/**
 * speechService.ts — DebateSphere AI 辩手语音服务
 * -------------------------------------------------
 * 基于 Web Speech API (speechSynthesis) 的免费 TTS 引擎封装。
 *
 * 两大核心：
 * 1. 16 人格音色映射：按 MBTI 认知功能与典型表达风格，为每种人格
 *    配置 pitch（音高）/ rate（语速），让 INTJ 沉稳、ENFP 轻快……
 * 2. 情感语调：通过文本特征检测（反驳词 / 结论词 / 热情词）自动切换
 *    质疑 / 坚定 / 热情 / 平静 四种语调，模拟"有情绪地说服"。
 *
 * 设计为可插拔：speechService 只是"免费档"实现，上层通过
 * voiceEngine.ts 的抽象接口调用，未来可无缝切换到云端实时语音
 * （Qwen-Audio-Realtime / MiniMax Speech / OpenAI Realtime）。
 */

// ─────────────────────────────────────────────────────────────
// 1. 类型定义
// ─────────────────────────────────────────────────────────────

export type SpeechMood = 'calm' | 'firm' | 'skeptical' | 'warm' | 'energetic'

export interface PersonaVoice {
  typeId: string
  /** 音高：0.5（低沉）~ 2.0（尖细），基准 1.0 */
  pitch: number
  /** 语速：0.5（慢）~ 2.0（快），基准 1.0 */
  rate: number
  /** 音色气质描述（用于设置页展示） */
  desc: string
}

export interface SpeakOptions {
  /** MBTI 人格 id（如 'INTJ'），用于应用人格音色 */
  typeId?: string
  /** 情感语调，不传则自动从文本特征推断 */
  mood?: SpeechMood
  /** true = 打断当前朗读立即说（辩论室自动朗读场景）；false = 排队 */
  interrupt?: boolean
}

// ─────────────────────────────────────────────────────────────
// 2. 16 人格音色映射表
//    （基于认知功能组合：Ni/Ne/Si/Se × Ti/Te/Fi/Fe 的能量差异）
// ─────────────────────────────────────────────────────────────

const PITCH = 1.0 // 基准音高
const RATE = 1.0 // 基准语速

export const PERSONA_VOICES: Record<string, PersonaVoice> = {
  // ── NT 理性派 ──────────────────────────────────────────
  INTJ: { typeId: 'INTJ', pitch: 0.82, rate: 0.9, desc: '低沉冷静、笃定克制，像战略家在推演' },
  ENTJ: { typeId: 'ENTJ', pitch: 0.88, rate: 1.08, desc: '强势有力、斩钉截铁，天生的指挥者' },
  INTP: { typeId: 'INTP', pitch: 0.95, rate: 0.95, desc: '平缓分析、字句斟酌，像在做思维实验' },
  ENTP: { typeId: 'ENTP', pitch: 1.0, rate: 1.18, desc: '语速飞快、跳跃带刺，辩论场上最兴奋的那个' },
  // ── NF 理想派 ──────────────────────────────────────────
  INFJ: { typeId: 'INFJ', pitch: 0.92, rate: 0.85, desc: '温柔深沉、语重心长，带一点哲思' },
  ENFJ: { typeId: 'ENFJ', pitch: 1.05, rate: 1.0, desc: '温暖感召、富有感染力，像在演讲' },
  INFP: { typeId: 'INFP', pitch: 1.12, rate: 0.85, desc: '轻柔梦幻、欲言又止，声线偏软' },
  ENFP: { typeId: 'ENFP', pitch: 1.22, rate: 1.2, desc: '轻快明亮、元气满满，情绪写在声音里' },
  // ── SJ 守护派 ──────────────────────────────────────────
  ISTJ: { typeId: 'ISTJ', pitch: 0.9, rate: 0.85, desc: '一板一眼、稳重可靠，像宣读文件' },
  ESTJ: { typeId: 'ESTJ', pitch: 0.85, rate: 1.02, desc: '坚定果断、条理分明，不容置疑' },
  ISFJ: { typeId: 'ISFJ', pitch: 1.02, rate: 0.9, desc: '温和体贴、细声细气，照顾每个人的感受' },
  ESFJ: { typeId: 'ESFJ', pitch: 1.1, rate: 1.05, desc: '热络亲切、语气上扬，像邻家大姐' },
  // ── SP 行动派 ──────────────────────────────────────────
  ISTP: { typeId: 'ISTP', pitch: 0.95, rate: 0.9, desc: '冷静简短、惜字如金，直接给结论' },
  ESTP: { typeId: 'ESTP', pitch: 1.0, rate: 1.15, desc: '大胆明快、现场感强，爱用反问' },
  ISFP: { typeId: 'ISFP', pitch: 1.06, rate: 0.9, desc: '安静柔和、慢条斯理，声音里带着观察' },
  ESFP: { typeId: 'ESFP', pitch: 1.16, rate: 1.1, desc: '活泼外放、抑扬顿挫，表现力拉满' },
}

