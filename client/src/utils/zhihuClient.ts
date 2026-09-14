/**
 * v40+ 知乎 API 前端封装（统一通过服务端代理）
 *
 * 端点（后端代理路径）：
 *   GET    /api/zhihu/status                 是否启用 + 模型列表
 *   GET    /api/zhihu/search?q=&count=&filter=&db=
 *   POST   /api/zhihu/chat { model, messages, stream }
 *   GET    /api/zhihu/hotlist?limit=
 *
 * 设计思路：secret 永远留在服务端。前端只与自己的 /api/zhihu/* 路由对话。
 * 没启用时（HTTP 503）走 fallback，前端自动降级。
 */

import { useEffect, useState } from 'react'
import { API_BASE } from '../config'

const F = (p: string) => `${API_BASE}${p}`

async function jget(p: string) {
  const res = await fetch(F(p))
  if (res.status === 503) {
    throw new Error('知乎 API 未启用（请在服务端 .env 设置 ZHIHU_ACCESS_SECRET）')
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText)
  return res.json()
}

async function jpost(p: string, body: any) {
  const res = await fetch(F(p), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 503) {
    throw new Error('知乎 API 未启用（请在服务端 .env 设置 ZHIHU_ACCESS_SECRET）')
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText)
  return res.json()
}

// ============ 类型 ============

export type ZhihuModel = 'fast' | 'thinking' | 'agent'

export interface ZhihuStatus {
  enabled: boolean
  models: { fast: string; thinking: string; agent: string }
  rpmLimit: number
  endpoints: { search: string; chat: string; hotlist: string }
}

export interface ZhihuSearchItem {
  title: string
  contentType: string
  contentId: string
  snippet: string
  highlightHtml: string
  url: string
  commentCount: number
  voteUpCount: number
  authorName: string
  authorAvatar: string
  authorBadgeText: string
  authorityLevel: string
  editTime: number
  topComments: string[]
}

export interface ZhihuHotItem {
  title: string
  url: string
  thumbnailUrl: string
  summary: string
}

// ============ API ============

export async function getZhihuStatus(): Promise<ZhihuStatus> {
  return jget('/api/zhihu/status')
}

/** 全网搜索 */
export async function zhihuSearch(opts: {
  q: string
  count?: number
  filter?: string
  db?: 'all' | 'realtime' | 'static'
}): Promise<{ enabled: boolean; query: string; count: number; hasMore: boolean; items: ZhihuSearchItem[] }> {
  const params = new URLSearchParams()
  params.set('q', opts.q)
  if (opts.count) params.set('count', String(opts.count))
  if (opts.filter) params.set('filter', opts.filter)
  if (opts.db && opts.db !== 'all') params.set('db', opts.db)
  return jget(`/api/zhihu/search?${params.toString()}`)
}

/** 直答聊天（非流式） */
export async function zhihuChat(opts: {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  model?: ZhihuModel
}): Promise<{ id: string; content: string; reasoning: string; usage?: any }> {
  const data = await jpost('/api/zhihu/chat', { ...opts, stream: false })
  return {
    id: data.id,
    content: data.content,
    reasoning: data.reasoning,
    usage: data.usage,
  }
}

/** 直答聊天（流式 - 通过 EventSource 或 fetch stream） */
export async function zhihuChatStream(
  opts: {
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
    model?: ZhihuModel
  },
  onChunk: (delta: { content?: string; reasoning?: string }, full: string) => void
): Promise<string> {
  const res = await fetch(F('/api/zhihu/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...opts, stream: true }),
  })
  if (res.status === 503) throw new Error('知乎 API 未启用')
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText)
  if (!res.body) throw new Error('没有可读流')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') continue
      try {
        const json = JSON.parse(payload)
        const delta = json.choices?.[0]?.delta || {}
        const reasoning = delta.reasoning_content
        const content = delta.content
        if (content || reasoning) {
          if (content) fullContent += content
          onChunk({ content, reasoning }, fullContent)
        }
      } catch {
        // ignore malformed chunk
      }
    }
  }
  return fullContent
}

/** 热榜 */
export async function zhihuHotlist(limit = 30): Promise<{ total: number; items: ZhihuHotItem[] }> {
  return jget(`/api/zhihu/hotlist?limit=${limit}`)
}

// ============ Hook ============

// v40.5.1: status 模块级缓存（避免 ZhihuSourcesPanel 4 个 hook 各自触发 GET /api/zhihu/status）
let _statusCache: ZhihuStatus | null = null
let _statusCacheAt = 0
let _statusInflight: Promise<ZhihuStatus> | null = null

