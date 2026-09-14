/**
 * ZhihuSourcesPanel.tsx — v40.5 一站式"导入知乎内容到知识库"面板
 * --------------------------------------------------------------------------
 * 在 KnowledgeLibrary 顶部加入；用户选择：用户内容 / 收藏 / 收藏夹内容，
 * 勾选条目 → 点击"导入到知识库" → 后端 /api/zhihu/import-to-kb 转 payload → 循环调 cloudkb.upload
 *
 * 设计原则：
 *   - 1 屏看完全部入口（搜索 / 我的内容 / 我的收藏 / 收藏夹）
 *   - 多选 → 批量按钮 → 进度提示 → 失败可见
 *   - 用户不需要记 API 路径
 */

import { useMemo, useState } from 'react'
import {
  BookMarked,
  ChevronRight,
  CloudUpload,
  FileText,
  FolderHeart,
  Loader2,
  AlertCircle,
  RefreshCcw,
  Sparkles,
  UserCircle2,
} from 'lucide-react'
import {
  useZhihuFavlistContents,
  useZhihuFavlists,
  useZhihuStatus,
  useZhihuUserCollections,
  useZhihuUserContents,
  importItemsToKb,
  type ZhihuContentItem,
  type ZhihuFavlist,
} from '../utils/zhihuClient'

type Source = 'user-contents' | 'user-collections' | 'favlist' | 'search'

interface ZhihuSourcesPanelProps {
  userId: string
  /** 导入完成后通知父组件刷新 KB 列表 */
  onImported?: (count: number) => void
}

