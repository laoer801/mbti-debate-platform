/**
 * v40.8 PK 自动模式
 *
 * 三大保证：
 * 1) 阶段到点必自动推进（无需用户点）
 * 2) 自由辩论阶段，只要人类沉默 N 秒，AI 主动持续发言（人格不中断）
 * 3) 总结阶段到点必自动调用裁判 → LLM 出总结报告 → 写库
 *
 * 同时防御「AI 装糊涂」：调用 LLM 失败/返回装糊涂内容时，触发兜底重试，
 * 仍失败则用预设的「话题引用型安全开场句」保住系统不空转。
 */

import { getDB } from './db.js'
import { generateAIReply } from './ai-opponent.js'
import { AI_LEVELS } from './ai-opponent.js'
import { aiJudgeDebate } from './pk-judge-ai.js'

const PHASE_FLOW = ['preparation', 'opening', 'free_debate', 'closing', 'judging']
const PHASE_DURATION_AI = {
  preparation: 8,
  opening: 90,     // AI 房立论 90s（够说 6~10 句）
  free_debate: 180, // AI 房自由辩论 3 分钟（自循环节奏）
  closing: 75,     // AI 房总结 75s
  judging: 20,
}
const FREE_DEBATE_AI_TICK_MS = 6500       // AI 自循环节奏：每 6.5s 看一次要不要说
const FREE_DEBATE_SILENCE_THRESHOLD_MS = 7500  // 人类沉默 7.5s 视为放弃本轮
const OPENING_KICKOFF_MS = 3500
const CLOSING_KICKOFF_MS = 3500

// 内存级调度表（重启后丢，但 setTimeout 本来就不持久；阶段可由客户端事件触发回灌）
const phaseTimers = new Map()      // roomId -> setTimeout handle（阶段推进）
const debateLoops = new Map()       // roomId -> setTimeout handle（自由辩论自循环）

export function clearAutoModeTimers(roomId) {
  if (phaseTimers.has(roomId)) { clearTimeout(phaseTimers.get(roomId)); phaseTimers.delete(roomId) }
  if (debateLoops.has(roomId)) { clearTimeout(debateLoops.get(roomId)); debateLoops.delete(roomId) }
}

export function clearAllAutoModeTimers() {
  for (const t of phaseTimers.values()) clearTimeout(t)
  for (const t of debateLoops.values()) clearTimeout(t)
  phaseTimers.clear(); debateLoops.clear()
}

// ============================================================
// 1) 阶段到点自动推进
// ============================================================
export function scheduleAutoAdvance(app, roomId, phase, durationMs) {
  clearAutoModeTimers_phase(roomId)
  if (!durationMs || durationMs <= 0) return
  const next = nextPhaseOf(phase)
  if (!next) return
  const handle = setTimeout(async () => {
    phaseTimers.delete(roomId)
    await autoAdvance(app, roomId, phase, next)
  }, durationMs)
  phaseTimers.set(roomId, handle)
  console.log(`[PK-AUTO] ${roomId} ${phase} → ${next} 将在 ${Math.round(durationMs / 1000)}s 后自动推进`)
}

function clearAutoModeTimers_phase(roomId) {
  if (phaseTimers.has(roomId)) { clearTimeout(phaseTimers.get(roomId)); phaseTimers.delete(roomId) }
}

function nextPhaseOf(phase) {
  const i = PHASE_FLOW.indexOf(phase)
  if (i < 0 || i >= PHASE_FLOW.length - 1) return null
  return PHASE_FLOW[i + 1]
}

