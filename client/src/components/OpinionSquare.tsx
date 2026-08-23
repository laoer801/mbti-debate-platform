import { useState } from 'react'
import { Opinion } from '../types'
import { opinions } from '../data/opinions'
import { mbtiProfiles } from '../data/mbtiProfiles'
import { TrendingUp, ThumbsUp, ThumbsDown, MessageCircle, Eye, Plus, ArrowRight } from 'lucide-react'
import clsx from 'clsx'

interface OpinionSquareProps {
  onStartDebate: (topic: string, types: string[]) => void
}

export function OpinionSquare({ onStartDebate }: OpinionSquareProps) {
  const [selectedOpinion, setSelectedOpinion] = useState<Opinion | null>(null)
  const [votes, setVotes] = useState<Record<string, 'A' | 'B'>>({})
  const [expanded, setExpanded] = useState(false)

  if (selectedOpinion) {
    const v = votes[selectedOpinion.id]
    return (
      <div className="h-full overflow-y-auto p-6" role="main" aria-label={`观点详情 - ${selectedOpinion.title}`}>
        <button
          onClick={() => setSelectedOpinion(null)}
          className="flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--color-accent)' }}
          aria-label="返回观点广场"
        >← 返回观点广场</button>

        <div className="glass p-6 mb-6">
          <div className="flex gap-2 mb-3">
            {selectedOpinion.tags.map(t => <span key={t} className="tag tag-active">{t}</span>)}
            <span className="tag flex items-center gap-1"><TrendingUp size={12} />热度 {selectedOpinion.hot}</span>
          </div>

          <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--color-text)' }}>{selectedOpinion.title}</h2>

          {/* Vote bars */}
          <div className="flex gap-4 mb-6">
            <div className={clsx('flex-1 p-4 rounded-lg text-center transition-all cursor-pointer', v === 'A' && 'ring-2')}
              style={{ background: v === 'A' ? 'var(--color-accent-light)' : 'var(--color-bg-tertiary)', borderColor: v === 'A' ? 'var(--color-accent)' : 'transparent' }}
              onClick={() => setVotes(prev => ({ ...prev, [selectedOpinion.id]: 'A' }))}
              role="button" aria-label={`投票支持：${selectedOpinion.sideA}`}
            >
              <div className="text-2xl font-bold mb-1" style={{ color: 'var(--color-accent)' }}>{selectedOpinion.votesA.toLocaleString()}</div>
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{selectedOpinion.sideA}</div>
            </div>
            <div className="flex items-center text-sm font-bold" style={{ color: 'var(--color-text-tertiary)' }}>VS</div>
            <div className={clsx('flex-1 p-4 rounded-lg text-center transition-all cursor-pointer', v === 'B' && 'ring-2')}
              style={{ background: v === 'B' ? 'var(--color-accent-light)' : 'var(--color-bg-tertiary)', borderColor: v === 'B' ? 'var(--color-accent)' : 'transparent' }}
              onClick={() => setVotes(prev => ({ ...prev, [selectedOpinion.id]: 'B' }))}
              role="button" aria-label={`投票支持：${selectedOpinion.sideB}`}
            >
              <div className="text-2xl font-bold mb-1" style={{ color: 'var(--color-accent)' }}>{selectedOpinion.votesB.toLocaleString()}</div>
              <div className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{selectedOpinion.sideB}</div>
            </div>
          </div>
        </div>

        {/* Personality stances */}
        <h3 className="text-sm font-bold uppercase mb-3" style={{ color: 'var(--color-text-tertiary)' }}>各人格怎么看</h3>
        <div className="space-y-3 mb-6">
          {selectedOpinion.personalityStances.map(ps => {
            const profile = mbtiProfiles.find(p => p.id === ps.typeId)
            if (!profile) return null
            return (
              <div key={ps.typeId} className="flex gap-3 p-4 rounded-lg" style={{ background: 'var(--color-bg-tertiary)' }}>
                <div className="avatar avatar-sm flex-shrink-0 mt-0.5" style={{ background: profile.color, color: '#fff' }}>{profile.emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>{profile.name}</span>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-bold',
                      ps.side === 'A' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    )}>
                      支持{ps.side === 'A' ? '甲方' : '乙方'}
                    </span>
                    {ps.changedMind && <span className="text-xs" style={{ color: 'var(--color-warning)' }}>🔄 曾改变立场</span>}
                  </div>
                  <p className="text-sm italic" style={{ color: 'var(--color-text-secondary)' }}>"{ps.reason}"</p>
                </div>
              </div>
            )
          })}
        </div>

        <button onClick={() => onStartDebate(selectedOpinion.title, selectedOpinion.personalityStances.map(p => p.typeId))}
          className="btn btn-primary w-full">
          用这个话题开一场辩论 <ArrowRight size={16} />
        </button>
      </div>
    )
  }

  // Opinion list
  const displayOpinions = expanded ? opinions : opinions.slice(0, 4)

  return (
    <div className="h-full overflow-y-auto p-6" role="main" aria-label="观点广场">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>观点广场</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>站队、投票、看各人格怎么讲</p>
        </div>
        <button className="btn btn-ghost btn-sm" aria-label="创建新观点">
          <Plus size={14} /> 发起话题
        </button>
      </div>

      <div className="space-y-3">
        {displayOpinions.map(op => (
          <button key={op.id} onClick={() => setSelectedOpinion(op)}
            className="glass p-4 w-full text-left transition-all hover:-translate-y-0.5 cursor-pointer" role="article">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h3 className="font-bold flex-1" style={{ color: 'var(--color-text)' }}>{op.title}</h3>
              <span className="tag flex items-center gap-1 flex-shrink-0">
                <TrendingUp size={12} />{op.hot}°
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
              <span className="flex items-center gap-1"><ThumbsUp size={12} />{op.votesA.toLocaleString()}</span>
              <span className="flex items-center gap-1"><ThumbsDown size={12} />{op.votesB.toLocaleString()}</span>
              <span className="flex items-center gap-1"><MessageCircle size={12} />{op.personalityStances.length}个观点</span>
            </div>

            {/* Mini stance preview */}
            <div className="flex gap-1 flex-wrap">
              {op.personalityStances.slice(0, 4).map(ps => {
                const p = mbtiProfiles.find(p => p.id === ps.typeId)
                if (!p) return null
                return (
                  <span key={ps.typeId} className="avatar avatar-sm" style={{ background: p.color, color: '#fff', opacity: 0.8 }} title={`${p.name}: ${ps.reason}`}>
                    {p.emoji}
                  </span>
                )
              })}
              {op.personalityStances.length > 4 && (
                <span className="text-xs self-center ml-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  +{op.personalityStances.length - 4}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {!expanded && opinions.length > 4 && (
        <button onClick={() => setExpanded(true)} className="btn btn-ghost w-full mt-4">
          <Eye size={14} /> 加载更多观点
        </button>
      )}
    </div>
  )
}
