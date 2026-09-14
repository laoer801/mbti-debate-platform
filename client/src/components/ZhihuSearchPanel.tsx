/**
 * v40+ 知乎全网搜索面板（用于辩论资料 / 知识库）
 *
 * 数据源：服务端 /api/zhihu/search
 * 嵌到 KnowledgeLibrary 的"按搜索" tab 或辩论大师的"资料面板"。
 */

import { useState } from 'react'
import { Search, ExternalLink, MessageSquare, ThumbsUp, AlertCircle, Sparkles } from 'lucide-react'
import { useZhihuSearch } from '../utils/zhihuClient'
import clsx from 'clsx'

interface Props {
  /** 默认查询词 */
  defaultQuery?: string
  /** 紧凑模式（在侧栏时） */
  compact?: boolean
  onPickSnippet?: (item: { title: string; snippet: string; url: string }) => void
}

export function ZhihuSearchPanel({ defaultQuery = '', compact, onPickSnippet }: Props) {
  const [q, setQ] = useState(defaultQuery)
  const { results, loading, error } = useZhihuSearch(q, 10)

  return (
    <div className={clsx('flex flex-col gap-3', compact ? 'p-2' : 'p-4')}>
      {/* 搜索框 */}
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="知乎全网搜索（键入 ≥ 2 字触发）"
            className="w-full pl-9 pr-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-cyan-500"
          />
        </div>
        {q && (
          <button
            onClick={() => setQ('')}
            className="text-xs text-slate-400 hover:text-white"
          >
            清空
          </button>
        )}
      </div>

      {/* 错误状态 */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded text-xs" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-1">知乎 API 未启用</div>
            <div>{error}</div>
            <div className="text-slate-400 mt-1">需在服务端 <code className="bg-slate-800 px-1 rounded">.env</code> 设置 <code className="bg-slate-800 px-1 rounded">ZHIHU_ACCESS_SECRET</code> 激活</div>
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="text-center text-xs text-slate-500 py-4">搜索中...</div>
      )}

      {/* 结果 */}
      {!loading && !error && q.length >= 2 && results.length === 0 && (
        <div className="text-center text-xs text-slate-500 py-4">没有结果，换个关键词试试</div>
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.contentId} className="rounded-md p-3 transition-colors" style={{ background: 'var(--color-bg-secondary)' }}>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2 group"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors line-clamp-2">
                    {r.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{r.snippet}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    {r.authorityLevel >= '3' && (
                      <span className="text-cyan-400 font-mono">高权威</span>
                    )}
                    <span className="flex items-center gap-1">
                      <ThumbsUp size={11} /> {r.voteUpCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare size={11} /> {r.commentCount}
                    </span>
                    <span>{r.authorName}</span>
                  </div>
                </div>
                <ExternalLink size={12} className="text-slate-500 group-hover:text-cyan-400 mt-1" />
              </a>
              {onPickSnippet && (
                <button
                  onClick={() => onPickSnippet({ title: r.title, snippet: r.snippet, url: r.url })}
                  className="mt-2 text-xs text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <Sparkles size={11} /> 把这段材料加入知识库
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
