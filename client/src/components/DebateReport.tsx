/**
 * v33 辩论报告模态（DebateReport.tsx）
 *
 * 辩论结束后展示结构化 Markdown 报告——双方论点/交锋焦点/共识分歧/折中方案/裁判判定/置信度。
 * 对标 Dialectic report 命令：从保存的辩论状态生成综合报告。
 *
 * 挂载时自动调 generateDebateReport（LLM 优先，失败回退本地模板）。
 * 工具栏：重新生成 / 复制 / 下载 .md / 关闭。
 */
import { useState, useEffect, useCallback } from 'react'
import { FileText, Copy, Download, RefreshCw, X, Loader2 } from 'lucide-react'
import { generateDebateReport, downloadMarkdown, copyText, type ReportInput } from '../utils/debateReport'
import { renderMarkdownLite } from '../utils/markdownLite'

interface DebateReportProps {
  input: ReportInput
  onClose: () => void
}

export function DebateReport({ input, onClose }: DebateReportProps) {
  const [markdown, setMarkdown] = useState('')
  const [source, setSource] = useState<'llm' | 'template'>('template')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const generate = useCallback(async () => {
    setLoading(true)
    setMarkdown('')
    try {
      const result = await generateDebateReport(input)
      setMarkdown(result.markdown)
      setSource(result.source)
    } catch (err) {
      console.error('[DebateReport] 生成失败:', err)
      setMarkdown('# 报告生成失败\n\n请稍后重试，或检查 AI 大模型配置。')
      setSource('template')
    } finally {
      setLoading(false)
    }
  }, [input])

  useEffect(() => {
    generate()
  }, [generate])

  const handleCopy = async () => {
    const ok = await copyText(markdown)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    const safeName = input.topic.replace(/[\\/:*?"<>|]/g, '').slice(0, 30) || '辩论报告'
    const date = new Date().toISOString().slice(0, 10)
    downloadMarkdown(markdown, `${safeName}_${date}.md`)
  }

  const html = renderMarkdownLite(markdown)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      role="dialog"
      aria-modal="true"
      aria-label="辩论报告"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl"
        style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center gap-2 px-5 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}>
          <FileText size={18} style={{ color: 'var(--color-accent)' }} />
          <h2 className="text-sm font-bold flex-1" style={{ color: 'var(--color-text)' }}>
            辩论报告
          </h2>
          {!loading && (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: source === 'llm' ? 'var(--color-accent-light)' : 'var(--color-bg-tertiary)',
                color: source === 'llm' ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
              }}>
              {source === 'llm' ? '🤖 AI 深度报告' : '⚙️ 本地模板报告'}
            </span>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="p-1.5 rounded-md transition-colors disabled:opacity-40"
            style={{ color: 'var(--color-text-tertiary)' }}
            title="重新生成"
            aria-label="重新生成报告">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleCopy}
            disabled={loading || !markdown}
            className="p-1.5 rounded-md transition-colors disabled:opacity-40"
            style={{ color: copied ? '#2fc9a3' : 'var(--color-text-tertiary)' }}
            title={copied ? '已复制' : '复制 Markdown'}
            aria-label="复制报告">
            <Copy size={15} />
          </button>
          <button
            onClick={handleDownload}
            disabled={loading || !markdown}
            className="p-1.5 rounded-md transition-colors disabled:opacity-40"
            style={{ color: 'var(--color-text-tertiary)' }}
            title="下载 .md 文件"
            aria-label="下载报告">
            <Download size={15} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-colors ml-1"
            style={{ color: 'var(--color-text-tertiary)' }}
            title="关闭"
            aria-label="关闭报告">
            <X size={18} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin mb-3" style={{ color: 'var(--color-accent)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                AI 正在撰写辩论报告…
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                分析双方论点、提炼交锋焦点、生成折中方案
              </p>
            </div>
          ) : (
            <div
              className="md-report-body"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>

      {/* 报告 Markdown 渲染样式 */}
      <style>{`
        .md-report-body { font-size: 13px; line-height: 1.7; color: var(--color-text); }
        .md-report-body .md-h1 { font-size: 17px; font-weight: 700; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 2px solid var(--color-accent); color: var(--color-text); }
        .md-report-body .md-h2 { font-size: 14px; font-weight: 600; margin: 18px 0 8px; color: var(--color-accent); }
        .md-report-body .md-h3 { font-size: 13px; font-weight: 600; margin: 12px 0 6px; color: var(--color-text); }
        .md-report-body .md-p { margin: 6px 0; color: var(--color-text-secondary); }
        .md-report-body .md-ul { margin: 6px 0; padding-left: 20px; }
        .md-report-body .md-ul li { margin: 3px 0; color: var(--color-text-secondary); }
        .md-report-body .md-ol { margin: 6px 0; padding-left: 20px; }
        .md-report-body .md-ol li { margin: 3px 0; color: var(--color-text-secondary); }
        .md-report-body .md-quote { border-left: 3px solid var(--color-accent); padding: 6px 12px; margin: 8px 0; background: var(--color-bg-tertiary); color: var(--color-text-tertiary); border-radius: 0 6px 6px 0; }
        .md-report-body .md-hr { border: none; border-top: 1px solid var(--color-border); margin: 14px 0; }
        .md-report-body .md-code { background: var(--color-bg-tertiary); padding: 1px 5px; border-radius: 3px; font-family: var(--font-mono, monospace); font-size: 12px; }
        .md-report-body strong { font-weight: 600; color: var(--color-text); }
        .md-report-body .md-cite { display: inline-block; background: var(--color-accent-light); color: var(--color-accent); padding: 0 4px; border-radius: 3px; font-size: 11px; font-weight: 600; margin: 0 1px; }
      `}</style>
    </div>
  )
}