export function ZhihuSourcesPanel({ userId, onImported }: ZhihuSourcesPanelProps) {
  const [tab, setTab] = useState<Source>('user-contents')
  const [contentType, setContentType] = useState('all')
  const [pickedFavlist, setPickedFavlist] = useState<ZhihuFavlist | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ ok: number; failed: number; errors: string[] } | null>(null)

  // v40.5.1: 先检查知乎平台是否启用（server 端 secret 已配）
  const [zhihuStatus] = useZhihuStatus()

  const userContents = useZhihuUserContents(contentType, 20)
  const userCollections = useZhihuUserCollections(30)
  const favlists = useZhihuFavlists(50)
  const favlistContents = useZhihuFavlistContents(pickedFavlist?.urlToken ?? null, 30)

  // 当前 tab 对应的条目列表
  const currentItems: ZhihuContentItem[] = useMemo(() => {
    if (tab === 'user-contents') return userContents.data?.items || []
    if (tab === 'user-collections') return userCollections.data?.items || []
    if (tab === 'favlist') return favlistContents.data?.items || []
    return []
  }, [tab, userContents.data, userCollections.data, favlistContents.data])

  const isLoading =
    (tab === 'user-contents' && userContents.loading) ||
    (tab === 'user-collections' && userCollections.loading) ||
    (tab === 'favlist' && favlistContents.loading) ||
    (tab === 'user-contents' && userContents.error) ||
    (tab === 'user-collections' && userCollections.error) ||
    (tab === 'favlist' && favlistContents.error)

  const errorMsg = tab === 'user-contents' ? userContents.error
    : tab === 'user-collections' ? userCollections.error
    : tab === 'favlist' ? favlistContents.error
    : null

  const sourceLabel: Record<Source, string> = {
    'user-contents': 'zhihu:user-contents',
    'user-collections': 'zhihu:user-collections',
    'favlist': 'zhihu:favlist-contents',
    'search': 'zhihu:contents',
  }

  const toggle = (url: string) => setSelected(s => ({ ...s, [url]: !s[url] }))
  const pickAll = () => {
    const next = { ...selected }
    for (const it of currentItems) next[it.url] = true
    setSelected(next)
  }
  const clearAll = () => {
    const next = { ...selected }
    for (const it of currentItems) delete next[it.url]
    setSelected(next)
  }

  const selectedItems = currentItems.filter(it => selected[it.url])

  const onImport = async () => {
    if (selectedItems.length === 0) return
    setImporting(true)
    setImportResult(null)
    try {
      const result = await importItemsToKb(userId, selectedItems, sourceLabel[tab] as any)
      setImportResult(result)
      onImported?.(result.ok)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
        <h3 className="text-base font-semibold">📚 知乎源 · 一键导入知识库</h3>
      </div>

      {/* v40.5.1: 服务端未配 secret 时给清晰提示，不调 4 个端点 */}
      {zhihuStatus && zhihuStatus.enabled === false && (
        <div className="mb-3 p-3 rounded-lg flex gap-2 items-start"
          style={{ background: 'var(--color-bg-tertiary)', borderLeft: '3px solid var(--color-warning, #f59e0b)' }}>
          <AlertCircle size={16} style={{ color: '#f59e0b', marginTop: 2, flexShrink: 0 }} />
          <div className="text-xs space-y-1">
            <p className="font-semibold" style={{ color: 'var(--color-text)' }}>知乎平台 API 暂未配置</p>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              需要由部署方在服务端 <code>.env</code> 文件里填入 <code>ZHIHU_ACCESS_SECRET</code>。
              配置后重启 server，下面 4 个 tab 即可使用。
            </p>
          </div>
        </div>
      )}

      {/* 4 个 source tab */}
      <div className="flex flex-wrap gap-2 mb-4">
        <TabBtn active={tab === 'user-contents'} onClick={() => setTab('user-contents')}>
          <UserCircle2 size={14} /> 我的内容
        </TabBtn>
        <TabBtn active={tab === 'user-collections'} onClick={() => setTab('user-collections')}>
          <BookMarked size={14} /> 我的收藏
        </TabBtn>
        <TabBtn active={tab === 'favlist'} onClick={() => setTab('favlist')}>
          <FolderHeart size={14} /> 收藏夹内容
        </TabBtn>
      </div>

      {/* sub-筛选：内容类型 */}
      {tab === 'user-contents' && (
        <div className="flex flex-wrap gap-1.5 text-xs mb-3">
          {['all', 'answer', 'article', 'zvideo', 'pin', 'question'].map(t => (
            <button
              key={t}
              onClick={() => setContentType(t)}
              className="px-2 py-1 rounded-full border"
              style={{
                background: contentType === t ? 'var(--color-accent)' : 'transparent',
                color: contentType === t ? '#fff' : 'var(--color-text)',
                borderColor: 'var(--color-border)',
              }}>
              {t === 'all' ? '全部' : ({ answer: '回答', article: '文章', zvideo: '视频', pin: '想法', question: '问题' }[t] || t)}
            </button>
          ))}
        </div>
      )}

      {/* 收藏夹选择 */}
      {tab === 'favlist' && (
        <div className="mb-3">
          <div className="text-xs opacity-70 mb-1.5">选择收藏夹：</div>
          {favlists.loading ? (
            <Loader2 className="animate-spin inline-block" size={14} />
          ) : favlists.data?.items.length === 0 ? (
            <div className="text-xs opacity-60">⚠️ 没有可用的收藏夹（可能未配置 OAuth，或还没有收藏夹）</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {favlists.data?.items.map(f => (
                <button
                  key={f.urlToken}
                  onClick={() => setPickedFavlist(f)}
                  className="px-2 py-1 rounded-full border text-xs"
                  style={{
                    background: pickedFavlist?.urlToken === f.urlToken ? 'var(--color-accent)' : 'transparent',
                    color: pickedFavlist?.urlToken === f.urlToken ? '#fff' : 'var(--color-text)',
                    borderColor: 'var(--color-border)',
                  }}>
                  {f.title} {f.isPublic ? '🔓' : '🔒'} ({f.urlToken})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 工具条 */}
      <div className="flex items-center justify-between mb-2 text-xs opacity-75">
        <div className="flex items-center gap-2">
          <button onClick={pickAll} className="underline">全选当前页</button>
          <span>·</span>
          <button onClick={clearAll} className="underline">清空</button>
        </div>
        <div>
          已选 {selectedItems.length} / {currentItems.length} 条 ·
          来源 {sourceLabel[tab]}
        </div>
      </div>

      {/* 内容列表 */}
      {errorMsg && (
        <div className="text-xs px-3 py-2 rounded mb-2"
          style={{ background: '#e57e7e22', color: '#e57e7e' }}>
          ⚠️ {errorMsg}
        </div>
      )}
      {isLoading && currentItems.length === 0 ? (
        <div className="text-center py-6 opacity-50 text-xs">
          <Loader2 className="animate-spin inline-block mr-1" size={14} /> 加载知乎数据中…
        </div>
      ) : currentItems.length === 0 ? (
        <div className="text-center py-6 opacity-40 text-xs">点击上方按钮切换并加载内容</div>
      ) : (
        <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {currentItems.map(it => (
            <ContentRow
              key={it.url}
              item={it}
              checked={!!selected[it.url]}
              onToggle={() => toggle(it.url)}
            />
          ))}
        </div>
      )}

      {/* 操作 */}
      <div className="flex items-center gap-2 mt-3">
        <button
          disabled={importing || selectedItems.length === 0}
          onClick={onImport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{
            background: importing ? 'var(--color-bg)' : 'var(--color-accent)',
            color: importing ? 'var(--color-text-secondary)' : '#fff',
            cursor: importing || selectedItems.length === 0 ? 'not-allowed' : 'pointer',
            opacity: importing || selectedItems.length === 0 ? 0.5 : 1,
          }}>
          {importing ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />}
          导入到知识库
        </button>

        {/* 显式刷新 */}
        {(tab === 'user-contents' || tab === 'user-collections') && (
          <button
            onClick={() => {
              if (tab === 'user-contents') userContents.reload()
              // userCollections / favlists 没有 reload；让用户切 tab 重拉即可
            }}
            className="text-xs underline opacity-70 flex items-center gap-1">
            <RefreshCcw size={12} /> 重新拉取
          </button>
        )}

        {importResult && (
          <span className="text-xs ml-auto" style={{ color: importResult.failed > 0 ? '#e57e7e' : '#5fbf77' }}>
            ✓ {importResult.ok} 条已导入{importResult.failed > 0 ? ` · ✗ ${importResult.failed} 条失败` : ''}
          </span>
        )}
      </div>

      {importResult?.errors?.length ? (
        <details className="mt-2 text-[11px] opacity-70">
          <summary className="cursor-pointer">查看失败原因 ({importResult.errors.length})</summary>
          <ul className="list-disc ml-5 mt-1">
            {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

// ================ 子组件 ================

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
      style={{
        background: active ? 'var(--color-accent)' : 'var(--color-bg)',
        color: active ? '#fff' : 'var(--color-text)',
        border: '1px solid var(--color-border)',
      }}>
      {children}
    </button>
  )
}

function ContentRow({ item, checked, onToggle }: { item: ZhihuContentItem; checked: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-start gap-2 py-2 cursor-pointer hover:bg-black/5 px-2 rounded">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs">
          <FileText size={11} className="opacity-50" />
          <span className="font-medium truncate" style={{ color: 'var(--color-text)' }}>{item.title}</span>
        </div>
        <div className="text-[11px] opacity-65 line-clamp-2 mt-0.5">{item.summary}</div>
        <div className="text-[10px] opacity-50 mt-1 flex flex-wrap gap-2">
          <span>👍 {item.likeCount}</span>
          <span>💬 {item.commentCount}</span>
          <span>⭐ {item.favoriteCount}</span>
          {item.author?.name && <span>✍ {item.author.name}</span>}
          <span className="truncate flex-1">{item.contentType}</span>
          <a href={item.url} target="_blank" rel="noreferrer" className="underline flex items-center gap-0.5">
            链接 <ChevronRight size={10} />
          </a>
        </div>
      </div>
    </label>
  )
}
