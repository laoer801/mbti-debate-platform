/**
 * v39 每日新闻学习路由（routes/news.js）
 *
 * v38 → v39 变更：
 *  - 替换 8 个 RSS 源（6 个已死）为 9 个实测可用源，覆盖 5 大类别
 *  - 修复 empty link 去重 bug（link 为空时用 title 去重）
 *  - 增加 per-source 抓取结果上报（前端可显示哪些源成功/失败）
 *  - 增加 /api/news/categories 端点（按类别统计）
 *
 * 端点：
 *  GET /api/news/fetch       — 手动触发抓取
 *  GET /api/news/latest      — 获取最新 N 条（支持 ?category= 过滤）
 *  GET /api/news/search      — 关键词搜索
 *  GET /api/news/sources     — 列出可用新闻源
 *  GET /api/news/stats       — 统计（含 byCategory）
 *  GET /api/news/categories  — 按类别统计
 *  DELETE /api/news/:id      — 删除单条
 *  DELETE /api/news/all      — 清空全部
 */

import { Router } from 'express'
import { getDB } from '../db.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// ============ RSS 新闻源（v39：9 个实测可用源，5 大类别） ============
const NEWS_SOURCES = [
  // 科技（5 源）
  { id: 'ithome',  name: 'IT之家',  url: 'https://www.ithome.com/rss/',         category: '科技' },
  { id: 'ifanr',   name: '爱范儿',  url: 'https://www.ifanr.com/feed',           category: '科技' },
  { id: 'leiphone',name: '雷锋网',  url: 'https://www.leiphone.com/feed',        category: '科技' },
  { id: 'sspai',   name: '少数派',  url: 'https://sspai.com/feed',               category: '科技' },
  { id: 'solidot', name: 'Solidot', url: 'https://www.solidot.org/index.rss',    category: '科技' },
  // 商业（1 源）
  { id: 'tmtpost', name: '钛媒体',  url: 'https://www.tmtpost.com/feed',         category: '商业' },
  // 时政（1 源）
  { id: 'xinhuanet',name: '新华网', url: 'http://www.xinhuanet.com/politics/news_politics.xml', category: '时政' },
  // 国际（1 源）
  { id: 'people',  name: '人民网国际', url: 'http://www.people.com.cn/rss/world.xml',          category: '国际' },
  // 综合（1 源）
  { id: 'chinanews',name: '中国新闻网', url: 'https://www.chinanews.com.cn/rss/scroll-news.xml', category: '综合' },
]

// ============ RSS 解析（零依赖，正则提取） ============

/**
 * 从 RSS XML 中提取条目（兼容 RSS 2.0 和 Atom）
 */
function parseRSS(xml, sourceName, category) {
  const articles = []

  // RSS 2.0: <item>...</item>
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) || []
  for (const item of items) {
    const title = stripCdata(extractTag(item, 'title'))
    const link = stripCdata(extractTag(item, 'link'))
    const description = stripHtml(extractTag(item, 'description'))
    const pubDate = extractTag(item, 'pubDate')
    const published_at = pubDate ? new Date(pubDate).getTime() : Date.now()
    if (title) {
      articles.push({
        title: title.trim(),
        summary: description.slice(0, 500),
        content: description,
        link: link.trim(),
        source: sourceName,
        category,
        published_at,
      })
    }
  }

  // Atom: <entry>...</entry>
  const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) || []
  for (const entry of entries) {
    const title = stripCdata(extractTag(entry, 'title'))
    const linkMatch = entry.match(/<link[^>]*href="([^"]*)"[^>]*>/i)
    const link = linkMatch ? stripCdata(linkMatch[1]) : ''
    const summary = stripHtml(extractTag(entry, 'summary') || extractTag(entry, 'content'))
    const updated = extractTag(entry, 'updated') || extractTag(entry, 'published')
    const published_at = updated ? new Date(updated).getTime() : Date.now()
    if (title) {
      articles.push({
        title: title.trim(),
        summary: summary.slice(0, 500),
        content: summary,
        link: link.trim(),
        source: sourceName,
        category,
        published_at,
      })
    }
  }

  return articles
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return match ? match[1].trim() : ''
}