async function autoAdvance(app, roomId, fromPhase, toPhase) {
  const db = getDB()
  const room = db.prepare('SELECT * FROM pk_rooms WHERE id = ?').get(roomId)
  if (!room) return
  if (room.current_phase !== fromPhase) return // 已被手动切走

  // judging 阶段自动收尾：直接触发评分
  if (toPhase === 'judging') {
    db.prepare('UPDATE pk_rooms SET current_phase = ?, phase_started_at = ?, phase_duration = ? WHERE id = ?')
      .run('judging', Date.now(), PHASE_DURATION_AI.judging, roomId)
    app.get('io')?.to(`pk-room-${roomId}`).emit('phase-changed', { phase: 'judging', startedAt: Date.now(), duration: PHASE_DURATION_AI.judging * 1000 })
    console.log(`[PK-AUTO] ${roomId} 进入 judging，触发自动裁判`)
    await triggerJudgeAndSummary(app, roomId)
    return
  }

  // 切到下一发言阶段：先停止自循环，再启动新的循环 + 阶段定时器
  stopFreeDebateLoop(roomId)
  const dur = PHASE_DURATION_AI[toPhase] || 60
  db.prepare('UPDATE pk_rooms SET current_phase = ?, phase_started_at = ?, phase_duration = ? WHERE id = ?')
    .run(toPhase, Date.now(), dur, roomId)
  app.get('io')?.to(`pk-room-${roomId}`).emit('phase-changed', { phase: toPhase, startedAt: Date.now(), duration: dur * 1000 })

  if (room.ai_mode) {
    // 给正方（用户）自动喊一次「请发言」机会：先让 turn 回到人类
    const human = db.prepare(`SELECT user_id FROM pk_participants WHERE room_id = ? AND user_id NOT LIKE 'ai\\_\\_%' ESCAPE '\\'`).get(roomId)?.user_id
    if (human) db.prepare('UPDATE pk_rooms SET turn_user_id = ? WHERE id = ?').run(human, roomId)
    if (toPhase === 'opening' || toPhase === 'closing') {
      setTimeout(() => triggerAIKickoff(app, roomId), toPhase === 'closing' ? CLOSING_KICKOFF_MS : OPENING_KICKOFF_MS)
    } else if (toPhase === 'free_debate') {
      startFreeDebateLoop(app, roomId)
    }
  }

  scheduleAutoAdvance(app, roomId, toPhase, dur * 1000)
}

// ============================================================
// 2) AI 自循环（自由辩论）：人类沉默就持续替反方发言
// ============================================================
export function startFreeDebateLoop(app, roomId) {
  stopFreeDebateLoop(roomId)
  const tick = async () => {
    try {
      const db = getDB()
      const room = db.prepare('SELECT * FROM pk_rooms WHERE id = ?').get(roomId)
      if (!room || room.current_phase !== 'free_debate' || !room.ai_mode) return
      const aiId = (() => {
        const lv = AI_LEVELS[room.ai_level || 'beginner']
        return lv ? lv.id : null
      })()
      const humanId = db.prepare(`SELECT user_id FROM pk_participants WHERE room_id = ? AND user_id NOT LIKE 'ai\\_\\_%' ESCAPE '\\'`).get(roomId)?.user_id
      if (!aiId || !humanId) return
      const humanLast = db.prepare('SELECT created_at FROM pk_moves WHERE room_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1').get(roomId, humanId)?.created_at || 0
      const aiLast = db.prepare('SELECT created_at FROM pk_moves WHERE room_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1').get(roomId, aiId)?.created_at || 0
      const now = Date.now()
      // 沉默超过阈值 OR AI 已经在最近 8 秒发过则本 tick 跳过
      const humanSilent = (now - humanLast) > FREE_DEBATE_SILENCE_THRESHOLD_MS
      const aiJustSpoke = (now - aiLast) < 8000
      if (humanSilent && !aiJustSpoke) {
        await safeAIReply(app, roomId, { mode: 'self-loop' })
      }
    } catch (e) {
      console.warn('[PK-AUTO] free_debate tick err:', e.message)
    } finally {
      // 继续下一 tick
      if (!debateLoops.has(roomId)) return
      const h = setTimeout(tick, FREE_DEBATE_AI_TICK_MS)
      debateLoops.set(roomId, h)
    }
  }
  const h = setTimeout(tick, FREE_DEBATE_AI_TICK_MS)
  debateLoops.set(roomId, h)
  console.log(`[PK-AUTO] ${roomId} 自由辩论自循环已启动`)
}

export function stopFreeDebateLoop(roomId) {
  if (debateLoops.has(roomId)) { clearTimeout(debateLoops.get(roomId)); debateLoops.delete(roomId) }
}

async function triggerAIKickoff(app, roomId) {
  try { await safeAIReply(app, roomId, { kickoff: true }) } catch (e) { console.warn('[PK-AUTO] kickoff err:', e.message) }
}

