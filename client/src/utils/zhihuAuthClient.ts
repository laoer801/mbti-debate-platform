// v40.6 知乎账号绑定 / 登录 / 同步收藏 API 客户端
import { API } from '../hooks/useAuth'

export interface ZhihuBinding {
  bound: boolean
  zhihuUserId?: string
  zhihuUsername?: string
  zhihuAvatar?: string
  status?: 'active' | 'expired' | 'revoked'
  boundAt?: number
  lastUsedAt?: number | null
  lastVerifyAt?: number | null
}

export interface ZhihuFavlist {
  id: number
  title: string
  description: string
  is_public: boolean
  item_count: number
}

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

export async function getZhihuBinding(token: string | null): Promise<ZhihuBinding> {
  const r = await fetch(`${API}/zhihu-auth/me`, { headers: authHeaders(token) })
  if (!r.ok) throw new Error('查询绑定状态失败')
  const data = await r.json()
  return data.binding || { bound: false }
}

export async function bindZhihu(token: string | null, z_c0: string): Promise<ZhihuBinding> {
  const r = await fetch(`${API}/zhihu-auth/bind`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ z_c0 }),
  })
  if (!r.ok) {
    const e = await r.json()
    throw new Error(e.error || '绑定失败')
  }
  const data = await r.json()
  return data.binding
}

export async function unbindZhihu(token: string | null): Promise<void> {
  const r = await fetch(`${API}/zhihu-auth/bind`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!r.ok) {
    const e = await r.json()
    throw new Error(e.error || '解绑失败')
  }
}

export async function listZhihuFavlists(token: string | null): Promise<ZhihuFavlist[]> {
  const r = await fetch(`${API}/zhihu-auth/favlists`, { headers: authHeaders(token) })
  if (!r.ok) {
    const e = await r.json()
    throw new Error(e.error || '拉取收藏夹失败')
  }
  const data = await r.json()
  return data.favlists || []
}

export async function createZhihuFavlist(
  token: string | null,
  payload: { title: string; description?: string; is_public?: boolean }
): Promise<{ id: number; title: string }> {
  const r = await fetch(`${API}/zhihu-auth/favlists`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const e = await r.json()
    throw new Error(e.error || '创建收藏夹失败')
  }
  const data = await r.json()
  return data.favlist
}

export interface SyncItem {
  content_type: 'answer' | 'article' | 'question'
  content_id: string | number
}

export interface SyncResult {
  ok: boolean
  summary: { total: number; success: number; failed: number; skipped: number }
  results: Array<SyncItem & { status: 'success' | 'failed' | 'skipped'; message?: string }>
}

export async function syncToZhihu(
  token: string | null,
  target_favlist_id: number,
  items: SyncItem[]
): Promise<SyncResult> {
  const r = await fetch(`${API}/zhihu-auth/sync`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ target_favlist_id, items }),
  })
  if (!r.ok) {
    const e = await r.json()
    throw new Error(e.error || '同步失败')
  }
  return r.json()
}