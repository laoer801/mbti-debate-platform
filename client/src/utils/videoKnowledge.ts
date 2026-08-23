/**
 * v34 视频知识模块（videoKnowledge.ts）——「把喜欢的科普视频提炼成文字，让人格学习」
 *
 * 背景：用户想把抖音科普视频的内容转成文字保存，并让辩论人格也能学习。
 * 纯前端约束下无法自动下载视频 + ASR（无后端/无本地语音模型），
 * 因此走「导入通道」：粘贴文案/字幕、上传 .srt/.vtt/.txt/.md、外部工具转录产物，三路皆可。
 *
 * 数据分层：
 *  1. 元数据层（localStorage `mbti_video_books`）：VideoBook 列表
 *     —— 标题 / 来源链接 / 标签 / 摘要 / 导入方式（「记录保存」的可读层）
 *  2. 内容层（IndexedDB chunks，复用 v32 store）：视频文字切块入库到固定领域 'videos'
 *     —— 通过 BM25 可被检索（「人格学习」的检索层）
 *
 * 学习方式（用户选定「全局共享」）：所有 16 人格在辩论 / 1v1 对话时
 * 自动检索视频知识并注入提示词，引用时带 📺 来源序号。
 * 该领域是隐藏领域（不在领域管理 UI 显示），不影响 v32 领域路由。
 */

import { addDocument, removeDocument, searchDomain, type BM25Hit } from './knowledgeBase'
import { chunkText } from './knowledgeBase/documentParser'

// ============ 类型 ============

/** 一条视频知识收藏（元数据 + 全文） */
export interface VideoBook {
  id: string
  /** 内容层入库后的 docId（IndexedDB documents/chunks 主键），删除时精确定位 */
  docId?: string
  title: string
  /** 来源链接（抖音分享链接等） */
  sourceUrl?: string
  emoji: string
  tags: string[]
  /** 一句话摘要（可选，用户自填） */
  summary?: string
  /** 提炼出的文字全文（字幕/文案） */
  transcript: string
  sourceKind: 'paste' | 'file' | 'external'
  addedAt: number
  chunkCount: number
}

/** 视频知识检索命中（供 UI 参考来源卡 + 提示词注入） */
export interface VideoRagHit {
  title: string
  text: string
  score: number
}

/** 导入视频知识的输入 */
export interface VideoKnowledgeInput {
  title: string
  sourceUrl?: string
  emoji?: string
  tags?: string[]
  summary?: string
  /** 提炼好的文字（粘贴 / 字幕解析 / 外部 transcript 的内容） */
  text: string
  sourceKind: 'paste' | 'file' | 'external'
}

const BOOKS_KEY = 'mbti_video_books'
/** 视频知识专用领域 id（隐藏领域：不在 getAllDomains 返回，仅作为 chunk 归属） */
const VIDEO_DOMAIN = 'videos'
/** Node 测试环境无 localStorage → 元数据层静默降级（内容层仍走内存后端可测） */
const hasLocalStorage = typeof localStorage !== 'undefined'
/** 内存元数据兜底（Node 测试 / localStorage 不可用时保持 CRUD 语义一致） */
let memBooks: VideoBook[] | null = null

// ============ 字幕解析 ============

/**
 * 解析 .srt 字幕 → 纯文本（去掉序号、时间轴、空行，只保留字幕文字）。
 * SRT 格式：
 *   1
 *   00:00:01,000 --> 00:00:03,500
 *   字幕内容
 */
export function parseSrt(srt: string): string {
  const clean = srt.replace(/\r\n/g, '\n')
  // 行块：以空行分隔
  const blocks = clean.split(/\n\s*\n/)
  const lines: string[] = []
  for (const block of blocks) {
    const rows = block.split('\n').map(r => r.trim()).filter(Boolean)
    if (rows.length === 0) continue
    // 跳过纯序号行
    if (rows.length >= 1 && /^\d+$/.test(rows[0])) rows.shift()
    // 跳过时间轴行
    if (rows.length >= 1 && /-->/.test(rows[0])) rows.shift()
    const text = rows.join(' ').trim()
    if (text) lines.push(text)
  }
  return lines.join('\n')
}

