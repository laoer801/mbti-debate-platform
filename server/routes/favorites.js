/**
 * v40.7 思辩星球云端收藏夹路由
 *
 * 端点：
 *   GET    /api/favorites?type=&tag=&q=&limit=   列表（可选过滤）
 *   GET    /api/favorites/tags                    该用户用过的所有标签
 *   GET    /api/favorites/check?type=&id=        是否已收藏（用于按钮态）
 *   POST   /api/favorites                        { item_type, item_id, title, summary?, url?, source?, thumbnail?, author?, tags?, notes? } 收藏
 *   PUT    /api/favorites/:id                    { notes?, tags?, title?, summary? } 更新
 *   DELETE /api/favorites/:id                    取消
 *   POST   /api/favorites/sync-to-zhihu          { fav_ids: [], target_favlist_id } 把所选收藏同步到知乎收藏夹
 *
 * 设计：
 *   - 唯一约束 (user_id, item_type, item_id) 防重复；POST 重复时返回 existing
 *   - 标签：字符串数组存 JSON；GET /tags 聚合
 *   - 同步到知乎：复用 v40.6 zhihuUserApi.addToFavlist
 */

import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDB } from '../db.js'
import { authMiddleware } from './auth.js'
import { loadDecryptedZc0 } from './zhihu-auth.js'
import { addToFavlist } from '../utils/zhihuUserApi.js'

export const favoritesRoutes = Router()

const ALLOWED_TYPES = ['answer', 'article', 'question', 'post']

function isValidType(t) {
  return ALLOWED_TYPES.includes(t)
}

function parseTags(s) {
  if (Array.isArray(s)) return s.slice(0, 20).map(String).map((t) => t.slice(0, 30))
  if (typeof s !== 'string') return []
  try {
    const arr = JSON.parse(s)
    if (!Array.isArray(arr)) return []
    return arr.slice(0, 20).map(String).map((t) => t.slice(0, 30))
  } catch {
    return []
  }
}

function publicRow(row) {
  if (!row) return null
  return {
    id: row.id,
    itemType: row.item_type,
    itemId: row.item_id,
    title: row.title,
    summary: row.summary,
    url: row.url,
    source: row.source,
    thumbnail: row.thumbnail,
    author: row.author,
    tags: parseTags(row.tags),
    notes: row.notes,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
  }
}

// ============================================================
// 1. 列表（可按类型 / 标签 / 关键词过滤）
// ============================================================
favoritesRoutes.get('/', authMiddleware, (req, res) => {
  const { type, tag, q, limit } = req.query
  const db = getDB()
  const conds = ['user_id = ?']
  const args = [req.user.id]
  if (type && isValidType(type)) {
    conds.push('item_type = ?')
    args.push(type)
  }
  if (tag && typeof tag === 'string' && tag.trim()) {
    // tags 是 JSON 数组；用 LIKE 匹配简单包含
    conds.push("tags LIKE ?")
    args.push(`%"${tag.trim().slice(0, 30)}"%`)
  }
  if (q && typeof q === 'string' && q.trim()) {
    conds.push('(title LIKE ? OR summary LIKE ? OR notes LIKE ?)')
    const like = `%${q.trim().slice(0, 100)}%`
    args.push(like, like, like)
  }
  const lim = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500)
  const rows = db
    .prepare(
      `SELECT id, item_type, item_id, title, summary, url, source, thumbnail, author, tags, notes, added_at, updated_at
       FROM user_favorites WHERE ${conds.join(' AND ')} ORDER BY added_at DESC LIMIT ?`
    )
    .all(...args, lim)
  res.json({ favorites: rows.map(publicRow), total: rows.length })
})

// ============================================================
// 2. 该用户所有标签（用于自动补全）
// ============================================================
favoritesRoutes.get('/tags', authMiddleware, (req, res) => {
  const db = getDB()
  const rows = db
    .prepare('SELECT tags FROM user_favorites WHERE user_id = ?')
    .all(req.user.id)
  const counter = new Map()
  for (const r of rows) {
    const arr = parseTags(r.tags)
    for (const t of arr) counter.set(t, (counter.get(t) || 0) + 1)
  }
  const tags = [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))
  res.json({ tags })
})

// ============================================================
// 3. 检查是否已收藏（按钮态显示用）
// ============================================================
favoritesRoutes.get('/check', authMiddleware, (req, res) => {
  const { type, id } = req.query
  if (!isValidType(type) || !id) {
    return res.status(400).json({ error: 'type / id 必填且 type 必须是 answer/article/question/post' })
  }
  const db = getDB()
  const row = db
    .prepare('SELECT id FROM user_favorites WHERE user_id = ? AND item_type = ? AND item_id = ?')
    .get(req.user.id, type, String(id))
  res.json({ favorited: Boolean(row), favoriteId: row?.id || null })
})

