import { Trophy, Medal, Star, Swords, Home } from 'lucide-react'
import { PKJudgeResult, JudgePlayerScore, PKParticipant } from '../types'
import clsx from 'clsx'

interface PKJudgeProps {
  result: PKJudgeResult
  participants: PKParticipant[]
  onLeave: () => void
  roomId: string
  topic?: string
}

export function PKJudge({ result, participants, onLeave, roomId, topic }: PKJudgeProps) {
  const winner = result.results?.find(r => r.userId === result.winner)
  const loser = result.results?.find(r => r.userId !== result.winner)

  const getPlayerName = (userId: string) => {
    const p = participants.find(p => p.user_id === userId)
    return p?.username || '玩家'
  }

  const getPlayerSide = (userId: string) => {
    const p = participants.find(p => p.user_id === userId)
    return p?.side === 'pro' ? '正方' : '反方'
  }

  return (
    <div className="animate-fadeIn">
      {/* Winner banner */}
      <div className="text-center py-8 mb-6 rounded-2xl relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #d9b87111, #8f7ff522, #6fa3f511)' }}>
        <div className="absolute top-0 left-0 right-0 h-1"
          style={{ background: 'linear-gradient(90deg, #d9b871, #e57e7e, #8f7ff5, #6fa3f5)' }} />
        <Trophy size={64} className="mx-auto mb-3" style={{ color: '#d9b871' }} />
        <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
          🏆 {winner?.username || '未知'} 获胜！
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          辩题：<span className="font-medium" style={{ color: 'var(--color-text)' }}>{topic || roomId}</span>
        </p>
      </div>

      {/* Scores comparison */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {result.results?.map((player, idx) => (
          <div key={player.userId} className={clsx(
            'p-4 rounded-xl border-2 transition-all',
            player.userId === result.winner
              ? 'border-yellow-400/50 scale-[1.02]'
              : 'border-transparent opacity-80'
          )}
            style={{
              background: player.userId === result.winner
                ? 'linear-gradient(135deg, #d9b87111, #6fa3f511)'
                : 'var(--color-bg-secondary)',
              borderColor: player.userId === result.winner ? '#d9b87155' : 'var(--color-border)',
            }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                style={{ background: 'var(--color-bg)' }}>
                {player.userId === result.winner ? '👑' : '🎭'}
              </div>
              <div>
                <p className="font-bold" style={{ color: 'var(--color-text)' }}>{player.username}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {getPlayerSide(player.userId)} · {idx === 0 ? <Medal size={10} className="inline text-yellow-500" /> : null}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-2xl font-bold" style={{ color: player.userId === result.winner ? '#d9b871' : 'var(--color-text)' }}>
                  {player.total}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>总分</p>
              </div>
            </div>

            {/* Score bars */}
            <div className="space-y-2">
              {[
                { key: 'logic', label: '逻辑性', color: '#6fa3f5' },
                { key: 'evidence', label: '论据质量', color: '#2fc9a3' },
                { key: 'eloquence', label: '语言表达', color: '#d9b871' },
                { key: 'rebuttal', label: '反驳能力', color: '#e57e7e' },
                { key: 'etiquette', label: '礼仪风度', color: '#8f7ff5' },
              ].map(dim => {
                const score = player.scores[dim.key as keyof typeof player.scores] || 0
                return (
                  <div key={dim.key} className="flex items-center gap-2">
                    <span className="text-[10px] w-14" style={{ color: 'var(--color-text-secondary)' }}>{dim.label}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${score}%`, background: dim.color }} />
                    </div>
                    <span className="text-[10px] font-mono w-6 text-right" style={{ color: 'var(--color-text)' }}>{score}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Judge feedback */}
      {result.feedback && (
        <div className="p-4 rounded-xl mb-6" style={{ background: 'var(--color-bg-secondary)' }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--color-text)' }}>
            <Star size={14} className="inline text-yellow-500" /> AI裁判点评
          </h3>
          <div className="text-sm leading-relaxed space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
            {result.feedback.split('\n').map((line, i) => {
              if (line.startsWith('##')) {
                return <p key={i} className="font-bold mt-3" style={{ color: 'var(--color-text)' }}>{line.replace('## ', '')}</p>
              }
              if (line.startsWith('🏆') || line.startsWith('🥇') || line.startsWith('🥈') || line.startsWith('🥉')) {
                return <p key={i} className="py-1" style={{ color: 'var(--color-text)' }}>{line}</p>
              }
              if (line.startsWith('•') || line.startsWith('🎁') || line.startsWith('💡')) {
                return <p key={i} className="pl-2" style={{ color: 'var(--color-text-secondary)' }}>{line}</p>
              }
              if (line.trim()) {
                return <p key={i} style={{ color: 'var(--color-text-tertiary)' }}>{line}</p>
              }
              return <br key={i} />
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onLeave}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          <Swords size={16} /> 再来一局
        </button>
        <button
          onClick={onLeave}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm transition-all hover:opacity-80"
          style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
        >
          <Home size={16} /> 返回大厅
        </button>
      </div>
    </div>
  )
}
