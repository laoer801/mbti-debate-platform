/**
 * LLM 客户端（OpenAI 兼容协议）
 *
 * 支持任意 OpenAI 兼容的 /chat/completions 端点：
 *   - DeepSeek      https://api.deepseek.com
 *   - OpenAI        https://api.openai.com/v1
 *   - 通义千问       https://dashscope.aliyuncs.com/compatible-mode/v1
 *   - 硅基流动       https://api.siliconflow.cn/v1
 *   - 自定义        任意 baseURL
 *
 * 配置持久化在 localStorage（key: ds_llm_config），v25「顶尖辩手模式」使用。
 */

export interface LLMConfig {
  baseURL: string
  apiKey: string
  model: string
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

/** 预设服务商（v25） */
export const LLM_PROVIDERS: { id: string; name: string; baseURL: string; model: string }[] = [
  { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'qwen', name: '通义千问', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'siliconflow', name: '硅基流动', baseURL: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3' },
]

const DEFAULT_CONFIG: LLMConfig = {
  baseURL: LLM_PROVIDERS[0].baseURL,
  apiKey: '',
  model: LLM_PROVIDERS[0].model,
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

/** 是否已配置可用（有 baseURL + key + model） */
export function isLLMConfigured(): boolean {
  const cfg = getLLMConfig()
  return Boolean(cfg.baseURL && cfg.apiKey && cfg.model)
}

/**
 * 调用 chat/completions，返回 assistant 文本。
 * 失败时抛出带可读信息的 Error。
 */
export async function chatCompletion(
  messages: LLMMessage[],
  opts?: ChatOpts
): Promise<string> {
  const cfg = getLLMConfig()
  if (!isLLMConfigured()) {
    throw new Error('LLM 未配置：请在设置页填写 API Key')
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