export const DEFAULT_VOICE: PersonaVoice = { typeId: '__default', pitch: PITCH, rate: RATE, desc: '自然中性' }

// ─────────────────────────────────────────────────────────────
// 3. 情感语调：文本特征 → 语调 → 声学参数微调
// ─────────────────────────────────────────────────────────────

interface MoodProfile {
  /** 相对人格基准的音高偏移 */
  pitchDelta: number
  /** 相对人格基准的语速偏移 */
  rateDelta: number
}

const MOOD_PROFILES: Record<SpeechMood, MoodProfile> = {
  calm: { pitchDelta: 0, rateDelta: 0 },
  firm: { pitchDelta: -0.04, rateDelta: -0.06 }, // 沉下来、放慢，一字一顿
  skeptical: { pitchDelta: 0.05, rateDelta: 0.08 }, // 扬起来、加快，带质问感
  warm: { pitchDelta: 0.04, rateDelta: -0.03 }, // 柔和上扬
  energetic: { pitchDelta: 0.1, rateDelta: 0.14 }, // 情绪饱满、语速飞起
}

// 文本特征 → 情感语调用例（含中文口语特征词）
const MOOD_PATTERNS: { mood: SpeechMood; patterns: RegExp[] }[] = [
  {
    mood: 'skeptical',
    patterns: [
      /不(同意|成立|认可|是)|站不住|有漏洞|混淆|偷换概念|以偏概全|你刚(才)?说|反驳|质疑|凭什么|证据(呢|在哪)|请问/,
    ],
  },
  {
    mood: 'firm',
    patterns: [
      /所以|结论|推下去|只有一种|除非|无论如何|事实(是|就是)|必须|必然|最终|说到底|核心是|关键在于/,
    ],
  },
  {
    mood: 'energetic',
    patterns: [
      /太(棒|好|赞)|绝了|有意思|哈哈|精彩|漂亮|完美|燃|爽|厉害了|哇/,
    ],
  },
  {
    mood: 'warm',
    patterns: [
      /我(很|非常)?(理解|懂|尊重)|我明白|谢谢你|辛苦|没关系|别担心|加油|共情|我懂你/,
    ],
  },
]

/** 从文本自动推断情感语调（无匹配 → calm） */
export function inferMood(text: string): SpeechMood {
  for (const { mood, patterns } of MOOD_PATTERNS) {
    for (const re of patterns) {
      if (re.test(text)) return mood
    }
  }
  return 'calm'
}

// ─────────────────────────────────────────────────────────────
// 4. 中文语音选择（优先本地语音，其次在线中文语音）
// ─────────────────────────────────────────────────────────────

let cachedVoices: SpeechSynthesisVoice[] = []
let voicesLoaded = false

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  const vs = window.speechSynthesis.getVoices()
  if (vs.length > 0) {
    cachedVoices = vs
    voicesLoaded = true
  }
  return cachedVoices
}

/** 等待语音列表加载（Chrome/Android 首次异步） */
function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    if (voicesLoaded && cachedVoices.length > 0) return resolve(cachedVoices)
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve([])
    loadVoices()
    if (cachedVoices.length > 0) return resolve(cachedVoices)
    // voiceschanged 事件（Chrome/Edge/Android WebView）
    const timer = window.setTimeout(() => resolve(loadVoices()), 800)
    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timer)
      resolve(loadVoices())
    }
  })
}

