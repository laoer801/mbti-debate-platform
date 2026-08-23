/**
 * v32 知识库存储层（store.ts）
 *
 * 持久化：IndexedDB（库 mbti_kb，三张表 domains / documents / chunks）
 * 兼容：Node 测试环境无 indexedDB → 自动降级为内存实现（不落盘，逻辑等价）
 *
 * 内存缓存：BM25 索引按领域懒构建并缓存，数据变更时失效重建。
 */

import { DOMAIN_PRESETS } from '../../data/domainPresets'
import { tokenize, tokenizeQuery } from './tokenizer'
import { buildIndex, searchIndex, type BM25Index, type BM25Hit } from './bm25'

// ============ 类型 ============

export interface DomainRecord {
  id: string
  name: string
  emoji: string
  color: string
  description: string
  keywords: string[]
  isCustom: boolean
  enabled: boolean
  createdAt: number
}

export interface KnowledgeDoc {
  docId: string
  domainId: string
  fileName: string
  title: string
  kind: string
  size: number
  chunkCount: number
  addedAt: number
  error?: string
}

export interface KnowledgeChunk {
  id: string
  domainId: string
  docId: string
  fileName: string
  title: string
  text: string
  seq: number
}

export interface KBRouteHit {
  domainId: string
  domainName: string
  domainEmoji: string
  domainColor: string
  hits: BM25Hit[]
  totalChunks: number
}

const DB_NAME = 'mbti_kb'
const DB_VERSION = 1

// ============ IndexedDB 封装 ============

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('domains')) db.createObjectStore('domains', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('documents')) db.createObjectStore('documents', { keyPath: 'docId' })
      if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const req = fn(t.objectStore(store))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ============ 内存实现（Node 测试 / 无 indexedDB 环境） ============

class MemoryBackend {
  domains = new Map<string, DomainRecord>()
  docs = new Map<string, KnowledgeDoc>()
  chunks = new Map<string, KnowledgeChunk>()
}

let memBackend: MemoryBackend | null = null
const isIDBAvailable = typeof indexedDB !== 'undefined'

// ============ 缓存 ============

interface IndexCacheEntry {
  chunks: KnowledgeChunk[]
  index: BM25Index
  built: number
}
const indexCache = new Map<string, IndexCacheEntry>()

function invalidateCache(domainId: string) {
  indexCache.delete(domainId)
}

// ============ 领域 CRUD ============

/** 读取全部领域：预设领域（合并用户配置）+ 用户自建领域 */
export async function getAllDomains(): Promise<DomainRecord[]> {
  const presets: DomainRecord[] = DOMAIN_PRESETS.map(p => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    color: p.color,
    description: p.description,
    keywords: p.keywords,
    isCustom: false,
    enabled: true,
    createdAt: 0,
  }))

  let userDomains: DomainRecord[] = []
  if (isIDBAvailable) {
    try {
      const db = await openDB()
      userDomains = await tx<DomainRecord[]>(db, 'domains', 'readonly', s => s.getAll() as IDBRequest<DomainRecord[]>)
      db.close()
    } catch { userDomains = [] }
  } else {
    userDomains = memBackend ? [...memBackend.domains.values()] : []
  }

  const map = new Map<string, DomainRecord>()
  for (const p of presets) map.set(p.id, p)
  for (const u of userDomains) {
    if (!u.isCustom && map.has(u.id)) {
      // 预设领域：合并启用状态等用户配置
      map.set(u.id, { ...map.get(u.id)!, ...u, id: u.id, name: map.get(u.id)!.name, emoji: map.get(u.id)!.emoji, color: map.get(u.id)!.color })
    } else {
      map.set(u.id, u)
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.isCustom !== b.isCustom) return a.isCustom ? 1 : -1
    return a.id.localeCompare(b.id)
  })
}

export async function saveDomain(record: DomainRecord): Promise<void> {
  if (isIDBAvailable) {
    try {
      const db = await openDB()
      await tx(db, 'domains', 'readwrite', s => s.put(record))
      db.close()
      return
    } catch { /* fallthrough */ }
  }
  memBackend = memBackend ?? new MemoryBackend()
  memBackend.domains.set(record.id, record)
}

export async function removeDomain(id: string): Promise<void> {
  if (isIDBAvailable) {
    try {
      const db = await openDB()
      await tx(db, 'domains', 'readwrite', s => s.delete(id))
      // 同时清理该领域的文档与块
      const docs = await tx<KnowledgeDoc[]>(db, 'documents', 'readonly', s => s.getAll() as IDBRequest<KnowledgeDoc[]>)
      for (const d of docs.filter(d => d.domainId === id)) {
        await tx(db, 'documents', 'readwrite', s => s.delete(d.docId))
      }
      const chunks = await tx<KnowledgeChunk[]>(db, 'chunks', 'readonly', s => s.getAll() as IDBRequest<KnowledgeChunk[]>)
      for (const c of chunks.filter(c => c.domainId === id)) {
        await tx(db, 'chunks', 'readwrite', s => s.delete(c.id))
      }
      db.close()
    } catch { /* fallthrough */ }
  }
  memBackend = memBackend ?? new MemoryBackend()
  memBackend.domains.delete(id)
  for (const d of memBackend.docs.values()) if (d.domainId === id) memBackend.docs.delete(d.docId)
  for (const c of memBackend.chunks.values()) if (c.domainId === id) memBackend.chunks.delete(c.id)
  invalidateCache(id)
}