/**
 * 解析 .vtt 字幕 → 纯文本。
 * VTT 头部有 WEBVTT，时间轴用 00:00:01.000 --> 格式（点号毫秒）。
 */
export function parseVtt(vtt: string): string {
  const clean = vtt.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '')
  const withoutHeader = clean.replace(/^WEBVTT[^\n]*\n+/, '')
  const lines: string[] = []
  for (const raw of withoutHeader.split('\n')) {
    const row = raw.trim()
    if (!row) continue
    if (/-->/.test(row)) continue            // 时间轴
    if (/^NOTE\b/i.test(row)) continue       // 注释
    if (/^kind:|^language:|^cue\b/i.test(row)) continue
    if (/^\d{1,2}:\d{2}:\d{2}[.,]\d{3}$/.test(row)) continue // 纯时间戳行
    if (/^\d+$/.test(row)) continue          // 序号
    lines.push(row)
  }
  return lines.join('\n')
}

/**
 * 按文件名/扩展名自动选择字幕解析器；普通文本原样返回。
 * 支持 .srt / .vtt / .txt / .md / .transcript.md（外部工具产物）。
 */
export function parseSubtitleFile(fileName: string, content: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.srt')) return parseSrt(content)
  if (lower.endsWith('.vtt')) return parseVtt(content)
  // 其他格式（txt/md/transcript.md）：去除时间轴残留（形如 00:00:01,000 --> 00:00:03,500）
  const cleaned = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => !/^\s*\d+\s*$/.test(line) && !/-->\s*\d/.test(line))
    .join('\n')
  return cleaned.trim()
}

// ============ 元数据 CRUD（localStorage） ============

export function getVideoBooks(): VideoBook[] {
  if (hasLocalStorage) {
    try {
      const raw = localStorage.getItem(BOOKS_KEY)
      if (!raw) return memBooks ? [...memBooks] : []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      // fallthrough → 内存兜底
    }
  }
  return memBooks ? [...memBooks] : []
}

export function saveVideoBooks(books: VideoBook[]): void {
  // 内存兜底（Node 测试 / localStorage 不可用）：先写内存，再尝试持久化
  memBooks = [...books]
  if (!hasLocalStorage) return
  try {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books.slice(0, 100)))
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('mbti:video-books-changed', { detail: books }))
      } catch { /* ignore */ }
    }
  } catch {
    // localStorage 满时静默失败
  }
}

