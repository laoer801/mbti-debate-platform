/**
 * v40.6 知乎账号绑定 + Cookie 登录 + 收藏夹同步路由
 *
 * 端点：
 *   GET    /api/zhihu-auth/me                当前用户的知乎绑定状态（不含 cookie）
 *   POST   /api/zhihu-auth/bind              { z_c0 } 验证 cookie 后绑定
 *   DELETE /api/zhihu-auth/bind              解绑
 *   POST   /api/zhihu-auth/login             { z_c0 } 仅用知乎 cookie 创建/登录账号（返回 JWT）
 *   GET    /api/zhihu-auth/favlists          拉当前绑定知乎账号下的收藏夹列表
 *   POST   /api/zhihu-auth/favlists          { title, description, is_public } 创建收藏夹
 *   POST   /api/zhihu-auth/sync              { target_favlist_id, items: [{content_type, content_id}] } 批量同步
 *
 * 说明：
 *   知乎 2026 年已关闭公开 OAuth 注册通道，本路由用 cookie 注入方案：
 *   用户从浏览器 DevTools → Application → Cookies → 复制 z_c0 的 Value
 *   后端加密存储（server/utils/secret-box.js）用于调知乎前端 API
 */

import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { v4 as uuid } from 'uuid'
import { getDB } from '../db.js'
import { authMiddleware } from './auth.js'
import { JWT_SECRET } from '../secret.js'
import { encrypt, decrypt } from '../utils/secret-box.js'
import {
  validateCookie,
  listFavlists,
  createFavlist,
  addToFavlist,
} from '../utils/zhihuUserApi.js'

export const zhihuAuthRoutes = Router()

// 校验 z_c0 格式（知乎 cookie 是 base64-ish 字符串，长度通常 80-200）
function isValidZc0(s) {
  return typeof s === 'string' && /^[A-Za-z0-9_\-+/=]{60,300}$/.test(s.trim())
}

// 把绑定记录转换成对外暴露的字段（绝不含密文）
function publicBinding(row) {
  if (!row) return null
  return {
    bound: true,
    zhihuUserId: row.zhihu_user_id,
    zhihuUsername: row.zhihu_username,
    zhihuAvatar: row.zhihu_avatar,
    status: row.status,
    boundAt: row.bound_at,
    lastUsedAt: row.last_used_at,
    lastVerifyAt: row.last_verify_at,
  }
}

// 解密当前用户绑定的 z_c0
function loadDecryptedZc0(db, user_id) {
  const row = db
    .prepare('SELECT z_c0_ciphertext, z_c0_iv, z_c0_tag, status FROM user_zhihu_bindings WHERE user_id = ?')
    .get(user_id)
  if (!row) return null
  if (row.status !== 'active') return null
  return decrypt({
    ciphertext: row.z_c0_ciphertext,
    iv: row.z_c0_iv,
    tag: row.z_c0_tag,
  })
}

// ============================================================
// 1. 当前用户的知乎绑定状态
// ============================================================
zhihuAuthRoutes.get('/me', authMiddleware, (req, res) => {
  const db = getDB()
  const row = db
    .prepare(
      'SELECT zhihu_user_id, zhihu_username, zhihu_avatar, status, bound_at, last_used_at, last_verify_at FROM user_zhihu_bindings WHERE user_id = ?'
    )
    .get(req.user.id)
  res.json({ binding: publicBinding(row) })
})

