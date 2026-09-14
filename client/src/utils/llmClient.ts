/**
 * LLM 客户端（v40+：支持 5 家服务商 + 直答代理）
 *
 * 支持任意 OpenAI 兼容的 /chat/completions 端点：
 *   - DeepSeek      https://api.deepseek.com
 *   - OpenAI        https://api.openai.com/v1
 *   - 通义千问       https://dashscope.aliyuncs.com/compatible-mode/v1
 *   - 硅基流动       https://api.siliconflow.cn/v1
 *   - 知乎直答       ★ v40+：走服务端 /api/zhihu/chat（不需要 baseURL/apiKey，secret 在服务端）
 *   - 自定义        任意 baseURL
 *
 * 配置持久化在 localStorage（key: ds_llm_config），v25「顶尖辩手模式」使用。
 */

import { API_BASE } from '../config'

export interface LLMConfig {
  provider: 'openai-compatible' | 'zhihu'
  baseURL: string
  apiKey: string
  model: string
  /** 知乎直答模型档（fast/thinking/agent） */
  zhihuModel?: 'fast' | 'thinking' | 'agent'
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOpts {
  temperature?: number
  maxTokens?: number
  json?: boolean
  timeoutMs?: number
}

const STORAGE_KEY = 'ds_llm_config'

/** 预设服务商 */
export const LLM_PROVIDERS: { id: string; name: string; baseURL?: string; model: string }[] = [
  { id: 'zhihu', name: '⭐ 知乎直答（免配置）', model: 'thinking' },
  { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'qwen', name: '通义千问', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'siliconflow', name: '硅基流动', baseURL: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3' },
  { id: 'custom', name: '自定义 OpenAI 兼容', baseURL: '', model: '' },
]

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'openai-compatible',
  baseURL: LLM_PROVIDERS[1].baseURL!, // deepseek
  apiKey: '',
  model: LLM_PROVIDERS[1].model,
  zhihuModel: 'thinking',
}

export function getLLMConfig(): LLMConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_CONFIG }
}

export function setLLMConfig(cfg: Partial<LLMConfig>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...getLLMConfig(), ...cfg }))
  } catch {
    /* ignore */
  }
}

/** 是否已配置可用 */
export function isLLMConfigured(): boolean {
  const cfg = getLLMConfig()
  if (cfg.provider === 'zhihu') return true  // 知乎直答不需要客户端 key
  return Boolean(cfg.baseURL && cfg.apiKey && cfg.model)
}

/**
 * v40.5.5「都接 AI，不要本地」：是否有任一 AI 通道可尝试。
 * openai 直连失败会自动切「知乎直答」（chatCompletion 内部），
 * 因此只要不是完全空配置就允许走 AI 通道；真正不可用时由调用方提示。
 */
export function hasAnyAIChannel(): boolean {
  const cfg = getLLMConfig()
  if (cfg.provider === 'zhihu') return true
  if (cfg.zhihuModel) return true // 有知乎直答兜底通道（服务端 secret 已配则由服务端裁决）
  return Boolean(cfg.baseURL && cfg.model) // 至少填了模型地址，失败也会自动切/报错而非落本地
}

/**
 * 调用 LLM，返回 assistant 文本。
 *
 * 智能多通道（v40.5.5「都接 AI，不要本地」）：
 *  1. provider === 'zhihu'：直接走服务端 /api/zhihu/chat 代理（secret 在服务端）
 *  2. 其他（openai-compatible）：直连主通道；失败后自动切知乎直答重试一次
 *     ——保证只要有任一 AI 通道可用，发言/审题/裁判绝不掉进本地模板
 */
export async function chatCompletion(
  messages: LLMMessage[],
  opts?: ChatOpts
): Promise<string> {
  const cfg = getLLMConfig()

  // 知乎直答走服务端代理（主通道）
  if (cfg.provider === 'zhihu') {
    return chatViaZhihu(messages, cfg, opts)
  }

  // openai-compatible 主通道
  try {
    return await chatViaOpenAICompatible(messages, cfg, opts)
  } catch (primaryErr) {
    // 主通道失败 → 知乎直答兜底（只要配置了 zhihuModel 就尝试）
    if (!cfg.zhihuModel) throw primaryErr
    console.warn('[LLM] openai-compatible 失败，自动切「知乎直答」:', (primaryErr as Error).message)
    try {
      return await chatViaZhihu(messages, cfg, opts)
    } catch (zhErr) {
      throw new Error(
        `AI 通道均不可用（直连: ${(primaryErr as Error).message}；知乎直答: ${(zhErr as Error).message}）`
      )
    }
  }
}

/** OpenAI 兼容协议直连 */
async function chatViaOpenAICompatible(messages: LLMMessage[], cfg: LLMConfig, opts?: ChatOpts): Promise<string> {
  if (!cfg.baseURL || !cfg.apiKey || !cfg.model) {
    throw new Error('LLM 未配置：请在设置页填写 API Key，或切到「知乎直答」模式')
  }
  const url = cfg.baseURL.replace(/\/+$/, '') + '/chat/completions'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 60000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: opts?.temperature ?? 0.8,
        max_tokens: opts?.maxTokens ?? 800,
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`LLM API ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('LLM 返回空内容')
    }
    return text.trim()
  } finally {
    clearTimeout(timer)
  }
}

/** 知乎直答调用（走服务端代理） */
async function chatViaZhihu(messages: LLMMessage[], cfg: LLMConfig, opts?: ChatOpts): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 60000)
  try {
    const res = await fetch(`${API_BASE}/api/zhihu/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.zhihuModel || 'thinking',
        messages,
        stream: false,
      }),
      signal: controller.signal,
    })

    if (res.status === 503) {
      throw new Error('知乎 API 未启用：请在服务端 .env 设置 ZHIHU_ACCESS_SECRET')
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `直答 API ${res.status}`)
    }

    const data = await res.json()
    const text = data?.content
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('直答返回空内容')
    }
    return text.trim()
  } finally {
    clearTimeout(timer)
  }
}

/** 一次性便捷调用：system + user 两段 */
export async function chatOnce(
  system: string,
  user: string,
  opts?: ChatOpts
): Promise<string> {
  return chatCompletion(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    opts
  )
}

// ============ 顶尖辩手模式（v25 多智能体结构化对抗） ============

const ARENA_MODE_KEY = 'ds_arena_mode'

/** 顶尖辩手模式开关（localStorage 持久化） */
export function getArenaMode(): boolean {
  try {
    return localStorage.getItem(ARENA_MODE_KEY) === '1'
  } catch {
    return false
  }
}

export function setArenaMode(v: boolean): void {
  try {
    localStorage.setItem(ARENA_MODE_KEY, v ? '1' : '0')
  } catch {
    /* ignore */
  }
}
