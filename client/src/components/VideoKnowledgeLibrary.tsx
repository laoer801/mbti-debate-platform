/**
 * v34 视频知识管理面板（VideoKnowledgeLibrary.tsx）
 *
 * 把喜欢的科普视频「提炼成文字 → 记录保存 → 让人格学习」。
 * 导入通道三路皆可：粘贴文案/字幕、上传字幕文件（.srt/.vtt/.txt/.md）、外部转录产物。
 * 学习方式（全局共享）：所有 16 人格在辩论 / 1v1 对话时自动检索并引用视频知识。
 */

import { useState, useEffect, useCallback } from 'react'
import { Clapperboard, Upload, Trash2, Plus, Link2, FileText, CheckCircle2, AlertCircle, ChevronDown, Sparkles, BookOpenCheck } from 'lucide-react'
import clsx from 'clsx'
import {
  getVideoBooks, saveVideoBooks, importVideoKnowledge, removeVideoBook, clearVideoBooks,
  parseSubtitleFile, getVideoKnowledgeStats, searchVideos, type VideoBook,
} from '../utils/videoKnowledge'

interface ImportLog {
  title: string
  ok: boolean
  detail: string
}

export function VideoKnowledgeLibrary() {
  const [books, setBooks] = useState<VideoBook[]>(getVideoBooks)
  const [stats, setStats] = useState<{ count: number; chunkCount: number }>({ count: 0, chunkCount: 0 })
  const [showImport, setShowImport] = useState(false)
  const [title, setTitle] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [tags, setTags] = useState('')
  const [summary, setSummary] = useState('')
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [testQuery, setTestQuery] = useState('')
  const [testHits, setTestHits] = useState<{ title: string; text: string; score: number }[] | null>(null)
  const [testing, setTesting] = useState(false)

  const refresh = useCallback(async () => {
    setBooks(getVideoBooks())
    setStats(await getVideoKnowledgeStats())
  }, [])

  useEffect(() => {
    refresh()
    const onChanged = () => refresh()
    window.addEventListener('mbti:video-books-changed', onChanged)
    window.addEventListener('storage', onChanged)
    return () => {
      window.removeEventListener('mbti:video-books-changed', onChanged)
      window.removeEventListener('storage', onChanged)
    }
  }, [refresh])

  // ============ 导入 ============

  const doImport = async (sourceKind: 'paste' | 'file' | 'external', textContent: string, fileName?: string) => {
    if (!textContent.trim()) return
    setImporting(true)
    setLogs([])
    try {
      const tagList = tags.split(/[,，\s]+/).filter(Boolean)
      const book = await importVideoKnowledge({
        title: title.trim() || fileName?.replace(/\.(srt|vtt|txt|md|transcript)$/i, '') || '未命名视频',
        sourceUrl: sourceUrl.trim() || undefined,
        emoji: '📺',
        tags: tagList,
        summary: summary.trim() || undefined,
        text: textContent,
        sourceKind,
      })
      setLogs([{ title: book.title, ok: true, detail: `已入库 ${book.chunkCount} 段内容 · 所有人格可学习` }])
      // 清空输入（保留标题/链接/标签方便连续导入同一系列视频）
      setText('')
      setSummary('')
    } catch (err) {
      setLogs([{ title: title || '导入', ok: false, detail: err instanceof Error ? err.message : String(err) }])
    }
    setImporting(false)
    await refresh()
  }

  const handlePasteImport = () => doImport('paste', text)

  const handleFileImport = async (files: FileList | File[]) => {
    const list = [...files]
    if (list.length === 0) return
    setImporting(true)
    setLogs([])
    const newLogs: ImportLog[] = []
    for (const f of list) {
      const buf = await f.arrayBuffer()
      const content = new TextDecoder('utf-8').decode(buf)
      const plain = parseSubtitleFile(f.name, content)
      if (!plain.trim()) {
        newLogs.push({ title: f.name, ok: false, detail: '未提取到有效文字（可能为空字幕或非文本内容）' })
        continue
      }
      try {
        const book = await importVideoKnowledge({
          title: title.trim() || f.name.replace(/\.(srt|vtt|txt|md)$/i, ''),
          sourceUrl: sourceUrl.trim() || undefined,
          emoji: '📺',
          tags: tags.split(/[,，\s]+/).filter(Boolean),
          summary: summary.trim() || undefined,
          text: plain,
          sourceKind: 'file',
        })
        newLogs.push({ title: book.title, ok: true, detail: `已入库 ${book.chunkCount} 段内容 · 所有人格可学习` })
      } catch (err) {
        newLogs.push({ title: f.name, ok: false, detail: err instanceof Error ? err.message : String(err) })
      }
    }
    setLogs(newLogs)
    setImporting(false)
    await refresh()
  }

  const handleDelete = async (id: string) => {
    await removeVideoBook(id)
    setExpandedId(prev => (prev === id ? null : prev))
    await refresh()
  }

  const handleClearAll = async () => {
    if (!window.confirm(`确定清空全部 ${books.length} 条视频知识？人格将不再引用它们。`)) return
    await clearVideoBooks()
    setExpandedId(null)
    await refresh()
  }

  const handleTestSearch = async () => {
    if (!testQuery.trim()) return
    setTesting(true)
    const hits = await searchVideos(testQuery, 3)
    setTestHits(hits)
    setTesting(false)
  }

  // ============ 渲染 ============

  return (
    <div className="h-full flex flex-col" role="main" aria-label="视频知识库">
      {/* 头部 */}
      <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2 display-title gradient-text">
              <Clapperboard size={16} style={{ color: 'var(--color-accent)' }} /> 视频知识 · 人格学习
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              把喜欢的科普视频提炼成文字，所有 16 人格在辩论 / 对话中都能引用
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              📺 {stats.count} 条 · {stats.chunkCount} 段
            </span>
            <button onClick={() => { setShowImport(v => !v); setLogs([]) }} className="btn btn-primary btn-sm btn-sheen" aria-label="导入视频知识">
              <Plus size={14} /> {showImport ? '收起导入' : '导入视频知识'}
            </button>
            {books.length > 0 && (
              <button onClick={handleClearAll} className="btn btn-ghost btn-sm" aria-label="清空视频知识" title="清空全部">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 导入面板 */}
      {showImport && (
        <div className="px-4 py-3 border-b flex-shrink-0 space-y-2.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="视频标题（如：三分钟看懂黑洞）"
              className="input input-sm w-full"
              aria-label="视频标题"
            />
            <div className="flex items-center gap-2">
              <Link2 size={14} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
              <input
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                placeholder="来源链接（抖音分享链接，可选）"
                className="input input-sm w-full"
                aria-label="来源链接"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="标签，用逗号分隔（如：天文,科普,黑洞）"
              className="input input-sm w-full"
              aria-label="标签"
            />
            <input
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="一句话摘要（可选）"
              className="input input-sm w-full"
              aria-label="摘要"
            />
          </div>

          {/* 粘贴导入 */}
          <div>
            <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              <Sparkles size={12} /> 方式一：粘贴视频文案 / 字幕（在抖音 App 复制全文后粘贴到这里）
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={'粘贴视频文案或字幕文字…\n\n（提示：抖音视频右下角「全文」可复制文案；或用外部转录工具把视频转成文字后粘贴）'}
              rows={4}
              className="input w-full resize-y text-sm"
              aria-label="粘贴视��文案"
            />
            <div className="flex justify-end mt-1.5">
              <button onClick={handlePasteImport} disabled={importing || !text.trim()} className="btn btn-primary btn-sm btn-sheen" aria-label="导入粘贴内容">
                <CheckCircle2 size={14} /> 导入文字
              </button>
            </div>
          </div>

          {/* 文件导入 */}
          <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              <FileText size={12} /> 方式二：上传字幕 / 文案文件（支持 .srt / .vtt / .txt / .md，可多选）
            </div>
            <label className="block w-full rounded-lg border-2 border-dashed px-4 py-3 text-center cursor-pointer transition-all hover:opacity-80"
              style={{ borderColor: 'var(--color-accent)', background: 'var(--color-bg)' }}>
              <Upload size={16} className="mx-auto mb-1" style={{ color: 'var(--color-accent)' }} />
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                点击选择文件（自动解析 .srt/.vtt 时间轴，提取纯文本入库）
              </span>
              <input
                type="file"
                accept=".srt,.vtt,.txt,.md,.markdown"
                multiple
                className="hidden"
                onChange={e => { if (e.target.files) handleFileImport(e.target.files); e.target.value = '' }}
                aria-label="上传字幕文件"
              />
            </label>
          </div>

          {/* 导入日志 */}
          {logs.length > 0 && (
            <div className="space-y-1">
              {logs.map((l, i) => (
                <div key={i} className="text-xs flex items-start gap-1.5 px-2 py-1.5 rounded-lg"
                  style={{ background: l.ok ? 'rgba(34,211,238,0.08)' : 'rgba(244,114,182,0.08)' }}>
                  {l.ok
                    ? <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#66c4d4' }} />
                    : <AlertCircle size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#e897b5' }} />}
                  <span style={{ color: l.ok ? 'var(--color-text)' : '#e897b5' }}>
                    <b>{l.title}</b>：{l.detail}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {books.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
            <Clapperboard size={40} style={{ color: 'var(--color-text-tertiary, #666)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              还没有视频知识。<br />点右上角「导入视频知识」，把喜欢的抖音科普视频文案 / 字幕粘贴进来，
              <br />或上传 .srt/.vtt/.txt/.md 字幕文件。
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary, #888)' }}>
              导入后，辩论 / 1v1 对话时所有 16 人格会自动检索引用这些内容 📚
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2.5">
            {/* 检索测试 */}
            <div className="flex items-center gap-2 mb-3">
              <input
                value={testQuery}
                onChange={e => setTestQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleTestSearch() }}
                placeholder="检索测试：输入一个问题，看人格会引用哪些视频知识…"
                className="input input-sm flex-1"
                aria-label="检索测试"
              />
              <button onClick={handleTestSearch} disabled={testing || !testQuery.trim()} className="btn btn-ghost btn-sm" aria-label="检索">
                <BookOpenCheck size={14} /> {testing ? '检索中…' : '检索'}
              </button>
            </div>
            {testHits && (
              <div className="mb-3 space-y-1.5 rounded-lg px-3 py-2" style={{ background: 'rgba(244,114,182,0.06)', border: '1px solid rgba(244,114,182,0.2)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: '#e897b5' }}>
                  📺 检索命中 {testHits.length} 条（人格辩论 / 对话时将引用）
                </div>
                {testHits.map((h, i) => (
                  <div key={i} className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    [{i + 1}] <b style={{ color: 'var(--color-text)' }}>《{h.title}》</b>（{h.score.toFixed(1)}分）{h.text.slice(0, 60)}{h.text.length > 60 ? '…' : ''}
                  </div>
                ))}
              </div>
            )}

            {books.map(b => (
              <div key={b.id} className="rounded-xl border transition-all" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                <button
                  onClick={() => setExpandedId(prev => (prev === b.id ? null : b.id))}
                  className="w-full text-left px-3 py-2.5 flex items-start gap-2.5"
                  aria-label={`展开 ${b.title}`}
                >
                  <span className="text-lg leading-none mt-0.5">📺</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{b.title}</div>
                    <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                      {b.tags.length > 0 && (
                        <span>{b.tags.slice(0, 4).map(t => `#${t}`).join(' ')}</span>
                      )}
                      {b.summary && <span className="truncate max-w-[60%]">{b.summary}</span>}
                    </div>
                    <div className="text-[11px] mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--color-text-tertiary, #888)' }}>
                      <span>{b.chunkCount} 段内容</span>
                      <span>{new Date(b.addedAt).toLocaleDateString('zh-CN')}</span>
                      <span>{b.sourceKind === 'paste' ? '粘贴' : b.sourceKind === 'file' ? '文件导入' : '外部转录'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span
                      role="button" tabIndex={0}
                      onClick={e => { e.stopPropagation(); handleDelete(b.id) }}
                      className="p-1.5 rounded-lg hover:opacity-70"
                      aria-label="删除这条视频知识"
                      title="删除"
                    >
                      <Trash2 size={14} style={{ color: 'var(--color-text-tertiary, #888)' }} />
                    </span>
                    <ChevronDown size={14} className={clsx('transition-transform', expandedId === b.id && 'rotate-180')} style={{ color: 'var(--color-text-tertiary, #888)' }} />
                  </div>
                </button>
                {expandedId === b.id && (
                  <div className="px-3 pb-3">
                    {b.sourceUrl && (
                      <a href={b.sourceUrl} target="_blank" rel="noreferrer"
                        className="text-xs inline-flex items-center gap-1 mb-2 hover:opacity-75"
                        style={{ color: 'var(--color-accent)' }}>
                        <Link2 size={11} /> 查看原视频
                      </a>
                    )}
                    <div className="text-xs whitespace-pre-wrap max-h-56 overflow-y-auto rounded-lg p-2.5 leading-relaxed"
                      style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                      {b.transcript}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
