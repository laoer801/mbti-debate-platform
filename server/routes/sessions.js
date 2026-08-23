import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDB } from '../db.js'

export const sessionRoutes = Router()

// Create a new session
sessionRoutes.post('/', (req, res) => {
  const { topic, sceneId, participants } = req.body

  if (!topic || !participants || participants.length < 2) {
    return res.status(400).json({ error: '需要话题和至少2位参与者' })
  }

  const db = getDB()
  const id = uuidv4()
  const now = Date.now()

  db.prepare(`
    INSERT INTO sessions (id, topic, scene_id, participants, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, topic, sceneId || null, JSON.stringify(participants), now, now)

  res.json({ id, topic, sceneId, participants, createdAt: now })
})

// Get all sessions
sessionRoutes.get('/', (req, res) => {
  const db = getDB()
  const sessions = db.prepare(`
    SELECT * FROM sessions ORDER BY created_at DESC LIMIT 50
  `).all()

  res.json(sessions.map(s => ({
    ...s,
    participants: JSON.parse(s.participants),
  })))
})

// Get session messages
sessionRoutes.get('/:id/messages', (req, res) => {
  const db = getDB()
  const messages = db.prepare(`
    SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC
  `).all(req.params.id)

  res.json(messages.map(m => ({
    ...m,
    isUser: !!m.is_user,
  })))
})

// Add message to session
sessionRoutes.post('/:id/messages', (req, res) => {
  const { typeId, typeName, typeEmoji, typeColor, content, confidence, isUser } = req.body

  if (!typeId || !content) {
    return res.status(400).json({ error: '需要发送者ID和内容' })
  }

  const db = getDB()
  const msgId = uuidv4()
  const now = Date.now()

  db.prepare(`
    INSERT INTO messages (id, session_id, type_id, type_name, type_emoji, type_color, content, confidence, is_user, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(msgId, req.params.id, typeId, typeName || '', typeEmoji || '', typeColor || '', content, confidence || null, isUser ? 1 : 0, now)

  // Update session timestamp
  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, req.params.id)

  res.json({
    id: msgId,
    sessionId: req.params.id,
    typeId, typeName, typeEmoji, typeColor, content, confidence,
    isUser: !!isUser,
    timestamp: now,
  })
})

// Delete session
sessionRoutes.delete('/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})
