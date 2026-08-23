/**
 * v32 本地 BM25 检索（bm25.ts）
 *
 * 经典 BM25 概率检索模型，纯前端实现、零依赖。
 * 与 tokenizer 搭配：中文文档分块后建索引，查询时同口径分词打分。
 *
 * 特点：
 *  - 标题加权：chunk.title 中的词频按 ×3 计入，命中标题的片段显著优先
 *  - 命中片段附原文 + 出处，供「引用来源」卡片展示
 *  - 纯函数、可测试、可序列化重建
 */

export interface IndexableChunk {
  id: string
  text: string
  /** 标题（可选）——标题命中加权 */
  title?: string
}

export interface BM25Hit {
  id: string
  score: number
  text: string
  title?: string
}

interface TermPosting {
  df: number              // 文档频率：包含该词的块数
  postings: Map<string, number> // chunkId → tf
}

export interface BM25Index {
  chunks: Map<string, { text: string; title?: string; len: number }>
  terms: Map<string, TermPosting>
  avgdl: number
  k1: number
  b: number
}

const K1 = 1.5
const B = 0.75
/** 标题词频加权倍率 */
const TITLE_BOOST = 3

/**
 * 构建 BM25 索引。
 * @param chunks 已分词前的原始块（text 会被内部再分词；调用方可预分词传入）
 */
export function buildIndex(chunks: IndexableChunk[], preTokenized: (text: string) => string[]): BM25Index {
  const index: BM25Index = {
    chunks: new Map(),
    terms: new Map(),
    avgdl: 0,
    k1: K1,
    b: B,
  }

  const docs = chunks.map(c => {
    const textTokens = preTokenized(c.text)
    const titleTokens = c.title ? preTokenized(c.title) : []
    // 合并词频：标题词 × TITLE_BOOST
    const tf = new Map<string, number>()
    for (const t of textTokens) tf.set(t, (tf.get(t) ?? 0) + 1)
    for (const t of titleTokens) tf.set(t, (tf.get(t) ?? 0) + TITLE_BOOST)
    return { id: c.id, text: c.text, title: c.title, tf, len: textTokens.length + titleTokens.length * TITLE_BOOST }
  })

  if (docs.length > 0) {
    index.avgdl = docs.reduce((s, d) => s + d.len, 0) / docs.length
  }

  for (const doc of docs) {
    index.chunks.set(doc.id, { text: doc.text, title: doc.title, len: doc.len })
    for (const [term, tf] of doc.tf) {
      let post = index.terms.get(term)
      if (!post) {
        post = { df: 0, postings: new Map() }
        index.terms.set(term, post)
      }
      post.df += 1
      post.postings.set(doc.id, tf)
    }
  }

  return index
}

/** BM25 单篇打分 */
function scoreDoc(index: BM25Index, term: string, df: number, tf: number, docLen: number): number {
  const N = index.chunks.size
  const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
  const numerator = tf * (index.k1 + 1)
  const denominator = tf + index.k1 * (1 - index.b + index.b * (docLen / index.avgdl))
  return idf * (denominator === 0 ? 0 : numerator / denominator)
}

/**
 * 在索引上检索，返回按分数降序的命中片段。
 * @param index  建好的索引
 * @param query  查询文本（内部统一分词）
 * @param topK   返回条数（默认 4）
 */
export function searchIndex(index: BM25Index, query: string, preTokenized: (text: string) => string[], topK = 4): BM25Hit[] {
  const terms = preTokenized(query)
  if (terms.length === 0 || index.chunks.size === 0) return []

  const scores = new Map<string, number>()
  for (const term of terms) {
    const post = index.terms.get(term)
    if (!post) continue
    for (const [chunkId, tf] of post.postings) {
      const doc = index.chunks.get(chunkId)
      if (!doc) continue
      scores.set(chunkId, (scores.get(chunkId) ?? 0) + scoreDoc(index, term, post.df, tf, doc.len))
    }
  }

  const ranked = [...scores.entries()]
    .map(([id, score]) => {
      const doc = index.chunks.get(id)!
      return { id, score, text: doc.text, title: doc.title }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  return ranked
}

/** 合并多个领域的检索结果（跨领域兜底） */
export function mergeHits(domainHits: BM25Hit[], topK = 4): BM25Hit[] {
  const seen = new Set<string>()
  const out: BM25Hit[] = []
  for (const h of [...domainHits].sort((a, b) => b.score - a.score)) {
    if (seen.has(h.id)) continue
    seen.add(h.id)
    out.push(h)
    if (out.length >= topK) break
  }
  return out
}
