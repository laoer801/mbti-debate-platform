import { Router } from 'express'
import { getDB } from '../db.js'

export const kbRoutes = Router()

// ── 人格档案 ──

// GET /api/kb/profiles — 获取所有人格五层档案（可筛选分组）
kbRoutes.get('/profiles', (req, res) => {
  const db = getDB()
  const { group } = req.query
  const sql = group
    ? 'SELECT * FROM personality_profiles WHERE group_name = ? ORDER BY type_id'
    : 'SELECT * FROM personality_profiles ORDER BY group_name, type_id'
  const rows = group ? db.prepare(sql).all(group) : db.prepare(sql).all()

  const parsed = rows.map(r => ({
    ...r,
    catchphrases: JSON.parse(r.catchphrases || '[]'),
    core_values: JSON.parse(r.core_values || '[]'),
    blind_spots: JSON.parse(r.blind_spots || '[]'),
    core_instructions: JSON.parse(r.core_instructions || '[]'),
    debate_stances: JSON.parse(r.debate_stances || '[]'),
  }))

  res.json({ total: parsed.length, profiles: parsed })
})

// GET /api/kb/profiles/:typeId — 获取单个人格完整档案
kbRoutes.get('/profiles/:typeId', (req, res) => {
  const db = getDB()
  const row = db.prepare('SELECT * FROM personality_profiles WHERE type_id = ?').get(req.params.typeId)
  if (!row) return res.status(404).json({ error: '人格不存在' })

  const profile = {
    ...row,
    catchphrases: JSON.parse(row.catchphrases || '[]'),
    core_values: JSON.parse(row.core_values || '[]'),
    blind_spots: JSON.parse(row.blind_spots || '[]'),
    core_instructions: JSON.parse(row.core_instructions || '[]'),
    debate_stances: JSON.parse(row.debate_stances || '[]'),
  }
  res.json({ profile })
})

// GET /api/kb/profiles/:typeId/system-prompt — 组装完整 System Prompt
kbRoutes.get('/profiles/:typeId/system-prompt', (req, res) => {
  const db = getDB()
  const row = db.prepare('SELECT * FROM personality_profiles WHERE type_id = ?').get(req.params.typeId)
  if (!row) return res.status(404).json({ error: '人格不存在' })

  const vals = JSON.parse(row.core_values || '[]')
  const blinds = JSON.parse(row.blind_spots || '[]')
  const instructions = JSON.parse(row.core_instructions || '[]')
  const phrases = JSON.parse(row.catchphrases || '[]')

  const prompt = `## 你的身份
${row.identity_statement}

## 你的核心认知模式
- 能量来源：${row.energy_source}
- 信息处理：${row.info_processing}
- 决策方式：${row.decision_style}
- 生活方式：${row.life_style}

## 你的说话风格
- 语气：${row.tone}
- 用词偏好：${row.word_preference}
- 句式特征：${row.sentence_pattern}
- 典型口头禅：${phrases.join('、')}
- 情绪表达：${row.emotion_expression}

## 你的价值观与盲点
- 你最看重：${vals.join('、')}
- 你容易忽略：${blinds.join('、')}

## 核心指令
${instructions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`

  res.json({ typeId: row.type_id, systemPrompt: prompt })
})

// ── Few-shot 示例 ──

// GET /api/kb/fewshots/all — 获取所有 Few-shot 示例（供前端缓存）
kbRoutes.get('/fewshots/all', (req, res) => {
  const db = getDB()
  const rows = db.prepare('SELECT * FROM few_shot_examples ORDER BY type_id, priority DESC').all()
  res.json({ total: rows.length, examples: rows })
})

// GET /api/kb/fewshots/:typeId — 获取指定人格的所有示例
kbRoutes.get('/fewshots/:typeId', (req, res) => {
  const db = getDB()
  const { category, limit } = req.query
  let sql = 'SELECT * FROM few_shot_examples WHERE type_id = ?'
  const params = [req.params.typeId]

  if (category) {
    sql += ' AND category = ?'
    params.push(category)
  }

  sql += ' ORDER BY priority DESC'
  if (limit) { sql += ' LIMIT ?'; params.push(Number(limit)) }

  const rows = db.prepare(sql).all(...params)
  res.json({ typeId: req.params.typeId, total: rows.length, examples: rows })
})

