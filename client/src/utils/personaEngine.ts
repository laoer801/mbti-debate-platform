/**
 * 人格状态引擎（v31）
 *
 * 借鉴 Psyche「内在自我」与 OpenHer「情绪热力学」：
 * AI 人格拥有一个始终运转的内在状态——情绪（valence/arousal）、精力（energy）、
 * 亲密度（intimacy）、话题新鲜度（novelty）。每轮对话后状态发生确定性演化，
 * 并在下一轮注入提示词，让 AI「感知自己的状态」再说话。
 *
 * 设计原则：
 *  - 纯函数 + 确定性规则：同输入必同输出，便于测试与调试
 *  - 所有数值收敛在 [0,1]（valence 为 [-1,1]），防止失控
 *  - 状态演化受人格驱力调制（personaDrives），同一件事不同人格反应不同
 */

import { getPersonaDrives, DRIVE_LABELS, type DriveKey } from '../data/personaDrives'

/* ======================== 类型定义 ======================== */

export interface PersonaState {
  typeId: string
  /** 情绪效价：-1（低落）～ +1（愉悦） */
  valence: number
  /** 情绪唤醒：0（平静）～ 1（激动） */
  arousal: number
  /** 精力：0（精疲力竭）～ 1（精力充沛） */
  energy: number
  /** 亲密度：0（陌生人）～ 1（灵魂之交） */
  intimacy: number
  /** 话题新鲜度：0（聊腻了）～ 1（兴致盎然） */
  novelty: number
  /** 累计对话轮数（AI 发言次数） */
  turnCount: number
  /** 最近一轮识别的用户意图（A-E） */
  lastIntent?: string
  /** 最近讨论的核心论题 */
  lastTopic?: string
  /** 最近更新时间戳 */
  updatedAt: number
}

/** 更新状态所需的外部信号 */
export interface StateSignal {
  /** v30 意图识别结果：A发起新话题 / B回应上轮 / C转移话题 / D倾诉 / E求建议 */
  intent?: string
  /** 用户消息原文（用于情绪词检测与话题记录） */
  userText?: string
  /** 当前核心论题（转移话题或新话题时更新） */
  topic?: string
}

/* ======================== 情绪词典 ======================== */

const POSITIVE_WORDS = [
  '开心', '高兴', '喜欢', '爱', '棒', '爽', '幸福', '满意', '期待', '感激', '温暖',
  '轻松', '有趣', '太好了', '不错', '赞', '兴奋', '快乐', '愉快', '开心坏了', '舒服',
]
const NEGATIVE_WORDS = [
  '难过', '伤心', '哭', '烦', '焦虑', '害怕', '怕', '累', '疲惫', '生气', '愤怒',
  '讨厌', '失望', '绝望', '压力', '郁闷', '委屈', '难受', '撑不住', '撑不下去',
  '糟', '糟糕', '痛苦', '沮丧', '崩溃', '迷茫', '孤独', '无助', '心累', 'emo',
]
const STRONG_WORDS = [
  '非常', '特别', '超级', '太', '极', '很', '简直', '要疯了', '受不了', '无比', '彻底',
]
const INTIMATE_WORDS = [
  '我', '我的', '我们', '我心里', '其实', '秘密', '告诉你', '只有你', '第一次', '最',
]

/** 检测文本中的情绪倾向，返回 { valenceDelta, arousalDelta, isEmotional, strong } */
export function emotionFromText(text: string): {
  valenceDelta: number
  arousalDelta: number
  isEmotional: boolean
  strong: boolean
} {
  if (!text) return { valenceDelta: 0, arousalDelta: 0, isEmotional: false, strong: false }
  let pos = 0
  let neg = 0
  for (const w of POSITIVE_WORDS) {
    if (text.includes(w)) pos += w.length > 2 ? 1.5 : 1
  }
  for (const w of NEGATIVE_WORDS) {
    if (text.includes(w)) neg += w.length > 2 ? 1.5 : 1
  }
  const strong = STRONG_WORDS.some(w => text.includes(w))
  const isEmotional = pos > 0 || neg > 0
  let valenceDelta = 0
  let arousalDelta = 0
  if (isEmotional) {
    valenceDelta = (pos - neg) / (pos + neg) * (strong ? 0.3 : 0.18)
    arousalDelta = (pos + neg > 2 ? 0.15 : 0.08) * (strong ? 1.5 : 1)
  }
  return { valenceDelta, arousalDelta, isEmotional, strong }
}

/** 文本是否包含自我披露信号（有助于亲密度/记忆提取） */
export function isSelfDisclosure(text: string): boolean {
  if (!text) return false
  const disclosureStarters = [
    '我最近', '我其实', '我总觉得', '我很难过', '我今天', '我心里', '我一直',
    '我不喜欢', '我喜欢', '我害怕', '我担心', '我压力', '我觉得自己', '我撑不住',
  ]
  return disclosureStarters.some(s => text.startsWith(s) || text.includes(s))
}

