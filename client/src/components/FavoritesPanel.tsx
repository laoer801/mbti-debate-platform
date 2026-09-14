import { useEffect, useMemo, useState } from 'react'
import {
  Bookmark,
  ExternalLink,
  Filter,
  Loader2,
  Save,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { getToken } from '../hooks/useAuth'
import {
  listFavorites,
  listFavoriteTags,
  removeFavorite,
  updateFavorite,
  type Favorite,
  type FavoriteItemType,
} from '../utils/favoritesClient'
import { ZhihuSyncButton } from './ZhihuSyncButton'
import clsx from 'clsx'

const TYPE_LABEL: Record<FavoriteItemType, string> = {
  answer: '答案',
  article: '文章',
  question: '问题',
  post: '本地帖',
}

/**
 * v40.7 思辩星球云端收藏夹面板
 * 挂在 KnowledgeLibrary 作为新 mode = 'favorites'
 */
export function FavoritesPanel() {
  const [items, setItems] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<FavoriteItemType | ''>('')
  const [tagFilter, setTagFilter] = useState('')
  const [allTags, setAllTags] = useState<{ name: string; count: number }[]>([])
  const [editing, setEditing] = useState<Favorite | null>(null)
  const [editTags, setEditTags] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [syncOpen, setSyncOpen] = useState(false)

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const list = await listFavorites(getToken(), {
        type: typeFilter || undefined,
        tag: tagFilter || undefined,
        q: search.trim() || undefined,
      })
      setItems(list)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, tagFilter])

  useEffect(() => {
    listFavoriteTags(getToken()).then(setAllTags).catch(() => {})
  }, [])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确认取消收藏？')) return
    try {
      await removeFavorite(getToken(), id)
      setItems((prev) => prev.filter((f) => f.id !== id))
      setSelected((prev) => {
        const n = new Set(prev)
        n.delete(id)
        return n
      })
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleBatchDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`确认取消选中的 ${selected.size} 项收藏？`)) return
    try {
      for (const id of selected) {
        await removeFavorite(getToken(), id)
      }
      setItems((prev) => prev.filter((f) => !selected.has(f.id)))
      setSelected(new Set())
    } catch (e: any) {
      setError(e.message)
    }
  }

  const openEdit = (fav: Favorite) => {
    setEditing(fav)
    setEditTags(fav.tags.join(', '))
    setEditNotes(fav.notes)
  }

  const saveEdit = async () => {
    if (!editing) return
    try {
      const tags = editTags.split(',').map((t) => t.trim()).filter(Boolean)
      const updated = await updateFavorite(getToken(), editing.id, {
        notes: editNotes,
        tags,
      })
      setItems((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
      setEditing(null)
    } catch (e: any) {
      setError(e.message)
    }
  }

  // 可同步到知乎的条目（answer/article/question + source=zhihu）
  const syncableItems = useMemo(
    () => items.filter((f) => f.source === 'zhihu' && (f.itemType === 'answer' || f.itemType === 'article' || f.itemType === 'question')),
    [items]
  )
  const syncableSelected = useMemo(
    () => syncableItems.filter((f) => selected.has(f.id)),
    [syncableItems, selected]
  )

  return (
    <div className="px-4 pb-6">
      {/* 工具栏 */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-4 flex flex-wrap items-center gap-2"
        style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && refresh()}
            placeholder="搜索标题/摘要/备注"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none focus:ring-2"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as FavoriteItemType | '')}
          className="px-2 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        >
          <option value="">全部类型</option>
          <option value="answer">答案</option>
          <option value="article">文章</option>
          <option value="question">问题</option>
          <option value="post">本地帖</option>
        </select>

        {tagFilter && (
          <button
            onClick={() => setTagFilter('')}
            className="px-2 py-1 rounded text-xs flex items-center gap-1"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          >
            <Tag size={10} /> {tagFilter} <X size={10} />
          </button>
        )}

        {selected.size > 0 && (
          <>
            <button
              onClick={handleBatchDelete}
              className="px-2 py-2 rounded-lg text-xs flex items-center gap-1"
              style={{ background: 'rgba(231,76,60,0.15)', color: '#e74c3c' }}
            >
              <Trash2 size={12} /> 删除 ({selected.size})
            </button>
            {syncableSelected.length > 0 && (
              <button
                onClick={() => setSyncOpen(true)}
                className="px-2 py-2 rounded-lg text-xs flex items-center gap-1 text-white"
                style={{ background: 'linear-gradient(135deg, #0084ff, #0066cc)' }}
              >
                <Upload size={12} /> 同步 {syncableSelected.length} 条到知乎
              </button>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="mb-3 p-2 rounded text-xs" style={{ background: 'rgba(231,76,60,0.15)', color: '#e74c3c' }}>
          {error}
        </div>
      )}

      {/* 标签云 */}
      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Filter size={12} className="opacity-60 self-center" />
          {allTags.slice(0, 15).map((t) => (
            <button
              key={t.name}
              onClick={() => setTagFilter(tagFilter === t.name ? '' : t.name)}
              className={clsx(
                'px-2 py-0.5 rounded text-xs transition-all',
                tagFilter === t.name && 'font-semibold'
              )}
              style={{
                background: tagFilter === t.name ? 'var(--color-accent)' : 'var(--color-surface)',
                color: tagFilter === t.name ? '#fff' : 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              {t.name} <span className="opacity-60">×{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* 列表 */}
      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12 opacity-60">
          <Loader2 size={20} className="animate-spin mr-2" /> 加载中...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 opacity-60 text-center">
          <Bookmark size={36} className="mb-3 opacity-50" />
          <p className="text-sm">还没有收藏</p>
          <p className="text-xs mt-1">在知乎内容卡片右上角点 ★ 即可收藏到这里</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((f) => (
            <FavCard
              key={f.id}
              fav={f}
              selected={selected.has(f.id)}
              onToggleSelect={() => toggleSelect(f.id)}
              onDelete={() => handleDelete(f.id)}
              onEdit={() => openEdit(f)}
            />
          ))}
        </div>
      )}

      {/* 编辑弹窗 */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 shadow-2xl"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Save size={16} /> 编辑收藏
            </h3>
            <p className="text-xs mb-3 opacity-70" style={{ color: 'var(--color-text-secondary)' }}>
              {editing.title}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  标签（英文/中文逗号分隔）
                </label>
                <input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="MBTI, INTJ, 心理学"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  备注
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={4}
                  placeholder="想说的话..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium hover:opacity-80"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              >
                取消
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'var(--color-accent)' }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量同步弹窗（包装 ZhihuSyncButton 的 presetItems） */}
      {syncOpen && (
        <SyncBatchModal
          favorites={syncableSelected}
          onClose={() => setSyncOpen(false)}
          onSynced={() => {
            setSyncOpen(false)
            setSelected(new Set())
            refresh()
          }}
        />
      )}
    </div>
  )
}

function FavCard({
  fav,
  selected,
  onToggleSelect,
  onDelete,
  onEdit,
}: {
  fav: Favorite
  selected: boolean
  onToggleSelect: () => void
  onDelete: () => void
  onEdit: () => void
}) {
  return (
    <div
      className="rounded-xl p-3 transition-all hover:shadow-md"
      style={{
        background: 'var(--color-surface)',
        border: selected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-1 rounded"
          style={{ accentColor: 'var(--color-accent)' }}
          aria-label="选中"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5">
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  background: fav.source === 'local' ? 'rgba(99,102,241,0.15)' : 'rgba(0,132,255,0.15)',
                  color: fav.source === 'local' ? '#6366f1' : '#0084ff',
                }}
              >
                {TYPE_LABEL[fav.itemType]}
              </span>
              {fav.author && (
                <span className="text-xs opacity-70" style={{ color: 'var(--color-text-secondary)' }}>
                  {fav.author}
                </span>
              )}
            </div>
          </div>
          <h4 className="text-sm font-semibold mb-1 line-clamp-2" style={{ color: 'var(--color-text)' }}>
            {fav.url ? (
              <a href={fav.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {fav.title} <ExternalLink size={10} className="inline opacity-50" />
              </a>
            ) : (
              fav.title
            )}
          </h4>
          {fav.summary && (
            <p className="text-xs line-clamp-2 mb-2 opacity-80" style={{ color: 'var(--color-text-secondary)' }}>
              {fav.summary}
            </p>
          )}
          {fav.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {fav.tags.map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 rounded text-[10px]"
                  style={{
                    background: 'var(--color-bg)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
          {fav.notes && (
            <p className="text-xs italic mb-2 line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
              💭 {fav.notes}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-[10px] opacity-50" style={{ color: 'var(--color-text-secondary)' }}>
              {new Date(fav.addedAt).toLocaleDateString('zh-CN')}
            </span>
            <div className="flex gap-1">
              <button
                onClick={onEdit}
                className="px-2 py-1 rounded text-xs hover:opacity-80"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                编辑
              </button>
              <button
                onClick={onDelete}
                className="px-2 py-1 rounded text-xs hover:opacity-80"
                style={{ color: '#e74c3c' }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 复用 ZhihuSyncButton 但用 presetItems 注入选中的 fav_ids
 */
function SyncBatchModal({
  favorites,
  onClose,
  onSynced,
}: {
  favorites: Favorite[]
  onClose: () => void
  onSynced: () => void
}) {
  // ZhihuSyncButton 内部用 content_id 字段，favorites 用 itemId；构造同步 items
  const presetItems = favorites.map((f) => ({
    content_type: f.itemType as 'answer' | 'article' | 'question',
    content_id: f.itemId,
  }))
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div className="relative">
        <ZhihuSyncButtonWrapper presetItems={presetItems} onAfterSync={onSynced} onClose={onClose} />
      </div>
    </div>
  )
}

/**
 * ZhihuSyncButton 是导出组件但只能 "click to open" 模式；这里让它自动打开
 */
function ZhihuSyncButtonWrapper({
  presetItems,
  onAfterSync,
  onClose,
}: {
  presetItems: Array<{ content_type: 'answer' | 'article' | 'question'; content_id: string }>
  onAfterSync: () => void
  onClose: () => void
}) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <ZhihuSyncButton
        label="同步选中条目到知乎"
        presetItems={presetItems}
      />
      <p className="mt-3 text-xs opacity-60 text-center" style={{ color: 'var(--color-text-secondary)' }}>
        同步完成后窗口自动关闭
      </p>
      <button
        onClick={onAfterSync}
        className="mt-2 w-full py-2 rounded-lg text-sm font-medium hover:opacity-80"
        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
      >
        完成
      </button>
    </div>
  )
}