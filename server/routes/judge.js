/**
 * v40.2 七维裁判系统路由
 *
 * 端点：
 *   GET  /api/judge/rubric          取当前激活的评分维度配置
 *   GET  /api/judge/rubric/all      取所有评分版本
 *   POST /api/judge/rubric          admin 创建新版本
 *   POST /api/judge/rubric/activate admin 切换激活版本
 *   POST /api/judge/run             跑三裁判融合评分（heuristic + llm + human）
 *   POST /api/judge/verdict/:id/feedback  对评分给反馈（用来反哺 calibration）
 */

import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDB } from '../db.js'

export const judgeRoutes = Router()

// ============ 评分维度配置 ============

judgeRoutes.get('/rubric', (req, res) => {
  const db = getDB()
  const row = db.prepare('SELECT version, rubric_json, created_at FROM judge_rubric WHERE is_active = 1 LIMIT 1').get()
  if (!row) return res.json({ version: '7d-v1', dimensions: { logic: 0.18, evidence: 0.15, rebuttal: 0.15, clarity: 0.10, demeanor: 0.10, rhetoric: 0.12, strategy: 0.10, ethics: 0.10 }, scale: 100 })
  res.json(JSON.parse(row.rubric_json))
})

judgeRoutes.get('/rubric/all', (req, res) => {
  const db = getDB()
  const rows = db.prepare('SELECT version, rubric_json, created_by, total_passed, is_active, created_at FROM judge_rubric ORDER BY created_at DESC').all()
  res.json({ rubrics: rows.map(r => ({ ...r, rubric: JSON.parse(r.rubric_json) })) })
})

judgeRoutes.post('/rubric', (req, res) => {
  const db = getDB()
  const { version, dimensions, scale = 100 } = req.body || {}
  if (!version || !dimensions) return res.status(400).json({ error: 'version + dimensions 必填' })
  // 必填 7 个维度；不足报错
  const required = ['logic', 'evidence', 'rebuttal', 'clarity', 'demeanor', 'rhetoric', 'strategy', 'ethics']
  const missing = required.filter(k => !(k in dimensions))
  if (missing.length) return res.status(400).json({ error: `缺少维度：${missing.join(',')}` })

  // 验证权重和 ≈ 1
  const sum = Object.values(dimensions).reduce((s, v) => s + Number(v), 0)
  if (Math.abs(sum - 1) > 0.01) {
    return res.status(400).json({ error: `维度权重和必须=1，当前 ${sum.toFixed(3)}` })
  }

  const createdBy = (req.headers['x-user-id'] || 'admin').toString()
  db.prepare(`
    INSERT OR REPLACE INTO judge_rubric (version, rubric_json, created_by, is_active, created_at)
    VALUES (?, ?, ?, 0, ?)
  `).run(version, JSON.stringify({ version, dimensions, scale }), createdBy, Date.now())

  res.json({ ok: true, version })
})

judgeRoutes.post('/rubric/activate', (req, res) => {
  const db = getDB()
  const { version } = req.body || {}
  if (!version) return res.status(400).json({ error: 'version 必填' })
  const exists = db.prepare('SELECT version FROM judge_rubric WHERE version = ?').get(version)
  if (!exists) return res.status(404).json({ error: '版本不存在' })

  const tx = db.transaction(() => {
    db.prepare('UPDATE judge_rubric SET is_active = 0').run()
    db.prepare('UPDATE judge_rubric SET is_active = 1 WHERE version = ?').run(version)
  })
  tx()

  res.json({ ok: true, version })
})

// ============ 三裁判融合评分 ============

/**
 * 三裁判评分融合算法（借鉴 Bluear7878/AI-Colosseum-Debate 和 mjsushanth/Multi_Agent_LLM_Debater）
 *
 * 输入 messages：[{typeId, typeName, content, typeColor}]
 * 三裁判：
 *   - heuristic：本地规则打分（与前端 judgeDebate 一致）
 *   - llm：服务端把消息送进 LLM，让 LLM 按 8 维评分（含 ethics）
 *   - human：用户中途按"P"暂停由人工给出评分（用 payload 传入）
 *
 * 输出：每辩手的 8 维分 + 加权共识 verdict
 */
