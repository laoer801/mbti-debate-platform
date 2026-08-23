import { useState, useRef, useEffect, useCallback } from 'react'
import { Moon, Sun, Send, StopCircle, RotateCcw, TrendingUp, Brain, Sparkles, Zap, Scale, Volume2, VolumeX, FileText } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { VoiceInput } from './VoiceInput'
import { Message, DebateMode, ConfidenceScore, ReflectionEntry } from '../types'
import { mbtiProfiles } from '../data/mbtiProfiles'
import { debateModes } from '../data/debateModes'
import { personalitySystems } from '../data/personalitySystem'
import { buildDialogueMessages, buildDialogueFallback, parseDialogueResponse, INTENT_LABELS } from '../data/dialogueMode'
import { generateDebateResponse, generateReflection, ReflectionResult, judgeDebate, sideLabels, Side } from '../utils/debateEngine'
import { getLearningMaterial } from '../utils/learningStore'
import { speakAiMessage, isAiVoiceEnabled, setAiVoiceEnabled } from '../utils/voiceEngine'
import { speechService } from '../utils/speechService'
import { isLLMConfigured, getArenaMode, chatCompletion } from '../utils/llmClient'
import { createArenaFromTypes, prepareFullArena, runNextSpeech, judgeArena, analyzeTopic, parseCoT, type ArenaState, type ArenaJudgeResult, type TopicAnalysis, type ArenaResearch, type ArenaStance } from '../utils/debateArena'
// v33 辩论报告生成器（对标 Dialectic：辩论结束后一键生成结构化 Markdown 报告）
import { DebateReport } from './DebateReport'
import { toReportSpeechesFromArena, toReportJudgeFromArena, toReportSpeechesFromMessages, toReportStances, type ReportInput } from '../utils/debateReport'
// v31.1：duel/auto 模式同样连接 AI——人格 LLM 优先，本地模板兜底
import { buildSpeechMessages } from '../utils/debatePrompts'
// v31 人格内核：状态引擎（情绪/精力/亲密度/话题新鲜度演化）+ 持久记忆（跨会话延续）
import { createInitialState, getOrInitState, updateState, savePersonaState, clearPersonaState, describeMood, moodEmoji, energyLabel, intimacyLabel, noveltyLabel, type PersonaState } from '../utils/personaEngine'
import { createEmptyMemory, getOrInitMemory, addMemory, savePersonaMemory, clearPersonaMemory, extractMemoryCandidates, type PersonaMemory } from '../utils/personaMemory'
import clsx from 'clsx'

interface DebateRoomProps {
  topic: string
  messages: Message[]
  selectedTypes: string[]
  onSendMessage: (content: string) => void
  onBotMessage: (typeId: string, content: string, confidence?: number, side?: Side, thinking?: string) => void
  isDebating: boolean
  setIsDebating: (v: boolean) => void
  toggleTheme: () => void
  theme: string
  isSidebarOpen: boolean
  isInfoOpen: boolean
  onToggleSidebar: () => void
  onToggleInfo: () => void
  debateMode: DebateMode
  setDebateMode: (m: DebateMode) => void
  confidenceScores: ConfidenceScore[]
}

/** 自动辩论最多进行的轮数（每轮 = 每位人格发言一次） */
const MAX_AUTO_ROUNDS = 10