/** v39: 剥离 CDATA 包装（标题/链接中常见） */
function stripCdata(text) {
  if (!text) return ''
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

function stripHtml(html) {
  if (!html) return ''
  // CDATA 内容提取
  html = html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  // 先替换 HTML 实体（顺序很重要：实体解码后才能正确去标签）
  html = html.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  // 再去 HTML 标签
  html = html.replace(/<[^>]+>/g, '')
  // 清理多余空白
  html = html.replace(/\s+/g, ' ').trim()
  return html
}

// ============ 抓取逻辑 ============

async function fetchRSSFeed(url) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DebateSphere/1.0' },
    })
    clearTimeout(timeout)
    if (!resp.ok) return null
    const xml = await resp.text()
    // 过滤掉误返回 HTML 的源（有些站会把 RSS URL 重定向到 HTML 首页）
    if (xml.includes('<!DOCTYPE html') || xml.includes('<html')) return null
    return xml
  } catch (err) {
    console.error(`[News] Fetch failed: ${url} — ${err.message}`)
    return null
  }
}

/**
 * 抓取所有源，返回 per-source 结果
 */
async function fetchAllNews() {
  const results = []
  const sourceStatus = [] // [{ id, name, category, ok, count }]
  for (const src of NEWS_SOURCES) {
    const xml = await fetchRSSFeed(src.url)
    if (xml) {
      const articles = parseRSS(xml, src.name, src.category)
      results.push(...articles)
      sourceStatus.push({ id: src.id, name: src.name, category: src.category, ok: true, count: articles.length })
      console.log(`[News] ${src.name}: ${articles.length} articles`)
    } else {
      sourceStatus.push({ id: src.id, name: src.name, category: src.category, ok: false, count: 0 })
      console.log(`[News] ${src.name}: FAILED`)
    }
  }
  return { articles: results, sourceStatus }
}

// ============ 路由 ============

