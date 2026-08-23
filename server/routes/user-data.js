import { Router } from 'express'
import { getDB } from '../db.js'
import { authMiddleware } from './auth.js'

const router = Router()

/**
 * 用户数据云同步路由（"用户信息跟随账号"）
 * 全量覆盖式同步：客户端登录后拉取云端 → 与本地合并 → 回写
 */

// GET /api/user/books — 拉取当前用户的书籍
router.get('/books', authMiddleware, (req, res) => {
  const db = getDB()
  const rows = db.prepare(
    'SELECT id, title, author, theme, accent, notes, quotes, added_at AS addedAt FROM user_books WHERE user_id = ? ORDER BY added_at DESC'
  ).all(req.user.id)
  const books = rows.map(r => ({ ...r, quotes: JSON.parse(r.quotes || '[]') }))
  res.json({ books })
})

// PUT /api/user/books — 全量覆盖当前用户的书籍
router.put('/books', authMiddleware, (req, res) => {
  const { books } = req.body || {}
  if (!Array.isArray(books)) return res.status(400).json({ error: 'books 必须是数组' })
  const db = getDB()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_books WHERE user_id = ?').run(req.user.id)
    const ins = db.prepare(
      'INSERT OR REPLACE INTO user_books (id, user_id, title, author, theme, accent, notes, quotes, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    for (const b of books) {
      if (!b || typeof b.title !== 'string' || !b.title.trim()) continue
      ins.run(
        String(b.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
        req.user.id,
        b.title.trim().slice(0, 200),
        String(b.author || '').slice(0, 100),
        String(b.theme || '').slice(0, 100),
        String(b.accent || '#6366f1').slice(0, 20),
        String(b.notes || '').slice(0, 2000),
        JSON.stringify(Array.isArray(b.quotes) ? b.quotes.slice(0, 50) : []),
        typeof b.addedAt === 'number' ? b.addedAt : Date.now()
      )
    }
  })
  tx()
  res.json({ ok: true, count: books.length })
})

// GET /api/user/sessions — 拉取当前用户的历史辩论会话
router.get('/sessions', authMiddleware, (req, res) => {
  const db = getDB()
  const rows = db.prepare(
    'SELECT id, topic, mode, scene_id AS sceneId, participants, messages, highlights, created_at AS createdAt FROM user_debate_sessions WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.id)
  const sessions = rows.map(r => ({
    id: r.id,
    topic: r.topic,
    mode: r.mode,
    sceneId: r.sceneId,
    participants: JSON.parse(r.participants || '[]'),
    messages: JSON.parse(r.messages || '[]'),
    highlights: JSON.parse(r.highlights || '[]'),
    createdAt: r.createdAt,
  }))
  res.json({ sessions })
})

// PUT /api/user/sessions — 全量覆盖当前用户的历史辩论会话
router.put('/sessions', authMiddleware, (req, res) => {
  const { sessions } = req.body || {}
  if (!Array.isArray(sessions)) return res.status(400).json({ error: 'sessions 必须是数组' })
  const db = getDB()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_debate_sessions WHERE user_id = ?').run(req.user.id)
    const ins = db.prepare(
      'INSERT OR REPLACE INTO user_debate_sessions (id, user_id, topic, mode, scene_id, participants, messages, highlights, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    for (const s of sessions) {
      if (!s || typeof s.topic !== 'string' || !s.topic.trim()) continue
      ins.run(
        String(s.id || Date.now().toString(36)),
        req.user.id,
        s.topic.trim().slice(0, 300),
        String(s.mode || 'free').slice(0, 20),
        s.sceneId ? String(s.sceneId).slice(0, 100) : null,
        JSON.stringify(Array.isArray(s.participants) ? s.participants.slice(0, 16) : []),
        JSON.stringify(Array.isArray(s.messages) ? s.messages.slice(-200) : []),
        JSON.stringify(Array.isArray(s.highlights) ? s.highlights.slice(0, 20) : []),
        typeof s.createdAt === 'number' ? s.createdAt : Date.now()
      )
    }
  })
  tx()
  res.json({ ok: true, count: sessions.length })
})

export { router as userDataRoutes }