// ============================================================
// 2. 绑定知乎账号
// ============================================================
zhihuAuthRoutes.post('/bind', authMiddleware, async (req, res) => {
  const { z_c0 } = req.body || {}
  if (!isValidZc0(z_c0)) {
    return res.status(400).json({ error: 'z_c0 cookie 格式不正确（应为浏览器 Cookie 中的 Value）' })
  }
  let me
  try {
    me = await validateCookie(z_c0.trim())
  } catch (e) {
    if (e.code === 'ZHIHU_AUTH_INVALID') {
      return res.status(401).json({ error: '知乎 cookie 无效或已过期，请重新复制', detail: e.detail })
    }
    return res.status(502).json({ error: '知乎验证失败：' + (e.message || '��知错误') })
  }

  let payload
  try {
    payload = encrypt(z_c0.trim())
  } catch (e) {
    return res.status(500).json({ error: '加密失败：' + (e.message || e) })
  }

  const db = getDB()
  const now = Date.now()
  // upsert：同一用户已有绑定则覆盖
  db.prepare(
    `INSERT INTO user_zhihu_bindings
     (user_id, zhihu_user_id, zhihu_username, zhihu_avatar, z_c0_ciphertext, z_c0_iv, z_c0_tag, status, bound_at, last_used_at, last_verify_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       zhihu_user_id = excluded.zhihu_user_id,
       zhihu_username = excluded.zhihu_username,
       zhihu_avatar = excluded.zhihu_avatar,
       z_c0_ciphertext = excluded.z_c0_ciphertext,
       z_c0_iv = excluded.z_c0_iv,
       z_c0_tag = excluded.z_c0_tag,
       status = 'active',
       bound_at = excluded.bound_at,
       last_verify_at = excluded.last_verify_at`
  ).run(
    req.user.id,
    me.id,
    me.name,
    me.avatar_url,
    payload.ciphertext,
    payload.iv,
    payload.tag,
    now,
    now,
    now
  )

  res.json({
    ok: true,
    binding: {
      bound: true,
      zhihuUserId: me.id,
      zhihuUsername: me.name,
      zhihuAvatar: me.avatar_url,
      status: 'active',
      boundAt: now,
      lastVerifyAt: now,
    },
  })
})

// ============================================================
// 3. 解绑
// ============================================================
zhihuAuthRoutes.delete('/bind', authMiddleware, (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM user_zhihu_bindings WHERE user_id = ?').run(req.user.id)
  res.json({ ok: true })
})

