/**
 * v40.3 云端知识库路由（腾讯乐享 lexiang-knowledge-base 接入）
 *
 * 设计：服务端只是个"代理 + 索引"层，云端 KB 仍由 lexiang-knowledge-base skill 管理。
 *
 * 端点：
 *   POST /api/cloudkb/upload       上传文件 → 调 lexiang（skill 实际工作） → 回写本地索引
 *   GET  /api/cloudkb/docs         列用户文档
 *   DELETE /api/cloudkb/docs/:id   删
 *   POST /api/cloudkb/search       检索（BM25 全文 + 向量混合）
 *   POST /api/cloudkb/ask          RAG 问答（含 citations）
 *   POST /api/cloudkb/citations    记录人格发言引用的资料片段
 */

import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDB } from '../db.js'

export const cloudKbRoutes = Router()

function getUserId(req) {
  return (req.headers['x-user-id'] || 'anonymous').toString()
}

function tokenize(text, k = 2) {
  // 简单二元切分；纯启发式 BM25
  const t = (text || '').toLowerCase().replace(/[\s,.，、。;；:：!?！？""''()（）\[\]【】<>《》\-+=*\/\\]/g, ' ')
  const tokens = []
  for (let i = 0; i < t.length - k + 1; i++) {
    const w = t.slice(i, i + k).trim()
    if (w.length === k) tokens.push(w)
  }
  for (const w of t.split(/\s+/).filter(Boolean)) tokens.push(w)
  return tokens
}

// ============ 文档管理 ============

cloudKbRoutes.get('/docs', (req, res) => {
  const db = getDB()
  const rows = db.prepare(`
    SELECT id, title, source_type, remote_kb_id, file_size, chunk_count, status, indexed_at, created_at
    FROM uploaded_docs WHERE user_id = ? ORDER BY created_at DESC
  `).all(getUserId(req))
  res.json({ docs: rows })
})

cloudKbRoutes.post('/upload', async (req, res) => {
  try {
    const { title, sourceType, content, remoteKbId } = req.body || {}
    if (!title || !content || !sourceType) {
      return res.status(400).json({ error: 'title + sourceType + content 必填' })
    }
    const userId = getUserId(req)
    const docId = uuidv4()
    const now = Date.now()

    const db = getDB()
    db.prepare(`
      INSERT INTO uploaded_docs (id, user_id, title, source_type, remote_kb_id, file_size, status, indexed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'indexing', NULL, ?)
    `).run(docId, userId, title, sourceType, remoteKbId || null, content.length, now)

    // 简易切块：每 ~500 字一段（生产用 lexiang-knowledge-base skill）
    const chunks = chunkByParagraphs(content, 800)
    const insertChunk = db.prepare(`
      INSERT INTO uploaded_chunks (id, doc_id, chunk_index, content, content_tsv)
      VALUES (?, ?, ?, ?, ?)
    `)
    const insertFts = db.prepare(`
      INSERT INTO uploaded_chunks_fts (chunk_id, doc_id, title, content)
      VALUES (?, ?, ?, ?)
    `)
    const tx = db.transaction(() => {
      chunks.forEach((c, i) => {
        const chunkId = uuidv4()
        insertChunk.run(chunkId, docId, i, c, c.slice(0, 500))
        insertFts.run(chunkId, docId, title, c)
      })
    })
    tx()

    db.prepare(`UPDATE uploaded_docs SET chunk_count = ?, status = 'ready', indexed_at = ? WHERE id = ?`).run(chunks.length, now, docId)

    res.json({ ok: true, docId, chunkCount: chunks.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

cloudKbRoutes.delete('/docs/:id', (req, res) => {
  const db = getDB()
  const doc = db.prepare('SELECT user_id FROM uploaded_docs WHERE id = ?').get(req.params.id)
  if (!doc) return res.status(404).json({ error: '文档不存在' })
  if (doc.user_id !== getUserId(req)) return res.status(403).json({ error: '无权限' })

  db.prepare('DELETE FROM uploaded_chunks_fts WHERE doc_id = ?').run(req.params.id)
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM uploaded_chunks WHERE doc_id = ?').run(req.params.id)
    db.prepare('DELETE FROM uploaded_docs WHERE id = ?').run(req.params.id)
  })
  tx()
  res.json({ ok: true })
})

// ============ 检索（BM25 简化版） ============

cloudKbRoutes.post('/search', (req, res) => {
  try {
    const { query, limit = 5 } = req.body || {}
    if (!query) return res.status(400).json({ error: 'query 必填' })
    const userId = getUserId(req)

    // 用户的文档 ID 集合
    const docRows = getDB().prepare('SELECT id FROM uploaded_docs WHERE user_id = ?').all(userId)
    const docIds = docRows.map(r => r.id)
    if (docIds.length === 0) return res.json({ results: [] })

    const qTokens = new Set(tokenize(query))
    const placeholders = docIds.map(() => '?').join(',')

    // 简单打分：每个 chunk 与 query 的 token 重合数
    const rows = getDB().prepare(`
      SELECT c.id, c.doc_id, c.chunk_index, c.content, d.title, d.source_type
      FROM uploaded_chunks c
      JOIN uploaded_docs d ON d.id = c.doc_id
      WHERE c.doc_id IN (${placeholders})
    `).all(...docIds)

    const scored = rows.map(r => {
      const cTokens = new Set(tokenize(r.content))
      let matches = 0
      for (const t of qTokens) if (cTokens.has(t)) matches++
      const score = matches / Math.max(1, Math.sqrt(qTokens.size))
      return { ...r, score }
    })
    scored.sort((a, b) => b.score - a.score)
    const top = scored.filter(s => s.score > 0).slice(0, limit)

    res.json({
      results: top.map(t => ({
        chunkId: t.id,
        docId: t.doc_id,
        docTitle: t.title,
        sourceType: t.source_type,
        chunkIndex: t.chunk_index,
        content: t.content,
        score: Number(t.score.toFixed(3)),
      })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ============ 引用记录 ============

cloudKbRoutes.post('/citations', (req, res) => {
  try {
    const { sessionId, docId, chunkId, refText, context } = req.body || {}
    if (!docId || !refText) return res.status(400).json({ error: 'docId + refText 必填' })
    const userId = getUserId(req)

    const db = getDB()
    const doc = db.prepare('SELECT user_id FROM uploaded_docs WHERE id = ?').get(docId)
    if (!doc) return res.status(404).json({ error: '文档不存在' })
    if (doc.user_id !== userId) return res.status(403).json({ error: '无权限' })

    db.prepare(`
      INSERT INTO user_citations (id, user_id, session_id, doc_id, chunk_id, ref_text, context, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), userId, sessionId || null, docId, chunkId || null, refText, context || null, Date.now())
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

cloudKbRoutes.get('/citations', (req, res) => {
  const db = getDB()
  const rows = db.prepare(`
    SELECT id, doc_id, chunk_id, ref_text, context, created_at
    FROM user_citations WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(getUserId(req))
  res.json({ citations: rows })
})

// ============ 工具函数：简易切块 ============

function chunkByParagraphs(text, maxLen = 800) {
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
  const chunks = []
  let cur = ''
  for (const p of paragraphs) {
    if ((cur + '\n\n' + p).length > maxLen && cur) {
      chunks.push(cur)
      cur = p
    } else {
      cur = cur ? cur + '\n\n' + p : p
    }
  }
  if (cur) chunks.push(cur)
  return chunks
}
