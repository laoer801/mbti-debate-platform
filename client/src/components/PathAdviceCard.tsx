/**
 * v33 专业建议·路径卡片（PathAdviceCard.tsx）
 *
 * 渲染 LLM 在困境/决策类问题后输出的「路径建议」——三条可选行动路径 + 共同风险 + 下一步。
 * 对标 Cognix Problem Mode：不给唯一答案，呈现选择空间。
 *
 * 移动端纵向堆叠，桌面端三列并排；点击路径卡可展开「利/弊」详情。
 */
import { useState } from 'react'
import { Compass, AlertTriangle, ArrowRight } from 'lucide-react'
import type { PathAdvice } from '../types'

interface PathAdviceCardProps {
  advice: PathAdvice
  /** 人格主题色（边框/标题着色） */
  color: string
}

const PATH_LABELS = ['A', 'B', 'C']
const PATH_HUES = ['#66c4d4', '#ad8fe8', '#e897b5'] // 霓虹青 / 紫 / 品红——三路径视觉区分

export function PathAdviceCard({ advice, color }: PathAdviceCardProps) {
  const [expanded, setExpanded] = useState<number | null>(0) // 默认展开第一条

  return (
    <div className="mt-2 rounded-xl border animate-fade-in"
      style={{ borderColor: `${color}44`, background: 'var(--color-bg-secondary)' }}>
      {/* 标题栏 */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b"
        style={{ borderColor: `${color}22` }}>
        <Compass size={14} style={{ color }} />
        <span className="text-xs font-bold" style={{ color }}>🧭 路径建议</span>
        <span className="text-[10px] ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
          三条路 · 你来选
        </span>
      </div>

      {/* 路径卡片组 */}
      <div className="p-2.5 grid gap-2"
        style={{ gridTemplateColumns: advice.paths.length >= 3 ? 'repeat(3, 1fr)' : `repeat(${advice.paths.length}, 1fr)` }}>
        {advice.paths.map((p, i) => {
          const hue = PATH_HUES[i] || color
          const isOpen = expanded === i
          return (
            <button
              key={i}
              onClick={() => setExpanded(isOpen ? null : i)}
              className="text-left rounded-lg border transition-all hover:scale-[1.02] active:scale-[0.99] p-2.5"
              style={{
                borderColor: isOpen ? hue : `${color}33`,
                background: isOpen ? `${hue}11` : 'var(--color-bg)',
              }}
              aria-label={`路径 ${PATH_LABELS[i] || i + 1}：${p.name}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-bold w-4 h-4 rounded flex items-center justify-center shrink-0"
                  style={{ background: hue, color: '#fff' }}>
                  {PATH_LABELS[i] || i + 1}
                </span>
                <span className="text-[11px] font-bold truncate" style={{ color: hue }}>{p.name}</span>
              </div>
              <div className="text-[10px] leading-snug mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="opacity-60">适合：</span>{p.fitFor}
              </div>
              {isOpen && (
                <div className="space-y-1 mt-1.5 animate-fade-in">
                  <div className="text-[10px] leading-snug flex gap-1">
                    <span className="shrink-0 font-semibold" style={{ color: '#2fc9a3' }}>利</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{p.pros}</span>
                  </div>
                  <div className="text-[10px] leading-snug flex gap-1">
                    <span className="shrink-0 font-semibold" style={{ color: '#e57e7e' }}>弊</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{p.cons}</span>
                  </div>
                </div>
              )}
              {!isOpen && (
                <div className="text-[9px] mt-1 opacity-50" style={{ color: 'var(--color-text-tertiary)' }}>
                  点击展开利弊
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* 风险提示 */}
      {advice.risks && (
        <div className="mx-2.5 mb-2 px-2.5 py-1.5 rounded-lg flex gap-1.5 items-start"
          style={{ background: 'rgba(245,158,11,0.1)' }}>
          <AlertTriangle size={12} className="shrink-0 mt-0.5" style={{ color: '#d9b871' }} />
          <div className="text-[10px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="font-semibold" style={{ color: '#d9b871' }}>风险提示：</span>
            {advice.risks}
          </div>
        </div>
      )}

      {/* 建议下一步 */}
      {advice.nextStep && (
        <div className="mx-2.5 mb-2.5 px-2.5 py-1.5 rounded-lg flex gap-1.5 items-start"
          style={{ background: `${color}11` }}>
          <ArrowRight size={12} className="shrink-0 mt-0.5" style={{ color }} />
          <div className="text-[10px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="font-semibold" style={{ color }}>建议下一步：</span>
            {advice.nextStep}
          </div>
        </div>
      )}
    </div>
  )
}
