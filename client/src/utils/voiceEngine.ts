/**
 * voiceEngine.ts — DebateSphere 语音引擎抽象层
 * -------------------------------------------------
 * 定义统一的 VoiceEngine 接口，让上层（辩论室 / 设置页）不关心底层
 * 是"免费浏览器 TTS"还是"云端实时语音 API"。
 *
 * 引擎注册表：
 *   - web-speech     ：Web Speech API（免费、零部署、立即可用）✅ 已实现
 *   - cloud-realtime ：云端端到端实时语音（Qwen-Audio-Realtime /
 *                      MiniMax Speech / OpenAI Realtime）🔜 预留
 *
 * 切换引擎只需调用 setVoiceEngine('cloud-realtime')，业务代码零改动。
 */

import { speechService, type SpeakOptions, type SpeechMood } from './speechService'

// ─────────────────────────────────────────────────────────────
// 1. 引擎接口
// ─────────────────────────────────────────────────────────────

export interface VoiceEngine {
  /** 引擎标识（注册表 key） */
  readonly id: string
  /** 展示名 */
  readonly name: string
  /** 是否可用 */
  readonly supported: boolean
  /** 语音播报总开关（持久化） */
  readonly enabled: boolean
  setEnabled(v: boolean): void
  /** 朗读一段文本（AI 辩手发言） */
  speak(text: string, opts?: SpeakOptions): void
  /** 停止所有朗读 */
  cancel(): void
  /** 是否正在朗读 */
  readonly speaking: boolean
}

// ─────────────────────────────────────────────────────────────
// 2. Web Speech 引擎（免费档，当前默认）
// ─────────────────────────────────────────────────────────────

export class WebSpeechVoiceEngine implements VoiceEngine {
  readonly id = 'web-speech'
  readonly name = '浏览器语音（免费）'

  get supported(): boolean {
    return speechService.supported
  }

  get enabled(): boolean {
    return speechService.enabled
  }

  setEnabled(v: boolean): void {
    speechService.setEnabled(v)
  }

  speak(text: string, opts?: SpeakOptions): void {
    speechService.speak(text, opts)
  }

  cancel(): void {
    speechService.cancel()
  }

  get speaking(): boolean {
    return speechService.speaking
  }
}

// ─────────────────────────────────────────────────────────────
// 3. 云端实时语音引擎（预留占位）
// ─────────────────────────────────────────────────────────────
// TODO: 接入云端实时语音（终极形态"听懂-思考-说话"全双工）。
// 候选：
//   - 阿里 Qwen-Audio-3.0-Realtime（WebSocket 流式，支持动态语气）
//   - MiniMax Speech-02 / 2.6（首包延迟 <250ms，支持全语音克隆）
//   - OpenAI gpt-realtime（声音几乎与真人无异，需 WebRTC）
//   - 字节 Seed-RealTime-Voice（端到端，语气情绪逼近真人）
// 接入步骤：
//   1. 后端 server/ 新增 /api/voice 代理路由（转发流式请求，隐藏 API Key）
//   2. 本类实现 speak()/listen() 走 WebSocket 全双工
//   3. 音色克隆：可加载 16 人格各 5 秒参考音频 → 人格音色更真实

export class CloudRealtimeVoiceEngine implements VoiceEngine {
  readonly id = 'cloud-realtime'
  readonly name = '云端实时语音（需 API Key）'

  private _enabled = false

  get supported(): boolean {
    // TODO: 检测后端 /api/voice 是否已配置可用
    return false
  }

  get enabled(): boolean {
    return this._enabled
  }

  setEnabled(v: boolean): void {
    this._enabled = v
    // TODO: 接入后持久化并校验 API Key
  }

  speak(_text: string, _opts?: SpeakOptions): void {
    // TODO: WebSocket 流式合成，服务端转发云端 API
  }

  cancel(): void {
    // TODO: 关闭流
  }

  get speaking(): boolean {
    return false
  }
}

// ─────────────────────────────────────────────────────────────
// 4. 引擎注册表与工厂
// ─────────────────────────────────────────────────────────────

export const voiceEngines: Record<string, VoiceEngine> = {
  'web-speech': new WebSpeechVoiceEngine(),
  'cloud-realtime': new CloudRealtimeVoiceEngine(),
}

let currentEngineId = 'web-speech'

/** 获取当前引擎 */
export function getVoiceEngine(): VoiceEngine {
  return voiceEngines[currentEngineId]
}

/** 切换语音引擎（web-speech | cloud-realtime） */
export function setVoiceEngine(id: string): void {
  if (voiceEngines[id]) {
    voiceEngines[currentEngineId]?.cancel()
    currentEngineId = id
  }
}

/** 当前引擎 id */
export function getVoiceEngineId(): string {
  return currentEngineId
}

// ─────────────────────────────────────────────────────────────
// 5. 便捷导出（业务代码直接用）
// ─────────────────────────────────────────────────────────────

/** 朗读 AI 辩手发言：typeId=人格，mood 自动推断，interrupt 打断当前 */
export function speakAiMessage(typeId: string, text: string, interrupt = true): void {
  getVoiceEngine().speak(text, { typeId, interrupt })
}

/** 语音播报总开关 */
export function setAiVoiceEnabled(v: boolean): void {
  getVoiceEngine().setEnabled(v)
}

/** 语音播报是否开启 */
export function isAiVoiceEnabled(): boolean {
  return getVoiceEngine().enabled
}

/** 朗读单条消息（点击消息朗读，排队模式） */
export function speakMessageOnce(typeId: string, text: string): void {
  getVoiceEngine().speak(text, { typeId, interrupt: false })
}

// 类型再导出，供上层使用
export type { SpeakOptions, SpeechMood }
