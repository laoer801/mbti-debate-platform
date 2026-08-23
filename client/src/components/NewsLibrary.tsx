/**
 * v39 新闻知识库面板（NewsLibrary.tsx）
 *
 * v38 → v39 变更：
 *  - 类别过滤标签栏（科技/商业/时政/国际/综合/全部）
 *  - 新闻标题可点击 → 打开原文（跨平台：Electron shell / Web new tab / Capacitor system browser）
 *  - 抓取后展示 per-source 状态（哪些源成功/失败，多少条）
 *  - 检索结果增加"打开原文"链接
 *  - 类别分布统计卡片
 */

import { useState, useEffect, useCallback } from 'react'
import { Newspaper, RefreshCw, Search, Trash2, ExternalLink, Clock, Tag, CheckCircle2, XCircle, Globe } from 'lucide-react'
import {
  getNewsArticles, getNewsStats, fetchAndLearnNews, clearAllNews, searchNews,
  getNewsCategoryStats,
  type NewsArticle, type NewsRagHit, type NewsFetchResult,
} from '../utils/newsKnowledge'
import clsx from 'clsx'

// ============ 跨平台打开链接 ============

/**
 * 跨平台打开外部链接：
 * - Electron: window.electronAPI?.openExternal（如果有 preload 注入）
 * - Web: window.open 新标签页
 * - Capacitor: window.open 触发系统浏览器
 */
function openExternalUrl(url: string): void {
  if (!url) return
  // Electron 环境检测
  const electronAPI = (window as any).electronAPI
  if (electronAPI?.openExternal) {
    electronAPI.openExternal(url)
    return
  }
  // Web / Capacitor：window.open
  window.open(url, '_blank', 'noopener,noreferrer')
}

// ============ 组件 ============