/** 生成视频收藏 id（元数据 + 入库 docId 同源，删除时便于定位 chunk） */
function genVideoId(): string {
  return 'vb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// ============ 导入 / 删除 ============

/**
 * 导入一条视频知识：文字切块 → 入库（videos 领域，BM25 可检索）→ 存元数据。
 * 不抛错：IndexedDB 失败时仍保存元数据（内容层降级，检索不到但记录可看）。
 */
export async function importVideoKnowledge(input: VideoKnowledgeInput): Promise<VideoBook> {
  const text = input.text.replace(/\r\n/g, '\n').trim()
  const id = genVideoId()
  const chunks = chunkText(text).map((c, i) => ({
    text: c,
    title: input.title || '视频知识',
    fileName: input.title || `video-${id}`,
    seq: i,
  }))

  let chunkCount = 0
  let docId: string | undefined
  try {
    const doc = await addDocument(
      VIDEO_DOMAIN,
      input.title || `video-${id}`,
      input.title || '视频知识',
      'video',
      chunks,
      text.length
    )
    chunkCount = doc.chunkCount
    docId = doc.docId
  } catch (err) {
    console.warn('[VideoKB] 内容入库失败（仅保存元数据）:', err)
  }

  const book: VideoBook = {
    id,
    docId,
    title: input.title || '未命名视频',
    sourceUrl: input.sourceUrl,
    emoji: input.emoji || '📺',
    tags: (input.tags || []).filter(Boolean).slice(0, 8),
    summary: input.summary,
    transcript: text,
    sourceKind: input.sourceKind,
    addedAt: Date.now(),
    chunkCount,
  }
  saveVideoBooks([book, ...getVideoBooks()])
  return book
}

/** 删除一条视频知识：删元数据 + 删内容 chunk（用入库 docId 精确定位）。 */
export async function removeVideoBook(id: string): Promise<void> {
  const books = getVideoBooks()
  const target = books.find(b => b.id === id)
  if (target) {
    try {
      await removeDocument(VIDEO_DOMAIN, target.docId || id)
    } catch { /* ignore */ }
  }
  saveVideoBooks(books.filter(b => b.id !== id))
}

/** 清空全部视频知识 */
export async function clearVideoBooks(): Promise<void> {
  const books = getVideoBooks()
  for (const b of books) {
    try { await removeDocument(VIDEO_DOMAIN, b.docId || b.id) } catch { /* ignore */ }
  }
  saveVideoBooks([])
}

// ============ 检索（人格学习层） ============

/**
 * 检索视频知识：按 query 在 videos 领域 BM25 检索。
 * @returns 命中片段（分数降序，最多 topK）；无内容返回空数组
 */
export async function searchVideos(query: string, topK = 4): Promise<VideoRagHit[]> {
  try {
    const hits: BM25Hit[] = await searchDomain(VIDEO_DOMAIN, query, topK)
    return hits.map(h => ({
      title: h.title || '视频知识',
      text: h.text,
      score: h.score,
    }))
  } catch {
    return []
  }
}

/**
 * 视频知识统计：收藏条数 + 内容块数（供 UI / 人格卡展示「已学 N 条」）。
 */
export async function getVideoKnowledgeStats(): Promise<{ count: number; chunkCount: number }> {
  const books = getVideoBooks()
  let chunkCount = 0
  for (const b of books) chunkCount += b.chunkCount || 0
  // 元数据可能缺失 chunkCount（老数据/入库失败），尽力从检索侧补齐
  if (chunkCount === 0 && books.length > 0) {
    try {
      const hits = await searchVideos('视频 知识 内容 资料', 1)
      chunkCount = hits.length
    } catch { /* ignore */ }
  }
  return { count: books.length, chunkCount }
}

// ============ 提示词注入 ============

/**
 * 生成注入人格提示词的「你学过的视频知识」段。
 * 与 v32 buildKnowledgeSection 的区别：定位为「TA 自己学过的内容」，
 * 引用更自然（像讲述自己的见闻），且辩论/对话场景通用。
 */
export function buildVideoKnowledgeSection(hits: VideoRagHit[]): string {
  if (!hits || hits.length === 0) return ''
  const hitsText = hits
    .map((h, i) => `[${i + 1}] 《${h.title}》：${h.text}`)
    .join('\n\n')

  return `## 你学过的视频知识（来自「📺 视频收藏」）

以下是你曾经看过并收藏的科普视频提炼出的文字。它们是你「学过的内容」——回答/辩论时，**如果能贴合主题，请自然地引用它们来支撑观点**（像在讲述自己了解的知识），引用时在句末标注序号：

${hitsText}

### 使用准则
1. 这些是你学过的知识——引用时自然融入表达，可带出处如「我之前看的一个科普视频讲到…（[1]）」
2. 资料中明确提到的内容可以自信地使用；资料未覆盖的部分按你本身的知识与判断继续
3. 严禁编造资料中不存在的具体数字、结论——宁可保守表述
4. 同一份资料正反双方都能用，但引用必须贴合当前论点，不硬凑`
}

/**
 * 便捷入口：检索 + 组装提示词段一步到位。
 * 返回 null 表示无可用视频知识（调用方直接跳过注入）。
 */
export async function retrieveVideoKnowledge(query: string, topK = 4): Promise<string | null> {
  const hits = await searchVideos(query, topK)
  if (hits.length === 0) return null
  return buildVideoKnowledgeSection(hits)
}
