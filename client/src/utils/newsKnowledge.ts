/**
 * v39 每日新闻知识模块（newsKnowledge.ts）
 *
 * v38 → v39 变更：
 *  - 修复 docId 错位 bug：使用 addDocument 返回值的真实 docId（旧版自造假 ID 导致旧新闻删不掉）
 *  - 修复 base URL 写死 localhost：改用 config.ts 的 API_BASE（移动端不再静默失效）
 *  - 修复正文重复拼接：title + content（不再重复拼 summary，避免 BM25 词频翻倍）
 *  - 清理逻辑改用 clearDomain（一次性清空领域全部文档，比逐条删更可靠）
 *  - 拉取上限提升到 100 条（源更多了，覆盖面更广）
 *  - 增加类别分布统计
 *
 * 数据流：
 *  1. 后端 RSS 抓取 → SQLite news_articles 表
 *  2. 前端调 /api/news/latest 获取列表 → 切块入 IndexedDB（'news' 隐藏领域）
 *  3. 辩论/对话时 retrieveNewsKnowledge(query) → BM25 检索 → 注入提示词
 *
 * 元数据层：localStorage mbti_news_articles（标题/来源/日期/标签/docId）
 * 内容层：IndexedDB chunks（复用 v32 store，BM25 可检索）
 *
 * 自动学习：App 启动时检查 localStorage 上次抓取时间，超过 12 小时自动 fetch
 */

import { addDocument, removeDocument, searchDomain, clearDomain, type BM25Hit } from './knowledgeBase'
import { chunkText } from './knowledgeBase/documentParser'
import { API_BASE } from '../config'

// ============ 类型 ============

export interface NewsArticle {
  id: string
  title: string
  summary: string
  content: string
  link: string
  source: string
  category: string
  tags: string[]
  published_at: number
  fetched_at: number
  /** 入库后的真实 docId（addDocument 返回值，删除时精确定位） */
  docId?: string
}

export interface NewsRagHit {
  title: string
  text: string
  score: number
  source: string
  link: string
}

export interface NewsFetchResult {
  fetched: number
  learned: number
  sourceStatus?: { id: string; name: string; category: string; ok: boolean; count: number }[]
}

// ============ 常量 ============

const NEWS_KEY = 'mbti_news_articles'
const NEWS_DOMAIN = 'news'
const LAST_FETCH_KEY = 'mbti_news_last_fetch'
const FETCH_INTERVAL = 12 * 60 * 60 * 1000 // 12 小时

const hasLocalStorage = typeof localStorage !== 'undefined'
let memArticles: NewsArticle[] | null = null

// ============ API 调用 ============

/**
 * v39: 使用 config.ts 的 API_BASE（构建时注入 VITE_API_BASE 或 localStorage 手动设置），
 * 不再写死 localhost:3001，移动端不再静默失效。
 */
