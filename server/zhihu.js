// 知乎 API 配置（v40+）
// 申请地址：https://developer.zhihu.com/

const ZHIHU_ACCESS_SECRET = process.env.ZHIHU_ACCESS_SECRET || ''
const ZH_MODEL_FAST = process.env.ZHIHU_MODEL_FAST || 'zhida-fast-1p5'
const ZH_MODEL_THINKING = process.env.ZHIHU_MODEL_THINKING || 'zhida-thinking-1p5'
const ZH_MODEL_AGENT = process.env.ZHIHU_MODEL_AGENT || 'zhida-agent'

// 是否启用（即是否配置了 secret）
export function zhihuEnabled() {
  return Boolean(ZHIHU_ACCESS_SECRET && ZHIHU_ACCESS_SECRET.length > 0)
}

// 速率限制简易令牌桶（每分钟 RPM）
let _rpmCounter = { minStart: Date.now(), count: 0 }
const RPM_LIMIT = Number(process.env.ZHIHU_RATE_LIMIT_RPM || 60)
export function rpmAllow() {
  const now = Date.now()
  if (now - _rpmCounter.minStart > 60_000) {
    _rpmCounter = { minStart: now, count: 0 }
  }
  if (_rpmCounter.count >= RPM_LIMIT) return false
  _rpmCounter.count++
  return true
}

const ZH_BASE_SEARCH = 'https://developer.zhihu.com/api/v1/content/global_search'
const ZH_BASE_CHAT = 'https://developer.zhihu.com/v1/chat/completions'
const ZH_BASE_HOTLIST = 'https://developer.zhihu.com/api/v1/content/hot_list'
const ZH_BASE_USER_CONTENTS = 'https://developer.zhihu.com/api/v1/user/contents'
const ZH_BASE_USER_COLLECTIONS = 'https://developer.zhihu.com/api/v1/user/collections'
const ZH_BASE_USER_FAVLISTS = 'https://developer.zhihu.com/api/v1/user/favlists'
const ZH_BASE_FAVLIST_CONTENTS = 'https://developer.zhihu.com/api/v1/user/favlist_contents'