export function NewsLibrary() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [stats, setStats] = useState({ count: 0, sources: 0, lastFetch: 0 })
  const [loading, setLoading] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<NewsRagHit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('全部')
  const [fetchResult, setFetchResult] = useState<NewsFetchResult | null>(null)
  const [categoryStats, setCategoryStats] = useState<{ category: string; count: number }[]>([])

  const refresh = useCallback(async () => {
    setArticles(getNewsArticles())
    setStats(await getNewsStats())
    setCategoryStats(getNewsCategoryStats())
  }, [])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener('mbti:news-changed', handler)
    return () => window.removeEventListener('mbti:news-changed', handler)
  }, [refresh])

  const handleFetch = async () => {
    setLoading(true)
    setError(null)
    setFetchResult(null)
    try {
      const result = await fetchAndLearnNews()
      setFetchResult(result)
      await refresh()
      if (result.learned === 0 && result.fetched === 0) {
        setError('后端服务器未启动或无可用新闻源。请确保后端运行在 3001 端口。')
      }
    } catch (err: any) {
      setError('抓取失败: ' + (err.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    if (!confirm('确定清空全部已学习新闻？')) return
    await clearAllNews()
    await refresh()
    setSearchResults(null)
    setFetchResult(null)
  }

  const handleSearch = async () => {
    if (!searchQ.trim()) {
      setSearchResults(null)
      return
    }
    const hits = await searchNews(searchQ, 5)
    setSearchResults(hits)
  }

  const fmtTime = (ts: number) => {
    if (!ts) return '--'
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  // 按类别过滤
  const filteredArticles = activeCategory === '全部'
    ? articles
    : articles.filter(a => a.category === activeCategory)

  // 所有类别（从 categoryStats 动态获取）
  const allCategories = ['全部', ...categoryStats.map(c => c.category)]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <Newspaper size={20} style={{ color: 'var(--color-accent)' }} /> 每日新闻学习
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            自动抓取 9 个中文新闻源（5 大类别） → 切块入 RAG → 辩论与对话中人格可引用时事热点
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFetch}
            disabled={loading}
            className="btn btn-primary btn-sm btn-sheen flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={clsx(loading && 'animate-spin')} />
            {loading ? '抓取中…' : '立即抓取新闻'}
          </button>
          {articles.length > 0 && (
            <button
              onClick={handleClear}
              className="btn btn-ghost btn-sm flex items-center gap-1"
              style={{ color: 'var(--color-danger)' }}
            >
              <Trash2 size={14} /> 清空
            </button>
          )}
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="glass rounded-xl p-3 border text-center" style={{ borderColor: 'var(--color-border)' }}>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>{stats.count}</div>
          <div className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>已学新闻</div>
        </div>
        <div className="glass rounded-xl p-3 border text-center" style={{ borderColor: 'var(--color-border)' }}>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>{stats.sources}</div>
          <div className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>新闻来源</div>
        </div>
        <div className="glass rounded-xl p-3 border text-center" style={{ borderColor: 'var(--color-border)' }}>
          <div className="text-sm font-bold flex items-center justify-center gap-1" style={{ color: 'var(--color-text)' }}>
            <Clock size={14} /> {fmtTime(stats.lastFetch)}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>上次更新</div>
        </div>
      </div>

      {/* 类别分布 */}
      {categoryStats.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {allCategories.map(cat => {
            const count = cat === '全部' ? articles.length : (categoryStats.find(c => c.category === cat)?.count || 0)
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={clsx(
                  'text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all',
                  isActive ? 'btn-primary' : 'btn-ghost'
                )}
                style={isActive ? {} : { color: 'var(--color-text-secondary)' }}
              >
                {cat} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* 抓取结果状态 */}
      {fetchResult?.sourceStatus && fetchResult.sourceStatus.length > 0 && (
        <div className="glass rounded-xl p-3 border mb-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
            <Globe size={14} style={{ color: 'var(--color-accent)' }} /> 抓取状态
            <span className="text-[10px] font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
              （新增 {fetchResult.learned} 条 / 共 {fetchResult.fetched} 条）
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {fetchResult.sourceStatus.map(s => (
              <div key={s.id} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                {s.ok ? (
                  <CheckCircle2 size={12} style={{ color: 'var(--color-success, #2FC9A3)' }} />
                ) : (
                  <XCircle size={12} style={{ color: 'var(--color-danger)' }} />
                )}
                <span>{s.name}</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>{s.count}条</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-xl border text-xs" style={{ borderColor: 'var(--color-danger)', background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      {/* 搜索测试 */}
      <div className="glass rounded-xl p-3 border mb-4" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Search size={14} style={{ color: 'var(--color-accent)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>检索测试（模拟人格如何检索新闻）</span>
        </div>
        <div className="flex gap-2">
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="输入关键词，如 AI、芯片、新能源、美国…"
            className="input-field flex-1 text-sm"
          />
          <button onClick={handleSearch} className="btn btn-sm btn-ghost">检索</button>
        </div>
        {searchResults && (
          <div className="mt-3 space-y-2">
            {searchResults.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>未检索到相关新闻</p>
            ) : searchResults.map((hit, i) => (
              <div key={i} className="p-2.5 rounded-lg text-xs" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="font-semibold cursor-pointer hover:underline"
                    style={{ color: 'var(--color-text)' }}
                    onClick={() => hit.link && openExternalUrl(hit.link)}
                  >
                    {hit.title}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
                      分数 {hit.score.toFixed(2)}
                    </span>
                    {hit.link && (
                      <button
                        onClick={() => openExternalUrl(hit.link)}
                        className="p-1 rounded transition-colors"
                        style={{ color: 'var(--color-accent)' }}
                        title="打开原文"
                      >
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{hit.text.slice(0, 150)}…</p>
                <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>来源：{hit.source}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新闻列表 */}
      {articles.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed text-center" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
          <Newspaper size={36} className="mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>还没有学习任何新闻</p>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            点击「立即抓取新闻」从 9 个中文新闻源自动学习
          </p>
          <button onClick={handleFetch} disabled={loading} className="btn btn-primary btn-sm btn-sheen">
            <RefreshCw size={14} className={clsx(loading && 'animate-spin')} /> 开始学习
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredArticles.map((a, i) => (
            <div
              key={a.id}
              className="stagger-item glass rounded-xl border p-3"
              style={{ borderColor: 'var(--color-border)', animationDelay: `${Math.min(i * 0.03, 0.6)}s` }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
                      {a.source}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
                      {a.category}
                    </span>
                    {a.tags.filter(t => t !== a.category).slice(0, 4).map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5" style={{ background: 'var(--color-bg)', color: 'var(--color-text-tertiary)' }}>
                        <Tag size={8} /> {tag}
                      </span>
                    ))}
                    <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                      <Clock size={10} /> {fmtTime(a.published_at)}
                    </span>
                  </div>
                  {/* v39: 标题可点击打开原文 */}
                  <h3
                    className="text-sm font-semibold mb-1 line-clamp-1 cursor-pointer hover:underline"
                    style={{ color: 'var(--color-text)' }}
                    onClick={() => a.link && openExternalUrl(a.link)}
                    title={a.link ? '点击打开原文' : undefined}
                  >
                    {a.title}
                  </h3>
                  <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{a.summary}</p>
                </div>
                {a.link && (
                  <button
                    onClick={() => openExternalUrl(a.link)}
                    className="p-2 rounded-lg flex-shrink-0 transition-colors"
                    style={{ color: 'var(--color-accent)', background: 'var(--color-accent-light)' }}
                    aria-label="打开原文"
                    title="在浏览器中打开原文"
                  >
                    <ExternalLink size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {filteredArticles.length === 0 && (
            <p className="text-center text-xs py-6" style={{ color: 'var(--color-text-tertiary)' }}>
              该类别暂无新闻
            </p>
          )}
        </div>
      )}
    </div>
  )
}
