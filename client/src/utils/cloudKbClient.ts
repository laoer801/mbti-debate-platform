/**
 * v40.3 云端知识库客户端封装
 *
 * 与服务端 /api/cloudkb/* 配套
 * 远程知识库（腾讯乐享 lexiang-knowledge-base）走 skill，本地 RAG 走 SQLite。
 *
 * 提供：
 *   - uploadFile(): 上传文件到云端 KB（调用 lexiang skill）或本地
 *   - search(): 检索最相关片段
 *   - recordCitation(): 人格发言末尾附 [来源:XX] 时调用
 *   - listDocs/getDoc/deleteDoc: 文档管理
 */

import { useEffect, useState } from 'react'
import { API_BASE } from '../config'

export interface UploadedDoc {
  id: string
  title: string
  source_type: string
  remote_kb_id?: string
  file_size: number
  chunk_count: number
  status: 'indexing' | 'ready' | 'error'
  indexed_at?: number
  created_at: number
}

export interface SearchResult {
  chunkId: string
  docId: string
  docTitle: string
  sourceType: string
  chunkIndex: number
  content: string
  score: number
}

async function jget(url: string) {
  const res = await fetch(`${API_BASE}${url}`)
  if (!res.ok) throw new Error((await res.json()).error || res.statusText)
  return res.json()
}

async function jpost(url: string, body: any) {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json()).error || res.statusText)
  return res.json()
}

async function jdelete(url: string) {
  const res = await fetch(`${API_BASE}${url}`, { method: 'DELETE' })
  if (!res.ok) throw new Error((await res.json()).error || res.statusText)
  return res.json()
}

// ============ 上传 ============

export async function uploadTextFile(opts: {
  title: string
  content: string
  sourceType?: 'markdown' | 'pdf' | 'docx' | 'url' | 'audio' | 'video' | 'epub'
}): Promise<{ docId: string; chunkCount: number }> {
  return jpost('/api/cloudkb/upload', {
    title: opts.title,
    content: opts.content,
    sourceType: opts.sourceType || 'markdown',
  })
}

// ⚠️ 真实二进制上传（PDF / docx / audio / video）走腾讯乐享 skill：
//   调用位置：KnowledgeLibrary.tsx 的"上传到云端 KB"按钮
//   skill 调用：lexiang-knowledge-base / 本地 RAG 兜底走本函数 uploadTextFile
// 实现：
//   1. 用户点击"上传到云端"
//   2. 调用 lexiang-knowledge-base skill（CLI）拿 remote_kb_id
//   3. 把 remote_kb_id 写入本地 uploaded_docs.remote_kb_id
//   4. 二进制文件本身留在乐享云端 KB
//   5. 检索时，本函数 search() 同时查 lexiang + 本地 cache

// ============ 检索 ============

export async function search(query: string, limit = 5): Promise<SearchResult[]> {
  const data = await jpost('/api/cloudkb/search', { query, limit })
  return data.results || []
}

// ============ 引用追踪 ============

export async function recordCitation(opts: {
  sessionId?: string
  docId: string
  chunkId?: string
  refText: string
  context?: string
}): Promise<void> {
  await jpost('/api/cloudkb/citations', opts)
}

export async function listCitations() {
  const data = await jget('/api/cloudkb/citations')
  return data.citations || []
}

// ============ 文档管理 ============

export async function listDocs(): Promise<UploadedDoc[]> {
  const data = await jget('/api/cloudkb/docs')
  return data.docs || []
}

export async function deleteDoc(id: string): Promise<void> {
  await jdelete(`/api/cloudkb/docs/${id}`)
}

// ============ Hook ============

export function useCloudKB() {
  const [docs, setDocs] = useState<UploadedDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await listDocs()
      setDocs(list)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const upload = async (opts: { title: string; content: string; sourceType?: any }) => {
    const result = await uploadTextFile(opts)
    await refresh()
    return result
  }

  const remove = async (id: string) => {
    await deleteDoc(id)
    await refresh()
  }

  const searchCloud = async (query: string) => search(query)

  return { docs, loading, error, refresh, upload, remove, search: searchCloud }
}

// ============ 引用片段拼接（人格发言末尾用） ============

/**
 * 把检索结果拼成"人格发言末尾附引用"段。
 * 前端在生成人格发言后 + 提交前调用，把返回的 appendix 字符串拼接到 content 末尾。
 */
export function buildCitationAppendix(results: SearchResult[]): string {
  if (results.length === 0) return ''
  const lines = results.slice(0, 2).map(r =>
    `[来源：${r.docTitle} · 相关度 ${(r.score * 100).toFixed(0)}% · 第 ${r.chunkIndex + 1} 段]`
  )
  return '\n\n📚 ' + lines.join(' · ')
}
