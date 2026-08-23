import { useState, useEffect } from 'react'
import { Calendar, Sparkles, ChevronRight, Trophy, Medal } from 'lucide-react'
import { API_BASE } from '../config'

const API = API_BASE + '/api'

interface DailyTopic {
  id: number
  tag: string
  tags: string[]
  question: string
  personality_tags: string[]
}

interface Achievement {
  id: string
  name: string
  emoji: string
  desc: string
  unlocked: boolean
}

export function DailyTopics() {
  const [topic, setTopic] = useState<{ date: string; topic: DailyTopic; total: number } | null>(null)
  const [upcoming, setUpcoming] = useState<{ date: string; topic: DailyTopic }[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpcoming, setShowUpcoming] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/daily/today`).then(r => r.json()),
      fetch(`${API}/daily/achievements`).then(r => r.json()),
    ]).then(([topicData, achData]) => {
      setTopic(topicData)
      setAchievements((achData.achievements || []).map((a: Achievement) => ({ ...a, unlocked: false })))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const loadUpcoming = async () => {
    if (upcoming.length > 0) { setShowUpcoming(!showUpcoming); return }
    try {
      const r = await fetch(`${API}/daily/upcoming`)
      const data = await r.json()
      setUpcoming(data.upcoming || [])
      setShowUpcoming(true)
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3 animate-pulse">
        <div className="h-6 w-2/5 rounded" style={{ background: 'var(--color-border)' }} />
        <div className="h-4 w-3/5 rounded" style={{ background: 'var(--color-border)', opacity: 0.7 }} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 今日话题 */}
      {topic && (
        <div
          className="rounded-xl p-5 border relative overflow-hidden"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(var(--glass-blur))',
            borderColor: 'var(--glass-border)',
            boxShadow: 'var(--glass-shadow)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} style={{ color: 'var(--color-accent)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>
              今日话题 · {topic.date}
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}
            >
              {topic.topic.tag}
            </span>
          </div>

          <p className="text-base font-semibold mb-3 leading-relaxed" style={{ color: 'var(--color-text)' }}>
            {topic.topic.question}
          </p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {topic.topic.personality_tags.map(pt => (
              <span
                key={pt}
                className="px-2 py-0.5 rounded text-xs"
                style={{
                  background: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {pt}
              </span>
            ))}
          </div>

          <button
            onClick={loadUpcoming}
            className="flex items-center gap-1 text-xs font-medium transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Sparkles size={12} />
            {showUpcoming ? '收起预览' : '查看未来话题'}
            <ChevronRight size={12} className={showUpcoming ? 'rotate-90' : ''} style={{ transition: 'transform 0.2s' }} />
          </button>

          {/* 未来话题预览 */}
          {showUpcoming && upcoming.length > 0 && (
            <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: 'var(--color-border)' }}>
              {upcoming.slice(0, 4).map((u, i) => (
                <div key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <span className="font-mono" style={{ color: 'var(--color-text-tertiary)' }}>{u.date.slice(5)}</span>
                  <span className="truncate">{u.topic.question}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 成就展示 */}
      <div
        className="rounded-xl p-5 border"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          borderColor: 'var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} style={{ color: 'var(--color-warning)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>辩论成就</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {achievements.slice(0, 6).map(ach => (
            <div
              key={ach.id}
              className="flex flex-col items-center gap-1 p-2 rounded-lg text-center transition-all"
              style={{
                background: ach.unlocked ? 'var(--color-accent-light)' : 'var(--color-bg-tertiary)',
                opacity: ach.unlocked ? 1 : 0.45,
              }}
              title={ach.desc}
            >
              <span className="text-xl">{ach.emoji}</span>
              <span className="text-[10px] font-medium leading-tight" style={{ color: 'var(--color-text-secondary)' }}>
                {ach.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