// ============================================================
// 4. 用知乎 cookie 直接登录（无本地账号则自动创建）
// ============================================================
zhihuAuthRoutes.post('/login', async (req, res) => {
  const { z_c0, mbtiType } = req.body || {}
  if (!isValidZc0(z_c0)) {
    return res.status(400).json({ error: 'z_c0 cookie 格式不正确' })
  }
  let me
  try {
    me = await validateCookie(z_c0.trim())
  } catch (e) {
    if (e.code === 'ZHIHU_AUTH_INVALID') {
      return res.status(401).json({ error: '知乎 cookie 无效或已过期', detail: e.detail })
    }
    return res.status(502).json({ error: '知乎验证失败：' + (e.message || '未知错误') })
  }

  const db = getDB()
  // 按 zhihu_user_id 查找已绑定用户
  let row = db
    .prepare(
      `SELECT u.id, u.username, u.mbti_type, u.avatar, u.bio, u.banned, u.role FROM users u
       INNER JOIN user_zhihu_bindings b ON b.user_id = u.id WHERE b.zhihu_user_id = ?`
    )
    .get(me.id)

  // 已绑定：直接登录
  if (row) {
    if (row.banned) return res.status(403).json({ error: '账号已被封禁' })
    db.prepare('UPDATE users SET login_at = ? WHERE id = ?').run(Date.now(), row.id)
    // 更新绑定 cookie
    const payload = encrypt(z_c0.trim())
    db.prepare(
      `UPDATE user_zhihu_bindings SET z_c0_ciphertext=?, z_c0_iv=?, z_c0_tag=?, status='active', last_used_at=?, last_verify_at=? WHERE user_id=?`
    ).run(payload.ciphertext, payload.iv, payload.tag, Date.now(), Date.now(), row.id)
    const token = jwt.sign(
      { id: row.id, username: row.username, mbtiType: row.mbti_type, role: row.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    )
    return res.json({
      token,
      user: {
        id: row.id,
        username: row.username,
        mbtiType: row.mbti_type,
        avatar: row.avatar,
        bio: row.bio,
        role: row.role,
      },
      binding: { zhihuUserId: me.id, zhihuUsername: me.name, zhihuAvatar: me.avatar_url },
    })
  }

  // 未绑定：自动创建本地账号（用户名 = 知乎昵称）
  const baseUsername = (me.name || `zh_${me.id}`).replace(/[^\u4e00-\u9fa5A-Za-z0-9_-]/g, '_').slice(0, 20)
  let username = baseUsername
  let suffix = 1
  while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    username = `${baseUsername}_${suffix++}`.slice(0, 20)
    if (suffix > 50) {
      username = `zh_${me.id}`.slice(0, 20)
      break
    }
  }

  const userId = uuid()
  const adminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c
  const role = adminCount === 0 ? 'admin' : 'user'
  const now = Date.now()
  db.prepare(
    `INSERT INTO users (id, username, password, mbti_type, avatar, bio, role, created_at, login_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    username,
    '!ZHIHU_OAUTH_NO_PASSWORD', // 标记：知乎登录用户，无本地密码
    typeof mbtiType === 'string' ? mbtiType : null,
    me.avatar_url || '',
    me.headline || '',
    role,
    now,
    now
  )

  // 绑定 z_c0
  const payload = encrypt(z_c0.trim())
  db.prepare(
    `INSERT INTO user_zhihu_bindings
     (user_id, zhihu_user_id, zhihu_username, zhihu_avatar, z_c0_ciphertext, z_c0_iv, z_c0_tag, status, bound_at, last_used_at, last_verify_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
  ).run(
    userId,
    me.id,
    me.name,
    me.avatar_url,
    payload.ciphertext,
    payload.iv,
    payload.tag,
    now,
    now,
    now
  )

  const token = jwt.sign(
    { id: userId, username, mbtiType: mbtiType || null, role },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
  res.json({
    token,
    user: { id: userId, username, mbtiType: mbtiType || null, avatar: me.avatar_url, role },
    binding: { zhihuUserId: me.id, zhihuUsername: me.name, zhihuAvatar: me.avatar_url },
  })
})

// ============================================================
// 5. 拉绑定的知乎账号收藏夹列表
// ============================================================
zhihuAuthRoutes.get('/favlists', authMiddleware, async (req, res) => {
  const db = getDB()
  let z_c0
  try {
    z_c0 = loadDecryptedZc0(db, req.user.id)
  } catch (e) {
    return res.status(500).json({ error: '解密 cookie 失败：' + (e.message || e) })
  }
  if (!z_c0) {
    return res.status(400).json({ error: '尚未绑定知乎账号或 cookie 已失效，请重新绑定' })
  }
  try {
    const favlists = await listFavlists(z_c0)
    db.prepare('UPDATE user_zhihu_bindings SET last_used_at = ? WHERE user_id = ?').run(
      Date.now(),
      req.user.id
    )
    res.json({ favlists })
  } catch (e) {
    if (e.code === 'ZHIHU_AUTH_INVALID') {
      db.prepare(`UPDATE user_zhihu_bindings SET status = 'expired' WHERE user_id = ?`).run(
        req.user.id
      )
      return res.status(401).json({ error: '知乎 cookie 已失效，请重新绑定', detail: e.detail })
    }
    res.status(502).json({ error: '拉取收藏夹失败：' + (e.message || '未知错误') })
  }
})

// ============================================================
// 6. 创建收藏夹
// ============================================================
zhihuAuthRoutes.post('/favlists', authMiddleware, async (req, res) => {
  const { title, description = '', is_public = false } = req.body || {}
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title 必填' })
  }
  const db = getDB()
  let z_c0
  try {
    z_c0 = loadDecryptedZc0(db, req.user.id)
  } catch (e) {
    return res.status(500).json({ error: '解密 cookie 失败：' + (e.message || e) })
  }
  if (!z_c0) return res.status(400).json({ error: '尚未绑定知乎账号或 cookie 已失效' })

  try {
    const created = await createFavlist(z_c0, {
      title: title.trim().slice(0, 50),
      description: String(description).slice(0, 200),
      is_public: Boolean(is_public),
    })
    res.json({ ok: true, favlist: { id: created.id, title: created.title } })
  } catch (e) {
    if (e.code === 'ZHIHU_AUTH_INVALID') {
      db.prepare(`UPDATE user_zhihu_bindings SET status = 'expired' WHERE user_id = ?`).run(
        req.user.id
      )
      return res.status(401).json({ error: '知乎 cookie 已失效' })
    }
    res.status(502).json({ error: '创建收藏夹失败：' + (e.message || '未知错误') })
  }
})

// ============================================================
// 7. 批量同步收藏到知乎收藏夹
// ============================================================
zhihuAuthRoutes.post('/sync', authMiddleware, async (req, res) => {
  const { target_favlist_id, items } = req.body || {}
  if (!target_favlist_id || typeof target_favlist_id !== 'number') {
    return res.status(400).json({ error: 'target_favlist_id 必填（数字）' })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items 必填且至少 1 条' })
  }
  if (items.length > 100) {
    return res.status(400).json({ error: '单次最多同步 100 条' })
  }
  const db = getDB()
  let z_c0
  try {
    z_c0 = loadDecryptedZc0(db, req.user.id)
  } catch (e) {
    return res.status(500).json({ error: '解密 cookie 失败：' + (e.message || e) })
  }
  if (!z_c0) return res.status(400).json({ error: '尚未绑定知乎账号或 cookie 已失效' })

  const now = Date.now()
  const results = []
  for (const it of items) {
    const log = {
      user_id: req.user.id,
      item_type: it.content_type,
      item_id: String(it.content_id),
      target_favlist_id,
      synced_at: now,
    }
    if (!['answer', 'article', 'question'].includes(it.content_type)) {
      results.push({ ...it, status: 'skipped', message: 'content_type 不支持' })
      db.prepare(
        `INSERT INTO zhihu_sync_log (user_id, item_type, item_id, target_favlist_id, status, message, synced_at) VALUES (?, ?, ?, ?, 'skipped', ?, ?)`
      ).run(log.user_id, log.item_type, log.item_id, log.target_favlist_id, 'content_type 不支持', now)
      continue
    }
    try {
      await addToFavlist(z_c0, target_favlist_id, it.content_type, it.content_id)
      results.push({ ...it, status: 'success' })
      db.prepare(
        `INSERT INTO zhihu_sync_log (user_id, item_type, item_id, target_favlist_id, status, message, synced_at) VALUES (?, ?, ?, ?, 'success', '', ?)`
      ).run(log.user_id, log.item_type, log.item_id, log.target_favlist_id, now)
    } catch (e) {
      const message = (e.message || '未知错误').slice(0, 200)
      results.push({ ...it, status: 'failed', message })
      db.prepare(
        `INSERT INTO zhihu_sync_log (user_id, item_type, item_id, target_favlist_id, status, message, synced_at) VALUES (?, ?, ?, ?, 'failed', ?, ?)`
      ).run(log.user_id, log.item_type, log.item_id, log.target_favlist_id, message, now)
      if (e.code === 'ZHIHU_AUTH_INVALID') {
        db.prepare(`UPDATE user_zhihu_bindings SET status = 'expired' WHERE user_id = ?`).run(
          req.user.id
        )
        return res.status(401).json({
          error: '知乎 cookie 已失效，请重新绑定',
          results,
        })
      }
    }
  }

  db.prepare('UPDATE user_zhihu_bindings SET last_used_at = ? WHERE user_id = ?').run(
    Date.now(),
    req.user.id
  )

  const success = results.filter((r) => r.status === 'success').length
  const failed = results.filter((r) => r.status === 'failed').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  res.json({ ok: failed === 0, summary: { total: results.length, success, failed, skipped }, results })
})

// ============================================================
// 8. 同步日志（调试用）
// ============================================================
zhihuAuthRoutes.get('/sync-log', authMiddleware, (req, res) => {
  const db = getDB()
  const rows = db
    .prepare(
      `SELECT id, item_type AS itemType, item_id AS itemId, target_favlist_id AS targetFavlistId, status, message, synced_at AS syncedAt
       FROM zhihu_sync_log WHERE user_id = ? ORDER BY synced_at DESC LIMIT 50`
    )
    .all(req.user.id)
  res.json({ log: rows })
})

// 导出内部工具给同进程其他路由复用（favorites 同步知乎时要用）
export { loadDecryptedZc0 }