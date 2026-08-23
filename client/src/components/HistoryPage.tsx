import { DebateSession } from '../types'
import { History, Clock, Users, MessageSquare, ArrowRight, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { EmptyState } from './EmptyState'

interface HistoryPageProps {
  sessions: DebateSession[]
  onReplay: (session: DebateSession) => void
  onDelete: (sessionId: string) => void
}

export function HistoryPage({ sessions, onReplay, onDelete }: HistoryPageProps) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<History size={36} style={{ color: 'var(--color-text-tertiary)' }} />}
        title="还没有辩论记录"
        description="去人格大厅挑选几位性格迥异的人格，开启一场精彩的思想交锋，这里就会留下你的足迹。"
        hint="💡 快捷键 Ctrl+1 去人格大厅 · Ctrl+2 直达辩论室"
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6" role="main" aria-label="辩论历史记录">
      <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>战斗记录</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>历史辩论回顾，包含论点和确信度变化</p>

      <div className="space-y-3">
        {sessions.map(session => (
          <div key={session.id} className="glass p-4 animate-fade-in">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-bold mb-2" style={{ color: 'var(--color-text)' }}>{session.topic}</h3>

                <div className="flex flex-wrap items-center gap-3 text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
                  <span className="flex items-center gap-1"><Clock size={12} />{new Date(session.createdAt).toLocaleString('zh-CN')}</span>
                  <span className="flex items-center gap-1"><Users size={12} />{session.participants.length}人</span>
                  <span className="flex items-center gap-1"><MessageSquare size={12} />{session.messages.length}条消息</span>
                  <span className="tag">{session.mode === 'free' ? '自由辩论' : session.mode === 'roundRobin' ? '轮转' : session.mode === 'adversarial' ? '对抗' : session.mode === 'duel' ? '1v1对话' : '苏格拉底'}</span>
                  {session.sceneId && <span className="tag tag-active">场景模式</span>}
                </div>

                {/* Highlights */}
                {session.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {session.highlights.map((h, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 italic rounded" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
                        "{h}"
                      </span>
                    ))}
                  </div>
                )}

                {/* Summary */}
                {session.summary && (
                  <details className="text-xs cursor-pointer">
                    <summary className="font-medium" style={{ color: 'var(--color-accent)' }}>查看辩论总结</summary>
                    <div className="mt-2 p-3 rounded-lg space-y-2" style={{ background: 'var(--color-bg-tertiary)' }}>
                      {session.summary.stanceComparison.map(s => (
                        <div key={s.typeId}>
                          <span className="font-bold">{s.typeId}:</span> {s.stance} - {s.reasoning}
                        </div>
                      ))}
                      {session.summary.consensus.length > 0 && (
                        <p className="text-green-600">共识: {session.summary.consensus.join('; ')}</p>
                      )}
                      {session.summary.disagreements.length > 0 && (
                        <p className="text-red-500">分歧: {session.summary.disagreements.join('; ')}</p>
                      )}
                    </div>
                  </details>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button onClick={() => onReplay(session)} className="btn btn-primary btn-sm" aria-label="回顾这场辩论">
                  <ArrowRight size={14} /> 回顾
                </button>
                <button onClick={() => onDelete(session.id)} className="btn btn-ghost btn-sm" aria-label="删除记录">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
