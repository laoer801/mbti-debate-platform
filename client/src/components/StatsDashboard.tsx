import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Users, Zap, Activity } from 'lucide-react'
import { mbtiProfiles } from '../data/mbtiProfiles'
import { API_BASE } from '../config'
import { CountUp } from './CountUp'

const API = API_BASE + '/api'

interface StatsData {
  totalDebates: number
  totalPosts: number
  totalMessages: number
  activeUsers: number
  typeDistribution: { typeId: string; count: number }[]
  topTopics: string[]
}

export function StatsDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try to fetch real stats from backend
    fetch(`${API}/posts`)
      .then(r => r.json())
      .then(data => {
        // Build stats from available data
        setStats({
          totalDebates: 0,
          totalPosts: data.total || 0,
          totalMessages: 0,
          activeUsers: 0,
          typeDistribution: (data.posts || []).reduce((acc: { typeId: string; count: number }[], p: any) => {
            const existing = acc.find(x => x.typeId === p.author_type)
            if (existing) existing.count++
            else acc.push({ typeId: p.author_type, count: 1 })
            return acc
          }, []),
          topTopics: [...new Set((data.posts || []).map((p: any) => p.title))].slice(0, 5) as string[],
        })
      })
      .catch(() => {
        // Fallback: simulated stats
        const typeDist = mbtiProfiles.slice(0, 8).map(p => ({
          typeId: p.id,
          count: Math.floor(Math.random() * 40) + 5,
        }))
        setStats({
          totalDebates: 156,
          totalPosts: 42,
          totalMessages: 1280,
          activeUsers: 38,
          typeDistribution: typeDist,
          topTopics: ['自由意志与决定论', 'AI是否会取代人类', '理想主义vs现实主义', 'MBTI是否科学', '社交媒体的利弊'],
        })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-6 w-1/3 rounded" style={{ background: 'var(--color-border)' }} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 rounded-lg" style={{ background: 'var(--color-border)', opacity: 0.6 }} />
          ))}
        </div>
      </div>
    )
  }

  if (!stats) return null

  const maxCount = Math.max(...stats.typeDistribution.map(d => d.count), 1)

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center gap-2">
        <BarChart3 size={20} style={{ color: 'var(--color-accent)' }} />
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>数据统计</h2>
      </div>

      {/* Quick stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Zap size={16} />} label="总辩论" value={stats.totalDebates} color="#6366f1" />
        <StatCard icon={<Activity size={16} />} label="帖子数" value={stats.totalPosts} color="#2fc9a3" />
        <StatCard icon={<TrendingUp size={16} />} label="消息" value={stats.totalMessages} color="#d9b871" />
        <StatCard icon={<Users size={16} />} label="活跃用户" value={stats.activeUsers} color="#e57e7e" />
      </div>

      {/* Type distribution bar chart */}
      <div
        className="rounded-xl p-5 border"
        style={{
          background: 'var(--glass-bg)',
          borderColor: 'var(--glass-border)',
        }}
      >
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          人格活跃度排行
        </h3>
        <div className="space-y-2">
          {stats.typeDistribution
            .sort((a, b) => b.count - a.count)
            .map((item) => {
              const profile = mbtiProfiles.find(p => p.id === item.typeId)
              const width = (item.count / maxCount) * 100
              return (
                <div key={item.typeId} className="flex items-center gap-2">
                  <span className="w-10 text-xs font-mono font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {item.typeId}
                  </span>
                  <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
                    <div
                      className="h-full rounded-full flex items-center px-2 transition-all duration-700"
                      style={{
                        width: `${Math.max(width, 5)}%`,
                        background: profile?.color || '#6366f1',
                        opacity: 0.85,
                      }}
                    >
                      <span className="text-xs font-bold text-white drop-shadow-sm">{item.count}</span>
                    </div>
                  </div>
                  <span className="text-xs w-6 text-right" style={{ color: 'var(--color-text-tertiary)' }}>
                    {profile?.emoji || ''}
                  </span>
                </div>
              )
            })}
        </div>
      </div>

      {/* Hot topics */}
      <div
        className="rounded-xl p-5 border"
        style={{
          background: 'var(--glass-bg)',
          borderColor: 'var(--glass-border)',
        }}
      >
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
          热门话题 TOP 5
        </h3>
        <div className="space-y-2">
          {stats.topTopics.map((topic, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-opacity-50"
              style={{ background: i === 0 ? 'var(--color-accent-light)' : 'transparent' }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: i === 0 ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                  color: i === 0 ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                {i + 1}
              </span>
              <span className="flex-1 text-sm truncate" style={{ color: 'var(--color-text)' }}>{topic}</span>
              {i === 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
                  热门
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <div
      className="rounded-xl p-4 border flex flex-col gap-2"
      style={{
        background: 'var(--glass-bg)',
        borderColor: 'var(--glass-border)',
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      </div>
      {/* v36：数字滚动动画（方案 §6 动态数据展示） */}
      <span className="text-2xl font-bold display-title" style={{ color: 'var(--color-text)' }}>
        <CountUp value={value} />
      </span>
    </div>
  )
}
