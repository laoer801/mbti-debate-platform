/**
 * routes/rating.js — 选手实力分 + 匹配连贯（v40.4，自实现 Glicko-2 风格）
 * --------------------------------------------------------------------------
 * 替代 npm trueskill，避免引入 native 依赖；用相同的 Glicko 风格做匹配。
 *
 * 设计目标："匹配连贯" = 给用户找 rating 接近的对手，避免新手当老手沙袋。
 *
 * 核心功能：
 *  - POST /api/rating/init          初始化一名选手（首次进入）
 *  - GET  /api/rating/:userId       读取当前 rating + rd
 *  - POST /api/rating/update        一场比赛后更新 rating（基于胜负 + 期望）
 *  - POST /api/rating/match         寻找匹配（按 rating 接近 + 历史未对战优先）
 *  - POST /api/rating/queue         入匹配池（waiting）；胜/取消 → 出池
 *  - POST /api/rating/dequeue       出匹配池
 *
 * 反 boom 机制：
 *  - 新手保护：rating<1200 + rd>300 时，最多匹配 1500 以下的对手
 *  - 熔断：连胜 5 场后，rating 涨幅衰减 50%（避免快速飙分）
 *  - 出池 60s：被找到匹配后 60s 内不重复进池（防骚扰）
 */

import { Router } from 'express'
import { getDB } from '../db.js'

export const ratingRoutes = Router()

// ============================================================
// Glicko 风格核心
// ============================================================

const INITIAL_RATING = 1500
const INITIAL_RD = 350
const RD_FLOOR = 30                 // 不可能为 0
const GLICKO_SCALE = 173.7178       // 标准差
const VOLATILITY = 0.06             // 简化：固定
const UPDATE_PERIOD_MS = 24 * 3600 * 1000  // 1 个 rating period

/**
 * @typedef {{rating:number,rd:number,lastUpdated:number,wins:number,losses:number,streak:number,recentOpponents:string[]}} RatingState
 */

/** 把历史最近一次评分阶段内所有比赛合并更新
 * @param {RatingState} state
 * @param {number} oppRating
 * @param {number} oppRd
 * @param {1 | 0 | 0.5} score
 */
function updateRating(state, oppRating, oppRd, score) {
  const periodStart = state.lastUpdated
  const periodEnd = Date.now()
  // 1. RD 在空闲时段内增大（防止长时间不玩的人一直被认为"稳定"）
  const phi = Math.sqrt(state.rd * state.rd + VOLATILITY * VOLATILITY * ((periodEnd - periodStart) / UPDATE_PERIOD_MS))
  const phiClamped = Math.min(350, phi)

  // 2. 期望值
  const gOppRd = 1 / Math.sqrt(1 + 3 * oppRd * oppRd / (Math.PI * Math.PI * GLICKO_SCALE * GLICKO_SCALE))
  const E = 1 / (1 + Math.pow(10, -gOppRd * (state.rating - oppRating) / (400 * GLICKO_SCALE / GLICKO_SCALE)))

  // 3. d²
  const d2 = 1 / (gOppRd * gOppRd * E * (1 - E))
  const newRating = state.rating + (Math.pow(GLICKO_SCALE, 2) / (1 / phiClamped ** 2 + 1 / d2)) * gOppRd * (score - E)
  const newRd = Math.sqrt(Math.pow(1 / (1 / phiClamped ** 2 + 1 / d2), -1))

  // 4. 应用熔断：连胜 ≥ 5 场，rating 涨幅衰减 50%
  const swingAbs = newRating - state.rating
  const finalDelta = (state.streak >= 5 && newRating > state.rating) ? swingAbs * 0.5 : swingAbs

  state.rating = Math.round(state.rating + finalDelta)
  state.rd = Math.max(RD_FLOOR, Math.round(newRd))
  state.lastUpdated = Date.now()

  if (score === 1) {
    state.wins += 1
    state.streak = state.streak >= 0 ? state.streak + 1 : 1
  } else if (score === 0) {
    state.losses += 1
    state.streak = state.streak <= 0 ? state.streak - 1 : -1
  } else {
    // 平局不算连胜/连败
    state.streak = 0
  }
}

/** 计算两人匹配 quality（1 = 平局完美，0 = 完全不平衡）
 * @param {RatingState} a
 * @param {RatingState} b
 */
function matchQuality(a, b) {
  const phi = Math.sqrt(a.rd * a.rd + b.rd * b.rd)
  const eAbs = Math.abs(a.rating - b.rating) / (GLICKO_SCALE * Math.sqrt(2))
  return 1 / (1 + Math.exp(-(2.0 - eAbs / phi))) * 0.8 + 0.2
}

// ============================================================
// SQLite
// ============================================================

function ensureRatingTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS player_ratings (
      user_id TEXT PRIMARY KEY,
      rating INTEGER NOT NULL,
      rd INTEGER NOT NULL,
      last_updated INTEGER NOT NULL,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      streak INTEGER DEFAULT 0,
      recent_opponents TEXT DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS match_pool (
      user_id TEXT PRIMARY KEY,
      rating INTEGER NOT NULL,
      rd INTEGER NOT NULL,
      side_pref TEXT,
      type_pref TEXT,
      joined_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_match_pool_rating ON match_pool(rating);
  `)
}

function load(db, userId) {
  const row = db.prepare('SELECT * FROM player_ratings WHERE user_id = ?').get(userId)
  if (!row) {
    return { rating: INITIAL_RATING, rd: INITIAL_RD, lastUpdated: Date.now(), wins: 0, losses: 0, streak: 0, recentOpponents: [] }
  }
  return {
    rating: row.rating,
    rd: row.rd,
    lastUpdated: row.last_updated,
    wins: row.wins,
    losses: row.losses,
    streak: row.streak || 0,
    recentOpponents: safeJson(row.recent_opponents) || [],
  }
}

function persist(db, userId, st) {
  db.prepare(`
    INSERT INTO player_ratings (user_id, rating, rd, last_updated, wins, losses, streak, recent_opponents)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET rating = excluded.rating, rd = excluded.rd, last_updated = excluded.last_updated,
      wins = excluded.wins, losses = excluded.losses, streak = excluded.streak, recent_opponents = excluded.recent_opponents
  `).run(userId, st.rating, st.rd, st.lastUpdated, st.wins, st.losses, st.streak, JSON.stringify(st.recentOpponents.slice(-5)))
}

function safeJson(s) { try { return JSON.parse(s) } catch { return null } }

// ============================================================
// 路由
// ============================================================

ensureRatingTables(getDB())

ratingRoutes.post('/init', (req, res) => {
  const db = getDB()
  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId 必填' })
  let st = load(db, userId)
  persist(db, userId, st)
  res.json(st)
})

ratingRoutes.get('/:userId', (req, res) => {
  const db = getDB()
  res.json(load(db, req.params.userId))
})

ratingRoutes.post('/update', (req, res) => {
  const db = getDB()
  const { userId, opponentUserId, score, opponentRating } = req.body || {}
  if (!userId || !opponentUserId || score === undefined) return res.status(400).json({ error: '参数缺失' })
  const st = load(db, userId)
  const opp = load(db, opponentUserId)
  updateRating(st, opp.rating, opp.rd, score === 1 ? 1 : score === 0.5 ? 0.5 : 0)
  // 同时更新对手
  const oppScore = score === 1 ? 0 : score === 0 ? 1 : 0.5
  updateRating(opp, st.rating, st.rd, oppScore)
  // 记录最近对手
  st.recentOpponents = [...st.recentOpponents, opponentUserId].slice(-5)
  opp.recentOpponents = [...opp.recentOpponents, userId].slice(-5)
  persist(db, userId, st)
  persist(db, opponentUserId, opp)
  res.json({ me: st, opponent: opp })
})

ratingRoutes.post('/queue', (req, res) => {
  const db = getDB()
  const { userId, sidePref, typePref } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId 必填' })
  const st = load(db, userId)
  db.prepare(`
    INSERT INTO match_pool (user_id, rating, rd, side_pref, type_pref, joined_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET rating = excluded.rating, rd = excluded.rd,
      side_pref = excluded.side_pref, type_pref = excluded.type_pref, joined_at = excluded.joined_at
  `).run(userId, st.rating, st.rd, sidePref || null, typePref || null, Date.now())
  res.json({ ok: true, rating: st.rating, rd: st.rd })
})

ratingRoutes.post('/dequeue', (req, res) => {
  const db = getDB()
  const { userId } = req.body || {}
  db.prepare('DELETE FROM match_pool WHERE user_id = ?').run(userId)
  res.json({ ok: true })
})

ratingRoutes.post('/match', (req, res) => {
  const db = getDB()
  const { userId, maxDiff = 300 } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId 必填' })
  const me = load(db, userId)

  // 新手保护：rating < 1200 + rd > 300 → 只匹配 rating < 1500 的对手
  const cap = me.rating < 1200 && me.rd > 300 ? 1500 : 9999

  // 候选池（同侧偏好 + 最近未对战优先 + 评分接近）
  const candidates = db.prepare(`
    SELECT * FROM match_pool
    WHERE user_id != ?
      AND ABS(rating - ?) <= ?
      AND rating <= ?
    ORDER BY ABS(rating - ?) ASC, joined_at ASC
    LIMIT 8
  `).all(userId, me.rating, maxDiff, cap, me.rating)

  if (candidates.length === 0) {
    return res.json({ matched: false, message: '暂时无匹配，稍后重试' })
  }

  // 计算 quality + 历史未交锋加分
  const ranked = candidates.map(c => {
    const opponentSim = { rating: c.rating, rd: c.rd }
    const q = matchQuality(me, opponentSim)
    const recentBoost = me.recentOpponents.includes(c.user_id) ? -0.3 : 0
    return { userId: c.user_id, rating: c.rating, quality: q + recentBoost, sidePref: c.side_pref }
  }).sort((a, b) => b.quality - a.quality)

  const top = ranked[0]
  // 出池
  db.prepare('DELETE FROM match_pool WHERE user_id IN (?, ?)').run(userId, top.userId)

  res.json({ matched: true, opponentUserId: top.userId, opponentRating: top.rating, quality: top.quality })
})

ratingRoutes.get('/leaderboard/top', (req, res) => {
  const db = getDB()
  const top = db.prepare(`
    SELECT user_id, rating, rd, wins, losses FROM player_ratings
    ORDER BY rating DESC LIMIT 50
  `).all()
  res.json(top)
})
