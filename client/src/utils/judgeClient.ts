/**
 * v40.2 七维裁判客户端
 *
 * 与服务端 /api/judge/* 配套
 * - fetchRubric() 取当前激活的 7 维配置
 * - runJudge() 跑三裁判融合
 * - useJudgeRubric() hook UI 动态加载权重
 */

import { useEffect, useState } from 'react'
import { API_BASE } from '../config'

export interface JudgeRubric {
  version: string
  dimensions: {
    logic: number
    evidence: number
    rebuttal: number
    clarity: number
    demeanor: number
    rhetoric: number
    strategy: number
    ethics: number
  }
  scale: 100
}

export interface JudgeScore {
  typeId: string
  name: string
  emoji?: string
  color?: string
  logic: number
  evidence: number
  rebuttal: number
  clarity: number
  demeanor: number
  rhetoric: number
  strategy: number
  ethics: number
  total: number
  comment: string
}

export interface JudgeRunResult {
  ok: true
  verdictId: string
  scores: JudgeScore[]
  verdict: string
}

export async function fetchRubric(): Promise<JudgeRubric> {
  const res = await fetch(`${API_BASE}/api/judge/rubric`)
  if (!res.ok) throw new Error('读取评分维度失败')
  return res.json()
}

export async function fetchAllRubrics(): Promise<{ rubrics: any[] }> {
  const res = await fetch(`${API_BASE}/api/judge/rubric/all`)
  if (!res.ok) throw new Error('读取评分版本失败')
  return res.json()
}

export async function activateRubric(version: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/api/judge/rubric/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version }),
  })
  return res.json()
}

export async function createRubric(rubric: JudgeRubric): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/api/judge/rubric`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rubric),
  })
  return res.json()
}

export async function runJudge(
  messages: { typeId: string; typeName?: string; typeEmoji?: string; typeColor?: string; content: string; isUser?: boolean }[],
  rubricVersion: string,
  humanScores?: Record<string, Partial<JudgeScore>>
): Promise<JudgeRunResult> {
  const res = await fetch(`${API_BASE}/api/judge/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, rubricVersion, humanScores }),
  })
  if (!res.ok) throw new Error((await res.json()).error || '评分失败')
  return res.json()
}

export function useJudgeRubric(): [JudgeRubric | null, () => Promise<void>] {
  const [rubric, setRubric] = useState<JudgeRubric | null>(null)
  const refresh = async () => {
    try {
      const r = await fetchRubric()
      setRubric(r)
    } catch (e) {
      console.error('useJudgeRubric:', e)
    }
  }
  useEffect(() => { refresh() }, [])
  return [rubric, refresh]
}

// ============ UI：8 维雷达图（用 inline SVG，避免依赖） ============

interface RadarProps {
  scores: JudgeScore
  size?: number
}

export function JudgeRadar({ scores, size = 240 }: RadarProps) {
  const dims = [
    { k: 'logic', label: '逻辑' },
    { k: 'evidence', label: '论据' },
    { k: 'rebuttal', label: '反驳' },
    { k: 'clarity', label: '清晰' },
    { k: 'demeanor', label: '风度' },
    { k: 'rhetoric', label: '修辞' },
    { k: 'strategy', label: '战略' },
    { k: 'ethics', label: '伦理' },
  ]
  const cx = size / 2, cy = size / 2
  const radius = size / 2 - 30
  const angle = (i: number) => (Math.PI * 2 * i) / dims.length - Math.PI / 2

  const points = dims.map((d, i) => {
    const v = (scores[d.k as keyof JudgeScore] as number) / 100
    const r = radius * v
    const x = cx + r * Math.cos(angle(i))
    const y = cy + r * Math.sin(angle(i))
    return { x, y, value: v, label: d.label, k: d.k, raw: scores[d.k as keyof JudgeScore] as number }
  })

  const polygon = points.map(p => `${p.x},${p.y}`).join(' ')

  // 网格圈
  const rings = [0.25, 0.5, 0.75, 1].map(scale => {
    const pts = dims.map((_, i) => {
      const r = radius * scale
      const x = cx + r * Math.cos(angle(i))
      const y = cy + r * Math.sin(angle(i))
      return `${x},${y}`
    }).join(' ')
    return pts
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="评分雷达图">
      {/* 网格圈 */}
      {rings.map((p, i) => (
        <polygon key={i} points={p} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      ))}
      {/* 轴线 */}
      {dims.map((d, i) => (
        <line key={d.k}
          x1={cx} y1={cy}
          x2={cx + radius * Math.cos(angle(i))}
          y2={cy + radius * Math.sin(angle(i))}
          stroke="rgba(255,255,255,0.1)" strokeWidth={0.5}
        />
      ))}
      {/* 数据多边形 */}
      <polygon points={polygon} fill="rgba(124,136,240,0.3)" stroke="#7c88f0" strokeWidth={2} />
      {/* 数据点 + 标签 */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="#7c88f0" />
          <text
            x={cx + (radius + 16) * Math.cos(angle(i))}
            y={cy + (radius + 16) * Math.sin(angle(i))}
            fill="rgba(255,255,255,0.85)"
            fontSize={11}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {p.label} {Math.round(p.raw)}
          </text>
        </g>
      ))}
      {/* 总分 */}
      <text x={cx} y={cy - 6} fill="#7c88f0" fontSize={28} fontWeight="bold" textAnchor="middle">
        {scores.total}
      </text>
      <text x={cx} y={cy + 14} fill="rgba(255,255,255,0.5)" fontSize={11} textAnchor="middle">
        {scores.name}
      </text>
    </svg>
  )
}

// ============ UI：评分面板（用于辩论结束页） ============

interface PanelProps {
  rubricVersion?: string
  messages: any[]
  onFeedback?: (verdictId: string, feedback: 'up' | 'down') => void
}

import { ThumbsUp, ThumbsDown } from 'lucide-react'

export function JudgePanel({ rubricVersion = '7d-v1', messages, onFeedback }: PanelProps) {
  const [result, setResult] = useState<JudgeRunResult | null>(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const r = await runJudge(messages, rubricVersion)
      setResult(r)
      if (onFeedback && r.verdictId) onFeedback(r.verdictId, 'up')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (messages.length > 0) run() }, [JSON.stringify(messages)])

  if (loading) {
    return <div className="p-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>评分中...</div>
  }
  if (!result) return null

  return (
    <div className="space-y-4 p-4">
      <div className="text-lg font-bold" style={{ color: 'var(--color-accent)' }}>
        🏆 {result.verdict}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {result.scores.map(s => (
          <div key={s.typeId} className="rounded-lg p-3 flex flex-col items-center" style={{ background: 'var(--color-bg-secondary)' }}>
            <JudgeRadar scores={s} size={200} />
            <div className="text-xs mt-2 text-center" style={{ color: 'var(--color-text-secondary)' }}>
              {s.comment}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button onClick={() => onFeedback?.(result.verdictId, 'up')} className="btn btn-ghost btn-sm">
          <ThumbsUp size={14} /> 赞同
        </button>
        <button onClick={() => onFeedback?.(result.verdictId, 'down')} className="btn btn-ghost btn-sm">
          <ThumbsDown size={14} /> 反对
        </button>
      </div>
    </div>
  )
}
