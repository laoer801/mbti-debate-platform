import { useState, useEffect } from 'react'
import { useAuth, API } from '../hooks/useAuth'
import type { MatchRecommendation } from '../types'
import { mbtiProfiles } from '../data/mbtiProfiles'
import { Heart } from 'lucide-react'

const compatMessages: Record<string, string> = {
  '90-100': '天生绝配！你们在认知和价值观上高度互补 🎯',
  '75-89': '非常合拍，有很好的化学反应 ✨',
  '60-74': '不错的搭配，值得深入了解 🌱',
  '40-59': '有一定差异，但有成长空间 💪',
  '0-39': '挑战组合，需要更多磨合和包容 🤝',
}

function getCompatLabel(score: number) {
  if (score >= 90) return compatMessages['90-100']
  if (score >= 75) return compatMessages['75-89']
  if (score >= 60) return compatMessages['60-74']
  if (score >= 40) return compatMessages['40-59']
  return compatMessages['0-39']
}

export function MatchPanel() {
  const { isLoggedIn, user, token } = useAuth()
  const [recommendations, setRecommendations] = useState<MatchRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [userType, setUserType] = useState<string>('')

  const profile = mbtiProfiles.find(p => p.id === user?.mbtiType)

  useEffect(() => {
    if (!isLoggedIn || !token) {
      setLoading(false)
      return
    }
    fetch(`${API}/match/recommendations`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setRecommendations(d.recommendations || [])
        setUserType(d.userType || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isLoggedIn, token])

  if (!isLoggedIn) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-8" style={{ color: 'var(--color-text)', opacity: 0.6 }}>
          <div className="text-5xl mb-4">💕</div>
          <p className="text-lg mb-2">登录后查看人格匹配推荐</p>
          <p className="text-sm">发现与你最契合的MBTI灵魂伴侣</p>
        </div>
      </div>
    )
  }

  if (!user?.mbtiType) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-8" style={{ color: 'var(--color-text)', opacity: 0.6 }}>
          <div className="text-5xl mb-4">🧪</div>
          <p className="text-lg mb-2">请先完成MBTI人格测试</p>
          <p className="text-sm">在"设置"或"人格大厅"中完成测试，解锁匹配推荐</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        {/* User Card */}
        <div className="rounded-2xl p-6 mb-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
              style={{ background: (profile?.color || '#9b59b6') + '20', color: profile?.color }}>
              {profile?.emoji || '🦋'}
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                {profile?.id} - {profile?.name}
              </h2>
              <p className="text-sm opacity-70 mt-1" style={{ color: 'var(--color-text)' }}>
                {profile?.description}
              </p>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text)' }}>🎯 与你最匹配的人格</h3>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin text-3xl">🌀</div>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-10" style={{ color: 'var(--color-text)' }}>
            <div
              className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}
              aria-hidden="true"
            >
              <Heart size={36} style={{ color: 'var(--color-text-tertiary)' }} />
            </div>
            <h3 className="text-base font-bold mb-1.5">还没有可匹配的用户</h3>
            <p className="text-sm opacity-70 mb-1">当其他用户完成 MBTI 测试后，这里会展示与你的类型最匹配的人格。</p>
            <p className="text-xs opacity-50">💡 邀请朋友加入，一起发现绝配人格吧！</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, i) => {
              const p = mbtiProfiles.find(pp => pp.id === rec.mbti_type)
              return (
                <div key={rec.id}
                  className="rounded-xl p-4 flex items-center gap-4 transition-all hover:scale-[1.02]"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    animation: `fadeInUp 0.3s ease-out ${i * 0.08}s both`,
                  }}>
                  {/* Rank */}
                  <div className="text-2xl font-bold w-10 text-center" style={{ color: i === 0 ? '#f39c12' : i < 3 ? '#bdc3c7' : 'var(--color-text)', opacity: 0.5 }}>
                    {i + 1}
                  </div>
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: (p?.color || '#9b59b6') + '20', color: p?.color }}>
                    {p?.emoji || '🦋'}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{rec.username}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: (p?.color || '#888') + '20', color: p?.color }}>
                        {rec.mbti_type}
                      </span>
                    </div>
                    <p className="text-xs mt-1 opacity-60 truncate" style={{ color: 'var(--color-text)' }}>{rec.matchReason}</p>
                  </div>
                  {/* Compatibility Score */}
                  <div className="text-center min-w-[60px]">
                    <div className="text-2xl font-bold" style={{ color: rec.compatibility >= 80 ? '#27ae60' : rec.compatibility >= 60 ? '#f39c12' : '#e74c3c' }}>
                      {rec.compatibility}%
                    </div>
                    <div className="text-xs opacity-50" style={{ color: 'var(--color-text)' }}>匹配度</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