async function apiGet(path: string): Promise<any> {
  try {
    const resp = await fetch(`${API_BASE}${path}`)
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

// ============ 元数据 CRUD（localStorage） ============

export function getNewsArticles(): NewsArticle[] {
  if (hasLocalStorage) {
    try {
      const raw = localStorage.getItem(NEWS_KEY)
      if (!raw) return memArticles ? [...memArticles] : []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      // fallthrough
    }
  }
  return memArticles ? [...memArticles] : []
}

export function saveNewsArticles(articles: NewsArticle[]): void {
  memArticles = [...articles]
  if (!hasLocalStorage) return
  try {
    // 最多存 200 条（约 7 天新闻量）
    localStorage.setItem(NEWS_KEY, JSON.stringify(articles.slice(0, 200)))
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('mbti:news-changed', { detail: articles }))
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

function getLastFetch(): number {
  if (!hasLocalStorage) return 0
  try {
    return parseInt(localStorage.getItem(LAST_FETCH_KEY) || '0')
  } catch { return 0 }
}

function setLastFetch(ts: number): void {
  if (!hasLocalStorage) return
  try { localStorage.setItem(LAST_FETCH_KEY, String(ts)) } catch { /* ignore */ }
}

// ============ 抓取 & 入库 ============

/**
 * 从后端拉取新闻 → 切块入 RAG → 更新元数据
 * 返回新入库条数 + per-source 抓取状态
 */
export async function fetchAndLearnNews(): Promise<NewsFetchResult> {
  // 1. 触发后端抓取
  const fetchResult = await apiGet('/api/news/fetch')
  if (!fetchResult || fetchResult.error) {
    console.warn('[NewsKB] 后端抓取失败，尝试使用已缓存新闻')
  }

  // 2. 拉取最新列表（v39: 提升到 100 条）
  const data = await apiGet('/api/news/latest?limit=100')
  if (!data || !data.articles || data.articles.length === 0) {
    return { fetched: 0, learned: 0, sourceStatus: fetchResult?.sourceStatus }
  }

  const articles: NewsArticle[] = data.articles.map((a: any) => ({
    id: a.id,
    title: a.title,
    summary: a.summary || '',
    content: a.content || a.summary || '',
    link: a.link || '',
    source: a.source || '',
    category: a.category || '',
    tags: Array.isArray(a.tags) ? a.tags : [],
    published_at: a.published_at || Date.now(),
    fetched_at: a.fetched_at || Date.now(),
  }))

  // 3. 清理旧内容（v39: 使用 clearDomain 一次性清空，比逐条删更可靠）
  await clearNewsContent()

  // 4. 切块入库到 RAG（隐藏 'news' 领域）
  let learned = 0
  for (const article of articles) {
    // v39 修复：只用 title + content，不重复拼 summary（summary 是 content 的前 500 字）
    const fullText = `${article.title}\n${article.content}`.trim()
    if (!fullText || fullText.length < 20) continue

    try {
      const chunks = chunkText(fullText).map((c, i) => ({
        text: c,
        title: article.title,
        fileName: `news-${article.id}`,
        seq: i,
      }))

      if (chunks.length > 0) {
        // v39 修复：使用 addDocument 返回值的真实 docId
        const doc = await addDocument(
          NEWS_DOMAIN,
          `news-${article.id}`,
          article.title,
          'news',
          chunks,
          fullText.length
        )
        article.docId = doc.docId // 真实 docId，删除时可精确定位
        learned++
      }
    } catch (err) {
      console.warn(`[NewsKB] 入库失败: ${article.title}`, err)
    }
  }

  // 5. 更新元数据
  saveNewsArticles(articles)
  setLastFetch(Date.now())

  console.log(`[NewsKB] 学习完成: ${learned}/${articles.length} 条`)
  return { fetched: articles.length, learned, sourceStatus: fetchResult?.sourceStatus }
}

/**
 * 检查是否需要自动学习（超过 FETCH_INTERVAL 则触发）
 */
export async function autoFetchIfNeeded(): Promise<boolean> {
  const last = getLastFetch()
  if (Date.now() - last < FETCH_INTERVAL) return false
  try {
    await fetchAndLearnNews()
    return true
  } catch {
    return false
  }
}

// ============ 清理 ============

/**
 * v39: 使用 clearDomain 一次性清空 news 领域全部文档
 * 比旧版逐条 removeDocument（且 docId 还是假的）可靠得多
 */
async function clearNewsContent(): Promise<void> {
  try {
    await clearDomain(NEWS_DOMAIN)
  } catch (err) {
    // 降级：尝试用元数据中的 docId 逐条删
    console.warn('[NewsKB] clearDomain 失败，降级逐条删除', err)
    const existing = getNewsArticles()
    for (const a of existing) {
      if (a.docId) {
        try { await removeDocument(NEWS_DOMAIN, a.docId) } catch { /* ignore */ }
      }
    }
  }
}

export async function clearAllNews(): Promise<void> {
  await clearNewsContent()
  saveNewsArticles([])
  setLastFetch(0)
}

// ============ 检索（人格学习层） ============

/**
 * 检索新闻知识：按 query 在 news 领域 BM25 检索
 */
export async function searchNews(query: string, topK = 5): Promise<NewsRagHit[]> {
  try {
    const hits: BM25Hit[] = await searchDomain(NEWS_DOMAIN, query, topK)
    // 从元数据补充 source / link 信息
    const articles = getNewsArticles()
    return hits.map(h => {
      const article = articles.find(a => a.title === h.title)
      return {
        title: h.title || '新闻',
        text: h.text,
        score: h.score,
        source: article?.source || '新闻',
        link: article?.link || '',
      }
    })
  } catch {
    return []
  }
}

/**
 * 统计
 */
export async function getNewsStats(): Promise<{ count: number; sources: number; lastFetch: number }> {
  const articles = getNewsArticles()
  const sources = new Set(articles.map(a => a.source))
  return {
    count: articles.length,
    sources: sources.size,
    lastFetch: getLastFetch(),
  }
}

/**
 * v39: 按类别统计
 */
export function getNewsCategoryStats(): { category: string; count: number }[] {
  const articles = getNewsArticles()
  const map = new Map<string, number>()
  for (const a of articles) {
    map.set(a.category, (map.get(a.category) || 0) + 1)
  }
  return [...map.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}

// ============ 提示词注入 ============

/**
 * 生成注入人格提示词的「今日新闻」段
 */
export function buildNewsKnowledgeSection(hits: NewsRagHit[]): string {
  if (!hits || hits.length === 0) return ''
  const hitsText = hits
    .map((h, i) => `[${i + 1}] ${h.title}（来源：${h.source}）：${h.text}`)
    .join('\n\n')

  return `## 今日新闻（你了解的时事热点）

以下是你今天学习到的新闻资讯。它们是你「了解的最新时事」——回答/辩论时，**如果能贴合主题，请自然地引用新闻事实来支撑观点或提供时事背景**，引用时在句末标注序号：

${hitsText}

### 使用准则
1. 这些是你了解的最新新闻——引用时自然融入，如「最近我看到一则新闻…（[1]）」
2. 新闻事实可以用于论证趋势、提供背景、举例子，但不要把新闻内容当作绝对真理——保持批判性思维
3. 严禁编造新闻中不存在的内容——宁可保守表述
4. 新闻与论题相关时引用，不相关则不硬凑`
}

/**
 * 便捷入口：检索 + 组装提示词段
 */
export async function retrieveNewsKnowledge(query: string, topK = 5): Promise<string | null> {
  const hits = await searchNews(query, topK)
  if (hits.length === 0) return null
  return buildNewsKnowledgeSection(hits)
}