// 通用请求封装：Bearer 鉴权 + Unix 时间戳 + JSON
export async function zhihuFetch(url, opts = {}) {
  if (!zhihuEnabled()) {
    throw new Error('ZHIHU_ACCESS_SECRET 未配置，知乎 API 不可用')
  }
  if (!rpmAllow()) {
    throw new Error('知乎 API 速率超限，请稍后再试')
  }
  const method = opts.method || 'GET'
  const headers = {
    'Authorization': `Bearer ${ZHIHU_ACCESS_SECRET}`,
    'X-Request-Timestamp': `${Math.floor(Date.now() / 1000)}`,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  }

  let fetchUrl = url
  let body
  if (method === 'GET' && opts.params) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(opts.params)) {
      if (v === undefined || v === null || v === '') continue
      qs.set(k, String(v))
    }
    const qsStr = qs.toString()
    if (qsStr) fetchUrl = `${url}${url.includes('?') ? '&' : '?'}${qsStr}`
  } else if (method !== 'GET') {
    if (opts.json) body = JSON.stringify(opts.json)
  }

  const res = await fetch(fetchUrl, { method, headers, body })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`知乎 API 错误 ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// ============================================================
// v40.5：用户内容 / 收藏 / 收藏夹 API 封装（用于知识库 + 学习模块）
// ============================================================

/**
 * 用户内容 API —— 拉公开范围内本人/被授权用户的全部创作
 * @param {object} params { offset, limit, contentType, sortField, sortOrder }
 * @param {string} oauthToken? 可选；不传时拉本人数据
 */
export async function zhihuUserContents(params = {}, oauthToken) {
  const headers = oauthToken ? { 'X-OAuth-Token': oauthToken } : undefined
  const json = await zhihuFetch(ZH_BASE_USER_CONTENTS, {
    method: 'GET',
    params: {
      Offset: params.offset ?? 0,
      Limit: params.limit ?? 20,
      ContentType: params.contentType ?? 'all',
      SortField: params.sortField ?? 'ts',
      SortOrder: params.sortOrder ?? 'desc',
    },
    headers,
  })
  return json?.Data || { Items: [], Paging: { IsEnd: true, Totals: 0 } }
}

/** 用户收藏内容 API —— 拉公开范围内的近期收藏 */
export async function zhihuUserCollections(params = {}, oauthToken) {
  const headers = oauthToken ? { 'X-OAuth-Token': oauthToken } : undefined
  const json = await zhihuFetch(ZH_BASE_USER_COLLECTIONS, {
    method: 'GET',
    params: { Limit: params.limit ?? 20 },
    headers,
  })
  return json?.Data || { Items: [] }
}

/** 用户收藏夹列表 API */
export async function zhihuUserFavlists(params = {}, oauthToken) {
  const headers = oauthToken ? { 'X-OAuth-Token': oauthToken } : undefined
  const json = await zhihuFetch(ZH_BASE_USER_FAVLISTS, {
    method: 'GET',
    params: { Limit: params.limit ?? 20 },
    headers,
  })
  return json?.Data || { Items: [] }
}

/** 收藏夹内容 API —— 拉指定收藏夹里的内容（用于按类目批量拉） */
export async function zhihuFavlistContents(params = {}, oauthToken) {
  if (!params.favlistUrlToken) {
    throw new Error('favlistUrlToken 必填')
  }
  const headers = oauthToken ? { 'X-OAuth-Token': oauthToken } : undefined
  const json = await zhihuFetch(ZH_BASE_FAVLIST_CONTENTS, {
    method: 'GET',
    params: {
      FavlistUrlToken: params.favlistUrlToken,
      Offset: params.offset ?? 0,
      Limit: params.limit ?? 20,
    },
    headers,
  })
  return json?.Data || { Items: [], Paging: { IsEnd: true, Totals: 0 } }
}

/**
 * v40.5：将知乎收藏/内容条目 → 一键入云端知识库的 Payload 格式（cloudkb.upload）
 * @param {object} item 任何 ContentItem / CollectionContentItem
 * @param {string} source 来源标签（如 'zhihu:user-contents' / 'zhihu:user-favlist'）
 */
export function itemToKbPayload(item, source = 'zhihu:contents') {
  const title = item.Title || '（无标题）'
  const summary = (item.Summary || '').trim()
  const text = `${title}\n\n${summary}\n\n来源：知乎 ${item.ContentType || ''} · 点赞 ${item.LikeCount ?? 0} · 评论 ${item.CommentCount ?? 0} · 收藏 ${item.FavoriteCount ?? 0}\n链接：${item.Url}`
  return {
    title: title.slice(0, 200),
    text,
    source_type: source,
    external_url: item.Url,
    metadata: {
      contentType: item.ContentType,
      likeCount: item.LikeCount ?? 0,
      commentCount: item.CommentCount ?? 0,
      favoriteCount: item.FavoriteCount ?? 0,
      author: item.Author?.Name || null,
      authorHeadline: item.Author?.Headline || null,
      favlists: (item.Favlists || []).map(f => ({ title: f.Title, url: f.Url })),
      createdAt: item.CreatedAt ?? null,
    },
  }
}

export {
  ZHIHU_ACCESS_SECRET,
  ZH_MODEL_FAST,
  ZH_MODEL_THINKING,
  ZH_MODEL_AGENT,
  ZH_BASE_SEARCH,
  ZH_BASE_CHAT,
  ZH_BASE_HOTLIST,
  ZH_BASE_USER_CONTENTS,
  ZH_BASE_USER_COLLECTIONS,
  ZH_BASE_USER_FAVLISTS,
  ZH_BASE_FAVLIST_CONTENTS,
}

export const zhihuMeta = {
  enabled: zhihuEnabled(),
  fastModel: ZH_MODEL_FAST,
  thinkingModel: ZH_MODEL_THINKING,
  agentModel: ZH_MODEL_AGENT,
  rpmLimit: RPM_LIMIT,
}