// ============================================================
// 3) 自动裁判 + LLM 总结报告
// ============================================================
// 兜底启发式裁判（aiJudgeDebate 失败时用；保证流程不中断）
function heuristicJudge(room, participants, moves) {
  const byUser = {}
  for (const p of participants) byUser[p.user_id] = { ...p, totalChars: 0, count: 0 }
  for (const m of moves) {
    if (byUser[m.user_id]) {
      byUser[m.user_id].totalChars += (m.content || '').length
      byUser[m.user_id].count++
    }
  }
  const results = []
  let winner = null, maxTotal = -1
  for (const uid of Object.keys(byUser)) {
    const u = byUser[uid]
    const total = Math.min(100, Math.round(u.totalChars / 12 + u.count * 4 + 35))
    results.push({
      userId: u.user_id, username: u.username, total,
      scores: { logic: total, evidence: total - 5, eloquence: total, rebuttal: total - 8, etiquette: total + 5 },
      comment: `启发式评估（AI 裁判失败兜底）：共发言 ${u.count} 条，累计 ${u.totalChars} ��`,
    })
    if (total > maxTotal) { maxTotal = total; winner = uid }
  }
  return {
    results, winner,
    feedback: `自动模式兜底：本场共 ${moves.length} 条发言，启发式判定胜方 ${byUser[winner]?.username || winner}（AI 裁判暂不可用时使用，精度有限，建议查看 pk_moves 原文）。`,
    winnerName: byUser[winner]?.username || winner,
  }
}

async function triggerJudgeAndSummary(app, roomId) {
  const db = getDB()
  // 幂等
  const exist = db.prepare('SELECT 1 FROM pk_judge_results WHERE room_id = ?').get(roomId)
  if (exist) {
    console.log(`[PK-AUTO] ${roomId} ��裁判，跳过`)
    return
  }
  try {
    const room = db.prepare('SELECT * FROM pk_rooms WHERE id = ?').get(roomId)
    if (!room) return
    const participants = db.prepare(`SELECT p.*, u.username, u.mbti_type FROM pk_participants p LEFT JOIN users u ON p.user_id = u.id WHERE p.room_id = ?`).all(roomId)
    const moves = db.prepare(`SELECT m.*, u.username FROM pk_moves m LEFT JOIN users u ON m.user_id = u.id WHERE m.room_id = ? ORDER BY m.created_at ASC`).all(roomId)
    let scores
    try {
      scores = await aiJudgeDebate(room, participants, moves)
      console.log(`[PK-AUTO] ${roomId} 裁判完成 → ${scores.winner}`)
    } catch (e) {
      console.warn(`[PK-AUTO] ${roomId} AI 裁判失败 (${e.message})，回退启发式`)
      scores = heuristicJudge(room, participants, moves)
      console.log(`[PK-AUTO] ${roomId} 启发式裁判完成 → ${scores.winner}`)
    }
    db.prepare(`INSERT INTO pk_judge_results (id, room_id, scores, winner_id, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), roomId, JSON.stringify(scores), scores.winner || null, scores.feedback || '', Date.now())
    console.log(`[PK-AUTO] ${roomId} 裁判完成 → ${scores.winner}`)

    // v40.8.1：裁判与总结之间留 2s 间隔，避免同一进程内连续两次 LLM 调用被上游限流（401/429）
    await new Promise(r => setTimeout(r, 2000))

    // LLM 总结报告
    const summaryText = await generateDebateSummary(room, participants, moves, scores)
    const startedAt = room.started_at || room.created_at
    const durationMs = Date.now() - startedAt
    const winnerSide = scores.winner === room.creator_id ? '正方' : '反方'
    const keyPts = (scores.results || []).map(r => `${r.username || r.userId}: ${(r.comment || '').slice(0, 80)}`).slice(0, 4).join('\n')
    db.prepare(`INSERT OR REPLACE INTO pk_summaries (id, room_id, topic, winner_id, winner_side, summary, key_points, improvement, move_count, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), roomId, room.topic, scores.winner || null, winnerSide, summaryText, keyPts, scores.feedback || '', moves.length, durationMs, Date.now())
    console.log(`[PK-AUTO] ${roomId} 总结报告已保存`)

    // 关闭房间
    db.prepare(`UPDATE pk_rooms SET current_phase = 'finished', winner_id = ? WHERE id = ?`).run(scores.winner || null, roomId)
    app.get('io')?.to(`pk-room-${roomId}`).emit('phase-changed', { phase: 'finished', startedAt: Date.now(), duration: 0 })
    app.get('io')?.to(`pk-room-${roomId}`).emit('judge-result', { scores, winner: scores.winner, feedback: scores.feedback, summary: summaryText })
  } catch (e) {
    console.warn(`[PK-AUTO] ${roomId} 裁判失败:`, e.message)
  }
}