// 手动触发抓取
router.get('/fetch', async (req, res) => {
  try {
    const { articles, sourceStatus } = await fetchAllNews()
    const db = getDB()
    let inserted = 0
    let skipped = 0

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO news_articles (id, title, summary, content, link, source, category, tags, published_at, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertMany = db.transaction((items) => {
      for (const a of items) {
        // 去重：link 非空时按 link 去重；link 为空时按 title 去重
        const dedupKey = a.link || a.title
        const existing = db.prepare(
          "SELECT 1 FROM news_articles WHERE (link = ? AND link != '') OR (link = '' AND title = ?)"
        ).get(a.link, a.title)
        if (existing) {
          skipped++
          continue
        }
        const id = uuidv4()
        const tags = JSON.stringify(autoTags(a.title, a.summary, a.category))
        stmt.run(id, a.title, a.summary, a.content, a.link, a.source, a.category, tags, a.published_at, Date.now())
        inserted++
      }
    })

    insertMany(articles)
    res.json({
      success: true,
      fetched: articles.length,
      inserted,
      skipped,
      total: db.prepare('SELECT COUNT(*) as c FROM news_articles').get().c,
      sourceStatus, // v39: 上报每个源的抓取状态
    })
  } catch (err) {
    console.error('[News] Fetch error:', err)
    res.status(500).json({ error: '抓取失败: ' + err.message })
  }
})

// 获取最新新闻（v39: 支持 category 过滤）
router.get('/latest', (req, res) => {
  const db = getDB()
  const limit = Math.min(parseInt(req.query.limit) || 30, 200)
  const category = (req.query.category || '').trim()

  let rows
  if (category && category !== '全部') {
    rows = db.prepare(`
      SELECT id, title, summary, link, source, category, tags, published_at, fetched_at
      FROM news_articles WHERE category = ? ORDER BY published_at DESC LIMIT ?
    `).all(category, limit)
  } else {
    rows = db.prepare(`
      SELECT id, title, summary, link, source, category, tags, published_at, fetched_at
      FROM news_articles ORDER BY published_at DESC LIMIT ?
    `).all(limit)
  }
  res.json({ articles: rows.map(parseRow) })
})

// 搜索新闻
router.get('/search', (req, res) => {
  const db = getDB()
  const q = (req.query.q || '').trim()
  const limit = Math.min(parseInt(req.query.limit) || 20, 50)
  if (!q) return res.json({ articles: [] })
  const rows = db.prepare(`
    SELECT id, title, summary, link, source, category, tags, published_at, fetched_at
    FROM news_articles
    WHERE title LIKE ? OR summary LIKE ? OR content LIKE ?
    ORDER BY published_at DESC LIMIT ?
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, limit)
  res.json({ articles: rows.map(parseRow) })
})

// 新闻源列表
router.get('/sources', (req, res) => {
  res.json({ sources: NEWS_SOURCES })
})

// 按类别统计（v39 新增）
router.get('/categories', (req, res) => {
  const db = getDB()
  const rows = db.prepare(`
    SELECT category, COUNT(*) as count FROM news_articles GROUP BY category ORDER BY count DESC
  `).all()
  res.json({ categories: rows })
})

// 清空全部（必须在 /:id 之前定义，否则 /all 会被 :id 匹配）
router.delete('/all', (req, res) => {
  const db = getDB()
  const info = db.prepare('DELETE FROM news_articles').run()
  res.json({ success: true, deleted: info.changes })
})

// 删除单条
router.delete('/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM news_articles WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// 统计（v39: 增加 byCategory）
router.get('/stats', (req, res) => {
  const db = getDB()
  const total = db.prepare('SELECT COUNT(*) as c FROM news_articles').get().c
  const bySource = db.prepare('SELECT source, COUNT(*) as c FROM news_articles GROUP BY source ORDER BY c DESC').all()
  const byCategory = db.prepare('SELECT category, COUNT(*) as c FROM news_articles GROUP BY category ORDER BY c DESC').all()
  const latest = db.prepare('SELECT MAX(fetched_at) as t FROM news_articles').get()
  res.json({ total, bySource, byCategory, lastFetch: latest.t || null })
})

// ============ 工具函数 ============

function autoTags(title, summary, category) {
  const tags = [category]
  const text = (title + ' ' + summary).toLowerCase()
  const keywordMap = {
    'AI': ['ai', '人工智能', 'gpt', 'llm', '大模型', 'chatgpt', 'deepseek'],
    '手机': ['手机', 'iphone', 'android', '安卓', '华为', '小米', 'oppo', 'vivo'],
    '芯片': ['芯片', '半导体', '台积电', 'nvidia', 'amd', 'intel', '光刻'],
    '互联网': ['互联网', '腾讯', '阿里', '字节', '百度', '美团', '抖音'],
    '游戏': ['游戏', 'steam', 'switch', 'ps5', 'xbox', '原神'],
    '汽车': ['汽车', '新能源', '电动车', '特斯拉', '比亚迪', '理想', '蔚来'],
    '金融': ['金融', '股市', '基金', '加息', '利率', '通胀', '央行'],
    '国际': ['美国', '日本', '欧盟', '俄罗斯', '乌克兰', '中东', '联合国'],
    '航天': ['航天', '火箭', 'spacex', '卫星', '空间站', '登月'],
    '安全': ['安全', '漏洞', '黑客', '勒索', '隐私', '数据泄露'],
    '教育': ['教育', '高考', '大学', '考研', '留学', '学生'],
    '医疗': ['医疗', '医保', '药', '疫苗', '医院', '健康'],
    '法律': ['法律', '法院', '判决', '犯罪', '诉讼', '立法'],
    '环境': ['环境', '气候', '碳排放', '环保', '污染', '碳中和'],
  }
  for (const [tag, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(kw => text.includes(kw))) {
      tags.push(tag)
    }
  }
  return [...new Set(tags)]
}

function parseRow(row) {
  return {
    ...row,
    tags: (() => { try { return JSON.parse(row.tags) } catch { return [] } })(),
  }
}

export { router as newsRoutes }
