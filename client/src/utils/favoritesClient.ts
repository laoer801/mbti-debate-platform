// v40.7 思辩星球云端收藏夹 API 客户端
import { API } from '../hooks/useAuth'

export type FavoriteItemType = 'answer' | 'article' | 'question' | 'post'

export interface Favorite {
  id: string
  itemType: FavoriteItemType
  itemId: string
  title: string
  summary: string
  url: string
  source: 'zhihu' | 'local'
  thumbnail: string
  author: string
  tags: string[]
  notes: string
  addedAt: number
  updatedAt: number
}

function authHeaders(token: string | null): Record<string, string> {
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
}

export async function listFavorites(
  token: string | null,
  params: { type?: FavoriteItemType; tag?: string; q?: string; limit?: number } = {}
): Promise<Favorite[]> {
  const qs = new URLSearchParams()
  if (params.type) qs.set('type', params.type)
  if (params.tag) qs.set('tag', params.tag)
  if (params.q) qs.set('q', params.q)
  if (params.limit) qs.set('limit', String(params.limit))
  const r = await fetch(`${API}/favorites?${qs}`, { headers: authHeaders(token) })
  if (!r.ok) throw new Error('查询收藏失败')
  const data = await r.json()
  return data.favorites || []
}

export async function listFavoriteTags(token: string | null): Promise<{ name: string; count: number }[]> {
  const r = await fetch(`${API}/favorites/tags`, { headers: authHeaders(token) })
  if (!r.ok) return []
  const data = await r.json()
  return data.tags || []
}

export async function checkFavorite(
  token: string | null,
  type: FavoriteItemType,
  itemId: string
): Promise<{ favorited: boolean; favoriteId: string | null }> {
  const r = await fetch(`${API}/favorites/check?type=${encodeURIComponent(type)}&id=${encodeURIComponent(itemId)}`, {
    headers: authHeaders(token),
  })
  if (!r.ok) return { favorited: false, favoriteId: null }
  return r.json()
}

export interface AddFavoritePayload {
  item_type: FavoriteItemType
  item_id: string
  title: string
  summary?: string
  url?: string
  source?: 'zhihu' | 'local'
  thumbnail?: string
  author?: string
  tags?: string[]
  notes?: string
}

export async function addFavorite(token: string | null, payload: AddFavoritePayload): Promise<Favorite> {
  const r = await fetch(`${API}/favorites`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error(e.error || '收藏失败')
  }
  const data = await r.json()
  return data.favorite
}

export async function updateFavorite(
  token: string | null,
  id: string,
  patch: { notes?: string; tags?: string[]; title?: string; summary?: string }
): Promise<Favorite> {
  const r = await fetch(`${API}/favorites/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error(e.error || '更新失败')
  }
  const data = await r.json()
  return data.favorite
}

export async function removeFavorite(token: string | null, id: string): Promise<void> {
  const r = await fetch(`${API}/favorites/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error(e.error || '取消收藏失败')
  }
}

export interface SyncToZhihuResult {
  ok: boolean
  summary: { total: number; success: number; failed: number }
  results: Array<{ favId: string; title: string; status: 'success' | 'failed'; message?: string }>
}

export async function syncFavoritesToZhihu(
  token: string | null,
  favIds: string[],
  targetFavlistId: number
): Promise<SyncToZhihuResult> {
  const r = await fetch(`${API}/favorites/sync-to-zhihu`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ fav_ids: favIds, target_favlist_id: targetFavlistId }),
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error(e.error || '同步失败')
  }
  return r.json()
}