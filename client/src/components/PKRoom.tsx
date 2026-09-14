import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import clsx from 'clsx'
import { Mic, Send, Timer, Swords, Trophy, LogOut, ChevronRight, Sparkles } from 'lucide-react'
import { PKRoom as PKRoomType, PKParticipant, PKMove, PKPhase, PKJudgeResult, JudgePlayerScore, BattleState, PetBattleEvent } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import { VoiceInput } from './VoiceInput'
import { PKJudge } from './PKJudge'
import { PetBattleField } from './PetBattleField'
import { API_BASE } from '../config'

const API = API_BASE + '/api'

const PHASE_LABELS: Record<PKPhase, string> = {
  waiting: '等待对手', preparation: '准备阶段', opening: '立论阶段',
  free_debate: '自由辩论', closing: '总结陈词', judging: '裁判评分中...', finished: '已结束'
}

const PHASE_DESCRIPTIONS: Record<PKPhase, string> = {
  waiting: '等待其他玩家加入房间...',
  preparation: '思考你的论点，准备立论发言',
  opening: '请陈述你的核心观点（立论）',
  free_debate: '自由辩论，互相质询和反驳',
  closing: '总结你的论点，做最后陈述',
  judging: 'AI裁判正在评分...',
  finished: '辩论结束'
}

const PHASE_DURATIONS: Partial<Record<PKPhase, number>> = {
  preparation: 60, opening: 120, free_debate: 300, closing: 90, judging: 30
}

interface PKRoomProps {
  roomId: string
  onLeave: () => void
}