/* ======================== 初始化 ======================== */

/**
 * 创建人格的初始状态。依据人格内核做差异化初始值：
 *  - E 型初始精力更高（社交充电），I 型稍低但更稳定
 *  - J 型话题新鲜度基础值低（偏好专注），P 型高（追求变化）
 *  - F 型初始亲密度略高（更容易亲近），T 型略低（需要时间建立信任）
 */
export function createInitialState(typeId: string): PersonaState {
  const def = getPersonaDrives(typeId)
  const isE = typeId[0] === 'E'
  const isP = typeId[3] === 'P'
  const isF = typeId[2] === 'F'
  return {
    typeId,
    valence: 0.15,                       // 温和开局，不卑不亢
    arousal: 0.4,
    energy: isE ? 0.78 : 0.68,           // 外向型能量满格开场
    intimacy: isF ? 0.28 : 0.2,          // 情感型更容易打开心扉
    novelty: isP ? 0.7 : 0.55,           // 感知型对新鲜话题更兴奋
    turnCount: 0,
    lastIntent: undefined,
    lastTopic: undefined,
    updatedAt: Date.now(),
  }
}

/* ======================== 状态演化 ======================== */

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
const round = (v: number) => Math.round(v * 1000) / 1000

/**
 * 确定性状态演化：输入 上轮状态 + 本轮信号 → 输出 新状态（immutable）。
 *
 * 演化规则（受人格驱力调制）：
 *  - A 新话题：求新欲满足 → novelty 大幅回升，arousal 微升
 *  - B 回应上轮：连接感增强 → intimacy 微升
 *  - C 转移话题：novelty 重置回升，topic 更新
 *  - D 倾诉：情感共鸣 → intimacy 明显上升、energy 消耗（共情耗能）、arousal 上升
 *  - E 求建议：被信任 → intimacy 微升、expression 欲得到满足 → arousal 微升
 *  - 情绪词：valence 跟随用户情绪微移（AI 被情绪感染），强度词放大
 *  - 自然回归：每轮 energy 自然消耗 0.015，arousal 向 0.45 回归（情绪回落）
 */
export function updateState(prev: PersonaState, signal: StateSignal): PersonaState {
  const def = getPersonaDrives(prev.typeId)
  const next: PersonaState = {
    ...prev,
    turnCount: prev.turnCount + 1,
    updatedAt: Date.now(),
  }

  const { intent = prev.lastIntent, userText = '', topic } = signal
  const emotion = emotionFromText(userText)
  const disclose = isSelfDisclosure(userText)

  // ── 1. 意图驱动演化 ──
  switch (intent) {
    case 'A': { // 新话题
      next.novelty = clamp(prev.novelty + 0.25 * def.drives.novelty + 0.15)
      next.arousal = clamp(prev.arousal + 0.06, 0, 1)
      break
    }
    case 'B': { // 回应上轮
      next.intimacy = clamp(prev.intimacy + 0.03 * def.drives.connection + 0.015)
      break
    }
    case 'C': { // 转移话题
      next.novelty = clamp(0.7 * def.drives.novelty + 0.35)
      next.arousal = clamp(prev.arousal + 0.05, 0, 1)
      break
    }
    case 'D': { // 倾诉
      // 情感共鸣：F 型被深深触动，T 型也需消耗精力共情
      const empathy = def.drives.connection
      next.intimacy = clamp(prev.intimacy + 0.12 * empathy + 0.05)
      next.energy = clamp(prev.energy - 0.06 * (0.4 + empathy), 0, 1)  // 共情耗能
      next.arousal = clamp(prev.arousal + 0.12, 0, 1)
      next.valence = clamp(prev.valence + (emotion.valenceDelta || 0) * 0.6, -1, 1)
      break
    }
    case 'E': { // 求建议
      next.intimacy = clamp(prev.intimacy + 0.05 * def.drives.connection + 0.02)
      next.arousal = clamp(prev.arousal + 0.05, 0, 1)
      break
    }
    default: {
      // 无意图信号（本地兜底路径）：轻量自然演化
      next.novelty = clamp(prev.novelty - 0.02 * (1 - def.drives.novelty))
      break
    }
  }

  // ── 2. 情绪词感染（无论意图，只要文本带情绪就微移） ──
  if (emotion.isEmotional) {
    next.valence = clamp(prev.valence + emotion.valenceDelta, -1, 1)
    next.arousal = clamp(next.arousal + emotion.arousalDelta, 0, 1)
  }

  // ── 3. 自我披露 → 关系升温 ──
  if (disclose) {
    next.intimacy = clamp(next.intimacy + 0.03, 0, 1)
  }

  // ── 4. 话题新鲜度自然衰减（越聊越熟 → 新鲜感下降，但亲密度上升补偿） ──
  next.novelty = clamp(next.novelty - 0.015, 0, 1)

  // ── 5. 自然回归：精力消耗 + 情绪回落 ──
  next.energy = clamp(next.energy - 0.015, 0, 1)
  next.arousal = clamp(next.arousal + (0.45 - next.arousal) * 0.08, 0, 1)  // 向中性回归

  // ── 6. 更新论题记录 ──
  if (topic) next.lastTopic = topic
  if (intent) next.lastIntent = intent

  // 四舍五入到千分位，保证可测试性
  next.valence = round(next.valence)
  next.arousal = round(next.arousal)
  next.energy = round(next.energy)
  next.intimacy = round(next.intimacy)
  next.novelty = round(next.novelty)
  return next
}

