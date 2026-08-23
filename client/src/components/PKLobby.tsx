import { useState, useEffect, useCallback } from 'react'
import type { CSSProperties } from 'react'
import clsx from 'clsx'
import { Swords, Plus, Zap, Users, Globe, Lock, RefreshCw, PawPrint, ArrowLeft, Lightbulb, Sparkles } from 'lucide-react'
import { PKRoom, PKPhase } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import { PetShop } from './PetShop'
import { recommendedTopics, randomTopic } from '../data/recommendedTopics'
import { API_BASE } from '../config'

const API = API_BASE + '/api'

const PHASE_LABELS: Record<PKPhase, string> = {
  waiting: '等待中', preparation: '准备中', opening: '立论阶段',
  free_debate: '自由辩论', closing: '总结陈词', judging: '裁判评分', finished: '已结束'
}

const PHASE_COLORS: Record<PKPhase, string> = {
  waiting: '#2fc9a3', preparation: '#d9b871', opening: '#6fa3f5',
  free_debate: '#e57e7e', closing: '#e8976f', judging: '#8f7ff5', finished: '#6b7280'
}

interface PKLobbyProps {
  onJoinRoom: (roomId: string) => void
}

export function PKLobby({ onJoinRoom }: PKLobbyProps) {
  const { isLoggedIn, user } = useAuth()
  const [rooms, setRooms] = useState<PKRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [topic, setTopic] = useState('')
  const [createPublic, setCreatePublic] = useState(true)
  const [creating, setCreating] = useState(false)
  const [matching, setMatching] = useState(false)
  const [error, setError] = useState('')
  const [showPetShop, setShowPetShop] = useState(false)

  // socket.io 实时连接
  const socketRef = useSocket()

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API}/pk/list`)
      const data = await res.json()
      setRooms(data)
    } catch (e) {
      console.error('获取房间列表失败', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    socket.emit('join-lobby')
    const onRoomCreated = () => fetchRooms()
    const onRoomUpdated = () => fetchRooms()
    socket.on('room-created', onRoomCreated)
    socket.on('room-updated', onRoomUpdated)

    return () => {
      socket.emit('leave-lobby')
      socket.off('room-created', onRoomCreated)
      socket.off('room-updated', onRoomUpdated)
    }
  }, [socketRef, fetchRooms])

  useEffect(() => { fetchRooms() }, [fetchRooms])

  // 30秒自动刷新
  useEffect(() => {
    const interval = setInterval(fetchRooms, 30000)
    return () => clearInterval(interval)
  }, [fetchRooms])

  const handleCreate = async () => {
    if (!topic.trim()) { setError('请输入辩题'); return }
    if (!isLoggedIn) { setError('请先登录'); return }
    setCreating(true)
    try {
      const token = localStorage.getItem('mbti_token')
      const res = await fetch(`${API}/pk/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ topic, position: '正方', isPublic: createPublic, maxParticipants: 2, creatorId: user?.id }),
      })
      const data = await res.json()
      if (res.ok) {
        onJoinRoom(data.room.id)
        setShowCreate(false)
        setTopic('')
      } else {
        setError(data.error)
      }
    } catch {
      setError('创建失败')
    } finally {
      setCreating(false)
    }
  }

  const handleQuickMatch = async () => {
    if (!isLoggedIn) { setError('请先登录'); return }
    setMatching(true)
    try {
      const token = localStorage.getItem('mbti_token')
      const res = await fetch(`${API}/pk/quick-match`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ userId: user?.id }),
      })
      const data = await res.json()
      if (res.ok) {
        onJoinRoom(data.room.id)
      }
    } catch {
      setError('匹配失败')
    } finally {
      setMatching(false)
    }
  }

  const handleJoinRoom = (roomId: string) => {
    if (!isLoggedIn) { setError('请先登录后再进入房间'); return }
    onJoinRoom(roomId)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3">
          {showPetShop ? (
            <button onClick={() => setShowPetShop(false)} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }}>
              <ArrowLeft size={18} />
            </button>
          ) : (
            <Swords size={24} style={{ color: 'var(--color-accent)' }} />
          )}
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
              {showPetShop ? '像素宠物商城' : '辩论PK·竞技场'}
            </h1>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {showPetShop ? '宠物养成 · 装备强化 · 积分消费' : '语音辩论 · 像素宠物 · 实时对战'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!showPetShop && (
            <>
              <button
                onClick={() => setShowPetShop(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105"
                style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}
              >
                <PawPrint size={16} /> 我的宠物
              </button>
              <button
                onClick={handleQuickMatch}
                disabled={matching}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #e57e7e, #e8976f)' }}
              >
                {matching ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                {matching ? '匹配中...' : '快速匹配'}
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105"
                style={{ background: 'var(--color-accent)' }}
              >
                <Plus size={16} /> 创建房间
              </button>
            </>
          )}
        </div>
      </div>

      {/* Pet shop view */}
      {showPetShop && (
        <div className="flex-1 overflow-hidden">
          <PetShop />
        </div>
      )}

      {/* Create Room Modal */}
      {!showPetShop && showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md p-6 rounded-2xl shadow-2xl" style={{ background: 'var(--color-bg-secondary)' }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text)' }}>创建辩论房间</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>辩题（可自定义）</label>
                <input
                  value={topic}
                  onChange={e => { setTopic(e.target.value); setError('') }}
                  placeholder="输入辩论话题..."
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setTopic(randomTopic())}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all hover:scale-105"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                    aria-label="随机辩题"
                  >
                    <Sparkles size={12} /> 随机辩题
                  </button>
                  <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    <Lightbulb size={11} className="inline mr-0.5" />推荐：
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    {recommendedTopics.flatMap(c => c.topics).slice(0, 4).map(t => (
                      <button
                        key={t}
                        onClick={() => { setTopic(t); setError('') }}
                        className="text-[11px] px-2 py-0.5 rounded-full border transition-all hover:scale-105"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-bg)' }}
                      >
                        {t.length > 14 ? t.slice(0, 14) + '…' : t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCreatePublic(true)}
                  className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm', createPublic ? 'text-white' : '')}
                  style={createPublic ? { background: 'var(--color-accent)' } : { background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
                >
                  <Globe size={14} /> 公开
                </button>
                <button
                  onClick={() => setCreatePublic(false)}
                  className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm', !createPublic ? 'text-white' : '')}
                  style={!createPublic ? { background: 'var(--color-accent)' } : { background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
                >
                  <Lock size={14} /> 私密
                </button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setShowCreate(false); setError('') }}
                  className="flex-1 py-2 rounded-lg text-sm" style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
                  取消
                </button>
                <button onClick={handleCreate} disabled={creating}
                  className="flex-1 py-2 rounded-lg text-sm text-white disabled:opacity-50"
                  style={{ background: 'var(--color-accent)' }}>
                  {creating ? '创建中...' : '创建'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room list */}
      {!showPetShop && (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            房间列表 ({rooms.length})
          </h2>
          <button onClick={fetchRooms} className="p-1 rounded hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }}>
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="animate-pulse h-20 rounded-xl" style={{ background: 'var(--color-bg-secondary)' }} />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Swords size={64} className="mb-4 opacity-20" style={{ color: 'var(--color-accent)' }} />
            <p className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>还没有房间</p>
            <p className="text-sm mb-6 text-center max-w-md" style={{ color: 'var(--color-text-secondary)' }}>
              快来开启第一场像素宠物辩论对战吧！创建房间邀请好友，或快速匹配随机对手。
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                style={{ background: 'var(--color-accent)' }}
              >
                <Plus size={18} /> 创建房间
              </button>
              <button
                onClick={handleQuickMatch}
                disabled={matching}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-accent)', border: '2px solid var(--color-accent)' }}
              >
                {matching ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
                {matching ? '匹配中...' : '快速匹配'}
              </button>
            </div>
            <p className="text-xs mt-4 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              💡 推荐辩题：「AI 应该拥有创作版权吗？」
            </p>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            {rooms.map((room, i) => {
              const phaseColor = PHASE_COLORS[room.current_phase as PKPhase]
              const full = (room.participant_count || 0) >= room.max_participants
              return (
              <button
                key={room.id}
                onClick={() => handleJoinRoom(room.id)}
                onMouseMove={e => {
                  const r = e.currentTarget.getBoundingClientRect()
                  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
                  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
                }}
                className="stagger-item glass card-spotlight text-left p-4 rounded-xl transition-all hover:scale-[1.02] border"
                style={{
                  borderColor: 'var(--color-border)',
                  ...({ '--spot-color': `${phaseColor}26` } as CSSProperties),
                  animationDelay: `${i * 0.05}s`,
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm line-clamp-1" style={{ color: 'var(--color-text)' }}>{room.topic}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{
                    background: phaseColor + '22',
                    color: phaseColor,
                  }}>
                    {PHASE_LABELS[room.current_phase as PKPhase]}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <span className={`status-dot ${full ? 'status-dot-danger' : 'status-dot-success'}`} />
                    {room.participant_count || 0}/{room.max_participants} 人
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {room.is_public ? <Globe size={12} /> : <Lock size={12} />}
                    {room.is_public ? '公开' : '私密'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono tabular-nums" style={{
                    background: 'var(--color-bg)',
                    color: 'var(--color-text-tertiary)',
                  }}>
                    房号: {room.id}
                  </span>
                </div>
              </button>
              )
            })}
          </div>
        )}
      </div>
      )}
    </div>
  )
}
