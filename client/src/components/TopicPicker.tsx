import { useState } from 'react'
import { X, Dices, Check, Lightbulb, Users } from 'lucide-react'
import clsx from 'clsx'
import { recommendedTopics, randomTopic } from '../data/recommendedTopics'

interface TopicPickerProps {
  participantCount: number
  onConfirm: (topic: string) => void
  onCancel: () => void
}

/**
 * 辩论主题选择 — 点击"开始辩论"后弹出
 * 推荐辩题（分类 chips） + 自定义输入 + 随机抽取
 */
export function TopicPicker({ participantCount, onConfirm, onCancel }: TopicPickerProps) {
  const [customTopic, setCustomTopic] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>(recommendedTopics[0].id)

  const activeCat = recommendedTopics.find(c => c.id === activeCategory) || recommendedTopics[0]
  const trimmed = customTopic.trim()
  const canConfirm = trimmed.length >= 4

  const handlePickRandom = () => {
    setCustomTopic(randomTopic())
  }

  const handleConfirm = () => {
    if (canConfirm) onConfirm(trimmed)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="选择辩论主题"
      onClick={onCancel}
    >
      <div
        className="glass w-full max-w-xl rounded-2xl border shadow-2xl animate-fade-in max-h-[86vh] flex flex-col"
        style={{ borderColor: 'var(--color-border)', background: 'color-mix(in srgb, var(--color-bg-secondary) 92%, transparent)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-lg font-bold display-title gradient-text flex items-center gap-2">
              <Lightbulb size={18} style={{ color: 'var(--color-accent)' }} /> 选择辩论主题
            </h2>
            <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
              <Users size={11} /> 已选 {participantCount} 位人格参与 · 选定后辩论自动开始
            </p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg transition-colors hover:bg-opacity-50" style={{ color: 'var(--color-text-tertiary)' }} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 自定义输入区 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                自定义主题
              </span>
              <button
                onClick={handlePickRandom}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-all hover:scale-105 btn-sheen"
                style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}
              >
                <Dices size={12} /> 随机一个
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={customTopic}
                onChange={e => setCustomTopic(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canConfirm) handleConfirm() }}
                placeholder="输入你想辩论的主题，如：毕业应该先就业还是先创业？"
                className="input-field flex-1 text-sm"
                aria-label="自定义辩论主题"
                maxLength={60}
              />
              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="btn btn-primary shrink-0 !px-4"
                aria-label="确认开始辩论"
              >
                <Check size={16} /> 开始
              </button>
            </div>
            {!canConfirm && customTopic && (
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-warning)' }}>主题至少 4 个字哦～</p>
            )}
          </div>

          {/* 推荐辩题 */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wide block mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
              推荐辩题
            </span>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {recommendedTopics.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={clsx('px-3 py-1.5 rounded-full text-xs font-semibold transition-all', activeCategory === cat.id ? 'text-white' : '')}
                  style={activeCategory === cat.id
                    ? { background: 'var(--color-accent)' }
                    : { background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeCat.topics.map((t, i) => (
                <button
                  key={t}
                  onClick={() => setCustomTopic(t)}
                  className={clsx(
                    'stagger-item text-left text-xs p-3 rounded-xl border transition-all hover:scale-[1.02]',
                    customTopic === t ? '' : ''
                  )}
                  style={{
                    animationDelay: `${i * 0.05}s`,
                    borderColor: customTopic === t ? 'var(--color-accent)' : 'var(--color-border)',
                    background: customTopic === t ? 'var(--color-accent-light)' : 'var(--color-bg)',
                    color: customTopic === t ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    boxShadow: customTopic === t ? '0 0 0 2px var(--color-accent-light)' : 'none',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="px-5 py-3.5 border-t flex items-center justify-end gap-2 shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onCancel} className="btn btn-ghost btn-sm">取消</button>
          <button onClick={handleConfirm} disabled={!canConfirm} className="btn btn-primary btn-sm btn-sheen">
            <Check size={14} /> 确认开始辩论 ({participantCount}人)
          </button>
        </div>
      </div>
    </div>
  )
}
