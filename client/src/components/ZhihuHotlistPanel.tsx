/**
 * v40+ 知乎热榜组件（替代 / 补充 RSS 源）
 *
 * 使用：NewsLibrary.tsx 加新 tab，或 DebateRoom 顶上"今日辩题源"
 */

import { useZhihuHotlist } from '../utils/zhihuClient'
import { Flame, ExternalLink, RefreshCw, ImageOff } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  limit?: number
  compact?: boolean
  /** 点击每条 → 注入到辩题输入框 */
  onPick?: (item: { title: string; url: string }) => void
  /** 自定义 onPick 按钮文案（v40.6.5：知乎中心改为"和人格 1v1 讨论"） */
  pickLabel?: string
}

export function ZhihuHotlistPanel({ limit = 20, compact, onPick, pickLabel }: Props) {
  const { list, loading, error, refresh } = useZhihuHotlist(limit)

  if (loading && list.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center gap-2 text-sm', compact ? 'py-4' : 'py-8')}
        style={{ color: 'var(--color-text-secondary)' }}>
        <RefreshCw size={14} className="animate-spin" />
        加载知乎热榜中...
      </div>
    )
  }

  if (error && list.length === 0) {
    return (
      <div className={clsx('flex flex-col items-center justify-center gap-2 text-sm', compact ? 'py-4' : 'py-8')}
        style={{ color: 'var(--color-text-secondary)' }}>
        <Flame size={20} />
        <div>知乎热榜暂不可用</div>
        <div className="text-xs text-slate-500">{error}</div>
      </div>
    )
  }

  return (
    <div className={clsx('flex flex-col gap-2', compact ? 'p-2' : 'p-3')}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Flame size={14} style={{ color: '#f97316' }} />
          <span className="text-sm font-bold">知乎热榜 Top {list.length}</span>
        </div>
        <button onClick={refresh} className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      <ul className="space-y-1.5">
        {list.map((item, idx) => (
          <li
            key={item.url}
            className="flex items-start gap-3 rounded p-2 transition-colors hover:bg-slate-800"
            style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}
          >
            <span
              className="text-xs font-mono w-6 flex-shrink-0 text-right"
              style={{ color: idx < 3 ? '#ef4444' : 'var(--color-text-secondary)' }}
            >
              {idx + 1}
            </span>

            {item.thumbnailUrl ? (
              <img
                src={item.thumbnailUrl}
                alt=""
                className="w-12 h-12 object-cover rounded flex-shrink-0"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <div className="w-12 h-12 rounded flex-shrink-0 flex items-center justify-center bg-slate-800">
                <ImageOff size={14} className="text-slate-600" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-white hover:text-cyan-400 line-clamp-2 block"
              >
                {item.title}
              </a>
              {item.summary && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.summary}</p>
              )}
              {onPick && (
                <button
                  onClick={() => onPick({ title: item.title, url: item.url })}
                  className="text-xs text-cyan-400 hover:underline mt-1"
                >
                  {pickLabel || '把这个做成辩题 →'}
                </button>
              )}
            </div>

            <a href={item.url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-cyan-400 mt-1">
              <ExternalLink size={12} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