// ============ 文档 CRUD ============

/** 导入文档到领域：生成 docId + 块，全部入库 */
export async function addDocument(domainId: string, fileName: string, title: string, kind: string, textChunks: { text: string; title?: string; fileName: string; seq: number }[], size: number, error?: string): Promise<KnowledgeDoc> {
  const docId = `doc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const valid = textChunks.filter(c => c.text.trim().length >= 10)
  const doc: KnowledgeDoc = {
    docId, domainId, fileName, title,
    kind,
    size,
    chunkCount: valid.length,
    addedAt: Date.now(),
    error,
  }
  const chunks: KnowledgeChunk[] = valid.map(c => ({
    id: `kb_${domainId}_${docId}_${c.seq}`,
    domainId, docId,
    fileName: c.fileName,
    title: c.title ?? title,
    text: c.text,
    seq: c.seq,
  }))

  if (isIDBAvailable) {
    try {
      const db = await openDB()
      await tx(db, 'documents', 'readwrite', s => s.put(doc))
      for (const c of chunks) await tx(db, 'chunks', 'readwrite', s => s.put(c))
      db.close()
      invalidateCache(domainId)
      return doc
    } catch { /* fallthrough */ }
  }
  memBackend = memBackend ?? new MemoryBackend()
  memBackend.docs.set(doc.docId, doc)
  for (const c of chunks) memBackend.chunks.set(c.id, c)
  invalidateCache(domainId)
  return doc
}

export async function getDocuments(domainId?: string): Promise<KnowledgeDoc[]> {
  let docs: KnowledgeDoc[]
  if (isIDBAvailable) {
    try {
      const db = await openDB()
      docs = await tx<KnowledgeDoc[]>(db, 'documents', 'readonly', s => s.getAll() as IDBRequest<KnowledgeDoc[]>)
      db.close()
    } catch { docs = [] }
  } else {
    docs = memBackend ? [...memBackend.docs.values()] : []
  }
  return domainId ? docs.filter(d => d.domainId === domainId).sort((a, b) => b.addedAt - a.addedAt) : docs.sort((a, b) => b.addedAt - a.addedAt)
}

export async function removeDocument(domainId: string, docId: string): Promise<void> {
  if (isIDBAvailable) {
    try {
      const db = await openDB()
      await tx(db, 'documents', 'readwrite', s => s.delete(docId))
      const chunks = await tx<KnowledgeChunk[]>(db, 'chunks', 'readonly', s => s.getAll() as IDBRequest<KnowledgeChunk[]>)
      for (const c of chunks.filter(c => c.docId === docId)) {
        await tx(db, 'chunks', 'readwrite', s => s.delete(c.id))
      }
      db.close()
    } catch { /* fallthrough */ }
  }
  memBackend = memBackend ?? new MemoryBackend()
  memBackend.docs.delete(docId)
  for (const c of memBackend.chunks.values()) if (c.docId === docId) memBackend.chunks.delete(c.id)
  invalidateCache(domainId)
}

export async function clearDomain(domainId: string): Promise<void> {
  const docs = await getDocuments(domainId)
  for (const d of docs) await removeDocument(domainId, d.docId)
}

// ============ 检索 ============

/** 取领域全部块（带缓存） */
async function getChunksCached(domainId: string): Promise<KnowledgeChunk[]> {
  const cached = indexCache.get(domainId)
  if (cached) return cached.chunks

  let chunks: KnowledgeChunk[]
  if (isIDBAvailable) {
    try {
      const db = await openDB()
      const all = await tx<KnowledgeChunk[]>(db, 'chunks', 'readonly', s => s.getAll() as IDBRequest<KnowledgeChunk[]>)
      db.close()
      chunks = all.filter(c => c.domainId === domainId)
    } catch { chunks = [] }
  } else {
    chunks = memBackend ? [...memBackend.chunks.values()].filter(c => c.domainId === domainId) : []
  }
  return chunks
}

/** 获取（并缓存）领域 BM25 索引 */
export async function getIndexForDomain(domainId: string): Promise<BM25Index | null> {
  const cached = indexCache.get(domainId)
  if (cached) return cached.index

  const chunks = await getChunksCached(domainId)
  if (chunks.length === 0) return null
  const index = buildIndex(
    chunks.map(c => ({ id: c.id, text: c.text, title: c.title })),
    tokenize
  )
  indexCache.set(domainId, { chunks, index, built: Date.now() })
  return index
}

/** 在单个领域检索 */
export async function searchDomain(domainId: string, query: string, topK = 4): Promise<BM25Hit[]> {
  const index = await getIndexForDomain(domainId)
  if (!index) return []
  return searchIndex(index, query, tokenizeQuery, topK)
}

/** 领域概览（文档数/块数）——用于知识库页统计 */
export async function getDomainStats(domainId: string): Promise<{ docCount: number; chunkCount: number }> {
  const docs = await getDocuments(domainId)
  const chunks = await getChunksCached(domainId)
  return { docCount: docs.filter(d => !d.error).length, chunkCount: chunks.length }
}

/** 全部启用领域汇总统计 */
export async function getGlobalStats(): Promise<{ docCount: number; chunkCount: number }> {
  const domains = (await getAllDomains()).filter(d => d.enabled)
  let docCount = 0
  let chunkCount = 0
  for (const d of domains) {
    const s = await getDomainStats(d.id)
    docCount += s.docCount
    chunkCount += s.chunkCount
  }
  return { docCount, chunkCount }
}