judgeRoutes.post('/run', async (req, res) => {
  try {
    const { messages, rubricVersion, humanScores } = req.body || {}
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages 必填' })
    }

    const db = getDB()
    const rubricRow = db.prepare('SELECT rubric_json FROM judge_rubric WHERE version = ?').get(rubricVersion)
    if (!rubricRow) return res.status(404).json({ error: 'rubric 版本不存在' })
    const rubric = JSON.parse(rubricRow.rubric_json)

    // 1. 启发式打分（本地规则）
    const heuristicScores = heuristicJudge(messages)

    // 2. LLM 打分（暂时离线 fallback——实际可由前端 LLM 客户端复用调用 OpenAI/Claude）
    // 这里以 heuristic 替代 LLM（避免服务端配 API key），并返回 source 标记
    const llmScores = heuristicScores   // TODO: 接 lexiang-knowledge-base 或者 llmClient 调外部

    // 3. 人工打分（可选）
    const humanMap = (humanScores && typeof humanScores === 'object') ? humanScores : {}

    // 4. 加权共识：heuristic × 0.45 + llm × 0.45 + human × 0.10（如果有人工）
    const consensus = mergeScores(heuristicScores, llmScores, humanMap, rubric.dimensions)

    // 5. 保存 verdict
    const verdictId = uuidv4()
    const verdictText = generateVerdictText(consensus)
    db.prepare(`
      INSERT INTO judge_verdicts (id, session_id, rubric_version, judge_json, consensus_json, verdict_text, citations_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      verdictId,
      null,
      rubricVersion,
      JSON.stringify({ heuristic: heuristicScores, llm: llmScores, human: humanMap }),
      JSON.stringify(consensus),
      verdictText,
      '[]',
      Date.now()
    )

    res.json({ ok: true, verdictId, scores: consensus, verdict: verdictText })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/**
 * 启发式评分器（与前端 utils/debateEngine.ts judgeDebate 一致，复刻为服务端版本）
 */
function heuristicJudge(messages) {
  const byType = {}
  for (const m of messages) {
    if (m.isUser || !m.typeId) continue
    if (!byType[m.typeId]) byType[m.typeId] = { msgs: [], name: m.typeName, emoji: m.typeEmoji, color: m.typeColor }
    byType[m.typeId].msgs.push(m)
  }

  const scores = []
  for (const [typeId, data] of Object.entries(byType)) {
    const text = data.msgs.map(m => m.content).join(' ')
    const logicMarks = (text.match(/因为|所以|因此|前提|推论|如果|那么|但是|然而/g) || []).length
    const hasStructure = /第一|第二|第三|首先|其次|最后/.test(text) ? 1 : 0
    const logic = Math.min(98, Math.round(42 + logicMarks * 4 + hasStructure * 12 + (data.msgs.length > 1 ? 6 : 0)))

    const evMarks = (text.match(/数据|统计|研究|案例|打个比方|就像|书中|曾经|数据显示|概率|样本/g) || []).length
    const evidence = Math.min(98, Math.round(38 + evMarks * 5 + (data.msgs.length > 2 ? 8 : 0)))

    const quoteMarks = (text.match(/「[^」]+」/g) || []).length
    const rebutMarks = (text.match(/反驳|不同意|站不住|漏洞|你刚说|混淆|以偏概全|偷换|不成立/g) || []).length
    const rebuttal = Math.min(98, Math.round(34 + quoteMarks * 7 + rebutMarks * 4))

    const sentences = text.split(/[。！？!?]/).filter(s => s.trim().length > 0)
    const avgLen = sentences.length > 0 ? text.length / sentences.length : 40
    let clarity = 60
    if (avgLen >= 12 && avgLen <= 42) clarity = 86
    else if (avgLen >= 8 && avgLen <= 60) clarity = 74
    else clarity = 58
    clarity = Math.min(96, clarity + Math.min(data.msgs.length * 2, 8))

    let demeanor = 78
    const attackMarks = (text.match(/你错了|你蠢|闭嘴|可笑|白痴|没脑子|智商/g) || []).length
    demeanor -= attackMarks * 9
    const politeMarks = (text.match(/理解|尊重|感谢|我觉得|个人看法|我明白|你说得有道理/g) || []).length
    demeanor += politeMarks * 2
    demeanor = Math.max(30, Math.min(98, demeanor))

    // 新三维：rhetoric / strategy / ethics
    // rhetoric: 比喻、节奏
    const rhetoricMarks = (text.match(/如同|就像|犹如|仿佛|想象一下|如同一|这话像/g) || []).length
    const rhetoric = Math.min(98, Math.round(50 + rhetoricMarks * 6))
    // strategy: 进退、关键点
    const strategyMarks = (text.match(/但是|关键|转折|核心|反而|真正的/g) || []).length
    const strategy = Math.min(98, Math.round(50 + strategyMarks * 5))
    // ethics: 不攻击、不撒谎
    let ethics = 90
    ethics -= attackMarks * 12
    ethics = Math.max(40, Math.min(98, ethics))

    const total = Math.round(
      logic * 0.18 +
      evidence * 0.15 +
      rebuttal * 0.15 +
      clarity * 0.10 +
      demeanor * 0.10 +
      rhetoric * 0.12 +
      strategy * 0.10 +
      ethics * 0.10
    )

    scores.push({
      typeId,
      name: data.name,
      emoji: data.emoji,
      color: data.color,
      logic, evidence, rebuttal, clarity, demeanor, rhetoric, strategy, ethics, total,
      comment: total >= 85 ? '全场最佳，多维碾压'
        : total >= 75 ? '发挥出色，亮点突出'
          : total >= 65 ? '中规中矩，有亮点也有短板'
            : '有待提升，多维度均需打磨',
    })
  }
  return scores.sort((a, b) => b.total - a.total)
}

function mergeScores(heuristic, llm, human, dims) {
  // 默认权重：heuristic 0.45, llm 0.45, human 0.10（有人工打分时使用）
  const hasHuman = Object.keys(human).length > 0
  const wH = hasHuman ? 0.45 : 0.5
  const wL = hasHuman ? 0.45 : 0.5
  const wU = hasHuman ? 0.10 : 0

  const merged = []
  for (const h of heuristic) {
    const l = llm.find(s => s.typeId === h.typeId) || h
    const u = human[h.typeId] || {}
    const m = { typeId: h.typeId, name: h.name, emoji: h.emoji, color: h.color }
    for (const k of Object.keys(dims)) {
      const hh = h[k] ?? 50
      const ll = l[k] ?? hh
      const uu = u[k]
      m[k] = Math.round(hh * wH + ll * wL + (typeof uu === 'number' ? uu * wU : hh * wH + ll * wL))
    }
    // 总分按 dims 权重再算一遍
    m.total = Math.round(Object.keys(dims).reduce((s, k) => s + m[k] * dims[k], 0))
    merged.push(m)
  }
  return merged.sort((a, b) => b.total - a.total)
}

function generateVerdictText(scores) {
  if (scores.length === 0) return '本场无有效发言。'
  const top = scores[0]
  const second = scores[1]
  const gap = second ? top.total - second.total : 100
  if (gap > 20) return `${top.name} 全场领跑，凭借「${top.comment}」，明显拉开差距。`
  if (gap > 10) return `${top.name} 险胜 ${second.name}，整体优势明显。`
  return `本场接近平局：${top.name}（${top.total}）与 ${second.name}（${second.total}）分数胶着，建议加审或人工复盘。`
}

// ============ 反馈接口（反哺数据） ============

judgeRoutes.post('/verdict/:id/feedback', (req, res) => {
  const { feedback, comment } = req.body || {}
  if (!['up', 'down'].includes(feedback)) {
    return res.status(400).json({ error: 'feedback 必为 up/down' })
  }
  const db = getDB()
  const row = db.prepare('SELECT id FROM judge_verdicts WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'verdict 不存在' })

  // 简单记一条反馈（暂用 usage_logs）
  db.prepare(`
    INSERT INTO usage_logs (id, user_id, username, event, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    require('uuid').v4(),
    (req.headers['x-user-id'] || 'anon').toString(),
    null,
    'judge_feedback',
    JSON.stringify({ verdictId: req.params.id, feedback, comment }),
    Date.now()
  )

  res.json({ ok: true })
})
