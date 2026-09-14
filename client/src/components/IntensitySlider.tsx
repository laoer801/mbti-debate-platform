/**
 * v40.1 强度滑块 UI 组件
 *
 * 放置位置建议：
 *   - TabBar 抽屉菜单 / 设置页 / 每个人格卡片右下角
 *
 * 强度档 1-5，5 是"极端"会有 UI 警示
 */

import type { MBTI16 } from '../data/personalityCore'
import { INTENSITY_LABELS } from '../data/personalityShell'
import { useIntensity } from '../utils/personalityIntensity'
import { AlertTriangle, Minus } from 'lucide-react'

interface Props {
  typeId: MBTI16
  /** 紧凑模式（卡片右下角）/ 完整模式（设置页独立行） */
  variant?: 'compact' | 'full'
  onChange?: (level: number) => void
}

export function IntensitySlider({ typeId, variant = 'full', onChange }: Props) {
  const [level, setLevel] = useIntensity(typeId)

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1" title={`强度档 ${level}（${INTENSITY_LABELS[level]}）`}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={(e) => {
              e.stopPropagation()
              setLevel(n as 1 | 2 | 3 | 4 | 5)
              onChange?.(n)
            }}
            className={`w-3 h-3 rounded-sm transition-all ${
              n <= level
                ? n === 5 ? 'bg-red-500' : n === 4 ? 'bg-orange-400' : n === 3 ? 'bg-cyan-400' : 'bg-slate-400'
                : 'bg-slate-700 opacity-50'
            }`}
            aria-label={`强度档 ${n}`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">强度档</span>
        <span className="text-sm font-mono">{level}/5 · {INTENSITY_LABELS[level]}</span>
      </div>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => {
              setLevel(n as 1 | 2 | 3 | 4 | 5)
              onChange?.(n)
            }}
            className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all ${
              n === level
                ? n === 5 ? 'bg-red-500 text-white' : n === 4 ? 'bg-orange-400 text-white' : n === 3 ? 'bg-cyan-500 text-white' : n === 2 ? 'bg-slate-500 text-white' : 'bg-slate-700 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {level === 5 && (
        <div className="flex items-start gap-2 px-2 py-1.5 rounded text-xs" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>极端模式</strong>：反例边界 = 0，竞技模式。可能产生尖刻攻击性输出——用户自担后果。
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        <Minus size={12} />
        <span>建议初学者从 2-3 起步，对抗场景开 4，高强度辩论开 5</span>
      </div>
    </div>
  )
}

/** 16 人格强度总览仪表盘（用于设置页或 admin 面板） */
import { useIntensityForAll } from '../utils/personalityIntensity'
import { allPersonaCores } from '../data/personalityCore'

export function IntensityOverview() {
  const map = useIntensityForAll()
  const cores = allPersonaCores()

  const groups = {
    analyst: cores.filter(c => ['INTJ', 'INTP', 'ENTJ', 'ENTP'].includes(c.typeId)),
    diplomat: cores.filter(c => ['INFJ', 'INFP', 'ENFJ', 'ENFP'].includes(c.typeId)),
    sentinel: cores.filter(c => ['ISTJ', 'ISFJ', 'ESTJ', 'ESFJ'].includes(c.typeId)),
    explorer: cores.filter(c => ['ISTP', 'ISFP', 'ESTP', 'ESFP'].includes(c.typeId)),
  }

  const groupLabels = { analyst: '分析家', diplomat: '外交家', sentinel: '守护者', explorer: '探险家' }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(groups).map(([key, list]) => (
        <div key={key} className="rounded-lg p-3" style={{ background: 'var(--color-bg-secondary)' }}>
          <h3 className="text-sm font-bold mb-2">{groupLabels[key as keyof typeof groupLabels]}</h3>
          <div className="space-y-2">
            {list.map(core => (
              <div key={core.typeId} className="flex items-center justify-between">
                <span className="text-xs font-mono">{core.typeId}</span>
                <IntensitySlider typeId={core.typeId} variant="compact" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