// GET /api/kb/fewshots/:typeId/random — 随机获取N条示例（用于辩论动态注入）
kbRoutes.get('/fewshots/:typeId/random', (req, res) => {
  const db = getDB()
  const n = Math.min(Number(req.query.n) || 3, 10)
  const rows = db.prepare(
    'SELECT * FROM few_shot_examples WHERE type_id = ? ORDER BY RANDOM() LIMIT ?'
  ).all(req.params.typeId, n)
  res.json({ typeId: req.params.typeId, examples: rows })
})

// ── 人格反射 ──

// GET /api/kb/reflections/:typeId — 获取人格反射数据
kbRoutes.get('/reflections/:typeId', (req, res) => {
  const db = getDB()
  const { trigger_type } = req.query
  const sql = trigger_type
    ? 'SELECT * FROM personality_reflections WHERE type_id = ? AND trigger_type = ?'
    : 'SELECT * FROM personality_reflections WHERE type_id = ?'
  const rows = trigger_type
    ? db.prepare(sql).all(req.params.typeId, trigger_type)
    : db.prepare(sql).all(req.params.typeId)
  res.json({ typeId: req.params.typeId, total: rows.length, reflections: rows })
})

// ── 跨人格检索 ──

// GET /api/kb/search?q=关键词 — 在所有人格数据中搜索
kbRoutes.get('/search', (req, res) => {
  const db = getDB()
  const q = req.query.q
  if (!q) return res.json({ results: [] })

  const sql = `SELECT type_id, type_name, type_emoji, group_name, tone, word_preference
    FROM personality_profiles WHERE
    identity_statement LIKE ? OR tone LIKE ? OR word_preference LIKE ? OR
    sentence_pattern LIKE ? OR emotion_expression LIKE ?
    LIMIT 10`
  const like = `%${q}%`
  const rows = db.prepare(sql).all(like, like, like, like, like)
  res.json({ query: q, results: rows })
})

// ── 知识库资源 ──

// GET /api/kb/resources — 获取数据集/API资源列表
kbRoutes.get('/resources', (req, res) => {
  const db = getDB()
  const rows = db.prepare('SELECT * FROM kb_resources').all()
  res.json({ total: rows.length, resources: rows })
})

// GET /api/kb/groups — 获取四大人格分组
kbRoutes.get('/groups', (req, res) => {
  const db = getDB()
  const rows = db.prepare(
    'SELECT group_name, COUNT(*) as count, GROUP_CONCAT(type_id) as members FROM personality_profiles GROUP BY group_name ORDER BY group_name'
  ).all()
  res.json({
    groups: [
      { name: '分析家', code: 'NT', emoji: '🧠', desc: '理性与战略的化身' },
      { name: '外交家', code: 'NF', emoji: '🕊️', desc: '共情与理想的代言人' },
      { name: '守护者', code: 'SJ', emoji: '⚙️', desc: '秩序与责任的守护者' },
      { name: '探索者', code: 'SP', emoji: '🔥', desc: '行动与体验的先锋' },
    ].map(g => {
      const row = rows.find(r => r.group_name === g.name)
      return { ...g, count: row ? row.count : 0, members: row ? row.members.split(',') : [] }
    })
  })
})

// POST /api/kb/reload — 重新加载种子数据（开发用）
kbRoutes.post('/reload', (req, res) => {
  const db = getDB()
  db.exec('DELETE FROM personality_reflections')
  db.exec('DELETE FROM few_shot_examples')
  db.exec('DELETE FROM personality_profiles')
  db.exec('DELETE FROM kb_resources')
  import('../seeds/personalities.js').then(({ seedKnowledgeBase, seedKBResources }) => {
    seedKnowledgeBase(db)
    seedKBResources(db)
    res.json({ status: 'ok', message: '知识库已重新加载' })
  })
})