/** 挑选最合适的中文语音：本地中文 > 在线中文 > 任意中文 > 默认 */
export async function pickChineseVoice(): Promise<SpeechSynthesisVoice | null> {
  const voices = await ensureVoicesLoaded()
  if (voices.length === 0) return null
  const zh = voices.filter(v => /^zh[-_]?(CN|Hans|TW|HK)?/i.test(v.lang) || /Chinese/i.test(v.name))
  const local = zh.find(v => v.localService)
  const online = zh.find(v => !v.localService)
  return local || online || zh[0] || null
}

// ─────────────────────────────────────────────────────────────
// 5. 长文本切分（规避 Chrome 朗读长文本自动中断的 bug）
// ─────────────────────────────────────────────────────────────

/** 按句末标点切分文本，每段上限 ~120 字 */
export function splitSentences(text: string): string[] {
  const cleaned = text.trim().replace(/\s+/g, ' ').replace(/[“”]/g, '')
  if (!cleaned) return []
  // 先按句末标点切，再对超长段按逗号兜底切
  const parts = cleaned.match(/[^。！？!?]+[。！？!?]?/g) || [cleaned]
  const out: string[] = []
  for (let part of parts) {
    part = part.trim()
    if (!part) continue
    if (part.length <= 120) {
      out.push(part)
    } else {
      // 超长段：按逗号/分号二次切分
      const sub = part.match(/[^，,；;]+[，,；;]?/g) || [part]
      for (let s of sub) {
        s = s.trim()
        if (s) out.push(s)
      }
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────
// 6. 语音服务主体
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ds_ai_voice_enabled'

class SpeechService {
  private _enabled = false
  private queue: SpeechSynthesisUtterance[] = []
  private activeVoice: SpeechSynthesisVoice | null = null
  private voiceReady: Promise<SpeechSynthesisVoice | null> | null = null

  constructor() {
    // 从 localStorage 恢复开关（浏览器环境）
    if (typeof window !== 'undefined') {
      try {
        this._enabled = localStorage.getItem(STORAGE_KEY) === '1'
      } catch {
        this._enabled = false
      }
    }
  }

  /** 浏览器是否支持 TTS */
  get supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  get enabled(): boolean {
    return this._enabled
  }

  /** 开启/关闭 AI 语音播报（持久化） */
  setEnabled(v: boolean): void {
    this._enabled = v
    if (!v) this.cancel()
    try {
      localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  /** 取消所有朗读（含队列） */
  cancel(): void {
    if (!this.supported) return
    window.speechSynthesis.cancel()
    this.queue = []
  }

  /** 会话中最后一次朗读是否正在进行 */
  get speaking(): boolean {
    return this.supported && window.speechSynthesis.speaking
  }

  /**
   * 朗读一段话（AI 辩手发言）
   * @param text 要朗读的文本
   * @param opts typeId=人格音色；mood=情感（默认自动推断）；interrupt=打断当前
   */
  speak(text: string, opts: SpeakOptions = {}): void {
    if (!this.supported || !this._enabled) return
    const t = (text || '').trim()
    if (!t) return

    const persona = (opts.typeId && PERSONA_VOICES[opts.typeId]) || DEFAULT_VOICE
    const mood = opts.mood || inferMood(t)
    const moodProfile = MOOD_PROFILES[mood]

    const pitch = Math.min(2, Math.max(0.5, persona.pitch + moodProfile.pitchDelta))
    const rate = Math.min(2, Math.max(0.5, persona.rate + moodProfile.rateDelta))

    if (opts.interrupt) this.cancel()

    const sentences = splitSentences(t)
    // 先保证语音引擎已初始化（选择中文语音）
    if (!this.voiceReady) {
      this.voiceReady = pickChineseVoice().then(v => (this.activeVoice = v))
    }
    this.voiceReady.then(() => {
      for (const s of sentences) {
        const u = new SpeechSynthesisUtterance(s)
        if (this.activeVoice) u.voice = this.activeVoice
        u.lang = this.activeVoice?.lang || 'zh-CN'
        u.pitch = pitch
        u.rate = rate
        u.volume = 1
        this.queue.push(u)
        window.speechSynthesis.speak(u)
      }
    })
  }
}

/** 全局单例 */
export const speechService = new SpeechService()

/** 获取某人格的音色配置（供设置页展示） */
export function getPersonaVoice(typeId: string): PersonaVoice {
  return PERSONA_VOICES[typeId] || DEFAULT_VOICE
}