export function useZhihuStatus(): [ZhihuStatus | null, boolean] {
  const [status, setStatus] = useState<ZhihuStatus | null>(_statusCache)
  const [loading, setLoading] = useState(_statusCache === null)
  useEffect(() => {
    if (_statusCache && Date.now() - _statusCacheAt < 60_000) {
      setStatus(_statusCache)
      setLoading(false)
      return
    }
    if (_statusInflight) {
      _statusInflight.then(setStatus).catch(e => console.warn('zhihu status:', e.message))
      return
    }
    setLoading(true)
    _statusInflight = getZhihuStatus()
      .then(s => {
        _statusCache = s
        _statusCacheAt = Date.now()
        return s
      })
      .catch(e => {
        console.warn('zhihu status:', e.message)
        return { enabled: false } as ZhihuStatus
      })
      .finally(() => {
        _statusInflight = null
      })
    _statusInflight.then(setStatus).catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  return [status, loading]
}

export function useZhihuHotlist(limit = 30) {
  const [list, setList] = useState<ZhihuHotItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await zhihuHotlist(limit)
      setList(data.items)
    } catch (e: any) {
      setError(e.message)
      setList([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { refresh() }, [limit])
  return { list, loading, error, refresh }
}

export function useZhihuSearch(q: string, count = 10) {
  const [results, setResults] = useState<ZhihuSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!q || q.length < 2) {
      setResults([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    const t = setTimeout(async () => {
      try {
        const data = await zhihuSearch({ q, count })
        setResults(data.items)
      } catch (e: any) {
        setError(e.message)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300) // 简易防抖
    return () => clearTimeout(t)
  }, [q, count])

  return { results, loading, error }
}

// ===========================================================
// v40.5: 用户内容 / 收藏 / 收藏夹 → 喂给知识库
// ===========================================================

export interface ZhihuContentItem {
  contentType: string
  url: string
  title: string
  summary: string
  likeCount: number
  commentCount: number
  favoriteCount: number
  createdAt: number | null
  favTime?: number | null
  author?: { name: string; urlToken: string; url: string; headline: string } | null
  favlists?: { urlToken: number; title: string; url: string }[]
}

export interface ZhihuFavlist {
  urlToken: number
  title: string
  url: string
  description: string
  isPublic: boolean
}

export interface ZhihuPaging {
  IsEnd: boolean
  NextOffset?: string
  Totals: number
}

export interface FetchResp<T> {
  enabled: boolean
  source: string
  items: T[]
  paging: ZhihuPaging
}

/** 拉本人/被授权用户的内容（回答/文章/视频/想法/问题） */
export async function fetchUserContents(opts: { contentType?: string; limit?: number; offset?: number; sortField?: string; sortOrder?: string } = {}): Promise<FetchResp<ZhihuContentItem>> {
  const qs = new URLSearchParams()
  qs.set('contentType', opts.contentType ?? 'all')
  qs.set('limit', String(opts.limit ?? 20))
  qs.set('offset', String(opts.offset ?? 0))
  if (opts.sortField) qs.set('sortField', opts.sortField)
  if (opts.sortOrder) qs.set('sortOrder', opts.sortOrder)
  return jget(`/api/zhihu/user/contents?${qs.toString()}`)
}

/** 拉本人/被授权用户的收藏 */
export async function fetchUserCollections(limit = 30): Promise<FetchResp<ZhihuContentItem>> {
  return jget(`/api/zhihu/user/collections?limit=${limit}`)
}

/** 拉本人/被授权用户的收藏夹列表 */
export async function fetchUserFavlists(limit = 50): Promise<{ items: ZhihuFavlist[]; enabled: boolean }> {
  return jget(`/api/zhihu/user/favlists?limit=${limit}`)
}

/** 拉指定收藏夹的内容 */
export async function fetchFavlistContents(favlistUrlToken: number, opts: { limit?: number; offset?: number } = {}): Promise<FetchResp<ZhihuContentItem>> {
  const qs = new URLSearchParams()
  qs.set('favlistUrlToken', String(favlistUrlToken))
  qs.set('limit', String(opts.limit ?? 30))
  qs.set('offset', String(opts.offset ?? 0))
  return jget(`/api/zhihu/favlist-contents?${qs.toString()}`)
}

export interface KbUploadPayload {
  title: string
  text: string
  source_type: string
  external_url: string
  metadata: Record<string, any>
}

/** 把任意内容条目转成 cloudkb.upload 友好的 payload（前端预生成可批量 POST） */
export function toKbPayload(it: ZhihuContentItem, source: string): KbUploadPayload {
  const text = `${it.title}\n\n${it.summary || ''}\n\n来源：知乎 ${it.contentType || ''} · 点赞 ${it.likeCount} · 评论 ${it.commentCount} · 收藏 ${it.favoriteCount}\n链接：${it.url}`
  return {
    title: (it.title || '（无标题）').slice(0, 200),
    text,
    source_type: source,
    external_url: it.url,
    metadata: {
      contentType: it.contentType,
      likeCount: it.likeCount,
      commentCount: it.commentCount,
      favoriteCount: it.favoriteCount,
      author: it.author?.name || null,
      authorHeadline: it.author?.headline || null,
      favlists: (it.favlists || []).map(f => ({ title: f.title, url: f.url })),
      createdAt: it.createdAt,
    },
  }
}

/** 一键导入到云端知识库（前端循环调 /api/cloudkb/upload） */
export async function importItemsToKb(
  userId: string,
  items: ZhihuContentItem[],
  source: 'zhihu:user-contents' | 'zhihu:user-collections' | 'zhihu:favlist-contents' | 'zhihu:contents',
): Promise<{ ok: number; failed: number; errors: string[] }> {
  const ok = [] as string[]
  const failed = [] as string[]
  for (const it of items) {
    const payload = toKbPayload(it, source)
    try {
      const res = await fetch(F('/api/cloudkb/upload'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...payload }),
      })
      if (!res.ok) throw new Error(await res.text().catch(() => res.statusText))
      ok.push(it.url)
    } catch (e: any) {
      failed.push(`${it.url}: ${e.message || 'unknown'}`)
    }
  }
  return { ok: ok.length, failed: failed.length, errors: failed }
}

// ========== React Hooks（带 loading / error / 数据缓存 60s） ==========

/** 缓存拉用户内容（5 分钟内不重拉） */
const _userContentsCache = new Map<string, { at: number; data: FetchResp<ZhihuContentItem> }>()
export function useZhihuUserContents(contentType = 'all', limit = 20) {
  const [data, setData] = useState<FetchResp<ZhihuContentItem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enabled, statusLoading] = useZhihuStatus()
  useEffect(() => {
    // v40.5.1: status 未加载完成前不发起请求（避免 503 错误日志）
    if (statusLoading) {
      setLoading(true)
      setError(null)
      return
    }
    if (!enabled || enabled.enabled === false) {
      setData({ items: [], enabled: false } as any)
      setLoading(false)
      setError(null)
      return
    }
    const key = `${contentType}:${limit}`
    const cached = _userContentsCache.get(key)
    if (cached && Date.now() - cached.at < 5 * 60_000) {
      setData(cached.data)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchUserContents({ contentType, limit })
      .then(d => {
        if (cancelled) return
        _userContentsCache.set(key, { at: Date.now(), data: d })
        setData(d)
        setError(null)
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [contentType, limit, enabled?.enabled, statusLoading])
  return { data, loading, error, reload: () => _userContentsCache.delete(`${contentType}:${limit}`) }
}

export function useZhihuUserCollections(limit = 30) {
  const [data, setData] = useState<FetchResp<ZhihuContentItem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enabled, statusLoading] = useZhihuStatus()
  useEffect(() => {
    if (statusLoading) { setLoading(true); setError(null); return }
    if (!enabled || enabled.enabled === false) {
      setData({ items: [], enabled: false } as any)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchUserCollections(limit)
      .then(d => { if (!cancelled) { setData(d); setError(null) } })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [limit, enabled?.enabled, statusLoading])
  return { data, loading, error }
}

export function useZhihuFavlists(limit = 50) {
  const [data, setData] = useState<{ items: ZhihuFavlist[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enabled, statusLoading] = useZhihuStatus()
  useEffect(() => {
    if (statusLoading) { setLoading(true); setError(null); return }
    if (!enabled || enabled.enabled === false) {
      setData({ items: [] })
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchUserFavlists(limit)
    fetchUserFavlists(limit)
    fetchUserFavlists(limit)
      .then(d => { if (!cancelled) { setData(d); setError(null) } })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [limit, enabled?.enabled])
  return { data, loading, error }
}

export function useZhihuFavlistContents(favlistUrlToken: number | null, limit = 30) {
  const [data, setData] = useState<FetchResp<ZhihuContentItem> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enabled, statusLoading] = useZhihuStatus()
  useEffect(() => {
    if (statusLoading) { setLoading(true); setError(null); return }
    if (!enabled || enabled.enabled === false) {
      setData({ items: [], enabled: false } as any)
      setLoading(false)
      setError(null)
      return
    }
    if (!favlistUrlToken) return
    let cancelled = false
    setLoading(true)
    fetchFavlistContents(favlistUrlToken, { limit })
      .then(d => { if (!cancelled) { setData(d); setError(null) } })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [favlistUrlToken, limit, enabled?.enabled, statusLoading])
  return { data, loading, error }
}
