import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuid } from 'uuid'
import { getDB } from '../db.js'
import { JWT_SECRET } from '../secret.js'

const router = Router()

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '请先登录' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: '登录已过期' })
  }
}

export { authMiddleware }

// 用户名：2-20字符，中文/字母/数字/下划线/连字符；密码：4-72字符
const USERNAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_-]{2,20}$/
const MAX_PASSWORD_LEN = 72 // bcrypt 截断阈值

function validateUsername(username) {
  if (typeof username !== 'string') return { ok: false, error: '用户名格式不正确' }
  const trimmed = username.trim()
  if (trimmed.length < 2) return { ok: false, error: '用户名至少2个字符' }
  if (trimmed.length > 20) return { ok: false, error: '用户名不能超过20个字符' }
  if (!USERNAME_RE.test(trimmed)) {
    return { ok: false, error: '用户名仅支持中文、字母、数字、下划线和连字符' }
  }
  return { ok: true, value: trimmed }
}

function validatePassword(password) {
  if (typeof password !== 'string') return { ok: false, error: '密码格式不正确' }
  if (password.length < 4) return { ok: false, error: '密码至少4个字符' }
  if (password.length > MAX_PASSWORD_LEN) return { ok: false, error: `密码不能超过${MAX_PASSWORD_LEN}个字符` }
  return { ok: true }
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password, mbtiType } = req.body || {}

  const u = validateUsername(username)
  if (!u.ok) return res.status(400).json({ error: u.error })
  const p = validatePassword(password)
  if (!p.ok) return res.status(400).json({ error: p.error })

  const db = getDB()
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(u.value)
  if (existing) return res.status(409).json({ error: '用户名已被注册' })

  const hashed = await bcrypt.hash(password, 10)
  // v35：当库里还没有任何 admin 时，本次注册者自动成为管理员（兼容老库已有用户的情况）
  const adminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c
  const role = adminCount === 0 ? 'admin' : 'user'
  const user = {
    id: uuid(),
    username: u.value,
    password: hashed,
    mbti_type: typeof mbtiType === 'string' ? mbtiType : null,
    role,
    created_at: Date.now(),
    login_at: Date.now(),
  }
  db.prepare(`INSERT INTO users (id, username, password, mbti_type, role, created_at, login_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(user.id, user.username, user.password, user.mbti_type, user.role, user.created_at, user.login_at)

  const token = jwt.sign({ id: user.id, username: user.username, mbtiType: user.mbti_type, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, user: { id: user.id, username: user.username, mbtiType: user.mbti_type, role: user.role } })
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: '用户名或密码格式不正确' })
  }
  const trimmed = username.trim()
  if (!trimmed || !password) return res.status(400).json({ error: '请输入用户名和密码' })
  const db = getDB()
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(trimmed)
  if (!user) return res.status(401).json({ error: '用户名不存在' })

  // v35：封禁检查（后台管理可封禁用户）
  if (user.banned) return res.status(403).json({ error: '账号已被封禁，请联系管理员' })

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return res.status(401).json({ error: '密码错误' })

  db.prepare('UPDATE users SET login_at = ? WHERE id = ?').run(Date.now(), user.id)
  const token = jwt.sign({ id: user.id, username: user.username, mbtiType: user.mbti_type, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, user: { id: user.id, username: user.username, mbtiType: user.mbti_type, avatar: user.avatar, bio: user.bio, role: user.role } })
})

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const db = getDB()
  const user = db.prepare('SELECT id, username, mbti_type, avatar, bio, role, created_at, login_at FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: '用户不存在' })
  res.json({ user })
})

// PUT /api/auth/profile
router.put('/profile', authMiddleware, (req, res) => {
  const { mbtiType, avatar, bio } = req.body
  const db = getDB()
  db.prepare('UPDATE users SET mbti_type = COALESCE(?, mbti_type), avatar = COALESCE(?, avatar), bio = COALESCE(?, bio) WHERE id = ?')
    .run(mbtiType || null, avatar || null, bio || null, req.user.id)
  const user = db.prepare('SELECT id, username, mbti_type, avatar, bio FROM users WHERE id = ?').get(req.user.id)
  res.json({ user })
})

export { router as authRoutes }