export function DebateRoom({
  topic, messages, selectedTypes, onSendMessage, onBotMessage,
  isDebating, setIsDebating, toggleTheme, theme,
  isSidebarOpen: _s, isInfoOpen, onToggleSidebar: _ts, onToggleInfo: _ti,
  debateMode, setDebateMode, confidenceScores,
}: DebateRoomProps) {
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState<Partial<Message> | null>(null)
  const [showConfidence, setShowConfidence] = useState(true)
  const [showJudge, setShowJudge] = useState(false)
  const [reflections, setReflections] = useState<ReflectionEntry[]>([])
  const [showReflection, setShowReflection] = useState(false)
  // 自动辩论状态（人格自主进行，用户可随时插话）
  const [autoOn, setAutoOn] = useState(false)
  const [autoEnded, setAutoEnded] = useState(false)
  // AI 语音播报开关（跟随全局设置）
  const [voiceOn, setVoiceOn] = useState(isAiVoiceEnabled())
  // 语音输入录音状态
  const [recording, setRecording] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const streamingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasStartedRef = useRef(false)
  const roundCountRef = useRef(0)
  const autoRef = useRef(false)
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesRef = useRef(messages)
  const startBotRoundRef = useRef<() => Promise<void>>(async () => {})
  // 本场固定立场分配（一半正方一半反方，避免每轮摇摆）
  const sideMapRef = useRef<Record<string, Side>>({})
  // v25 顶尖辩手模式：LLM 多智能体辩论场（arena）
  const arenaRef = useRef<ArenaState | null>(null)
  const [arenaJudge, setArenaJudge] = useState<ArenaJudgeResult | null>(null)
  // v33 辩论报告：裁判判定后可一键生成结构化 Markdown 报告
  const [showReport, setShowReport] = useState(false)
  const [reportInput, setReportInput] = useState<ReportInput | null>(null)
  // v26.2 审题：辩论之前必先审题——审题报告置顶展示，来源区分 AI 深度/本地快速
  const [arenaAnalysis, setArenaAnalysis] = useState<TopicAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  // v27 资料检索：审题之后检索辩题资料——资料包卡片展示，来源区分 AI 深度/本地快速
  const [arenaResearch, setArenaResearch] = useState<ArenaResearch | null>(null)
  const [researching, setResearching] = useState(false)
  // v27.2 立场宣言：开赛前每人先亮明「我认为……」——置顶展示，立场锁定全赛程
  const [arenaStance, setArenaStance] = useState<ArenaStance[] | null>(null)
  const [stanceLoading, setStanceLoading] = useState(false)

  // ── v31 人格状态引擎 + 持久记忆（每人格独立，跨会话延续）──
  const [personaStates, setPersonaStates] = useState<Record<string, PersonaState>>({})
  const [personaMemories, setPersonaMemories] = useState<Record<string, PersonaMemory>>({})
  const personaStatesRef = useRef<Record<string, PersonaState>>({})
  const personaMemoriesRef = useRef<Record<string, PersonaMemory>>({})
  const personaTypesKey = selectedTypes.join(',')

  // 初始化/同步选中人格的状态与记忆（切换人格、重置后都会刷新）
  useEffect(() => {
    const states: Record<string, PersonaState> = {}
    const mems: Record<string, PersonaMemory> = {}
    for (const id of selectedTypes) {
      states[id] = getOrInitState(id)
      mems[id] = getOrInitMemory(id)
    }
    personaStatesRef.current = states
    personaMemoriesRef.current = mems
    setPersonaStates(states)
    setPersonaMemories(mems)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaTypesKey])

  // 读取：ref 保证异步回调（auto 定时器/流式输出）中永远拿到最新值，避免闭包过期
  const getStateFor = (typeId: string): PersonaState => personaStatesRef.current[typeId] ?? getOrInitState(typeId)
  const getMemoryFor = (typeId: string): PersonaMemory => personaMemoriesRef.current[typeId] ?? getOrInitMemory(typeId)

  // 写入：ref + React state + localStorage 三同步（刷新页面后状态仍在）
  const commitPersonaState = (state: PersonaState) => {
    personaStatesRef.current = { ...personaStatesRef.current, [state.typeId]: state }
    setPersonaStates(prev => ({ ...prev, [state.typeId]: state }))
    savePersonaState(state)
  }
  const commitPersonaMemory = (mem: PersonaMemory) => {
    personaMemoriesRef.current = { ...personaMemoriesRef.current, [mem.typeId]: mem }
    setPersonaMemories(prev => ({ ...prev, [mem.typeId]: mem }))
    savePersonaMemory(mem)
  }

  // 清空某人格的状态与记忆（状态卡「重置」按钮）
  const resetPersona = (typeId: string) => {
    clearPersonaState(typeId)
    clearPersonaMemory(typeId)
    commitPersonaState(createInitialState(typeId))
    commitPersonaMemory(createEmptyMemory(typeId))
  }

  // 始终保持最新消息列表（避免自动辩论调度中的闭包过期）
  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    return () => {
      streamingRef.current = false
      autoRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
      // 离开辩论室 → 停止 AI 朗读
      speechService.cancel()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingMessage])

  // 进入辩论室（有主题、无消息）→ 人格自动开辩，自主持续进行
  useEffect(() => {
    if (isDebating && messages.length === 0 && !hasStartedRef.current) {
      hasStartedRef.current = true
      autoRef.current = true
      setAutoOn(true)
      setAutoEnded(false)
      startBotRoundRef.current()
    }
  }, [isDebating])

  // --- 认知模式差异可视化标签 ---
  const getMindLabel = (typeId: string) => {
    const sys = personalitySystems[typeId]
    if (!sys) return null
    const tm = sys.cognitiveMode
    const isThinker = tm.decisionStyle.includes('思考')
    const isIntuitive = tm.infoProcess.includes('直觉')
    const isIntrovert = tm.energySource.includes('内向')
    return {
      thinking: isThinker ? '🧠 理性优先' : '💜 感性优先',
      info: isIntuitive ? '🔮 直觉型' : '📋 实感型',
      energy: isIntrovert ? '🏠 内向' : '🌍 外向',
    }
  }

  // --- 辩论核心逻辑 ---
  const startBotRound = useCallback(async () => {
    if (streamingRef.current) return
    streamingRef.current = true
    setIsStreaming(true)

    // ── v31 用户信号：最新用户发言 + 最近消息内是否有用户插话（供状态演化/记忆提取）──
    const allMsgs = messagesRef.current
    const lastUserMsg = [...allMsgs].reverse().find(m => m.isUser)
    const recentUserMsg = [...allMsgs].slice(-2).find(m => m.isUser)

    // ── v28 对话模式：倾听→回应→邀请，无裁判无胜负，立场可流动 ──
    if (debateMode === 'dialogue') {
      const typeId = selectedTypes[0]
      if (!typeId) {
        streamingRef.current = false
        setIsStreaming(false)
        return
      }
      const profile = mbtiProfiles.find(p => p.id === typeId)
      if (!profile) {
        streamingRef.current = false
        setIsStreaming(false)
        return
      }

      // 取最近用户发言 + 对话历史
      const recentHistory = allMsgs.slice(-6)
        .filter(m => m !== lastUserMsg)
        .map(m => ({
          role: (m.isUser ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
        }))

      setStreamingMessage({
        typeId, typeName: profile.name, typeEmoji: profile.emoji,
        typeColor: profile.color, content: '',
      })

      let response: string
      let understanding = ''
      // v31：本轮结构化识别字段（供状态演化；LLM 解析失败/本地兜底时为空 → 走默认自然演化）
      let parsedIntent: string | undefined
      let parsedTopic: string | undefined
      if (isLLMConfigured()) {
        try {
          const messages = buildDialogueMessages({
            typeId,
            typeName: profile.name,
            userMessage: lastUserMsg?.content || '',
            recentHistory,
            // v31：注入人格当前状态 + 持久记忆——TA 能感知自己的情绪、记得你们之间的事
            state: getStateFor(typeId),
            memory: getMemoryFor(typeId),
          })
          const raw = await chatCompletion(messages, { temperature: 0.85, maxTokens: 600 })
          // v29+v30：解析【理解】+【回应】——先识别用户内容再回应，附带结构化识别字段
          const parsed = parseDialogueResponse(raw)
          understanding = parsed.understanding
          response = parsed.response
          parsedIntent = parsed.meta?.intent
          parsedTopic = parsed.meta?.topic
          // v30：把结构化识别字段（意图/论题/情绪）格式化为徽章文本，拼在思考链开头展示
          const meta = parsed.meta
          if (meta.intent || meta.topic || meta.emotion) {
            const badges: string[] = []
            if (meta.intent) badges.push(`🎯 意图识别：${INTENT_LABELS[meta.intent] ?? meta.intent}`)
            if (meta.topic) badges.push(`📌 核心论题：${meta.topic}`)
            if (meta.emotion) badges.push(`💭 情绪状态：${meta.emotion}`)
            if (badges.length > 0) {
              understanding = badges.join('\n') + '\n' + understanding
            }
          }
        } catch (err) {
          console.warn('[Dialogue] LLM 生成失败，回退本地兜底:', err)
          response = buildDialogueFallback(typeId, profile.name, lastUserMsg?.content || '')
        }
      } else {
        response = buildDialogueFallback(typeId, profile.name, lastUserMsg?.content || '')
      }

      // v29：先展示「识别用户内容」思考链（淡入 800ms），再打字机输出发言
      if (understanding) {
        setStreamingMessage(prev => prev ? { ...prev, thinking: understanding } : null)
        await new Promise<void>(r => { timerRef.current = setTimeout(r, 1000) })
        if (!streamingRef.current) return
      }

      // 打字机流式输出回应部分
      for (let i = 0; i < response.length; i++) {
        if (!streamingRef.current) break
        await new Promise<void>(r => { timerRef.current = setTimeout(r, 25 + Math.random() * 25) })
        if (!streamingRef.current) break
        setStreamingMessage(prev => prev ? { ...prev, content: response.substring(0, i + 1) } : null)
      }
      if (!streamingRef.current) return

      setStreamingMessage(null)

      // ── v31 状态演化：LLM 意图（A-E）驱动情绪/亲密度/新鲜度变化，确定性可回放 ──
      commitPersonaState(updateState(getStateFor(typeId), {
        intent: parsedIntent,
        userText: lastUserMsg?.content || '',
        topic: parsedTopic || topic,
      }))
      // ── v31 记忆沉淀：启发式提取值得记住的内容（偏好/经历/关系信号），跨会话延续 ──
      const candidates = extractMemoryCandidates(lastUserMsg?.content || '')
      if (candidates.length > 0) {
        let nextMem = getMemoryFor(typeId)
        for (const c of candidates) nextMem = addMemory(nextMem, c.text, c.kind)
        commitPersonaMemory(nextMem)
      }

      onBotMessage(typeId, response, undefined, undefined, understanding || undefined)
      speakAiMessage(typeId, response)

      // 对话模式不自动续聊——等用户发下一条消息
      streamingRef.current = false
      setIsStreaming(false)
      return
    }

    // ── v29 辩题识别：所有辩论模式开始前必须先识别辩题 ──
    // arena 模式在其分支内有完整审题流程（prepareFullArena），这里只处理非 arena 模式
    if (!(getArenaMode() && isLLMConfigured()) && !arenaAnalysis) {
      setAnalyzing(true)
      try {
        const analysis = await analyzeTopic(topic, selectedTypes)
        setArenaAnalysis(analysis)
      } catch (err) {
        console.warn('[Debate] 辩题识别失败:', err)
      } finally {
        setAnalyzing(false)
      }
    }

    // ── v25 顶尖辩手模式：LLM 多智能体结构化对抗（开场→质询→自由辩→总结 + AI 裁判）──
    if (getArenaMode() && isLLMConfigured()) {
      try {
        // 首次进入：创建辩论场（立场沿用 sideMapRef 分配，与模板模式一致）
        if (!arenaRef.current) {
          const proTypes = selectedTypes.filter(id => (sideMapRef.current[id] || 'pro') === 'pro')
          const conTypes = selectedTypes.filter(id => (sideMapRef.current[id] || 'pro') === 'con')
          arenaRef.current = createArenaFromTypes(topic, proTypes, conTypes)
        }

        // v26.2 + v27 + v27.2 辩论之前必先审题、必先检索资料、必亮立场：
        // 一步完成「审题 → 检索资料 → 立场宣言」（各自 LLM 优先、本地兜底，来源标记区分）
        if (!arenaRef.current.topicAnalysis || !arenaRef.current.research) {
          setAnalyzing(true)
          setStanceLoading(true)
          arenaRef.current = await prepareFullArena(arenaRef.current)
          setAnalyzing(false)
          setStanceLoading(false)
          setArenaAnalysis(arenaRef.current.topicAnalysis ?? null)
          setArenaResearch(arenaRef.current.research ?? null)
          setArenaStance(arenaRef.current.stance?.length ? arenaRef.current.stance : null)
        }

        // 整场结束 → LLM 裁判裁决（四维评分 + 套话检测 + 胜负判定）
        if (arenaRef.current.finished) {
          const result = await judgeArena(arenaRef.current)
          setArenaJudge(result)
          setShowJudge(true)
          autoRef.current = false
          setAutoOn(false)
          setAutoEnded(true)
          return
        }

        // v31：为当前辩手注入其状态与记忆——TA 带着「此刻的感受」和「记得的事」上场
        const activeDebater = arenaRef.current.debaters[arenaRef.current.activeIndex]
        const { state, speech } = await runNextSpeech(arenaRef.current, {
          state: activeDebater ? getStateFor(activeDebater.typeId) : undefined,
          memory: activeDebater ? getMemoryFor(activeDebater.typeId) : undefined,
        })
        arenaRef.current = state
        if (!speech) {
          autoRef.current = false
          setAutoOn(false)
          setAutoEnded(true)
          return
        }

        const profile = mbtiProfiles.find(p => p.id === speech.typeId)
        setStreamingMessage({ typeId: speech.typeId, typeName: speech.typeName, typeEmoji: profile?.emoji, typeColor: profile?.color, content: '', side: speech.side, thinking: speech.thinking })

        // v28：先展示思考链（淡入 600ms），再打字机输出发言
        if (speech.thinking) {
          await new Promise<void>(r => { timerRef.current = setTimeout(r, 800) })
          if (!streamingRef.current) return
        }

        // 打字机流式输出
        for (let i = 0; i < speech.content.length; i++) {
          if (!streamingRef.current) break
          await new Promise<void>(r => { timerRef.current = setTimeout(r, 25 + Math.random() * 25) })
          if (!streamingRef.current) break
          setStreamingMessage(prev => prev ? { ...prev, content: speech.content.substring(0, i + 1) } : null)
        }
        if (!streamingRef.current) return

        setStreamingMessage(null)
        onBotMessage(speech.typeId, speech.content, undefined, speech.side, speech.thinking)
        // AI 辩手开口说话（人格音色 + 情感语调）
        speakAiMessage(speech.typeId, speech.content)

        // v31：发言后更新该辩手状态——精力随辩论消耗、情绪自然回归（用户刚插话时会被情绪感染）
        commitPersonaState(updateState(getStateFor(speech.typeId), {
          userText: recentUserMsg?.content || '',
          topic: arenaRef.current?.topic || topic,
        }))

        // 自动辩论调度（arena 自身轮转，8 轮赛制）
        if (autoRef.current && !arenaRef.current.finished) {
          autoTimerRef.current = setTimeout(() => startBotRoundRef.current(), 1500 + Math.random() * 1000)
        }
        return
      } catch (err) {
        console.warn('[Arena] 编排失败，回退本地模板引擎:', err)
        // 不 return，继续走下方模板引擎逻辑
      }
    }

    const debateHistory = messagesRef.current.map(m => ({ typeId: m.typeId, content: m.content, isUser: m.isUser, side: m.side as Side | undefined }))
    roundCountRef.current += 1

    // 首次运行时为每位辩手分配固定立场（一半正方一半反方）
    if (Object.keys(sideMapRef.current).length === 0) {
      const half = Math.ceil(selectedTypes.length / 2)
      selectedTypes.forEach((id, idx) => {
        sideMapRef.current[id] = idx < half ? 'pro' : 'con'
      })
    }

    for (const typeId of selectedTypes) {
      if (!streamingRef.current) break
      const profile = mbtiProfiles.find(p => p.id === typeId)
      if (!profile) continue

      await new Promise<void>(r => { timerRef.current = setTimeout(r, 600 + Math.random() * 1200) })
      if (!streamingRef.current) break

      // 实时学习：每次发言前拉取用户书籍 + 历史辩论精华，注入自然语言
      const learning = getLearningMaterial(typeId, topic, 3)
      const side = sideMapRef.current[typeId] || 'pro'

      // ── v31.1 LLM 优先：人格连接 AI——辩手带着人格内核/状态/记忆/立场真实上场辩论 ──
      let result = generateDebateResponse(typeId, topic, debateHistory, { learning, side })
      let llmThinking: string | undefined
      if (isLLMConfigured()) {
        try {
          const opponent = [...debateHistory].reverse().find(m => m.typeId !== typeId && m.content)
          const msgs = [...buildSpeechMessages({
            typeId,
            typeName: profile.name,
            side,
            topic,
            stage: 'free_debate',
            ownSpeechCount: debateHistory.filter(m => m.typeId === typeId).length,
            recentHistory: debateHistory.slice(-6).map(m => `${mbtiProfiles.find(p => p.id === m.typeId)?.name ?? m.typeId}（${m.side === 'pro' ? '正方' : '反方'}）：${m.content}`),
            opponentLatest: opponent
              ? {
                  typeId: opponent.typeId,
                  typeName: mbtiProfiles.find(p => p.id === opponent.typeId)?.name ?? opponent.typeId,
                  side: opponent.side ?? 'pro',
                  content: opponent.content,
                }
              : undefined,
            topicAnalysis: arenaAnalysis?.text ?? undefined,
            research: arenaResearch?.text ?? undefined,
            // v31：注入当前辩手状态 + 记忆——TA 感知自己的情绪，记得你们之间的事
            state: getStateFor(typeId),
            memory: getMemoryFor(typeId),
          })]
          const raw = await chatCompletion(msgs, { temperature: 0.8, maxTokens: 600 })
          const parsed = parseCoT(raw)
          if (parsed.content.trim().length > 0) {
            result = {
              content: parsed.content.trim(),
              confidence: 90,
              detail: { score: 90, logic: 85, persuasion: 85, fun: 80 },
            }
            llmThinking = parsed.thinking || undefined
          }
        } catch (err) {
          console.warn(`[DebateRoom] LLM 发言失败，模板兜底（${typeId}）:`, err)
        }
      }
      debateHistory.push({ typeId, content: result.content, isUser: false, side })

      setStreamingMessage({ typeId, typeName: profile.name, typeEmoji: profile.emoji, typeColor: profile.color, content: '', confidence: result.confidence, side, thinking: llmThinking })

      // 打字机流式输出
      for (let i = 0; i < result.content.length; i++) {
        if (!streamingRef.current) break
        await new Promise<void>(r => { timerRef.current = setTimeout(r, 25 + Math.random() * 25) })
        if (!streamingRef.current) break
        setStreamingMessage(prev => prev ? { ...prev, content: result.content.substring(0, i + 1) } : null)
      }
      if (!streamingRef.current) break

      setStreamingMessage(null)
      onBotMessage(typeId, result.content, result.confidence, side, llmThinking)
      // AI 辩手开口说话（人格音色 + 情感语调；开关关闭时内部直接跳过）
      speakAiMessage(typeId, result.content)
      // v31：发言后更新该辩手状态（模板引擎无意图解析 → 默认自然演化：精力消耗、话题新鲜度衰减）
      commitPersonaState(updateState(getStateFor(typeId), {
        userText: recentUserMsg?.content || '',
        topic,
      }))
      await new Promise<void>(r => { timerRef.current = setTimeout(r, 300) })
    }

    streamingRef.current = false
    setIsStreaming(false)
    setStreamingMessage(null)

    // 自动辩论调度：未被停止/插话打断且未达上限 → 休息片刻继续
    if (autoRef.current) {
      if (roundCountRef.current >= MAX_AUTO_ROUNDS) {
        autoRef.current = false
        setAutoOn(false)
        setAutoEnded(true)
      } else {
        autoTimerRef.current = setTimeout(() => startBotRoundRef.current(), 1500 + Math.random() * 1000)
      }
    }
  }, [selectedTypes, topic, onBotMessage])

  // 同步最新引用（供 auto 定时器与挂载时调用）
  startBotRoundRef.current = startBotRound

  // --- 用户插话：打断当前发言 → 人格回应 → 恢复自动 ---
  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return

    // 打断进行中的流式输出与自动调度
    streamingRef.current = false
    autoRef.current = false
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (autoTimerRef.current) { clearTimeout(autoTimerRef.current); autoTimerRef.current = null }
    setAutoOn(false)
    setIsStreaming(false)
    setStreamingMessage(null)

    onSendMessage(text)
    setInput('')

    // 对话模式：仅触发一次人格回应，不自动续辩
    if (debateMode === 'dialogue') {
      setTimeout(() => {
        startBotRoundRef.current()
      }, 400)
    } else {
      // 人格回应用户插话（一轮），随后继续自动辩论
      setTimeout(() => {
        autoRef.current = true
        setAutoOn(true)
        setAutoEnded(false)
        startBotRoundRef.current()
      }, 400)
    }
  }, [input, onSendMessage, debateMode])

  // --- 停止自动辩论 ---
  const handleStop = useCallback(() => {
    streamingRef.current = false
    autoRef.current = false
    setAutoOn(false)
    setIsStreaming(false)
    setStreamingMessage(null)
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (autoTimerRef.current) { clearTimeout(autoTimerRef.current); autoTimerRef.current = null }
  }, [])

  // --- 手动续辩 ---
  const handleResume = useCallback(() => {
    autoRef.current = true
    setAutoOn(true)
    setAutoEnded(false)
    startBotRoundRef.current()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const participantProfiles = selectedTypes.map(id => mbtiProfiles.find(p => p.id === id)!).filter(Boolean)
  const currentMode = debateModes.find(m => m.id === debateMode)

  // 裁判五维评分（实时计算；v25 arena 模式优先展示 LLM 裁判结果）
  const judgeScores = judgeDebate(messages)
  const displayScores = arenaJudge && arenaJudge.scores.length > 0 ? arenaJudge.scores : judgeScores

  // v33 生成辩论报告：收集本场数据（arena 优先 / 模板兜底）→ 打开报告模态
  const handleGenerateReport = () => {
    let input: ReportInput
    if (arenaJudge && arenaRef.current) {
      // arena 模式：完整 ArenaSpeech 历史 + AI 裁判结果 + 立场/审题/资料
      input = {
        topic,
        speeches: toReportSpeechesFromArena(arenaRef.current.history),
        judge: toReportJudgeFromArena(arenaJudge),
        stances: toReportStances(arenaRef.current.stance),
        analysis: arenaAnalysis?.text,
        research: arenaResearch?.text,
      }
    } else {
      // 模板模式：Message[] + 本地裁判评分
      const topScore = displayScores.length > 0
        ? [...displayScores].sort((a, b) => b.total - a.total)[0]
        : null
      input = {
        topic,
        speeches: toReportSpeechesFromMessages(messages),
        judge: topScore ? {
          scores: displayScores,
          winner: topScore.name,
          verdict: `${topScore.name} 以总分 ${topScore.total} 领先`,
          source: 'template' as const,
        } : undefined,
      }
    }
    setReportInput(input)
    setShowReport(true)
  }

  return (
    <div className="h-full flex">
      {/* 主辩论区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部栏 */}
        <header className="px-4 py-3 flex items-center gap-3 shrink-0 border-b" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{topic || '请选择话题'}</h2>
              {autoOn && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
                  <Zap size={10} className="animate-pulse" /> 自动辩论中
                </span>
              )}
              {autoEnded && (
                <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                  ⏸ 告一段落
                </span>
              )}
            </div>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {participantProfiles.map(p => {
                const label = getMindLabel(p.id)
                return (
                  <span key={p.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1"
                    style={{ background: `${p.color}20`, color: p.color }}>
                    {p.emoji} {p.id}
                    {label && <span className="opacity-60 ml-0.5">{label.thinking.slice(0, 2)}</span>}
                  </span>
                )
              })}
            </div>
          </div>

          {/* 模式切换 */}
          <div className="flex gap-1">
            {debateModes.map(m => (
              <button key={m.id} onClick={() => setDebateMode(m.id)}
                className="p-1.5 rounded-md text-xs transition-all tooltip"
                data-tooltip={m.name}
                style={debateMode === m.id
                  ? { background: 'var(--color-accent-light)', color: 'var(--color-accent)' }
                  : { color: 'var(--color-text-tertiary)' }}
                aria-label={`辩论模式：${m.name}`} title={m.description}>
                {m.emoji}
              </button>
            ))}
          </div>

          {/* 反射开关 */}
          <button onClick={() => setShowReflection(v => !v)}
            className="p-1.5 rounded-md transition-colors relative"
            style={{ color: showReflection ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
            aria-label="切换反思面板">
            <Brain size={16} />
            {reflections.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-accent)' }} />
            )}
          </button>

          <button onClick={() => setShowConfidence(v => !v)}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: showConfidence ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
            aria-label="切换确信度面板">
            <TrendingUp size={16} />
          </button>

          {/* 裁判评分（对话模式无裁判） */}
          {debateMode !== 'dialogue' && (
            <button onClick={() => setShowJudge(v => !v)}
              className="p-1.5 rounded-md transition-colors relative"
              style={{ color: showJudge ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
              aria-label="切换裁判评分">
              <Scale size={16} />
              {messages.some(m => !m.isUser) && !showJudge && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-accent)' }} />
              )}
            </button>
          )}

          {/* AI 语音播报开关 */}
          <button onClick={() => { const v = !voiceOn; setVoiceOn(v); setAiVoiceEnabled(v) }}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: voiceOn ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
            aria-label={voiceOn ? '关闭 AI 语音播报' : '开启 AI 语音播报'}
            title={voiceOn ? 'AI 语音播报已开启，点击关闭' : 'AI 语音播报已关闭，点击开启'}>
            {voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <button onClick={toggleTheme} className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--color-text-tertiary)' }} aria-label="切换主题">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>

        {/* 模式描述 */}
        {currentMode && (
          <div className="px-4 py-2 text-xs flex items-center gap-2 border-b" style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
            <span>{currentMode.emoji}</span>
            <span className="font-medium">{currentMode.name}模式</span>
            <span>· {currentMode.description}</span>
            <span className="ml-auto flex items-center gap-2">
              {autoOn && <span className="inline-flex items-center gap-1" style={{ color: 'var(--color-accent)' }}><Zap size={10} /> 人格自主辩论中，随时插话</span>}
              {autoEnded && <span>本场自动辩论已告一段落</span>}
              <span className="opacity-50">第 {roundCountRef.current} 轮</span>
            </span>
          </div>
        )}

        {/* v31 人格状态卡：情绪 / 精力 / 亲密度 / 话题新鲜度——每轮对话后实时演化，重置即清空状态与记忆 */}
        {participantProfiles.length > 0 && (
          <div className="px-4 py-2 flex gap-2 overflow-x-auto border-b shrink-0"
            style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
            aria-label="人格实时状态">
            {participantProfiles.map(p => {
              const st = personaStates[p.id]
              if (!st) return null
              const mem = personaMemories[p.id]
              const mood = moodEmoji(st)
              return (
                <div key={p.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border shrink-0 min-w-[168px] animate-fade-in"
                  style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}>
                  <span className="text-lg shrink-0" aria-hidden="true">{mood}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold shrink-0" style={{ color: p.color }}>{p.emoji} {p.id}</span>
                      <span className="text-[9px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
                        {describeMood(st)} · {energyLabel(st.energy)}
                      </span>
                    </div>
                    {/* 精力条 */}
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[8px] w-6 shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>精力</span>
                      <div className="h-1 rounded-full flex-1" style={{ background: 'var(--color-bg-secondary)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.round(st.energy * 100)}%`, background: st.energy > 0.45 ? 'var(--color-accent)' : 'var(--color-warning)' }} />
                      </div>
                      <span className="text-[8px] w-7 text-right tabular-nums shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>{Math.round(st.energy * 100)}%</span>
                    </div>
                    {/* 亲密度 / 新鲜度 / 记忆条数 / 重置 */}
                    <div className="flex items-center gap-1 mt-0.5 text-[8px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      <span>💞 {intimacyLabel(st.intimacy)}</span>
                      <span>·</span>
                      <span>✨ {noveltyLabel(st.novelty)}</span>
                      {mem && mem.entries.length > 0 && (
                        <span title={mem.entries.map(e => e.text).join('；')}>· 🧠 {mem.entries.length}条</span>
                      )}
                      <button
                        onClick={() => resetPersona(p.id)}
                        className="ml-auto text-[8px] px-1 py-0.5 rounded hover:opacity-70 transition-opacity"
                        style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' }}
                        title="清空 TA 的状态与记忆，回到初次相识" aria-label={`重置 ${p.id} 的状态与记忆`}>
                        重置
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto py-2" role="log" aria-label="辩论消息列表" aria-live="polite">
          {messages.length === 0 && !isStreaming && (
            <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-text-tertiary)' }}>
              <div className="text-center">
                <div className="flex justify-center mb-3"><div className="thinking-orb" aria-hidden="true" /></div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>辩论即将开始...</p>
                <p className="text-xs mt-1">人格们将自主辩论，你可以随时插话</p>
                <div className="flex gap-1.5 justify-center mt-3 flex-wrap">
                  {participantProfiles.map(p => (
                    <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${p.color}15`, color: p.color }}>
                      {p.emoji} {p.id}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AI 思考循环（等待沉浸化）：流式生成间隙展示 */}
          {isStreaming && !streamingMessage && (
            <div className="flex items-center gap-3 px-5 py-3 animate-fade-in">
              <div className="thinking-orb" aria-hidden="true" />
              <div>
                <div className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>辩手思考中…</div>
                <div className="thinking-dots mt-1" aria-hidden="true"><span /><span /><span /></div>
              </div>
            </div>
          )}

          {/* v29 审题环节：所有辩论模式开始前必先审题（全场共识） */}
          {(analyzing || arenaAnalysis) && (
            <>
              {analyzing && (
                <div className="flex items-center gap-3 px-5 py-3 animate-fade-in">
                  <div className="thinking-orb" aria-hidden="true" />
                  <div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>🧐 审题中：AI 分析师正在拆解辩题…</div>
                    <div className="thinking-dots mt-1" aria-hidden="true"><span /><span /><span /></div>
                  </div>
                </div>
              )}
              {arenaAnalysis && !analyzing && (
                <div className="mx-4 my-3 p-3 rounded-xl border animate-fade-in"
                  style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>📋 审题报告</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{ background: arenaAnalysis.source === 'llm' ? 'var(--color-accent-light)' : 'var(--color-bg-secondary)', color: arenaAnalysis.source === 'llm' ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                      {arenaAnalysis.source === 'llm' ? '🤖 AI 深度审题' : '⚙️ 本地快速审题'}
                    </span>
                    <span className="ml-auto text-[9px]" style={{ color: 'var(--color-text-tertiary)' }}>全场共识 · 发言不得偏离</span>
                  </div>
                  <div className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                    {arenaAnalysis.text}
                  </div>
                </div>
              )}

              {/* v27 资料检索环节：审题之后检索辩题资料（arena 模式置顶展示，全员可引用） */}
              {researching && (
                <div className="flex items-center gap-3 px-5 py-3 animate-fade-in">
                  <div className="thinking-orb" aria-hidden="true" />
                  <div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>🔎 检索中：AI 研究员正在收集辩题资料…</div>
                    <div className="thinking-dots mt-1" aria-hidden="true"><span /><span /><span /></div>
                  </div>
                </div>
              )}
              {arenaResearch && !researching && (
                <div className="mx-4 my-3 p-3 rounded-xl border animate-fade-in"
                  style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>📚 资料包</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{ background: arenaResearch.source === 'llm' ? 'var(--color-accent-light)' : 'var(--color-bg-secondary)', color: arenaResearch.source === 'llm' ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                      {arenaResearch.source === 'llm' ? '🤖 AI 深度检索' : '⚙️ 本地快速检索'}
                    </span>
                    <span className="ml-auto text-[9px]" style={{ color: 'var(--color-text-tertiary)' }}>可引用 · 引用须标注来源</span>
                  </div>
                  <div className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                    {arenaResearch.text}
                  </div>
                </div>
              )}

              {/* v27.2 立场宣言：开赛前每人先亮明「我认为……」——置顶展示，双方并排 */}
              {stanceLoading && (
                <div className="flex items-center gap-3 px-5 py-3 animate-fade-in">
                  <div className="thinking-orb" aria-hidden="true" />
                  <div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>📣 立场宣言中：各位辩手正在亮明「我认为…」…</div>
                    <div className="thinking-dots mt-1" aria-hidden="true"><span /><span /><span /></div>
                  </div>
                </div>
              )}
              {arenaStance && arenaStance.length > 0 && !stanceLoading && (
                <div className="mx-4 my-3 p-3 rounded-xl border animate-fade-in"
                  style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>📣 立场宣言</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
                      开赛前亮明「我认为…」
                    </span>
                    <span className="ml-auto text-[9px]" style={{ color: 'var(--color-text-tertiary)' }}>立场已锁定 · 全赛程不得倒戈</span>
                  </div>
                  <div className="space-y-2">
                    {arenaStance.map(s => {
                      const profile = mbtiProfiles.find(p => p.id === s.typeId)
                      const sideName = sideLabels[s.side]
                      return (
                        <div key={s.typeId} className="p-2.5 rounded-lg border"
                          style={{
                            background: 'var(--color-bg-secondary)',
                            borderColor: 'var(--color-border)',
                            borderLeft: `3px solid ${s.side === 'pro' ? 'var(--color-accent)' : 'var(--color-danger)'}`,
                          }}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-sm" aria-hidden="true">{profile?.emoji || '🤖'}</span>
                            <span className="text-[11px] font-bold"
                              style={{ color: s.side === 'pro' ? 'var(--color-accent)' : 'var(--color-danger)' }}>
                              {s.typeName}（{s.typeId}）
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                              style={{
                                background: s.side === 'pro' ? 'var(--color-accent-light)' : 'var(--color-danger-light)',
                                color: s.side === 'pro' ? 'var(--color-accent)' : 'var(--color-danger)',
                              }}>
                              {sideName}
                            </span>
                            <span className="ml-auto text-[9px]" style={{ color: 'var(--color-text-tertiary)' }}>
                              {s.source === 'llm' ? '🤖 AI 宣言' : '⚙️ 本地宣言'}
                            </span>
                          </div>
                          <div className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                            {s.content}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} isLast={false} />
          ))}

          {streamingMessage && streamingMessage.content !== undefined && (
            <ChatMessage
              message={{
                id: 'streaming', typeId: streamingMessage.typeId || '',
                typeName: streamingMessage.typeName || '', typeEmoji: streamingMessage.typeEmoji || '',
                typeColor: streamingMessage.typeColor || '', content: streamingMessage.content || '',
                timestamp: Date.now(), confidence: streamingMessage.confidence, side: streamingMessage.side,
                thinking: streamingMessage.thinking,
              }}
              isLast={true}
            />
          )}
          {/* v33 辩论报告入口：裁判判定后（或模板模式告一段落）一键生成结构化报告 */}
          {debateMode !== 'dialogue' && !isStreaming && (arenaJudge || (autoEnded && displayScores.length > 0)) && (
            <div className="flex justify-center py-4 animate-fade-in">
              <button
                onClick={handleGenerateReport}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
                style={{ background: 'linear-gradient(135deg, var(--color-accent), #ad8fe8)' }}
                aria-label="生成辩论报告">
                <FileText size={18} /> 生成辩论报告
              </button>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区（插话区） */}
        <div className="p-4 border-t" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
          <div className="flex gap-3 items-end">
            {/* 语音输入（开口即插话） */}
            <VoiceInput
              onResult={text => setInput(prev => (prev ? prev + text : text))}
              isRecording={recording}
              setIsRecording={setRecording}
            />
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={debateMode === 'dialogue'
                ? '分享你的想法或感受，TA 会倾听并回应你（Enter 发送）'
                : autoOn
                  ? '插话：输入你的观点，人格们会停下听你说（Enter 发送）'
                  : '输入你的观点（Enter 发送，Shift+Enter 换行）'}
              className="input-field text-sm resize-none h-12 flex-1"
              aria-label="输入你的观点"
              rows={1}
            />
            <div className="flex gap-2">
              {isStreaming ? (
                <>
                  {/* 辩论进行中：可插话或停止 */}
                  <button onClick={handleSend} disabled={!input.trim()}
                    className="p-3 rounded-xl transition-all active:scale-95 disabled:opacity-40 btn-sheen"
                    style={{ background: 'var(--color-warning)', color: '#fff' }}
                    title="打断并插话" aria-label="插话">
                    <Send size={18} />
                  </button>
                  <button onClick={handleStop} className="p-3 rounded-xl transition-colors" style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)' }} aria-label="停止辩论">
                    <StopCircle size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleSend} disabled={!input.trim()}
                    className="p-3 rounded-xl text-white transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: 'var(--color-accent)' }} aria-label="发送消息">
                    <Send size={18} />
                  </button>
                  {debateMode !== 'dialogue' && (
                    <button onClick={handleResume}
                      className={clsx('p-3 rounded-xl transition-all', autoEnded ? '' : '')}
                      style={{ background: autoOn ? 'var(--color-bg-tertiary)' : 'var(--color-accent-light)', color: autoOn ? 'var(--color-text-secondary)' : 'var(--color-accent)' }}
                      title={autoOn ? '重新开始一轮' : '继续自动辩论'} aria-label="继续辩论">
                      <RotateCcw size={18} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {autoOn && (
            <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
              <Zap size={9} style={{ color: 'var(--color-accent)' }} /> 人格正在自主辩论 · 输入内容并按 Enter 即可插话打断
            </p>
          )}
        </div>
      </div>

      {/* 右侧面板整合：裁判评分 + 反思 + 确信度 */}
      {(showJudge || showReflection || showConfidence) && (
        <aside className="w-64 border-l flex flex-col shrink-0" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }} aria-label="信息面板">
          {/* 裁判评分面板（v21） */}
          {showJudge && (
            <>
              <div className="p-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="text-xs font-bold uppercase flex items-center gap-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  <Scale size={14} /> 裁判评分
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {arenaJudge && arenaJudge.source === 'llm' && (
                  <div className="p-2.5 rounded-lg text-[11px] leading-relaxed" style={{ background: 'var(--color-accent-light)', color: 'var(--color-text)' }}>
                    <div className="font-bold mb-1" style={{ color: 'var(--color-accent)' }}>🏆 {arenaJudge.verdict}</div>
                    <div className="opacity-70">AI 裁判 · 五维评分 + 对抗三维度（交锋/深度/致命）+ 套话检测（密度 &gt;10% 记无效发言）</div>
                  </div>
                )}
                {displayScores.length === 0 && (
                  <div className="text-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>
                    <span className="text-xs">辩论进行中，裁判正在观察...</span>
                  </div>
                )}
                {displayScores.map((js, i) => (
                  <div key={js.typeId} className="animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text-tertiary)' }}>#{i + 1}</span>
                      <div className="avatar avatar-sm" style={{ background: js.color, color: '#fff' }}>{js.emoji}</div>
                      <span className="text-sm font-bold flex-1 truncate" style={{ color: js.color }}>{js.name}</span>
                      <span className="text-sm font-bold" style={{ color: js.color }}>{js.total}</span>
                    </div>

                    {/* 五维评分条 */}
                    {[
                      { label: '逻辑', v: js.logic },
                      { label: '论据', v: js.evidence },
                      { label: '反驳', v: js.rebuttal },
                      { label: '表达', v: js.clarity },
                      { label: '风度', v: js.demeanor },
                    ].map(dim => (
                      <div key={dim.label} className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] w-7 text-right shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>{dim.label}</span>
                        <div className="neon-bar-track flex-1">
                          <div className="neon-bar-fill" style={{ width: `${dim.v}%` }} />
                        </div>
                        <span className="text-[9px] w-6 tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>{dim.v}</span>
                      </div>
                    ))}

                    {/* v26 对抗质量三维度（0-10 分制，仅 AI 裁判） */}
                    {js.engagement !== undefined && (
                      [
                        { label: '交锋', v: js.engagement },
                        { label: '深度', v: js.depth ?? 0 },
                        { label: '致命', v: js.kill ?? 0 },
                      ].map(dim => (
                        <div key={dim.label} className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] w-7 text-right shrink-0" style={{ color: 'var(--color-accent)' }}>{dim.label}</span>
                          <div className="neon-bar-track flex-1">
                            <div className="neon-bar-fill" style={{ width: `${dim.v * 10}%`, background: 'var(--color-accent)' }} />
                          </div>
                          <span className="text-[9px] w-6 tabular-nums" style={{ color: 'var(--color-accent)' }}>{dim.v}</span>
                        </div>
                      ))
                    )}

                    <p className="text-[10px] mt-1.5 px-2 py-1 rounded-md" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                      💬 {js.comment}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 反思面板 */}
          {showReflection && reflections.length > 0 && (
            <div className="border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="p-3 flex items-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
                <Brain size={14} style={{ color: 'var(--color-accent)' }} />
                <h3 className="text-xs font-bold uppercase" style={{ color: 'var(--color-text-tertiary)' }}>
                  🪞 人格自我反思
                </h3>
              </div>
              <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                {reflections.map((ref, i) => (
                  <div key={i} className="text-[11px] p-2 rounded-lg animate-fade-in" style={{ background: 'var(--color-bg-tertiary)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span>{ref.typeEmoji}</span>
                      <span className="font-bold" style={{ color: ref.typeColor }}>{ref.typeId}</span>
                      <Sparkles size={10} style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)' }} className="leading-relaxed">{ref.content}</p>
                    {ref.revisedStance && (
                      <p className="mt-1 text-[10px] italic" style={{ color: 'var(--color-accent)' }}>{ref.revisedStance}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 确信度排名面板 */}
          {showConfidence && (
            <>
              <div className="p-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="text-xs font-bold uppercase flex items-center gap-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  <TrendingUp size={14} /> 确信度排名
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {[...confidenceScores]
                  .sort((a, b) => b.score - a.score)
                  .map((cs, i) => {
                    const mindLabel = getMindLabel(cs.typeId)
                    return (
                      <div key={cs.typeId} className="animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-lg font-mono font-bold" style={{ color: 'var(--color-text-tertiary)' }}>#{i + 1}</span>
                          <div className="avatar avatar-sm" style={{ background: cs.color, color: '#fff' }}>{cs.emoji}</div>
                          <span className="text-sm font-bold flex-1 truncate" style={{ color: 'var(--color-text)' }}>{cs.name}</span>
                          <span className="text-xs font-bold" style={{ color: cs.color }}>{cs.score}%</span>
                        </div>

                        {/* 确信度条 */}
                        <div className="h-1.5 rounded-full mb-2" style={{ background: 'var(--color-bg-tertiary)' }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${cs.score}%`, background: cs.color }} />
                        </div>

                        {/* 认知风格标签 */}
                        {mindLabel && (
                          <div className="flex gap-1 mb-1.5 flex-wrap">
                            <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
                              {mindLabel.thinking}
                            </span>
                            <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
                              {mindLabel.info}
                            </span>
                          </div>
                        )}

                        {/* 子评分 */}
                        <div className="grid grid-cols-3 gap-1 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                          {cs.logic !== undefined && <span>🧠 {cs.logic}</span>}
                          {cs.persuasion !== undefined && <span>💪 {cs.persuasion}</span>}
                          {cs.fun !== undefined && <span>🎯 {cs.fun}</span>}
                        </div>
                      </div>
                    )
                  })}

                {confidenceScores.length === 0 && (
                  <div className="text-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>
                    <span className="text-xs">等待辩论开始...</span>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      )}

      {/* v33 辩论报告模态：全屏 Markdown 报告 + 复制/下载/重新生成 */}
      {showReport && reportInput && (
        <DebateReport input={reportInput} onClose={() => setShowReport(false)} />
      )}
    </div>
  )
}
