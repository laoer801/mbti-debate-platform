/**
 * v40.1 人格强度 + 校准路由
 *
 * 端点：
 *   POST /api/persona/calibrate   提交 60 题答案 → 服务端校验 → 计算结果 → 存 persona_calibration
 *   GET  /api/persona/calibration/:userId 取该用户最近一次校准结果（可选手册）
 *   POST /api/persona/intensity     存用户对每人格的强度档（1-5）
 *   GET  /api/persona/intensity     取（user_id + 16 人格 强度）
 *   POST /api/persona/verify        行为验证：把一段发言交给服务端 → 返回 consistency / forbiddenHits / issues
 */

import { Router } from 'express'
import { getDB } from '../db.js'

export const personaRoutes = Router()

// ============ 校准：60 题量表 ============

// (TS interface removed)

/**
 * 服务端版本的 60 题计分（与前端 personalityValidation.ts computeScore60 完全一致）
 * 重复实现是为了避免对前端 TS 代码的依赖；将来可提取为共享包。
 */
function computeScore60OnServer(answers) {
  if (!Array.isArray(answers) || answers.length !== 60) {
    throw new Error('answers 必须是长度 60 的数组')
  }
  if (answers.some(a => typeof a !== 'number' || a < 0 || a > 6 || !Number.isInteger(a))) {
    throw new Error('每题分数必须为 0-6 整数')
  }

  const QUESTIONS_BY_DIM = {
    EI: 14, NS: 16, TF: 15, JP: 15,
  }
  // 与前端 QUESTION_60 极性一致
  const POLARITY = [
    1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1,             // 1-14 EI
    1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1,       // 15-30 NS
    1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1,          // 31-45 TF (15 题)
    1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1,          // 46-60 JP
  ]

  const sums = { EI: 0, NS: 0, TF: 0, JP: 0 }
  const maxs = { EI: 0, NS: 0, TF: 0, JP: 0 }
  for (let i = 0; i < 60; i++) {
    const dim = ['EI', 'EI', 'EI', 'EI', 'EI', 'EI', 'EI', 'EI', 'EI', 'EI', 'EI', 'EI', 'EI', 'EI',
                 'NS', 'NS', 'NS', 'NS', 'NS', 'NS', 'NS', 'NS', 'NS', 'NS', 'NS', 'NS', 'NS', 'NS', 'NS', 'NS',
                 'TF', 'TF', 'TF', 'TF', 'TF', 'TF', 'TF', 'TF', 'TF', 'TF', 'TF', 'TF', 'TF', 'TF', 'TF',
                 'JP', 'JP', 'JP', 'JP', 'JP', 'JP', 'JP', 'JP', 'JP', 'JP', 'JP', 'JP', 'JP', 'JP', 'JP'][i]
    maxs[dim] += 36 // 6 × 6
    if (POLARITY[i] === 1) sums[dim] += answers[i] * 6
    else sums[dim] += (6 - answers[i]) * 6
  }
  const E = Math.round((sums.EI / maxs.EI) * 100)
  const N = Math.round((sums.NS / maxs.NS) * 100)
  const T = Math.round((sums.TF / maxs.TF) * 100)
  const J = Math.round((sums.JP / maxs.JP) * 100)
  const type = (E >= 50 ? 'E' : 'I') + (N >= 50 ? 'N' : 'S') + (T >= 50 ? 'T' : 'F') + (J >= 50 ? 'J' : 'P')
  const biases = [E, N, T, J].map(s => Math.min(s, 100 - s))
  const intensity = Math.max(0, Math.round(100 - Math.min(...biases) * 2))
  return { E, N, T, J, type, intensity }
}

personaRoutes.post('/calibrate', (req, res) => {
  try {
    const body = req.body || {}
    const answers = body.answers
    const userId = (req.headers['x-user-id'] || body.userId || 'anonymous').toString()
    const typeId = (body.typeId || 'self').toString()

    const result = computeScore60OnServer(answers)
    const now = Date.now()

    const db = getDB()
    db.prepare(`
      INSERT OR REPLACE INTO persona_calibration
        (user_id, type_id, e_score, n_score, t_score, j_score, result_type, intensity_score, filled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, typeId, result.E, result.N, result.T, result.J, result.type, result.intensity, now)

    res.json({ ok: true, calibration: { ...result, userId, typeId, filledAt: now } })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

personaRoutes.get('/calibration/:userId', (req, res) => {
  const db = getDB()
  const rows = db.prepare('SELECT * FROM persona_calibration WHERE user_id = ? ORDER BY filled_at DESC').all(req.params.userId)
  res.json({ calibrations: rows })
})

// ============ 用户强度档（1-5） ============

personaRoutes.post('/intensity', (req, res) => {
  try {
    const { typeId, level } = req.body || {}
    if (!typeId || ![1, 2, 3, 4, 5].includes(level)) {
      return res.status(400).json({ error: 'typeId + level（1-5）必填' })
    }
    const userId = (req.headers['x-user-id'] || 'anonymous').toString()
    const db = getDB()

    // 临时表：本地键值存储
    db.prepare(`
      CREATE TABLE IF NOT EXISTS persona_intensity (
        user_id TEXT NOT NULL,
        type_id TEXT NOT NULL,
        level INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, type_id)
      )
    `).run()
    db.prepare(`
      INSERT OR REPLACE INTO persona_intensity (user_id, type_id, level, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, typeId, level, Date.now())

    res.json({ ok: true, typeId, level })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

personaRoutes.get('/intensity', (req, res) => {
  const userId = (req.headers['x-user-id'] || 'anonymous').toString()
  const db = getDB()
  const rows = db.prepare('SELECT type_id, level, updated_at FROM persona_intensity WHERE user_id = ?').all(userId)
  res.json({ intensities: rows })
})

// ============ 行为验证（简易版，前端有完整版） ============

personaRoutes.post('/verify', (req, res) => {
  try {
    const { typeId, content } = req.body || {}
    if (!typeId || !content) {
      return res.status(400).json({ error: 'typeId + content 必填' })
    }
    // 极简规则（与前端 behaviorCheck 一致；将来用 prompt-engineering-expert-v2 skill 升级）
    const forbiddenPatterns = {
      INTJ: [/太棒了/, /超有意思/, /哈哈哈/],
      ENFP: [/啊啊啊|笑死/], // 严肃场景下拦截
      ISTJ: [/(大概|可能|也许)吗/],
    }
    const patterns = forbiddenPatterns[typeId] || []
    let forbiddenHits = 0
    const issues = []
    for (const p of patterns) {
      const m = content.match(p)
      if (m) {
        forbiddenHits += m.length
        issues.push(`违反规则「${p.source}」×${m.length}`)
      }
    }
    const consistency = Math.max(0, 100 - forbiddenHits * 15 - Math.max(0, content.length - 220))
    res.json({ ok: true, consistency, forbiddenHits, issues })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})
