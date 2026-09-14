/**
 * v40+ 知乎三 API 路由（统一封装 + 安全代理）
 *
 * 端点：
 *   GET  /api/zhihu/status                 是否启用 + 元数据
 *   GET  /api/zhihu/search?q=&count=&filter=&db=
 *   POST /api/zhihu/chat { model, messages, stream }
 *   GET  /api/zhihu/hotlist?limit=
 *
 * 设计：所有调用都过服务端（secret 永远不进前端），没启用时返回明确错误让前端走 fallback。
 */

import { Router } from 'express'
import {
  zhihuEnabled,
  zhihuMeta,
  ZH_BASE_SEARCH,
  ZH_BASE_CHAT,
  ZH_BASE_HOTLIST,
  ZH_BASE_USER_CONTENTS,
  ZH_BASE_USER_COLLECTIONS,
  ZH_BASE_USER_FAVLISTS,
  ZH_BASE_FAVLIST_CONTENTS,
  ZH_MODEL_FAST,
  ZH_MODEL_THINKING,
  ZH_MODEL_AGENT,
  zhihuFetch,
  zhihuUserContents,
  zhihuUserCollections,
  zhihuUserFavlists,
  zhihuFavlistContents,
  itemToKbPayload,
} from '../zhihu.js'

export const zhihuRoutes = Router()

// ============ 状态/元数据 ============

zhihuRoutes.get('/status', (req, res) => {
  res.json({
    enabled: zhihuEnabled(),
    models: {
      fast: ZH_MODEL_FAST,
      thinking: ZH_MODEL_THINKING,
      agent: ZH_MODEL_AGENT,
    },
    rpmLimit: zhihuMeta.rpmLimit,
    endpoints: {
      search: ZH_BASE_SEARCH,
      chat: ZH_BASE_CHAT,
      hotlist: ZH_BASE_HOTLIST,
      userContents: ZH_BASE_USER_CONTENTS,
      userCollections: ZH_BASE_USER_COLLECTIONS,
      userFavlists: ZH_BASE_USER_FAVLISTS,
      favlistContents: ZH_BASE_FAVLIST_CONTENTS,
    },
  })
})

// ============ 全网搜索 ============

/**
 * GET /api/zhihu/search
 * Query:
 *   q=关键词（必填）
 *   count=1-20（默认 10）
 *   filter=高级筛选
 *   db=all|realtime|static（默认 all）
 */
zhihuRoutes.get('/search', async (req, res) => {
  try {
    if (!zhihuEnabled()) {
      return res.status(503).json({ error: '知乎 API 未启用', enabled: false })
    }
    const q = String(req.query.q || '').trim()
    if (!q) return res.status(400).json({ error: 'q 必填' })
    const count = Math.min(20, Math.max(1, Number(req.query.count || 10)))
    const filter = req.query.filter ? String(req.query.filter) : ''
    const db = req.query.db ? String(req.query.db) : 'all'

    const data = await zhihuFetch(ZH_BASE_SEARCH, {
      method: 'GET',
      params: { Query: q, Count: count, Filter: filter, SearchDB: db },
    })

    if (data.Code !== 0) {
      return res.status(502).json({ error: data.Message || '知乎搜索失败', code: data.Code })
    }

    // 规整 Items + 提取评论数最高的评论作为辅助信息
    const items = (data.Data?.Items || []).map((it) => ({
      title: it.Title,
      contentType: it.ContentType,
      contentId: it.ContentID,
      snippet: stripHtml(it.ContentText).slice(0, 280),
      highlightHtml: it.ContentText, // 保留高亮标签供前端控制展示
      url: it.Url,
      commentCount: it.CommentCount,
      voteUpCount: it.VoteUpCount,
      authorName: it.AuthorName,
      authorAvatar: it.AuthorAvatar,
      authorBadgeText: it.AuthorBadgeText,
      authorityLevel: it.AuthorityLevel,
      editTime: it.EditTime,
      topComments: (it.CommentInfoList || []).slice(0, 2).map((c) => c.Content),
    }))

    res.json({
      enabled: true,
      query: q,
      count: items.length,
      hasMore: data.Data?.HasMore || false,
      items,
    })
  } catch (e) {
    console.error('/api/zhihu/search:', e.message)
    res.status(500).json({ error: e.message })
  }
})

function stripHtml(s) {
  return (s || '').replace(/<[^>]+>/g, '')
}

// ============ 直答 LLM（chat completions） ============

/**
 * POST /api/zhihu/chat
 * Body:
 *   {
 *     messages: [{role, content}, ...],
 *     model?: 'fast' | 'thinking' | 'agent'（默认 thinking）
 *     stream?: boolean（默认 false）
 *   }
 *
 * 非流式：直接返回完整 JSON
 * 流式：通过 SSE 推到前端（前端用 fetch + ReadableStream 解码）
 */