export function PKRoom({ roomId, onLeave }: PKRoomProps) {
  const { user } = useAuth()
  const [room, setRoom] = useState<PKRoomType | null>(null)
  const [participants, setParticipants] = useState<PKParticipant[]>([])
  const [moves, setMoves] = useState<PKMove[]>([])
  const [phase, setPhase] = useState<PKPhase>('waiting')
  const [phaseStartedAt, setPhaseStartedAt] = useState<number>(0)
  const [phaseDuration, setPhaseDuration] = useState<number>(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [inputText, setInputText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [judgeResult, setJudgeResult] = useState<PKJudgeResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [judging, setJudging] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [mySide, setMySide] = useState<'pro' | 'con'>('pro')
  const [voiceTip, setVoiceTip] = useState<{ username: string; text: string } | null>(null)
  const [aiTyping, setAiTyping] = useState<string | null>(null) // v40.6.1：AI 正在输入
  const [turnUserId, setTurnUserId] = useState<string | null>(null) // v40.6.3：当前发言权（AI 对战回合制）
  // v40 服务器权威宠物战斗：擂台快照 + 最新攻击事件
  const [battleStates, setBattleStates] = useState<BattleState[]>([])
  const [battleEvent, setBattleEvent] = useState<PetBattleEvent | null>(null)
  const battleSeqRef = useRef(0)
  // v40.6.6：屏幕级战斗反馈（震屏 + 闪光/冲击环）
  const [battleFx, setBattleFx] = useState<{ id: number; kind: 'hit' | 'crit' | 'ko'; color: string } | null>(null)
  const screenRootRef = useRef<HTMLDivElement>(null)
  const movesEndRef = useRef<HTMLDivElement>(null)
  const voiceTipTimer = useRef<number>(0)
  const socketRef = useSocket()
  const phaseRef = useRef<PKPhase>('waiting')
  const participantsRef = useRef<PKParticipant[]>([])
  // v40.7.1：AI 连发检测（自动切阶段时等 AI 观点说完）
  const aiTypingRef = useRef(false)
  const aiLastMoveRef = useRef(0)

  // 同步 ref，供 socket 回调读取最新状态
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { participantsRef.current = participants }, [participants])

  // Load room data
  useEffect(() => {
    const loadRoom = async () => {
      try {
        const token = localStorage.getItem('mbti_token')
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers.Authorization = `Bearer ${token}`
        const res = await fetch(`${API}/pk/${roomId}`, { headers })
        const data = await res.json()
        if (!res.ok) {
          setLoadError(data.error || '房间不存在或已结束')
          return
        }
        if (res.ok) {
          if (data.room) setRoom(data.room)
          setParticipants(data.participants || [])
          setMoves(data.moves || [])
          if (data.room) {
            setPhase(data.room.current_phase as PKPhase)
            setPhaseStartedAt(data.room.phase_started_at || 0)
            setPhaseDuration(data.room.phase_duration || 0)
            setTurnUserId(data.room.turn_user_id || null) // v40.6.3
          }
          if (data.judgeResult) {
            setJudgeResult(JSON.parse(data.judgeResult.scores || '{}'))
          }
          // Find my side
          const me = (data.participants || []).find((p: PKParticipant) => p.user_id === user?.id)
          if (me) setMySide(me.side)

          // v40：对局中途进入（断线重连）→ 恢复擂台战斗快照
          const inProgress = ['preparation', 'opening', 'free_debate', 'closing', 'judging'].includes(data.room?.current_phase)
          if (inProgress) {
            try {
              const bRes = await fetch(`${API}/pk/${roomId}/battle`)
              const bData = await bRes.json()
              if (bData.battleStates) setBattleStates(bData.battleStates)
            } catch {}
          }

          // v40.6.2：自动开赛——已满员(≥2)且 waiting → 直接进入准备阶段
          // （修复：此段此前为空注释，导致自己进 AI 房/断线重进永远停在 waiting 不开始）
          if (data.room?.current_phase === 'waiting' && (data.participants?.length >= 2)) {
            handlePhaseChange('preparation')
          }
        }
      } catch (e) {
        console.error('加载房间失败', e)
        setLoadError('网络错误，无法加载房间')
      } finally {
        setLoading(false)
      }
    }
    loadRoom()
  }, [roomId, user?.id])

  // 自动加入：创建房间/点列表进房时后端可能未把当前用户加入参与者
  // （/create 不自动添加创建者，点列表进入也不触发 join），必须补一次
  const autoJoinDoneRef = useRef(false)
  useEffect(() => {
    if (loading || !user?.id || !room) return
    if (room.current_phase !== 'waiting') return
    if (participants.some(p => p.user_id === user.id)) return
    if (autoJoinDoneRef.current) return
    autoJoinDoneRef.current = true

    const token = localStorage.getItem('mbti_token')
    fetch(`${API}/pk/${roomId}/join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
      body: JSON.stringify({ userId: user.id }), // 不传 side，后端自动分配（先到先占位）
    })
      .then(res => res.json())
      .then(data => {
        if (data.participants) setParticipants(data.participants)
      })
      .catch(e => console.error('自动加入房间失败', e))
  }, [loading, room, user?.id, participants, roomId])

  // 房间加载失败 → 错误界面
  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="text-center p-8">
          <Swords size={48} className="mx-auto mb-4 opacity-40" style={{ color: 'var(--color-text-secondary)' }} />
          <p className="font-bold mb-2" style={{ color: 'var(--color-text)' }}>{loadError}</p>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>该房间可能已开始、已满或已被删除</p>
          <button
            onClick={onLeave}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
            style={{ background: 'var(--color-accent)' }}
          >
            返回大厅
          </button>
        </div>
      </div>
    )
  }

  // socket.io 实时订阅
  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    socket.emit('join-room', roomId)

    const onParticipants = (pts: PKParticipant[]) => {
      setParticipants(pts)
      // 2人满且等待中 → 自动开始准备阶段
      if (pts.length >= 2 && phaseRef.current === 'waiting') {
        handlePhaseChange('preparation')
      }
    }

    const onPhaseChanged = (data: { phase: PKPhase; startedAt: number; duration: number }) => {
      setPhase(data.phase)
      setPhaseStartedAt(data.startedAt)
      setPhaseDuration(data.duration)
    }
    const onNewMove = (move: PKMove) => {
      setMoves(prev => [...prev, move])
      setAiTyping(null) // v40.6.1：AI 回完 → 取消"正在输入"
      // v40.7.1：AI 影子发言 → 刷新"AI 活跃"时间戳（多句连发中不自动切阶段）
      if (move.userId && String(move.userId).startsWith('ai__')) {
        aiTypingRef.current = false
        aiLastMoveRef.current = Date.now()
      }
    }
    const onAiTyping = (data: { userId: string; username: string; level?: string }) => {
      // v40.6.1：AI 辩友正在输入提示（消除等待焦虑）
      setAiTyping(`${data.username || '🤖 AI 辩友'}${data.level ? `（${data.level}）` : ''} 正在输入…`)
      // v40.7.1：标记 AI 正在连发
      if (data.userId && String(data.userId).startsWith('ai__')) {
        aiTypingRef.current = true
        aiLastMoveRef.current = Date.now()
      }
    }
    const onTurnChanged = (data: { roomId: string; turnUserId: string }) => {
      // v40.6.3：回合切换 → 轮到谁谁解锁
      setTurnUserId(data.turnUserId || null)
      if (data.turnUserId && user?.id && data.turnUserId === user.id) {
        setAiTyping(null)
      }
    }
    const onJudgeResult = (data: { scores: PKJudgeResult; winner: string; feedback: string }) => {
      setJudgeResult(data.scores || data)
      setPhase('finished')
    }
    const onVoiceText = (data: { userId: string; username: string; text: string }) => {
      // 对方语音转文字 → 显示浮动提示气泡（不污染本方输入框）
      if (data.userId !== user?.id) {
        setVoiceTip({ username: data.username || '对方', text: data.text })
        window.clearTimeout(voiceTipTimer.current)
        voiceTipTimer.current = window.setTimeout(() => setVoiceTip(null), 4000)
      }
    }

    // v40：擂台初始化（preparation 阶段服务端锁定双方宠物快照）
    const onBattleInit = (states: BattleState[]) => {
      setBattleStates(states || [])
    }

    // v40：宠物攻击事件 —— 服务器算好的伤害/HP，直接驱动擂台（两端一致）
    const onPetBattle = (ev: Omit<PetBattleEvent, 'seq'>) => {
      if (!ev) return
      battleSeqRef.current += 1
      setBattleEvent({ ...ev, seq: battleSeqRef.current })
      setBattleStates(prev => prev.map(s => {
        if (s.userId === ev.attackerId) return { ...s, hp: ev.attackerHp, damageDealt: s.damageDealt + ev.damage }
        if (s.userId === ev.defenderId) return { ...s, hp: ev.defenderHp, damageTaken: s.damageTaken + ev.damage }
        return s
      }))
      // v40.6.6：伤害瞬间 → 屏幕级动画（攻方阵营色驱动；暴击=冲击环+火花，击倒=强震）
      const atkSide = participantsRef.current.find(p => p.user_id === ev.attackerId)?.side
      const atkColor = atkSide === 'con' ? '#e57e7e' : '#6fa3f5'
      setBattleFx({ id: battleSeqRef.current, kind: ev.knockOut ? 'ko' : ev.crit ? 'crit' : 'hit', color: atkColor })
    }

    socket.on('participant-joined', onParticipants)
    socket.on('phase-changed', onPhaseChanged)
    socket.on('new-move', onNewMove)
    socket.on('ai-typing', onAiTyping)
    socket.on('pk-turn', onTurnChanged)
    socket.on('judge-result', onJudgeResult)
    socket.on('voice-text', onVoiceText)
    socket.on('battle-init', onBattleInit)
    socket.on('pet-battle', onPetBattle)

    return () => {
      socket.emit('leave-room', roomId)
      socket.off('participant-joined', onParticipants)
      socket.off('phase-changed', onPhaseChanged)
      socket.off('new-move', onNewMove)
      socket.off('ai-typing', onAiTyping)
      socket.off('pk-turn', onTurnChanged)
      socket.off('judge-result', onJudgeResult)
      socket.off('voice-text', onVoiceText)
      socket.off('battle-init', onBattleInit)
      socket.off('pet-battle', onPetBattle)
      window.clearTimeout(voiceTipTimer.current)
    }
  }, [socketRef, roomId])

  // Timer
  useEffect(() => {
    if (!phaseStartedAt || !phaseDuration) return
    const interval = setInterval(() => {
      const elapsed = (Date.now() - phaseStartedAt) / 1000
      const remaining = Math.max(0, phaseDuration - elapsed)
      setTimeLeft(Math.ceil(remaining))

      if (remaining <= 0) {
        // v40.7.1：AI 正在连发观点 → 自动切阶段顺延，等 AI 说完并停顿 2.5s 再切（观点表达完整）
        const aiBusy = aiTypingRef.current || Date.now() - aiLastMoveRef.current < 2500
        if (aiBusy) {
          setTimeLeft(0)
          return
        }
        clearInterval(interval)
        advanceToNextPhase()
      }
    }, 500)
    return () => clearInterval(interval)
  }, [phaseStartedAt, phaseDuration, phase])

  const handlePhaseChange = async (newPhase: PKPhase) => {
    try {
      const token = localStorage.getItem('mbti_token')
      await fetch(`${API}/pk/${roomId}/phase`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ phase: newPhase, userId: user?.id }),
      })
    } catch (e) {
      console.error('切换阶段失败', e)
    }
  }

  const advanceToNextPhase = () => {
    const phaseOrder: PKPhase[] = ['waiting', 'preparation', 'opening', 'free_debate', 'closing', 'judging', 'finished']
    const idx = phaseOrder.indexOf(phase)
    if (idx < 0 || idx >= phaseOrder.length - 1) return
    const nextPhase = phaseOrder[idx + 1]
    if (nextPhase === 'judging') {
      requestJudging()
    } else {
      handlePhaseChange(nextPhase)
    }
  }

  const requestJudging = async () => {
    setJudging(true)
    handlePhaseChange('judging')
    try {
      const token = localStorage.getItem('mbti_token')
      const res = await fetch(`${API}/pk/${roomId}/judge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ userId: user?.id }),
      })
      const data = await res.json()
      setJudgeResult(data)
      setPhase('finished')
    } catch (e) {
      console.error('评分失败', e)
    } finally {
      setJudging(false)
    }
  }

  const handleSend = useCallback(async () => {
    const content = inputText.trim()
    if (!content) return

    try {
      const token = localStorage.getItem('mbti_token')
      await fetch(`${API}/pk/${roomId}/move`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ userId: user?.id, content, moveType: 'speech' }),
      })
      setInputText('')    } catch (e) {
      console.error('发送失败', e)
    }
  }, [inputText, roomId, user?.id])

  // v40.7.1：请 AI 继续说（轮到自己但不想打字/想听 AI 更多观点）
  const handlePokeAI = useCallback(async () => {
    try {
      const token = localStorage.getItem('mbti_token')
      await fetch(`${API}/pk/${roomId}/poke`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ userId: user?.id }),
      })
    } catch (e) {
      console.error('请求 AI 发言失败', e)
    }
  }, [roomId, user?.id])

  const handleVoiceResult = (text: string) => {
    setInputText(prev => prev + (prev ? ' ' : '') + text)
    // 语音转写文本广播给房间内其他玩家
    const socket = socketRef.current
    if (socket?.connected) {
      socket.emit('voice-text', { roomId, text, userId: user?.id, username: user?.username })
    }
  }

  // Scroll to latest move
  useEffect(() => {
    movesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [moves])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const canSpeak = phase === 'free_debate' || phase === 'opening' || phase === 'closing'
  // v40.6.3：AI 对战回合制 —— 轮到我 = 发言权在己；真人房 turnUserId 为空 → 维持自由发言
  const isAiRoom = !!room?.ai_mode
  const isMyTurn = canSpeak && participants.some(p => p.user_id === user?.id)
    && (!isAiRoom || !turnUserId || turnUserId === user?.id)

  const phaseProgress = phaseDuration > 0 ? Math.min(100, ((Date.now() - phaseStartedAt) / 1000 / phaseDuration) * 100) : 0

  // v40.6.6：battleFx → 震屏 class（remove→reflow→add，保证连续攻击能重播）
  useEffect(() => {
    const el = screenRootRef.current
    if (!el) return
    el.classList.remove('kb-shake', 'kb-shake-strong')
    if (battleFx) {
      void el.offsetWidth
      el.classList.add(battleFx.kind === 'ko' ? 'kb-shake-strong' : 'kb-shake')
    }
  }, [battleFx])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="animate-spin w-8 h-8 border-2 rounded-full border-t-transparent" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  // 已完成 → 显示裁判结果
  if (phase === 'finished' && judgeResult) {
    return (
      <div className="h-full overflow-y-auto" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-3xl mx-auto p-6">
          <PKJudge result={judgeResult} participants={participants} onLeave={onLeave} roomId={roomId} topic={room?.topic} />
        </div>
      </div>
    )
  }

  return (
    <div ref={screenRootRef} className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* v40.6.6：宠物伤害屏幕动画 —— 全屏闪光 / 冲击环 / 火花（pointer-events-none 不挡操作） */}
      {battleFx && (
        <div className="kb-fx-overlay" key={battleFx.id} style={{ '--fx-color': battleFx.color } as CSSProperties}>
          <div className="kb-fx-flash" onAnimationEnd={() => setBattleFx(null)} />
          {battleFx.kind !== 'hit' && <div className="kb-fx-ring" />}
          {battleFx.kind === 'ko' && <div className="kb-fx-sparks" />}
        </div>
      )}
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { if (window.confirm('确定退出对局吗？')) onLeave() }}
            className="p-1.5 rounded-lg flex items-center gap-1 hover:opacity-80"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="退出对局"
          >
            <LogOut size={18} />
            <span className="text-xs hidden sm:inline">退出</span>
          </button>
          <div>
            <h2 className="font-bold text-sm line-clamp-1" style={{ color: 'var(--color-text)' }}>{room?.topic || '加载中...'}</h2>
            <span className="text-[10px] text-mono opacity-60" style={{ color: 'var(--color-text-tertiary)' }}>房号: {roomId}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{PHASE_LABELS[phase]}</span>
            {timeLeft > 0 && (
              <span className={clsx('flex items-center gap-1 text-sm font-mono font-bold px-2 py-0.5 rounded',
                timeLeft <= 30 ? 'text-red-400' : ''
              )} style={{ color: timeLeft <= 30 ? '#e57e7e' : 'var(--color-accent)' }}>
                <Timer size={14} />
                {formatTime(timeLeft)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Phase progress bar */}
      {phaseDuration > 0 && (
        <div className="h-1" style={{ background: 'var(--color-border)' }}>
          <div className="h-full transition-all duration-500" style={{
            width: `${phaseProgress}%`,
            background: phaseProgress > 80 ? 'linear-gradient(90deg, var(--color-accent), #e57e7e)' : 'var(--color-accent)',
          }} />
        </div>
      )}

      {/* Waiting state */}
      {phase === 'waiting' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Swords size={48} className="mx-auto mb-4 animate-pulse" style={{ color: 'var(--color-accent)' }} />
            <p className="text-lg font-medium" style={{ color: 'var(--color-text)' }}>等待对手加入...</p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>分享房间号 {roomId} 邀请好友</p>
            <p className="text-xs mt-4 opacity-50" style={{ color: 'var(--color-text-tertiary)' }}>
              当前 {participants.length}/{room?.max_participants || 2} 人
            </p>
            {/* v40.6.2：真人房等待兜底——没人来就转 AI 对战 */}
            {!room?.ai_mode && participants.length < 2 && (
              <button
                onClick={onLeave}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-accent)', border: '1.5px solid var(--color-accent)' }}
              >
                <Sparkles size={15} /> 等不到人？返回挑战 AI 辩友
              </button>
            )}
          </div>
        </div>
      )}

      {/* Debate area */}
      {phase !== 'waiting' && phase !== 'finished' && (
        <>
          {/* Participants */}
          <div className="flex items-center gap-4 px-4 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
            {participants.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
                <span className="text-lg">{p.mbti_type ? '🧑' : '👤'}</span>
                <span className="font-medium">{p.username || '玩家'}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                  style={p.side === 'pro' ? { background: '#6fa3f522', color: '#6fa3f5' } : { background: '#e57e7e22', color: '#e57e7e' }}>
                  {p.side === 'pro' ? '正方' : '反方'}
                </span>
              </div>
            ))}
          </div>

          {/* v40 宠物擂台 —— 布局流内占位，服务器权威 HP 驱动 */}
          <PetBattleField participants={participants} battleStates={battleStates} battleEvent={battleEvent} phase={phase} />

          {/* Voice tip bubble */}
          {voiceTip && (
            <div className="px-4 pt-2">
              <div className="mx-auto max-w-sm px-4 py-2 rounded-xl text-xs animate-fadeIn"
                style={{ background: 'var(--color-accent-10)', border: '1px solid var(--color-accent)', color: 'var(--color-text-secondary)' }}>
                🎤 <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{voiceTip.username}</span> 语音转文字：{voiceTip.text}
              </div>
            </div>
          )}

          {/* v40.6.1：AI 辩友正在输入 */}
          {aiTyping && (
            <div className="px-4 pt-2">
              <div className="mx-auto max-w-sm px-4 py-2 rounded-xl text-xs animate-fadeIn"
                style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="typing-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-accent)', display: 'inline-block', animation: 'blink 1s infinite' }} />
                  {aiTyping}
                </span>
              </div>
            </div>
          )}

          {/* Moves */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {moves.length === 0 && (
              <div className="text-center py-16">
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {PHASE_DESCRIPTIONS[phase]}
                </p>
              </div>
            )}
            {moves.map((move) => {
              const isMe = move.userId === user?.id
              return (
                <div key={move.id} className={clsx('flex gap-3', isMe ? 'flex-row-reverse' : '')}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: move.side === 'pro' ? '#6fa3f522' : '#e57e7e22' }}>
                    {move.side === 'pro' ? '⚔️' : '🛡️'}
                  </div>
                  <div className={clsx('max-w-[70%]', isMe ? 'items-end' : '')}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        {move.username || '玩家'}
                        {move.mbtiType && <span className="ml-1 opacity-50">({move.mbtiType})</span>}
                      </span>
                      <span className="text-[10px] opacity-40" style={{ color: 'var(--color-text-tertiary)' }}>
                        {new Date(move.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className={clsx('px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                      isMe ? 'rounded-tr-sm text-white' : 'rounded-tl-sm'
                    )}
                      style={isMe
                        ? { background: 'var(--color-accent)', color: '#fff' }
                        : { background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }
                      }>
                      {move.content}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={movesEndRef} />
          </div>

          {/* Input area */}
          {isMyTurn && (
            <div className="p-3 border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
              {/* v40.6.3：回合制轮到你提醒 */}
              {isAiRoom && (
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold animate-fadeIn" style={{ color: 'var(--color-accent)' }}>
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--color-accent)', boxShadow: '0 0 6px var(--color-accent)' }} />
                  🎙️ 轮到你发言
                </div>
              )}
              <div className="flex items-end gap-2">
                <VoiceInput onResult={handleVoiceResult} isRecording={isRecording} setIsRecording={setIsRecording} />
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder={PHASE_DESCRIPTIONS[phase]}
                  className="flex-1 px-3 py-2 rounded-lg text-sm resize-none min-h-[40px] max-h-[120px]"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  rows={2}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  className="p-2.5 rounded-lg text-white disabled:opacity-30 transition-all hover:scale-105"
                  style={{ background: 'var(--color-accent)' }}
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] opacity-40" style={{ color: 'var(--color-text-tertiary)' }}>
                  按Enter发送 / Shift+Enter换行 / 点击🎤语音输入
                </span>
                <div className="flex items-center gap-2">
                  {/* v40.7.1：不想打字 → 让 AI 继续发挥一段 */}
                  {isAiRoom && (
                    <button onClick={handlePokeAI} className="text-xs px-3 py-1 rounded-lg transition-all hover:opacity-80"
                      style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}
                      aria-label="请 AI 继续说">
                      💬 请 AI 继续说
                    </button>
                  )}
                  <button onClick={advanceToNextPhase} className="text-xs px-3 py-1 rounded-lg transition-all hover:opacity-80"
                    style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                    下一阶段 <ChevronRight size={10} className="inline" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Judging overlay */}
      {judging && (
        <div className="fixed inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="text-center p-8 rounded-2xl" style={{ background: 'var(--color-bg-secondary)' }}>
            <Trophy size={48} className="mx-auto mb-4 animate-bounce" style={{ color: '#d9b871' }} />
            <p className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>AI裁判评分中...</p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>分析辩论质量：逻辑性、论据、表达、反驳、风度</p>
            <div className="mt-4 w-48 h-2 rounded-full overflow-hidden mx-auto" style={{ background: 'var(--color-border)' }}>
              <div className="h-full animate-progress-bar rounded-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), #d9b871)' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
