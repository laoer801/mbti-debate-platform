// 知乎用户级 API 客户端（v40.6）
// 用 z_c0 cookie 调知乎前端 API（不走知乎开放平台）
// 场景：绑定知乎账号（验证 cookie + 拿用户信息）/ 同步收藏到知乎收藏夹

const ZHIHU_BASE = 'https://www.zhihu.com'

// 模拟浏览器 UA，避免被知乎风控
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

// 限速：每个 z_c0 每秒最多 4 次，避免被知乎封
let _lastCallAt = 0
async function throttle() {
  const now = Date.now()
  const gap = 250 // 250ms 间隔
  const wait = _lastCallAt + gap - now
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  _lastCallAt = Date.now()
}

function buildHeaders(z_c0, extra = {}) {
  return {
    Cookie: `z_c0=${z_c0}`,
    'User-Agent': DEFAULT_UA,
    Referer: ZHIHU_BASE + '/',
    'x-requested-with': 'fetch',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    ...extra,
  }
}

/**
 * 调知乎 API
 */
async function callZhihu(z_c0, path, opts = {}) {
  if (!z_c0 || typeof z_c0 !== 'string') {
    throw new Error('z_c0 cookie 缺失')
  }
  await throttle()
  const url = path.startsWith('http') ? path : ZHIHU_BASE + path
  const headers = buildHeaders(z_c0, opts.headers)
  const init = {
    method: opts.method || 'GET',
    headers,
  }
  if (opts.body) {
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
    headers['Content-Type'] = 'application/json'
  }
  let resp
  try {
    resp = await fetch(url, init)
  } catch (e) {
    throw new Error('知乎网络请求失败：' + (e.message || e))
  }
  const text = await resp.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (resp.status === 401 || resp.status === 403) {
    const err = new Error('知乎 cookie 已失效或无权限（HTTP ' + resp.status + '）')
    err.code = 'ZHIHU_AUTH_INVALID'
    err.detail = data
    throw err
  }
  if (!resp.ok) {
    const err = new Error('知乎 API 返回 HTTP ' + resp.status)
    err.code = 'ZHIHU_API_ERROR'
    err.detail = data
    throw err
  }
  return data
}

/**
 * 验证 z_c0 cookie + 拉取知乎用户信息
 * @returns {Promise<{ id: string, url_token: string, name: string, avatar_url: string, headline?: string }>}
 */
export async function validateCookie(z_c0) {
  const me = await callZhihu(z_c0, '/api/v4/me', { method: 'GET' })
  if (!me || !me.id) {
    const err = new Error('知乎返回的用户数据无效')
    err.code = 'ZHIHU_ME_INVALID'
    throw err
  }
  return {
    id: String(me.id),
    url_token: me.url_token || me.urlToken || '',
    name: me.name || me.url_token || `zh_${me.id}`,
    avatar_url: me.avatar_url || me.avatarUrl || '',
    headline: me.headline || '',
  }
}

/**
 * 拉取知乎用户的收藏夹列表
 * @returns {Promise<Array<{ id: number, title: string, description: string, is_public: boolean, item_count: number }>>}
 */
export async function listFavlists(z_c0) {
  const data = await callZhihu(z_c0, '/api/v4/collections?limit=50', { method: 'GET' })
  if (!Array.isArray(data)) return []
  return data.map((c) => ({
    id: c.id,
    title: c.title || '(未命名收藏夹)',
    description: c.description || '',
    is_public: Boolean(c.is_public),
    item_count: c.item_count || 0,
  }))
}

/**
 * 创建收藏夹
 * @returns {Promise<{ id: number, title: string }>}
 */
export async function createFavlist(z_c0, { title, description = '', is_public = false }) {
  return callZhihu(z_c0, '/api/v4/collections', {
    method: 'POST',
    body: { title, description, is_public },
  })
}

/**
 * 把内容（答案/文章/问题）添加到收藏夹
 * @param {string} z_c0
 * @param {number} favlist_id
 * @param {'answer' | 'article' | 'question'} content_type
 * @param {string|number} content_id
 */
export async function addToFavlist(z_c0, favlist_id, content_type, content_id) {
  if (!['answer', 'article', 'question'].includes(content_type)) {
    throw new Error('content_type 仅支持 answer / article / question')
  }
  const path = `/api/v4/collections/${favlist_id}/contents`
  return callZhihu(z_c0, path, {
    method: 'POST',
    body: { content_type, content_id: String(content_id) },
  })
}

/**
 * 列收藏夹内容（用于同步前确认 / 同步后核对）
 */
export async function listFavlistContents(z_c0, favlist_id, limit = 20) {
  const data = await callZhihu(
    z_c0,
    `/api/v4/collections/${favlist_id}/contents?limit=${limit}`,
    { method: 'GET' }
  )
  if (!Array.isArray(data)) return []
  return data
}