zhihuRoutes.post('/chat', async (req, res) => {
  try {
    if (!zhihuEnabled()) {
      return res.status(503).json({ error: '知乎 API 未启用', enabled: false })
    }
    const body = req.body || {}
    const messages = Array.isArray(body.messages) ? body.messages : []
    if (messages.length === 0) {
      return res.status(400).json({ error: 'messages 必填' })
    }

    // 模型选择：用户传 fast|thinking|agent，没有就默认 thinking
    const pickMap = { fast: ZH_MODEL_FAST, thinking: ZH_MODEL_THINKING, agent: ZH_MODEL_AGENT }
    const model = pickMap[body.model] || pickMap.thinking
    const stream = Boolean(body.stream)

    if (!stream) {
      // 非流式
      const data = await zhihuFetch(ZH_BASE_CHAT, {
        method: 'POST',
        json: { model, messages, stream: false },
      })
      const choice = data.choices?.[0]
      const message = choice?.message || {}
      return res.json({
        enabled: true,
        id: data.id,
        model: data.model,
        content: message.content || '',
        reasoning: message.reasoning_content || '',
        finishReason: choice?.finish_reason || 'stop',
        usage: data.usage,
      })
    }

    // 流式：直接 pipe 知乎流到前端
    const zhRes = await fetch(ZH_BASE_CHAT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ZHIHU_ACCESS_SECRET}`,
        'X-Request-Timestamp': `${Math.floor(Date.now() / 1000)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, stream: true }),
    })

    if (!zhRes.ok || !zhRes.body) {
      return res.status(502).json({ error: `直答流式失败 ${zhRes.status}` })
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    const reader = zhRes.body.getReader()
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(value)
        }
        res.end()
      } catch (e) {
        try { res.write(`data: {"error":{"message":"${String(e.message).replace(/"/g, '\\"')}"}}\n\n`) } catch {}
        res.end()
      }
    }
    pump()
  } catch (e) {
    console.error('/api/zhihu/chat:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ============ 热榜 ============

zhihuRoutes.get('/hotlist', async (req, res) => {
  try {
    if (!zhihuEnabled()) {
      return res.status(503).json({ error: '知乎 API 未启用', enabled: false })
    }
    const limit = Math.min(30, Math.max(1, Number(req.query.limit || 30)))
    const data = await zhihuFetch(ZH_BASE_HOTLIST, {
      method: 'GET',
      params: { Limit: limit },
    })
    if (data.Code !== 0) {
      return res.status(502).json({ error: data.Message || '知乎热榜失败', code: data.Code })
    }
    res.json({
      enabled: true,
      total: data.Data?.Total || 0,
      items: (data.Data?.Items || []).map(it => ({
        title: it.Title,
        url: it.Url,
        thumbnailUrl: it.ThumbnailUrl,
        summary: it.Summary,
      })),
    })
  } catch (e) {
    console.error('/api/zhihu/hotlist:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ============ v40.5: 用户内容 / 收藏 / 收藏夹联动知识库 ============

/** 通用工具：从请求里读 oauthToken（前端后续可补充，v40.5 先支持空走本人） */
function readOauthToken(req) {
  const t = req.headers['x-oauth-token'] || req.query.oauthToken || (req.body && req.body.oauthToken)
  return typeof t === 'string' && t.trim().length > 0 ? t.trim() : undefined
}

/**
 * 用户内容 API（用于"我所有回答/文章/想法/视频 → 一键入知识库"）
 * GET /api/zhihu/user/contents?contentType=all&limit=20&offset=0
 */
zhihuRoutes.get('/user/contents', async (req, res) => {
  try {
    if (!zhihuEnabled()) return res.status(503).json({ error: '知乎 API 未启用', enabled: false })
    const oauthToken = readOauthToken(req)
    const data = await zhihuUserContents({
      contentType: req.query.contentType || 'all',
      limit: Number(req.query.limit || 20),
      offset: Number(req.query.offset || 0),
      sortField: req.query.sortField || 'ts',
      sortOrder: req.query.sortOrder || 'desc',
    }, oauthToken)
    res.json({
      enabled: true,
      source: 'zhihu:user-contents',
      items: (data.Items || []).map(normalizeItem),
      paging: data.Paging || { IsEnd: true, Totals: 0 },
    })
  } catch (e) {
    console.error('/api/zhihu/user/contents:', e.message)
    res.status(500).json({ error: e.message })
  }
})

/**
 * 用户收藏 API（用于"我收藏的优质答案 → 喂给辩论 AI 学习"）
 * GET /api/zhihu/user/collections?limit=30
 */
zhihuRoutes.get('/user/collections', async (req, res) => {
  try {
    if (!zhihuEnabled()) return res.status(503).json({ error: '知乎 API 未启用', enabled: false })
    const oauthToken = readOauthToken(req)
    const data = await zhihuUserCollections({ limit: Number(req.query.limit || 30) }, oauthToken)
    res.json({
      enabled: true,
      source: 'zhihu:user-collections',
      items: (data.Items || []).map(normalizeItem),
      paging: { IsEnd: true, Totals: data.Items?.length || 0 },
    })
  } catch (e) {
    console.error('/api/zhihu/user/collections:', e.message)
    res.status(500).json({ error: e.message })
  }
})

/**
 * 用户收藏夹列表 API（用于让用户在知识库页挑选收藏夹批量入）
 * GET /api/zhihu/user/favlists?limit=50
 */
zhihuRoutes.get('/user/favlists', async (req, res) => {
  try {
    if (!zhihuEnabled()) return res.status(503).json({ error: '知乎 API 未启用', enabled: false })
    const oauthToken = readOauthToken(req)
    const data = await zhihuUserFavlists({ limit: Number(req.query.limit || 50) }, oauthToken)
    res.json({
      enabled: true,
      source: 'zhihu:user-favlists',
      items: (data.Items || []).map(f => ({
        urlToken: f.UrlToken,
        title: f.Title,
        url: f.Url,
        description: f.Description,
        isPublic: f.IsPublic,
      })),
    })
  } catch (e) {
    console.error('/api/zhihu/user/favlists:', e.message)
    res.status(500).json({ error: e.message })
  }
})

/**
 * 收藏夹内容 API
 * GET /api/zhihu/favlist-contents?favlistUrlToken=...&limit=50&offset=0
 */
zhihuRoutes.get('/favlist-contents', async (req, res) => {
  try {
    if (!zhihuEnabled()) return res.status(503).json({ error: '知乎 API 未启用', enabled: false })
    const urlToken = Number(req.query.favlistUrlToken || 0)
    if (!urlToken) return res.status(400).json({ error: 'favlistUrlToken 必填' })
    const oauthToken = readOauthToken(req)
    const data = await zhihuFavlistContents({
      favlistUrlToken: urlToken,
      limit: Number(req.query.limit || 30),
      offset: Number(req.query.offset || 0),
    }, oauthToken)
    res.json({
      enabled: true,
      source: 'zhihu:favlist-contents',
      items: (data.Items || []).map(normalizeItem),
      paging: data.Paging || { IsEnd: true, Totals: 0 },
    })
  } catch (e) {
    console.error('/api/zhihu/favlist-contents:', e.message)
    res.status(500).json({ error: e.message })
  }
})

/**
 * v40.5 一键入云端知识库（批量）—— KnowledgeLibrary "导入知乎条目" 按钮走的接口
 * POST /api/zhihu/import-to-kb
 * body: { items: [...], targetKinds: ['user-contents'|'user-collections'|'favlist'|'search'], userId: ... }
 *
 * 注意：这里只校验 + 把每条 item 转成 cloudkb.upload 的 payload —— 真正的写入由客户端去调 /api/cloudkb/upload，
 * 这样与现有上传路径风格一致、可复用进度 UI / 错误降级。
 */
zhihuRoutes.post('/import-to-kb', (req, res) => {
  try {
    if (!zhihuEnabled()) return res.status(503).json({ error: '知乎 API 未启用', enabled: false })
    const body = req.body || {}
    const items = Array.isArray(body.items) ? body.items : []
    const source = body.source || 'zhihu:contents'
    if (items.length === 0) return res.status(400).json({ error: 'items 必填且非空' })
    const payloads = items.map(it => itemToKbPayload(it, source))
    res.json({
      enabled: true,
      source,
      count: payloads.length,
      payloads,
      // 直接给出调用 cloudkb.upload 的 curl 文档，方便排查
      hint: '请循环调用 POST /api/cloudkb/upload，body = payloads[i] + userId',
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ---------- 工具：统一归一化任意 item → KnowledgeLibrary 通用模型 ----------
function normalizeItem(it) {
  if (!it) return null
  return {
    contentType: it.ContentType,
    url: it.Url,
    title: it.Title,
    summary: it.Summary,
    likeCount: it.LikeCount ?? 0,
    commentCount: it.CommentCount ?? 0,
    favoriteCount: it.FavoriteCount ?? 0,
    createdAt: it.CreatedAt ?? null,
    favTime: it.FavTime ?? null,
    author: it.Author ? {
      name: it.Author.Name,
      urlToken: it.Author.UrlToken,
      url: it.Author.Url,
      headline: it.Author.Headline,
    } : null,
    favlists: (it.Favlists || []).map(f => ({ urlToken: f.UrlToken, title: f.Title, url: f.Url })),
  }
}