async function generateDebateSummary(room, participants, moves, scores) {
  const { zhihuEnabled, ZH_BASE_CHAT, ZH_MODEL_FAST, ZHIHU_ACCESS_SECRET } = await import('./zhihu.js')
  if (!zhihuEnabled()) {
    console.log('[PK-AUTO] 总结: 知乎未启用，走本地')
    return generateFallbackSummary(room, moves, scores)
  }
  const sysMsg = `你是辩论复盘专家。基于完整交锋记录，输出 280 字以内的中文总结报告，分三段：
【核心交锋】双方各 1 个最强论点
【胜负关键】为什么胜方赢
【学习建议】给正方 1 条改进建议
不要 emoji，不要 Markdown，直接用「【】」分段。`
  // 取最近 14 条发言（与裁判一致，避开 token/credit 触发的 401）
  const lines = moves.slice(-14).map((m, i) => `${i + 1}. [${(m.username || m.user_id || '').slice(0, 12)}] ${(m.content || '').slice(0, 60)}`).join('\n')
  const userMsg = `��题：${room.topic}\n\n交锋节选（共 ${moves.length} 条）：\n${lines}\n\n胜方：${scores.winner || '未分'}。`
  // 两次尝试：第一次 25s，失败/为空再试 25s（不同 prompt）
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const ctrl = new AbortController()
      const tm = setTimeout(() => ctrl.abort(), 25000)
      const res = await fetch(ZH_BASE_CHAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ZHIHU_ACCESS_SECRET}` },
        body: JSON.stringify({ model: ZH_MODEL_FAST, messages: [{ role: 'user', content: sysMsg + '\n\n' + userMsg }], stream: false }),
        signal: ctrl.signal,
      })
      clearTimeout(tm)
      if (!res.ok) {
        console.warn(`[PK-AUTO] 总结 LLM HTTP ${res.status}（尝试 ${attempt}）`)
        continue
      }
      const data = await res.json()
      const text = (data?.choices?.[0]?.message?.content || data?.content || '').trim()
      if (text && text.length >= 30) {
        console.log(`[PK-AUTO] 总结 LLM 成功（尝试 ${attempt}，${text.length} 字）`)
        return text.slice(0, 1200)
      }
      console.warn(`[PK-AUTO] 总结 LLM 内容为空或太短（尝试 ${attempt}, len=${text.length}）`)
    } catch (e) {
      console.warn(`[PK-AUTO] 总结 LLM 异常（尝试 ${attempt}）: ${e.message}`)
    }
  }
  console.warn('[PK-AUTO] 总结: LLM 两次都失败，走本地兜底')
  return generateFallbackSummary(room, moves, scores)
}

function generateFallbackSummary(room, moves, scores) {
  const total = moves.length
  const human = moves.filter(m => !m.user_id.startsWith('ai__')).length
  const ai = total - human
  return `辩题「${room.topic}」交锋 ${total} 轮（正方 ${human} / 反方 ${ai}）。胜方：${scores.winner || '未分'}。\n核心交锋已在房间记录中沉淀，可通过房间日志回看。`
}

// ============================================================
// 4) AI 装糊涂防御：包装 generateAIReply，失败/装糊涂时重试/兜底
// ============================================================
const ZHUANGHU_PATTERN = /(请补充|无法作答|待辩题明确|补充辩题|确认立场|请求资料|搜索参考结果为空|缺少辩题|题目未给)/i

export async function safeAIReply(app, roomId, opts = {}) {
  const db = getDB()
  const room = db.prepare('SELECT * FROM pk_rooms WHERE id = ?').get(roomId)
  if (!room || !room.ai_mode) return
  const SPEAK = ['opening', 'free_debate', 'closing']
  if (!SPEAK.includes(room.current_phase)) return
  const aiId = (AI_LEVELS[room.ai_level || 'beginner'] || {}).id
  const humanId = db.prepare(`SELECT user_id FROM pk_participants WHERE room_id = ? AND user_id NOT LIKE 'ai\\_\\_%' ESCAPE '\\'`).get(roomId)?.user_id
  if (!aiId || !humanId) return

  const topic = (typeof room.topic === 'string' && room.topic.trim()) ? room.topic.trim() : '这个辩题'
  let text = ''
  let usedFallback = false
  try {
    text = await generateAIReply({
      levelKey: room.ai_level || 'beginner',
      topic, phase: room.current_phase, sideName: '反方', humanUserId: humanId,
      history: db.prepare(`SELECT m.user_id, m.content FROM pk_moves m WHERE m.room_id = ? ORDER BY m.created_at ASC LIMIT 24`).all(roomId).map(m => ({ role: m.user_id === aiId ? 'ai' : 'human', content: m.content })),
    })
  } catch (e) {
    console.warn(`[PK-AUTO] generateAIReply 异常: ${e.message}，进入兜底`)
  }

  // 防御层 1：装糊涂关键词命中 → 兜底句
  if (!text || ZHUANGHU_PATTERN.test(text) || text.length < 6) {
    console.warn(`[PK-AUTO] 检测到装糊涂/空响应，启用兜底句 (room=${roomId})`)
    text = buildFallbackReply(room.current_phase, topic)
    usedFallback = true
  }

  // 防御层 2：长度太短或太长都洗一下
  if (text.length < 4) text = buildFallbackReply(room.current_phase, topic)

  // 拆句写库
  const sentences = splitSentences(text).slice(0, 6)
  if (!sentences.length) return
  const lv = AI_LEVELS[room.ai_level || 'beginner']
  const io = app?.get?.('io')
  if (io) io.to(`pk-room-${roomId}`).emit('ai-typing', { roomId, userId: aiId, username: lv.label, level: lv.title, fallback: usedFallback })
  for (let i = 0; i < sentences.length; i++) {
    const cur = db.prepare('SELECT * FROM pk_rooms WHERE id = ?').get(roomId)
    if (!cur || !SPEAK.includes(cur.current_phase)) break
    addPKMove(app, db, cur, aiId, sentences[i], 'speech')
    if (i < sentences.length - 1) await new Promise(r => setTimeout(r, 1100))
  }
  db.prepare('UPDATE pk_rooms SET turn_user_id = ? WHERE id = ?').run(humanId, roomId)
  if (io) io.to(`pk-room-${roomId}`).emit('pk-turn', { roomId, turnUserId: humanId })
}

function buildFallbackReply(phase, topic) {
  if (phase === 'opening') return `先亮明立场：关于「${topic}」这道题，我方坚定站在反方。具体理由下面展开——核心是这件事的本质不是看起来那样。`
  if (phase === 'closing') return `总结一句：关于「${topic}」，我方的核心论点自始至终一致——关键在于问题定义本身。谢谢各位。`
  return `回到「${topic}」这个核心：对方刚才回避了我方提出的前提，请正面回应。`
}

function splitSentences(text) {
  const raw = String(text || '').trim()
  if (!raw) return []
  const parts = []
  for (const line of raw.split('\n')) {
    const l = line.trim()
    if (!l) continue
    for (const seg of l.split(/(?<=[。！？；!?;…])/)) {
      const t = seg.trim()
      if (t) parts.push(t)
    }
  }
  const out = []
  for (let p of parts) {
    while (p.length > 110) { out.push(p.slice(0, 45)); p = p.slice(45) }
    if (p) out.push(p)
  }
  return out.length ? out : [raw]
}

// addPKMove 复制自 pk-rooms.js（避免循环依赖；列名严格匹配 pk_moves schema）
import { v4 as uuidv4 } from 'uuid'
function addPKMove(app, db, room, userId, content, type) {
  const id = uuidv4()
  const now = Date.now()
  try {
    db.prepare(`INSERT INTO pk_moves (id, room_id, user_id, content, move_type, phase, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, room.id, userId, content, type || 'speech', room.current_phase || '', now)
  } catch (e) {
    console.warn(`[PK-AUTO] addPKMove 失败: ${e.message}`)
    return null
  }
  const io = app?.get?.('io')
  if (io) io.to(`pk-room-${room.id}`).emit('pk-move', { id, roomId: room.id, userId, content, moveType: type || 'speech', createdAt: now })
  return id
}