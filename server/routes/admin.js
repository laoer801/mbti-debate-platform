import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { v4 as uuid } from 'uuid'
import { getDB } from '../db.js'
import { JWT_SECRET } from '../secret.js'
import { onlineUsers, serializeOnline } from '../presence.js'

export const adminRoutes = Router()

// ============================================================
// v35 后台管理路由（仅 role=admin 可访问）
// 数据看板 / 用户管理 / 内容管理（辩论主题 + 人格提示词覆盖）
// ============================================================

function adminMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '请先登录' })
  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch {
    return res.status(401).json({ error: '登录已过期' })
  }
  // 以数据库 role 为准（JWT 里的 role 可能过期，如刚被降权）
  const db = getDB()
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(payload.id)
  if (!user || user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' })
  req.user = payload
  next()
}

// ============ 数据看板 ============

// GET /api/admin/stats — 运营总览（在线/注册/辩论/人格热度/使用统计）
adminRoutes.get('/stats', adminMiddleware, (req, res) => {
  const db = getDB()
  const totalUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
  const totalSessions = db.prepare('SELECT COUNT(*) AS c FROM sessions').get().c
  const totalPKRooms = db.prepare('SELECT COUNT(*) AS c FROM pk_rooms').get().c
  const totalPosts = db.prepare('SELECT COUNT(*) AS c FROM posts').get().c
  const totalMessages = db.prepare('SELECT COUNT(*) AS c FROM messages').get().c

  // 人格热度：users.mbti_type 分布
  const personaHeat = db.prepare(`
    SELECT COALESCE(mbti_type, '未填写') AS type, COUNT(*) AS count
    FROM users GROUP BY mbti_type ORDER BY count DESC
  `).all().map(r => ({ type: r.type, count: r.count }))

  // 近 7 天注册趋势（按天聚合）
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
  const registrations7d = db.prepare(`
    SELECT (created_at / 86400000) AS day, COUNT(*) AS count
    FROM users WHERE created_at >= ? GROUP BY day ORDER BY day
  `).all(weekAgo).map(r => ({ day: r.day, count: r.count }))

  // 辩论场次趋势（近 7 天）
  const debates7d = db.prepare(`
    SELECT (created_at / 86400000) AS day, COUNT(*) AS count
    FROM sessions WHERE created_at >= ? GROUP BY day ORDER BY day
  `).all(weekAgo).map(r => ({ day: r.day, count: r.count }))

  // 在线数据（实时）
  const online = {
    count: onlineUsers.size,
    users: serializeOnline(),
  }

  res.json({
    online,
    totalUsers,
    totalSessions,
    totalPKRooms,
    totalPosts,
    totalMessages,
    personaHeat,
    registrations7d,
    debates7d,
    timestamp: Date.now(),
  })
})

// ============ 用户管理 ============

// GET /api/admin/users — 用户列表
adminRoutes.get('/users', adminMiddleware, (req, res) => {
  const db = getDB()
  const users = db.prepare(`
    SELECT id, username, mbti_type, avatar, bio, role, banned, created_at, login_at
    FROM users ORDER BY created_at DESC LIMIT 500
  `).all()
  res.json({ users })
})

// PUT /api/admin/users/:id/role — 设置角色（admin / user）
adminRoutes.put('/users/:id/role', adminMiddleware, (req, res) => {
  const { role } = req.body || {}
  if (role !== 'admin' && role !== 'user') return res.status(400).json({ error: '角色必须是 admin 或 user' })
  const db = getDB()
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id)
  res.json({ ok: true })
})

// PUT /api/admin/users/:id/ban — 封禁 / 解封
adminRoutes.put('/users/:id/ban', adminMiddleware, (req, res) => {
  const { banned } = req.body || {}
  const value = banned ? 1 : 0
  const db = getDB()
  db.prepare('UPDATE users SET banned = ? WHERE id = ?').run(value, req.params.id)
  res.json({ ok: true })
})

// ============ 内容管理：辩论主题 ============

// GET /api/admin/topics — 主题列表
adminRoutes.get('/topics', adminMiddleware, (req, res) => {
  const db = getDB()
  const topics = db.prepare('SELECT * FROM debate_topics ORDER BY created_at DESC').all()
  res.json({ topics })
})

// POST /api/admin/topics — 新建主题
adminRoutes.post('/topics', adminMiddleware, (req, res) => {
  const { title, description, sides, active } = req.body || {}
  if (!title || !String(title).trim()) return res.status(400).json({ error: '主题不能为空' })
  const db = getDB()
  const id = 't_' + uuid().slice(0, 8)
  db.prepare(`INSERT INTO debate_topics (id, title, description, sides, active, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, String(title).trim(), description || '', JSON.stringify(sides || ['正方', '反方']), active === false ? 0 : 1, Date.now())
  res.json({ topic: db.prepare('SELECT * FROM debate_topics WHERE id = ?').get(id) })
})

// PUT /api/admin/topics/:id — 更新主题
adminRoutes.put('/topics/:id', adminMiddleware, (req, res) => {
  const { title, description, sides, active } = req.body || {}
  const db = getDB()
  if (title !== undefined && !String(title).trim()) return res.status(400).json({ error: '主题不能为空' })
  db.prepare(`
    UPDATE debate_topics SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      sides = COALESCE(?, sides),
      active = COALESCE(?, active)
    WHERE id = ?
  `).run(
    title !== undefined ? String(title).trim() : null,
    description !== undefined ? description : null,
    sides !== undefined ? JSON.stringify(sides) : null,
    active !== undefined ? (active ? 1 : 0) : null,
    req.params.id
  )
  res.json({ ok: true })
})

// DELETE /api/admin/topics/:id — 删除主题
adminRoutes.delete('/topics/:id', adminMiddleware, (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM debate_topics WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ============ 内容管理：人格提示词覆盖 ============

// GET /api/admin/overrides — 覆盖列表
adminRoutes.get('/overrides', adminMiddleware, (req, res) => {
  const db = getDB()
  const overrides = db.prepare('SELECT * FROM persona_overrides ORDER BY updated_at DESC').all()
  res.json({ overrides })
})

// PUT /api/admin/overrides/:typeId — 保存覆盖
adminRoutes.put('/overrides/:typeId', adminMiddleware, (req, res) => {
  const { systemPromptOverride, pathAdviceOverride } = req.body || {}
  const typeId = String(req.params.typeId).toUpperCase()
  const db = getDB()
  db.prepare(`
    INSERT INTO persona_overrides (type_id, system_prompt_override, path_advice_override, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(type_id) DO UPDATE SET
      system_prompt_override = excluded.system_prompt_override,
      path_advice_override = excluded.path_advice_override,
      updated_at = excluded.updated_at
  `).run(typeId, systemPromptOverride || '', pathAdviceOverride || '', Date.now())
  res.json({ ok: true, override: db.prepare('SELECT * FROM persona_overrides WHERE type_id = ?').get(typeId) })
})

// DELETE /api/admin/overrides/:typeId — 清除覆盖（恢复默认）
adminRoutes.delete('/overrides/:typeId', adminMiddleware, (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM persona_overrides WHERE type_id = ?').run(String(req.params.typeId).toUpperCase())
  res.json({ ok: true })
})

export { adminMiddleware }