// ============================================================
// 4. 收藏
// ============================================================
favoritesRoutes.post('/', authMiddleware, (req, res) => {
  const { item_type, item_id, title, summary, url, source, thumbnail, author, tags, notes } = req.body || {}
  if (!isValidType(item_type)) {
    return res.status(400).json({ error: 'item_type 必须是 answer/article/question/post' })
  }
  if (!item_id || typeof item_id !== 'string') {
    return res.status(400).json({ error: 'item_id 必填' })
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title 必填' })
  }
  const db = getDB()
  // 检查是否已收藏
  const existing = db
    .prepare('SELECT id, added_at, updated_at, tags, notes FROM user_favorites WHERE user_id = ? AND item_type = ? AND item_id = ?')
    .get(req.user.id, item_type, item_id)
  if (existing) {
    const row = db
      .prepare('SELECT id, item_type, item_id, title, summary, url, source, thumbnail, author, tags, notes, added_at, updated_at FROM user_favorites WHERE id = ?')
      .get(existing.id)
    return res.json({ ok: true, already: true, favorite: publicRow(row) })
  }

  const id = uuid()
  const now = Date.now()
  const tagsJson = JSON.stringify(parseTags(tags))
  db.prepare(
    `INSERT INTO user_favorites (id, user_id, item_type, item_id, title, summary, url, source, thumbnail, author, tags, notes, added_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.user.id,
    item_type,
    String(item_id).slice(0, 64),
    title.trim().slice(0, 300),
    typeof summary === 'string' ? summary.slice(0, 1000) : '',
    typeof url === 'string' ? url.slice(0, 500) : '',
    source === 'local' ? 'local' : 'zhihu',
    typeof thumbnail === 'string' ? thumbnail.slice(0, 500) : '',
    typeof author === 'string' ? author.slice(0, 100) : '',
    tagsJson,
    typeof notes === 'string' ? notes.slice(0, 2000) : '',
    now,
    now
  )
  const row = db
    .prepare('SELECT id, item_type, item_id, title, summary, url, source, thumbnail, author, tags, notes, added_at, updated_at FROM user_favorites WHERE id = ?')
    .get(id)
  res.json({ ok: true, already: false, favorite: publicRow(row) })
})

// ============================================================
// 5. 更新备注 / 标签 / 标题
// ============================================================
favoritesRoutes.put('/:id', authMiddleware, (req, res) => {
  const { id } = req.params
  const { notes, tags, title, summary } = req.body || {}
  const db = getDB()
  const row = db.prepare('SELECT id FROM user_favorites WHERE id = ? AND user_id = ?').get(id, req.user.id)
  if (!row) return res.status(404).json({ error: '收藏不存在' })

  const updates = []
  const args = []
  if (typeof notes === 'string') {
    updates.push('notes = ?'); args.push(notes.slice(0, 2000))
  }
  if (tags !== undefined) {
    updates.push('tags = ?'); args.push(JSON.stringify(parseTags(tags)))
  }
  if (typeof title === 'string' && title.trim()) {
    updates.push('title = ?'); args.push(title.trim().slice(0, 300))
  }
  if (typeof summary === 'string') {
    updates.push('summary = ?'); args.push(summary.slice(0, 1000))
  }
  if (updates.length === 0) return res.json({ ok: true, noop: true })
  updates.push('updated_at = ?'); args.push(Date.now())
  args.push(id, req.user.id)
  db.prepare(`UPDATE user_favorites SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...args)
  const newRow = db
    .prepare('SELECT id, item_type, item_id, title, summary, url, source, thumbnail, author, tags, notes, added_at, updated_at FROM user_favorites WHERE id = ?')
    .get(id)
  res.json({ ok: true, favorite: publicRow(newRow) })
})

// ============================================================
// 6. 取消收藏
// ============================================================
favoritesRoutes.delete('/:id', authMiddleware, (req, res) => {
  const db = getDB()
  const r = db.prepare('DELETE FROM user_favorites WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
  res.json({ ok: true, removed: r.changes })
})

// ============================================================
// 7. 一键同步到知乎收藏夹
// ============================================================
favoritesRoutes.post('/sync-to-zhihu', authMiddleware, async (req, res) => {
  const { fav_ids, target_favlist_id } = req.body || {}
  if (!Array.isArray(fav_ids) || fav_ids.length === 0) {
    return res.status(400).json({ error: 'fav_ids 必填且为非空数组' })
  }
  if (fav_ids.length > 100) {
    return res.status(400).json({ error: '单次最多同步 100 条' })
  }
  if (typeof target_favlist_id !== 'number') {
    return res.status(400).json({ error: 'target_favlist_id 必填（数字）' })
  }

  const db = getDB()
  // 仅取知乎源 + answer/article/question 类型（本地 post 不能同步）
  const placeholders = fav_ids.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT id, item_type, item_id, title FROM user_favorites
       WHERE user_id = ? AND id IN (${placeholders}) AND source = 'zhihu' AND item_type IN ('answer','article','question')`
    )
    .all(req.user.id, ...fav_ids)
  if (rows.length === 0) {
    return res.status(400).json({ error: '所选收藏中没有可同步到知乎的条目（仅支持 answer/article/question）' })
  }

  // 解密 cookie
  let z_c0
  try {
    z_c0 = loadDecryptedZc0(db, req.user.id)
  } catch (e) {
    return res.status(500).json({ error: '解密 cookie 失败：' + (e.message || e) })
  }
  if (!z_c0) {
    return res.status(400).json({ error: '尚未绑定知乎账号或 cookie 已失效，请重新绑定' })
  }

  const results = []
  for (const r of rows) {
    try {
      await addToFavlist(z_c0, target_favlist_id, r.item_type, r.item_id)
      results.push({ favId: r.id, title: r.title, status: 'success' })
    } catch (e) {
      results.push({
        favId: r.id,
        title: r.title,
        status: 'failed',
        message: (e.message || '未知错误').slice(0, 200),
      })
      if (e.code === 'ZHIHU_AUTH_INVALID') {
        db.prepare(`UPDATE user_zhihu_bindings SET status = 'expired' WHERE user_id = ?`).run(req.user.id)
        return res.status(401).json({
          error: '知乎 cookie 已失效，请重新绑定',
          results,
        })
      }
    }
  }

  db.prepare('UPDATE user_zhihu_bindings SET last_used_at = ? WHERE user_id = ?').run(Date.now(), req.user.id)
  const success = results.filter((r) => r.status === 'success').length
  const failed = results.filter((r) => r.status === 'failed').length
  res.json({ ok: failed === 0, summary: { total: results.length, success, failed }, results })
})