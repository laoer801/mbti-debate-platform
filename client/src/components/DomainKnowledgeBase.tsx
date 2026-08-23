/**
 * v32 领域知识库管理面板（DomainKnowledgeBase.tsx）
 *
 * 多领域 RAG 知识库管理：
 *  - 领域列表（内置预设 + 用户自建，可启用/停用）
 *  - 导入文档（拖拽 / 选择文件，txt / md / docx / pdf）
 *  - 文档管理（查看 / 删除）
 *  - 检索测试（输入问题，实时查看知识库命中）
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { CSSProperties } from 'react'
import {
  getAllDomains, saveDomain, removeDomain,
  addDocument, getDocuments, removeDocument, getDomainStats,
  searchDomain, type DomainRecord, type KnowledgeDoc,
} from '../utils/knowledgeBase/store'
import { parseDocumentFile } from '../utils/knowledgeBase/documentParser'
import { getDomainPreset } from '../data/domainPresets'
import type { BM25Hit } from '../utils/knowledgeBase/bm25'
import { Database, Upload, Trash2, Plus, Search, X, FileText, CheckCircle2, AlertCircle, Power, BookOpen } from 'lucide-react'
import clsx from 'clsx'

interface ImportLog {
  name: string
  ok: boolean
  detail: string
  chunkCount: number
}

export function DomainKnowledgeBase() {
  const [domains, setDomains] = useState<DomainRecord[]>([])
  const [selectedId, setSelectedId] = useState<string>('finance')
  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [stats, setStats] = useState<Record<string, { docCount: number; chunkCount: number }>>({})
  const [importing, setImporting] = useState(false)
  const [importLogs, setImportLogs] = useState<ImportLog[]>([])
  const [query, setQuery] = useState('')
  const [testHits, setTestHits] = useState<BM25Hit[] | null>(null)
  const [testing, setTesting] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)

  const selected = domains.find(d => d.id === selectedId) ?? domains[0]
  const selectedStats = selected ? stats[selected.id] : undefined

  const refresh = useCallback(async () => {
    const ds = await getAllDomains()
    setDomains(ds)
    // 刷新统计
    const st: Record<string, { docCount: number; chunkCount: number }> = {}
    for (const d of ds) st[d.id] = await getDomainStats(d.id)
    setStats(st)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!selected) return
    getDocuments(selected.id).then(setDocs)
    setTestHits(null)
    setQuery('')
  }, [selectedId, selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ============ 导入 ============

  const importFiles = useCallback(async (files: FileList | File[]) => {
    const list = [...files]
    if (list.length === 0 || !selected) return
    setImporting(true)
    setImportLogs([])
    const logs: ImportLog[] = []
    for (const f of list) {
      const parsed = await parseDocumentFile(f)
      if (parsed.error) {
        logs.push({ name: f.name, ok: false, detail: parsed.error, chunkCount: 0 })
        continue
      }
      if (parsed.chunks.length === 0) {
        logs.push({ name: f.name, ok: false, detail: '未提取到有效内容（内容过短或为纯图片/表格）', chunkCount: 0 })
        continue
      }
      const doc = await addDocument(
        selected.id,
        parsed.fileName,
        parsed.title,
        parsed.kind,
        parsed.chunks.map(c => ({ text: c.text, title: c.title, fileName: c.fileName, seq: c.seq })),
        f.size,
        undefined
      )
      logs.push({ name: f.name, ok: true, detail: `已解析 ${parsed.chunks.length} 段`, chunkCount: doc.chunkCount })
    }
    setImportLogs(logs)
    setImporting(false)
    await refresh()
    setDocs(await getDocuments(selected.id))
  }, [selected, refresh])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    importFiles(e.dataTransfer.files)
  }

  const handleDeleteDoc = async (docId: string) => {
    if (!selected) return
    await removeDocument(selected.id, docId)
    setDocs(await getDocuments(selected.id))
    await refresh()
  }

  const handleToggleEnabled = async (d: DomainRecord) => {
    await saveDomain({ ...d, enabled: !d.enabled })
    await refresh()
  }

  const handleDeleteDomain = async (d: DomainRecord) => {
    if (!d.isCustom) return
    await removeDomain(d.id)
    if (selectedId === d.id) setSelectedId('finance')
    await refresh()
  }

  const handleTestSearch = async () => {
    if (!selected || !query.trim()) return
    setTesting(true)
    try {
      const hits = await searchDomain(selected.id, query.trim(), 5)
      setTestHits(hits)
    } finally {
      setTesting(false)
    }
  }

  // ============ 渲染 ============

  return (
    <div className="h-full flex flex-col" role="main" aria-label="多领域知识库">
      {/* 头部 */}
      <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2 display-title gradient-text">
              <Database size={18} style={{ color: 'var(--color-accent)' }} /> 多领域知识库
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              导入各行业资料 · 1v1 深度交流时按领域检索引用（本地存储，离线可用）
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm btn-sheen" aria-label="新建领域">
              <Plus size={14} /> 新建领域
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* 领域选择条 */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4" role="tablist" aria-label="选择领域">
          {domains.map(d => (
            <button
              key={d.id}
              role="tab"
              aria-selected={selectedId === d.id}
              onClick={() => setSelectedId(d.id)}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all', selectedId === d.id ? 'text-white' : '')}
              style={selectedId === d.id
                ? { background: d.color }
                : { background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', opacity: d.enabled ? 1 : 0.45 }}
              title={d.description}
            >
              <span>{d.emoji}</span> {d.name}
              {stats[d.id] && stats[d.id].chunkCount > 0 && (
                <span className={clsx('text-[9px] px-1 py-0.5 rounded-full', selectedId === d.id ? 'bg-white/25' : '')}
                  style={selectedId === d.id ? {} : { background: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}>
                  {stats[d.id].chunkCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {selected ? (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* 领域信息卡 */}
            <div className="glass card-spotlight rounded-2xl p-4 border" style={{ borderColor: `${selected.color}44`, ...({ '--spot-color': `${selected.color}1f` } as CSSProperties) }}>
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: selected.color }}>
                  {selected.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold" style={{ color: 'var(--color-text)' }}>{selected.name}</h2>
                    {!selected.isCustom && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${selected.color}1a`, color: selected.color }}>内置领域</span>
                    )}
                    {selected.isCustom && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg)', color: 'var(--color-text-tertiary)' }}>自定义</span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
                      {selectedStats?.docCount ?? 0} 个文档 · {selectedStats?.chunkCount ?? 0} 条资料
                    </span>
                  </div>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{selected.description}</p>
                  {selected.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selected.keywords.slice(0, 8).map(k => (
                        <span key={k} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-text-tertiary)' }}>{k}</span>
                      ))}
                      {selected.keywords.length > 8 && <span className="text-[9px] self-center" style={{ color: 'var(--color-text-tertiary)' }}>+{selected.keywords.length - 8}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleToggleEnabled(selected)}
                    className={clsx('flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all', selected.enabled ? '' : 'opacity-60')}
                    style={selected.enabled ? { background: 'rgba(16,185,129,0.12)', color: '#2fc9a3' } : { background: 'var(--color-bg)', color: 'var(--color-text-tertiary)' }}
                    title={selected.enabled ? '点击停用（提问时不再检索该领域）' : '点击启用'}
                  >
                    <Power size={12} /> {selected.enabled ? '已启用' : '已停用'}
                  </button>
                  {selected.isCustom && (
                    <button
                      onClick={() => handleDeleteDomain(selected)}
                      className="p-1.5 rounded-lg transition-colors hover:scale-105"
                      style={{ color: 'var(--color-danger)', background: 'var(--color-danger-light)' }}
                      title="删除该领域（连同所有文档）"
                      aria-label={`删除领域 ${selected.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 导入区 */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => { dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false) } }}
              onDragEnter={() => { dragDepth.current += 1 }}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={clsx('rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all', dragging ? 'scale-[1.01]' : '')}
              style={{
                borderColor: dragging ? selected.color : 'var(--color-border)',
                background: dragging ? `${selected.color}0d` : 'var(--color-bg)',
              }}
              role="button"
              aria-label="导入文档到知识库"
            >
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".txt,.md,.markdown,.docx,.pdf"
                className="hidden"
                onChange={e => { if (e.target.files) importFiles(e.target.files); e.target.value = '' }}
              />
              <Upload size={22} className="mx-auto mb-2" style={{ color: selected.color }} />
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                {importing ? '正在解析文档…' : `拖拽或点击导入文档到「${selected.emoji} ${selected.name}」`}
              </div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                支持 txt / md / docx / pdf · 可多选 · 文档在本地解析与存储，不上传任何服务器
              </div>
            </div>

            {/* 导入日志 */}
            {importLogs.length > 0 && (
              <div className="space-y-1.5 rounded-xl p-3" style={{ background: 'var(--color-bg)' }}>
                {importLogs.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs" style={{ color: l.ok ? 'var(--color-text-secondary)' : 'var(--color-danger)' }}>
                    {l.ok ? <CheckCircle2 size={13} style={{ color: '#2fc9a3' }} /> : <AlertCircle size={13} />}
                    <span className="font-medium truncate">{l.name}</span>
                    <span className="ml-auto shrink-0">{l.detail}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 文档列表 */}
            <div className="glass rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <FileText size={15} style={{ color: selected.color }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>文档列表</h3>
                <span className="text-[10px] text-slate-400 ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
                  {docs.length} 个文档 · 提问时按相关度自动检索
                </span>
              </div>
              {docs.length === 0 ? (
                <div className="text-center py-6">
                  <BookOpen size={20} className="mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
                  <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    还没有文档——导入一份行业资料，1v1 交流时 TA 就能据此回答
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map(d => (
                    <div key={d.docId} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-opacity-60" style={{ background: 'var(--color-bg)' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${selected.color}1a` }}>
                        <FileText size={14} style={{ color: selected.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{d.title}</div>
                        <div className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                          {d.kind.toUpperCase()} · {d.chunkCount} 段 · {(d.size / 1024).toFixed(1)} KB · {new Date(d.addedAt).toLocaleString()}
                        </div>
                      </div>
                      {d.error && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
                          {d.error}
                        </span>
                      )}
                      <button
                        onClick={() => handleDeleteDoc(d.docId)}
                        className="p-1.5 rounded-lg transition-colors hover:scale-105"
                        style={{ color: 'var(--color-danger)', background: 'var(--color-danger-light)' }}
                        title="删除该文档"
                        aria-label={`删除 ${d.title}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 检索测试 */}
            <div className="glass rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Search size={15} style={{ color: selected.color }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>检索测试</h3>
                <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>模拟提问，查看知识库会命中哪些资料</span>
              </div>
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTestSearch()}
                  placeholder={`例：${getDomainPreset(selected.id)?.examples?.[0] ?? '输入一个与领域相关的问题…'}`}
                  className="flex-1 px-3.5 py-2 rounded-xl text-sm"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  aria-label="检索测试输入"
                />
                <button
                  onClick={handleTestSearch}
                  disabled={testing || !query.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 disabled:opacity-40"
                  style={{ background: selected.color }}
                >
                  {testing ? '检索中…' : '检索'}
                </button>
              </div>
              {testHits && (
                <div className="mt-3 space-y-2">
                  {testHits.length === 0 ? (
                    <div className="text-xs py-3 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                      没有命中——试试调整提问措辞，或导入更多资料
                    </div>
                  ) : (
                    testHits.map((h, i) => (
                      <div key={h.id} className="p-2.5 rounded-xl" style={{ background: 'var(--color-bg)', borderLeft: `3px solid ${selected.color}` }}>
                        <div className="flex items-center gap-2 text-[10px] mb-1">
                          <span className="font-bold" style={{ color: selected.color }}>#{i + 1}</span>
                          <span className="font-medium truncate" style={{ color: 'var(--color-text)' }}>《{h.title}》</span>
                          <span className="ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>score {(h.score as number).toFixed(2)}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed line-clamp-3" style={{ color: 'var(--color-text-secondary)' }}>{h.text}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>请选择一个领域</div>
        )}
      </div>

      {/* 新建领域模态 */}
      {showCreate && <CreateDomainModal
        onClose={() => setShowCreate(false)}
        onCreated={async () => { await refresh(); setShowCreate(false) }}
      />}
    </div>
  )
}

/* ==================== 新建领域模态 ==================== */

const CREATE_COLORS = ['#6366f1', '#2fc9a3', '#d9b871', '#e57e7e', '#8f7ff5', '#66c4d4', '#e58fb5', '#14b8a6', '#6fa3f5', '#ad8fe8']

function CreateDomainModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📂')
  const [color, setColor] = useState(CREATE_COLORS[0])
  const [keywordsText, setKeywordsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = async () => {
    if (!name.trim()) { setErr('请输入领域名称'); return }
    setSaving(true)
    const keywords = keywordsText.split(/[\s,，、]+/).map(k => k.trim()).filter(k => k.length >= 2)
    const id = 'custom_' + Date.now().toString(36)
    await saveDomain({
      id,
      name: name.trim().slice(0, 12),
      emoji: emoji.trim() || '📂',
      color,
      description: '自定义领域（" + name.trim() + "）',
      keywords,
      isCustom: true,
      enabled: true,
      createdAt: Date.now(),
    })
    setSaving(false)
    await onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
      role="dialog" aria-modal="true" aria-label="新建领域"
      onClick={onClose}>
      <div className="glass w-full max-w-md rounded-2xl border shadow-2xl animate-fade-in p-5"
        style={{ borderColor: 'var(--color-border)', background: 'color-mix(in srgb, var(--color-bg-secondary) 94%, transparent)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold display-title gradient-text flex items-center gap-2">
            <Plus size={16} style={{ color: 'var(--color-accent)' }} /> 新建领域
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--color-text-tertiary)' }} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              领域名称 <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="如：汽车行业 / 跨境电商 / 建筑设计"
              className="input-field w-full text-sm" maxLength={12} aria-label="领域名称" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>图标 Emoji</label>
              <input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="📂"
                className="input-field w-full text-sm" maxLength={4} aria-label="图标" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>主题色</label>
              <div className="flex gap-1.5 pt-1">
                {CREATE_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                    style={{ background: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
                    aria-label={`选择颜色 ${c}`} />
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              领域关键词（提问时用于识别领域，空格分隔）
            </label>
            <textarea value={keywordsText} onChange={e => setKeywordsText(e.target.value)}
              placeholder="例：汽车 新能源 电池 充电桩 智能驾驶"
              className="input-field w-full text-sm resize-none h-16 leading-relaxed" aria-label="关键词" />
          </div>
          {err && <div className="text-xs" style={{ color: 'var(--color-danger)' }}>{err}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm btn-sheen">
            <Plus size={14} /> {saving ? '创建中…' : '创建领域'}
          </button>
        </div>
      </div>
    </div>
  )
}