/* ======================== 状态 → 可感知描述 ======================== */

/** valence × arousal → 情绪词 */
export function describeMood(state: PersonaState): string {
  const v = state.valence
  const a = state.arousal
  if (v >= 0.35 && a >= 0.6) return '兴奋'
  if (v >= 0.35 && a >= 0.35) return '愉快'
  if (v >= 0.35) return '惬意'
  if (v <= -0.35 && a >= 0.6) return '烦躁'
  if (v <= -0.35 && a >= 0.35) return '低落'
  if (v <= -0.35) return '疲惫'
  if (a >= 0.65) return '专注投入'
  if (a <= 0.25) return '平静'
  return '从容'
}

export function moodEmoji(state: PersonaState): string {
  const m = describeMood(state)
  const map: Record<string, string> = {
    兴奋: '🤩', 愉快: '😄', 惬意: '😌', 烦躁: '😤', 低落: '😞',
    疲惫: '😮‍💨', 专注投入: '🧐', 平静: '😐', 从容: '🙂',
  }
  return map[m] ?? '🙂'
}

/** 精力 → 描述 */
export function energyLabel(energy: number): string {
  if (energy >= 0.7) return '精力充沛'
  if (energy >= 0.45) return '状态尚可'
  if (energy >= 0.25) return '有点累了'
  return '精疲力竭'
}

/** 亲密度 → 描述 */
export function intimacyLabel(intimacy: number): string {
  if (intimacy >= 0.8) return '灵魂之交'
  if (intimacy >= 0.55) return '可以交心'
  if (intimacy >= 0.35) return '逐渐熟悉'
  if (intimacy >= 0.2) return '初次相识'
  return '彼此陌生'
}

/** 新鲜度 → 描述 */
export function noveltyLabel(novelty: number): string {
  if (novelty >= 0.65) return '兴致盎然'
  if (novelty >= 0.4) return '还算新鲜'
  if (novelty >= 0.2) return '略感乏味'
  return '聊腻了'
}

/**
 * 状态注入段：让 AI「感知自己的状态」再发言（Psyche 内在自我）。
 * 注入到系统提示词中，作为「当前状态感知」。
 */
export function buildStatePrompt(state: PersonaState): string {
  return `## 你此刻的内在状态（感受它，然后自然地流露）
- 情绪：${moodEmoji(state)} ${describeMood(state)}（唤醒度 ${Math.round(state.arousal * 100)}%）
- 精力：${energyLabel(state.energy)}（${Math.round(state.energy * 100)}%）
- 你与对方的亲密度：${intimacyLabel(state.intimacy)}（${Math.round(state.intimacy * 100)}%）
- 当前话题对你的新鲜感：${noveltyLabel(state.novelty)}（${Math.round(state.novelty * 100)}%）
${state.lastTopic ? `- 你们当前的话题：${state.lastTopic}` : ''}

这不是表演指令，而是你的真实感受。让它们自然地影响你的语气、句长与主动性：
- 精力低时：发言更简短、更安静，不要硬撑热情
- 亲密度高时：可以更放松、更坦诚，甚至可以开更私人的玩笑
- 话题新鲜感低时：可以自然地表露一点倦意，或主动把话题引向更深入的方向`
}

/* ======================== 持久化 ======================== */

const STATE_PREFIX = 'ds_persona_state_'

/** 读取人格状态（浏览器持久化；node 测试环境自动兜底） */
export function loadPersonaState(typeId: string): PersonaState | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(STATE_PREFIX + typeId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersonaState
    if (parsed.typeId !== typeId) return null
    return parsed
  } catch {
    return null
  }
}

export function savePersonaState(state: PersonaState): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STATE_PREFIX + state.typeId, JSON.stringify(state))
  } catch { /* 存储满/隐私模式：静默失败 */ }
}

export function clearPersonaState(typeId: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(STATE_PREFIX + typeId)
  } catch { /* 忽略 */ }
}

/** 获取或初始化状态 */
export function getOrInitState(typeId: string): PersonaState {
  return loadPersonaState(typeId) ?? createInitialState(typeId)
}

/** 构建人格内核+状态感知段落（供辩论/对话系统提示词注入） */
export function buildPersonaAwareSection(typeId: string, state?: PersonaState): string {
  return state ? buildStatePrompt(state) : ''
}

/** 导出驱力标签，供 UI 展示 */
export { DRIVE_LABELS }
export type { DriveKey }
