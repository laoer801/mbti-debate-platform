/**
 * v40.2 辩论大师客户端模块
 *
 * 与服务端 /api/master/* 配套使用。
 * 提供：useDebateMaster() hook + UI 组件 <DebateMasterPanel>
 */

import { useEffect, useState } from 'react'
import { API_BASE } from '../config'

export type DebateStage = 'opening' | 'cross' | 'free' | 'closing' | 'review'

export interface TopicAnalysis {
  topic: string
  category: string
  isYesNo: boolean
  coreTheme: string
  hiddenAssumptions: string[]
  proSkeleton: string[]
  conSkeleton: string[]
  recommendedTypes: string[]
  advice: string
}

export interface ResearchPackage {
  topic: string
  category: string
  coreConcepts: string[]
  proSearchQueries: string[]
  conSearchQueries: string[]
  sourceHint: string
}

export interface MasterTip {
  stage: DebateStage
  toTypeId: string
  tipText: string
  severity: 'info' | 'warn' | 'tip'
  meta?: Record<string, any>
}

export interface MasterReview {
  sessionId?: string
  scores: { typeId: string; name: string; total: number; msgCount: number }[]
  turningPoints: { refCount: number; quote: string }[]
  mistakes: { typeId: string; content: string; attacks: number }[]
  citationsUsed: string[]
  highlights: string[]
}

async function postJSON(url: string, body: any) {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json()).error || res.statusText)
  return res.json()
}

// ============ Hook ============

export function useDebateMaster() {
  const [analyzing, setAnalyzing] = useState(false)
  const [researching, setResearching] = useState(false)
  const [tipLoading, setTipLoading] = useState(false)
  const [reviewing, setReviewing] = useState(false)

  const analyzeTopic = async (topic: string): Promise<TopicAnalysis | null> => {
    setAnalyzing(true)
    try {
      const data = await postJSON('/api/master/analyze-topic', { topic })
      return data.analysis
    } catch (e) {
      console.error('analyzeTopic failed:', e)
      return null
    } finally {
      setAnalyzing(false)
    }
  }

  const research = async (topic: string, sides: ('pro' | 'con')[] = ['pro', 'con']): Promise<ResearchPackage | null> => {
    setResearching(true)
    try {
      const data = await postJSON('/api/master/research', { topic, sides })
      return data.research
    } catch (e) {
      console.error('research failed:', e)
      return null
    } finally {
      setResearching(false)
    }
  }

  const getTip = async (stage: DebateStage, typeId: string, topic: string, history: any[]): Promise<MasterTip | null> => {
    setTipLoading(true)
    try {
      const data = await postJSON('/api/master/tip', { stage, typeId, topic, history })
      return data.tip
    } catch (e) {
      console.error('getTip failed:', e)
      return null
    } finally {
      setTipLoading(false)
    }
  }

  const review = async (sessionId: string, messages: any[], rubricVersion = '7d-v1'): Promise<MasterReview | null> => {
    setReviewing(true)
    try {
      const data = await postJSON('/api/master/review', { sessionId, messages, rubricVersion })
      return data.review
    } catch (e) {
      console.error('review failed:', e)
      return null
    } finally {
      setReviewing(false)
    }
  }

  return { analyzing, researching, tipLoading, reviewing, analyzeTopic, research, getTip, review }
}

// ============ UI：赛中 Tip Toast ============

import { Sparkles, AlertCircle, Info } from 'lucide-react'

interface Props {
  tip: MasterTip | null
  onDismiss?: () => void
}

export function MasterTipToast({ tip, onDismiss }: Props) {
  if (!tip) return null

  const icon = tip.severity === 'warn' ? AlertCircle
    : tip.severity === 'info' ? Info
      : Sparkles

  const color = tip.severity === 'warn' ? '#fbbf24'
    : tip.severity === 'info' ? '#60a5fa'
      : 'var(--color-accent)'

  const Icon = icon

  return (
    <div
      className="fixed bottom-4 right-4 max-w-sm px-4 py-3 rounded-lg shadow-2xl flex items-start gap-3 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.85)', borderLeft: `4px solid ${color}`, zIndex: 100 }}
      role="status"
    >
      <Icon size={18} style={{ color, flexShrink: 0, marginTop: 2 }} />
      <div className="flex-1">
        <div className="text-xs uppercase tracking-wider mb-1" style={{ color }}>
          大师建议 → {tip.toTypeId} · {tip.stage}
        </div>
        <div className="text-sm text-white">{tip.tipText}</div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-slate-400 hover:text-white text-xs" aria-label="关闭">
          ✕
        </button>
      )}
    </div>
  )
}

// ============ UI：赛后复盘面板 ============

export function DebateMasterReviewPanel({ review }: { review: MasterReview | null }) {
  if (!review) {
    return (
      <div className="p-4 text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
        复盘中...
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <section>
        <h3 className="text-lg font-bold mb-2">📊 综合评分</h3>
        <div className="space-y-1">
          {review.scores.map((s, i) => (
            <div key={s.typeId} className="flex items-center gap-2 text-sm">
              <span className="font-mono w-12">{i + 1}.</span>
              <span className="flex-1">{s.name}</span>
              <span className="font-bold" style={{ color: 'var(--color-accent)' }}>{s.total}</span>
              <span className="text-xs text-slate-500">({s.msgCount} 句)</span>
            </div>
          ))}
        </div>
      </section>

      {review.turningPoints.length > 0 && (
        <section>
          <h3 className="text-lg font-bold mb-2">🔁 关键转折</h3>
          <ul className="space-y-1 text-sm">
            {review.turningPoints.map((t, i) => (
              <li key={i} className="px-2 py-1 rounded" style={{ background: 'var(--color-bg-secondary)' }}>
                「{t.quote}」<span className="text-xs text-slate-500">（被引用 {t.refCount} 次）</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.mistakes.length > 0 && (
        <section>
          <h3 className="text-lg font-bold mb-2">⚠️ 攻击性过强（要扣分）</h3>
          <ul className="space-y-1 text-sm">
            {review.mistakes.slice(0, 3).map((m, i) => (
              <li key={i} className="px-2 py-1 rounded border-l-2 border-yellow-400" style={{ background: 'rgba(251,191,36,0.1)' }}>
                <span className="font-mono text-xs">{m.typeId}</span>
                <span className="text-xs text-slate-500 ml-2">攻击词 ×{m.attacks}</span>
                <div className="text-xs text-slate-400 mt-1">{m.content}...</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.citationsUsed.length > 0 && (
        <section>
          <h3 className="text-lg font-bold mb-2">📚 用户资料引用</h3>
          <ul className="space-y-1 text-xs">
            {review.citationsUsed.map((c, i) => (
              <li key={i} className="px-2 py-1 rounded" style={{ background: 'var(--color-bg-secondary)' }}>
                「{c}」
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.highlights.length > 0 && (
        <section>
          <h3 className="text-lg font-bold mb-2">💡 一句话总结</h3>
          {review.highlights.map((h, i) => (
            <div key={i} className="text-sm px-3 py-2 rounded" style={{ background: 'rgba(124,136,240,0.1)', borderLeft: '3px solid #7c88f0' }}>
              {h}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
