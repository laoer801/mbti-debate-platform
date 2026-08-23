/**
 * 人格持久记忆（v31）
 *
 * 借鉴 Soul OS「身份与记忆的伴生服务」与 GensokyoAI「两层记忆」：
 * 每个 AI 人格拥有独立的长期记忆库（浏览器本地持久化），跨会话延续——
 * 下次见面时 TA 还记得你上次聊过什么、你喜欢什么、你们走到哪一步。
 *
 * 设计原则：
 *  - 按人格隔离存储，互不串味
 *  - 记忆提取采用启发式规则（本地确定性，不额外消耗 LLM）
 *  - 记忆条数超限自动摘要沉淀（保留最新细节 + 按类型聚合）
 *  - 所有读写 try/catch，node 测试环境自动兜底
 */

export type MemoryKind = 'fact' | 'preference' | 'event' | 'relationship'

export const MEMORY_KIND_LABELS: Record<MemoryKind, string> = {
  fact: '事实',
  preference: '偏好',
  event: '经历',
  relationship: '关系',
}

export interface MemoryEntry {
  id: string
  typeId: string
  text: string
  kind: MemoryKind
  ts: number
}

export interface PersonaMemory {
  typeId: string
  entries: MemoryEntry[]
  /** 自动沉淀的长期摘要（跨会话注入用） */
  summary: string
  updatedAt: number
}

/** 单人格记忆上限：超过后触发摘要沉淀 */
export const MEMORY_LIMIT = 8

/* ======================== 记忆提取（启发式） ======================== */

const PREFERENCE_PATTERNS = [
  '我喜欢', '我不喜欢', '我最喜欢', '我最讨厌', '我讨厌', '我特别爱', '我超爱',
  '我爱吃', '我不爱吃', '我很喜欢', '我不太喜欢', '我比较喜欢', '我欣赏', '我反感',
  '我享受', '我偏爱', '我的口味',
]
const EVENT_PATTERNS = [
  '我最近', '我今天', '我昨天', '我上周', '我一直', '我其实', '我刚刚', '我明天',
  '我下周', '我正在', '我打算', '我想去', '我去过', '我做了', '我遇到', '我发生',
  '我考了', '我面试', '我辞职', '我搬家', '我养了', '我的工作', '我的生活', '我的状态',
]
const RELATIONSHIP_PATTERNS = [
  '告诉你', '只有你', '你是第一个', '你是唯一', '我第一次对别人', '我从来没对别人',
  '我们之间', '有你在', '认识你', '遇到你', '和你聊', '跟你聊',
]

/** 按标点拆句（中文标点 + 换行） */
export function splitSentences(text: string): string[] {
  if (!text) return []
  return text
    .split(/[。！？!?；;\n]+/)
    .map(s => s.trim())
    .filter(s => s.length >= 2)
}

/** 从用户消息中提取值得记住的记忆候选（本地启发式，无 LLM 消耗） */
export function extractMemoryCandidates(userText: string): { text: string; kind: MemoryKind }[] {
  const candidates: { text: string; kind: MemoryKind }[] = []
  const sentences = splitSentences(userText)

  for (const sentence of sentences) {
    // 偏好：明确喜恶 → 整句保留（含主语的偏好更值得记住）
    for (const p of PREFERENCE_PATTERNS) {
      if (sentence.includes(p)) {
        candidates.push({ text: sentence, kind: 'preference' })
        break
      }
    }
    // 关系类信号
    if (RELATIONSHIP_PATTERNS.some(p => sentence.includes(p))) {
      candidates.push({ text: sentence, kind: 'relationship' })
      continue
    }
    // 经历类信号
    if (EVENT_PATTERNS.some(p => sentence.includes(p))) {
      candidates.push({ text: sentence, kind: 'event' })
      continue
    }
  }

  // 去重（同一句话可能命中多种模式）
  const seen = new Set<string>()
  return candidates.filter(c => {
    if (seen.has(c.text)) return false
    seen.add(c.text)
    return true
  }).slice(0, 3) // 每轮最多存 3 条，防止垃圾记忆
}

/* ======================== 记忆库操作 ======================== */

export function createEmptyMemory(typeId: string): PersonaMemory {
  return { typeId, entries: [], summary: '', updatedAt: Date.now() }
}

/** 追加一条记忆；超过上限时自动摘要沉淀（保留最近 3 条细节） */
export function addMemory(mem: PersonaMemory, text: string, kind: MemoryKind): PersonaMemory {
  const entry: MemoryEntry = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    typeId: mem.typeId,
    text: text.length > 60 ? text.slice(0, 60) + '…' : text,
    kind,
    ts: Date.now(),
  }
  let entries = [...mem.entries, entry]
  let summary = mem.summary
  if (entries.length > MEMORY_LIMIT) {
    const kept = entries.slice(-3)
    summary = summarizeEntries(entries)
    entries = kept
  }
  return { typeId: mem.typeId, entries, summary, updatedAt: Date.now() }
}

/** 按类型聚合摘要（本地规则：各类各取最新一条） */
export function summarizeEntries(entries: MemoryEntry[]): string {
  const kinds: MemoryKind[] = ['fact', 'preference', 'event', 'relationship']
  const parts: string[] = []
  for (const kind of kinds) {
    const latest = entries.filter(e => e.kind === kind).slice(-1)[0]
    if (latest) parts.push(`${MEMORY_KIND_LABELS[kind]}：${latest.text}`)
  }
  return parts.join('；')
}

/** 将记忆库渲染为注入提示词的「记忆关联」段 */
export function buildMemorySection(mem: PersonaMemory | null): string {
  if (!mem) return ''
  const parts: string[] = []
  if (mem.summary) parts.push(`- 长期印象：${mem.summary}`)
  const recent = mem.entries.slice(-3)
  for (const e of recent) {
    parts.push(`- ${MEMORY_KIND_LABELS[e.kind]}：${e.text}`)
  }
  if (parts.length === 0) return ''
  return `## 你对 TA 的记忆（跨会话延续，自然流露，不要生硬背诵）
${parts.join('\n')}

这些是你与 TA 之间真实的过往。合适的时刻可以自然提及——比如用「上次你说…」来承接话题，而不是突然背诵履历。`
}

/* ======================== 持久化 ======================== */

const MEMORY_PREFIX = 'ds_persona_memory_'

export function loadPersonaMemory(typeId: string): PersonaMemory | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(MEMORY_PREFIX + typeId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersonaMemory
    if (parsed.typeId !== typeId) return null
    return parsed
  } catch {
    return null
  }
}

export function savePersonaMemory(mem: PersonaMemory): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(MEMORY_PREFIX + mem.typeId, JSON.stringify(mem))
  } catch { /* 静默失败 */ }
}

export function clearPersonaMemory(typeId: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(MEMORY_PREFIX + typeId)
  } catch { /* 忽略 */ }
}

export function getOrInitMemory(typeId: string): PersonaMemory {
  return loadPersonaMemory(typeId) ?? createEmptyMemory(typeId)
}
