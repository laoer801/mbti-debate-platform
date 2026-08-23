/**
 * 学习系统存储 — 让人格"实时学习"
 *
 * 两大学习来源：
 *  1. 用户添加的书籍（知识库 → localStorage `mbti_user_books`）
 *  2. 历史辩论赛精华（sessions 持久化 → localStorage `mbti_debate_sessions`）
 *
 * 辩论引擎通过 getLearningMaterial() 拉取与当前话题最相关的内容，
 * 以自然口语的方式注入发言，实现"人格越辩越有料"。
 */

import { API_BASE } from '../config'

// ============ 类型 ============

export interface UserBook {
  id: string
  title: string
  author: string
  theme: string      // 主题标签，如 "哲学" "科技" "心理"
  accent: string     // 展示色
  notes: string      // 笔记 / 摘要
  quotes: string[]   // 观点片段（学习素材，辩论时可被引用）
  addedAt: number
}

export interface LearningSnippet {
  source: string    // 出处（书名 或 历史辩论话题）
  text: string      // 观点内容
  kind: 'book' | 'debate'
}

export interface LearningMaterial {
  snippets: LearningSnippet[]
}

// ============ 存储 key ============

const BOOKS_KEY = 'mbti_user_books'
const SESSIONS_KEY = 'mbti_debate_sessions'

// ============ 用户书籍 CRUD ============

export function getUserBooks(): UserBook[] {
  try {
    const raw = localStorage.getItem(BOOKS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveUserBooks(books: UserBook[]): void {
  try {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books.slice(0, 50)))
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('mbti:books-changed', { detail: books }))
      } catch { /* ignore */ }
    }
  } catch {
    // localStorage 满时静默失败
  }
}

export function addUserBook(book: Omit<UserBook, 'id' | 'addedAt'>): UserBook {
  const newBook: UserBook = {
    ...book,
    id: 'ub_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    addedAt: Date.now(),
  }
  const books = getUserBooks()
  books.unshift(newBook)
  saveUserBooks(books)
  return newBook
}

export function removeUserBook(id: string): void {
  saveUserBooks(getUserBooks().filter(b => b.id !== id))
}

// ============ 历史辩论赛学习 ============

export interface PersistedSession {
  id: string
  topic: string
  mode: string
  participants: string[]
  messages: {
    id?: string
    typeId: string
    typeName?: string
    typeEmoji?: string
    typeColor?: string
    content: string
    timestamp?: number
    isUser?: boolean
    isHighlight?: boolean
  }[]
  highlights?: string[]
  sceneId?: string
  createdAt: number
}

export function loadPersistedSessions(): PersistedSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function persistSessions(sessions: PersistedSession[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 30)))
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('mbti:sessions-changed', { detail: sessions }))
      } catch { /* ignore */ }
    }
  } catch {
    // 静默失败
  }
}

/**
 * 从历史辩论赛提取精华片段：
 *  - 优先取被高亮的消息
 *  - 其次取每个参与者较长的发言（>40 字，说明有实质内容）
 *  - 最多取 6 条，覆盖最近的几场
 */
function extractDebateSnippets(typeId: string): LearningSnippet[] {
  const sessions = loadPersistedSessions()
  if (sessions.length === 0) return []

  const snippets: LearningSnippet[] = []
  // 从最新会话往前取，最多看 6 场
  const recent = sessions.slice(0, 6)

  for (const s of recent) {
    if (s.topic === '' || s.messages.length === 0) continue
    // 该人格参与过的发言
    const mine = s.messages.filter(m => m.typeId === typeId && !m.isUser && m.content.length > 25)
    // 先取高亮，再取最长发言
    const pool = [
      ...mine.filter(m => m.isHighlight),
      ...[...mine].sort((a, b) => b.content.length - a.content.length),
    ]
    const seen = new Set<string>()
    for (const m of pool) {
      if (snippets.length >= 6) break
      if (seen.has(m.content)) continue
      seen.add(m.content)
      snippets.push({
        source: `上次那场关于「${s.topic}」的辩论`,
        text: m.content.length > 90 ? m.content.slice(0, 90) + '…' : m.content,
        kind: 'debate',
      })
    }
  }
  return snippets
}

