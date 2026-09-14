import { useEffect, useState } from 'react'
import { CloudUpload, ExternalLink, Loader2, Plus, AlertCircle } from 'lucide-react'
import { getToken } from '../hooks/useAuth'
import {
  getZhihuBinding,
  listZhihuFavlists,
  createZhihuFavlist,
  syncToZhihu,
  type ZhihuFavlist,
} from '../utils/zhihuAuthClient'

interface SyncItem {
  content_type: 'answer' | 'article' | 'question'
  content_id: string
}

/**
 * v40.6 把内容批量同步到知乎收藏夹
 *
 * 触发位置：KnowledgeLibrary 顶部"同步到知乎"按钮 / ZhihuSourcesPanel 顶部
 *
 * 数据源：
 *   1) 当前传入的 items（如来自"我的收藏"列表的 answer_id 数组）
 *   2) 弹窗里手动添加的 ID 列表（每行一个：type:id，如 answer:12345678）
 *
 * 流程：选目标收藏夹 → 批量调 /api/zhihu-auth/sync → 显示成功/失败明细
 */
export function ZhihuSyncButton({
  label = '同步到知乎收藏夹',
  presetItems = [],
  disabled = false,
}: {
  label?: string
  presetItems?: SyncItem[]
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [binding, setBinding] = useState<{ bound: boolean; zhihuUsername?: string } | null>(null)
  const [favlists, setFavlists] = useState<ZhihuFavlist[]>([])
  const [target, setTarget] = useState<number | ''>('')
  const [newListTitle, setNewListTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [extraText, setExtraText] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; summary: any; results: any[] } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    ;(async () => {
      try {
        const b = await getZhihuBinding(getToken())
        setBinding({ bound: b.bound, zhihuUsername: b.zhihuUsername })
        if (b.bound) {
          const lists = await listZhihuFavlists(getToken())
          setFavlists(lists)
        }
      } catch (e: any) {
        setError(e.message)
      }
    })()
  }, [open])

  const parseExtra = (): SyncItem[] => {
    const items: SyncItem[] = []
    extraText.split(/\r?\n/).forEach((line) => {
      const m = line.trim().match(/^(answer|article|question)\s*[:#]\s*(\d+)$/i)
      if (m) items.push({ content_type: m[1].toLowerCase() as any, content_id: m[2] })
    })
    return items
  }

  const handleCreate = async () => {
    if (!newListTitle.trim()) {
      setError('收藏夹标题不能为空')
      return
    }
    setCreating(true)
    setError('')
    try {
      const fav = await createZhihuFavlist(getToken(), {
        title: newListTitle.trim(),
        description: '由思辩星球同步创建',
        is_public: false,
      })
      const lists = await listZhihuFavlists(getToken())
      setFavlists(lists)
      setTarget(fav.id)
      setNewListTitle('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const handleSync = async () => {
    if (!target) {
      setError('请先选择目标收藏夹')
      return
    }
    const items = [...presetItems, ...parseExtra()]
    if (items.length === 0) {
      setError('没有可同步的内容（请先在下方输入 answer/article/question ID，或从收藏列表传入）')
      return
    }
    if (items.length > 100) {
      setError('单次最多 100 条，请精简后重试')
      return
    }
    setSyncing(true)
    setError('')
    setResult(null)
    try {
      const r = await syncToZhihu(getToken(), Number(target), items)
      setResult(r)
    } catch (e: any) {
      setError(e.message || '同步失败')
    } finally {
      setSyncing(false)
    }
  }

  if (!binding || !binding.bound) {
    return (
      <button
        disabled
        title="请先在账号设置里绑定知乎账号"
        className="btn btn-sm btn-ghost opacity-50"
      >
        <CloudUpload size={14} /> 同步到知乎（未绑定）
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="btn btn-sm btn-primary btn-sheen"
        style={{ background: 'linear-gradient(135deg, #0084ff, #0066cc)' }}
      >
        <CloudUpload size={14} /> {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <CloudUpload size={18} /> 同步到知乎收藏夹
            </h2>
            <p className="text-xs mb-4 opacity-70" style={{ color: 'var(--color-text-secondary)' }}>
              当前知乎账号：<strong>{binding.zhihuUsername}</strong>
              <a
                href="https://www.zhihu.com/collections"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 hover:underline"
              >
                <ExternalLink size={10} className="inline" />
              </a>
            </p>

            {/* 目标收藏夹 */}
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                目标收藏夹
              </label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              >
                <option value="">— 选择收藏夹 —</option>
                {favlists.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}（{f.item_count} 条）
                  </option>
                ))}
              </select>

              <details className="mt-2">
                <summary className="text-xs cursor-pointer hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }}>
                  <Plus size={10} className="inline" /> 创建一个新收藏夹
                </summary>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    placeholder="收藏夹标题"
                    className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  />
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: '#0084ff' }}
                  >
                    {creating ? <Loader2 size={12} className="inline animate-spin" /> : '创建'}
                  </button>
                </div>
              </details>
            </div>

            {/* 额外 ID 列表 */}
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                手动添加 ID（每行一个，格式 <code>type:id</code>，如 <code>answer:12345678</code>）
              </label>
              <textarea
                value={extraText}
                onChange={(e) => setExtraText(e.target.value)}
                rows={4}
                placeholder={'answer:12345678\narticle:87654321\nquestion:1234567'}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none font-mono focus:ring-2"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
              <p className="text-xs mt-1 opacity-60" style={{ color: 'var(--color-text-secondary)' }}>
                {presetItems.length > 0 ? `已有 ${presetItems.length} 条从列表传入 + ` : ''}
                本框解析 {parseExtra().length} 条
              </p>
            </div>

            {error && (
              <div className="mb-3 p-2 rounded text-xs flex items-start gap-2" style={{ background: 'rgba(231,76,60,0.15)', color: '#e74c3c' }}>
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div
                className="mb-3 p-3 rounded-lg text-xs"
                style={{
                  background: result.ok ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
                  color: result.ok ? '#22c55e' : '#ca8a04',
                }}
              >
                <div className="font-semibold mb-1">
                  同步完成：成功 {result.summary.success} / 失败 {result.summary.failed} / 跳过 {result.summary.skipped}
                </div>
                {result.results.filter((r) => r.status !== 'success').length > 0 && (
                  <details>
                    <summary className="cursor-pointer hover:opacity-80">查看失败明细</summary>
                    <div className="mt-2 space-y-1 font-mono">
                      {result.results
                        .filter((r) => r.status !== 'success')
                        .map((r, i) => (
                          <div key={i}>
                            {r.content_type}:{r.content_id} → {r.status}
                            {r.message ? `（${r.message}）` : ''}
                          </div>
                        ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              >
                关闭
              </button>
              <button
                onClick={handleSync}
                disabled={syncing || !target}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #0084ff, #0066cc)' }}
              >
                {syncing ? <><Loader2 size={14} className="inline animate-spin mr-1" />同步中...</> : '开始同步'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}