// ============ 学习素材聚合 ============

/**
 * 拉取与当前话题最相关的学习素材
 *
 * @param typeId 人格类型
 * @param topic  当前辩论话题
 * @param max    最多返回几条（默认 3）
 */
export function getLearningMaterial(typeId: string, topic: string, max = 3): LearningMaterial {
  const books = getUserBooks()
  const bookSnippets: LearningSnippet[] = []
  for (const b of books) {
    for (const q of b.quotes) {
      if (!q.trim()) continue
      bookSnippets.push({
        source: `《${b.title}》`,
        text: q.trim(),
        kind: 'book',
      })
    }
  }

  const debateSnippets = extractDebateSnippets(typeId)
  const all = [...bookSnippets, ...debateSnippets]

  if (all.length === 0) return { snippets: [] }

  // 话题关键词相关度打分：命中 topic 关键词的优先
  const topicKeywords = topic
    .replace(/[？?！!。，,.、：:；;""''（）()]/g, ' ')
    .split(/\s+/)
    .filter(k => k.length >= 2)

  const scored = all.map(s => {
    let score = 0
    for (const kw of topicKeywords) {
      if (s.text.includes(kw)) score += 4
      if (s.source.includes(kw)) score += 2
    }
    // 稍微随机化，避免每次都取同一条
    score += Math.random() * 2
    return { s, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return { snippets: scored.slice(0, max).map(x => x.s) }
}

// ============ 便捷：某人格学过的书目 ============

export function getLearnedBookTitles(): string[] {
  return getUserBooks().map(b => b.title)
}

// ============ 云端同步（用户信息跟随账号） ============
// 登录后：书籍 + 历史辩论会话 按账号同步到服务器，跨设备/跨版本恢复

export async function fetchCloudBooks(token: string): Promise<UserBook[]> {
  const res = await fetch(`${API_BASE}/api/user/books`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('拉取云端书籍失败')
  const data = await res.json()
  return Array.isArray(data.books) ? data.books : []
}

export async function pushBooksToCloud(token: string, books?: UserBook[]): Promise<void> {
  const list = books ?? getUserBooks()
  const res = await fetch(`${API_BASE}/api/user/books`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ books: list }),
  })
  if (!res.ok) throw new Error('上传书籍失败')
}

export async function fetchCloudSessions(token: string): Promise<PersistedSession[]> {
  const res = await fetch(`${API_BASE}/api/user/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('拉取云端会话失败')
  const data = await res.json()
  return Array.isArray(data.sessions) ? data.sessions : []
}

export async function pushSessionsToCloud(token: string, sessions?: PersistedSession[]): Promise<void> {
  const list = sessions ?? loadPersistedSessions()
  const res = await fetch(`${API_BASE}/api/user/sessions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessions: list }),
  })
  if (!res.ok) throw new Error('上传会话失败')
}

/** 合并本地与云端书籍：按 id 去重，取 addedAt 较新者，按时间倒序 */
export function mergeCloudBooks(local: UserBook[], cloud: UserBook[]): UserBook[] {
  const map = new Map<string, UserBook>()
  for (const b of local) map.set(b.id, b)
  for (const b of cloud) {
    const existing = map.get(b.id)
    if (!existing || (b.addedAt || 0) > (existing.addedAt || 0)) map.set(b.id, b)
  }
  return [...map.values()].sort((a, b) => b.addedAt - a.addedAt)
}

/** 合并本地与云端会话：按 id 去重，取 createdAt 较新者，按时间倒序 */
export function mergeCloudSessions(local: PersistedSession[], cloud: PersistedSession[]): PersistedSession[] {
  const map = new Map<string, PersistedSession>()
  for (const s of local) map.set(s.id, s)
  for (const s of cloud) {
    const existing = map.get(s.id)
    if (!existing || (s.createdAt || 0) > (existing.createdAt || 0)) map.set(s.id, s)
  }
  return [...map.values()].sort((a, b) => b.createdAt - a.createdAt)
}
