import { useState, useRef, useEffect, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { Message } from '../types'
import { mbtiProfiles } from '../data/mbtiProfiles'
import { personalitySystems } from '../data/personalitySystem'
import { generateDebateResponse } from '../utils/debateEngine'
import { getLearningMaterial } from '../utils/learningStore'
import { PERSONA_SOURCES } from '../utils/debatePrompts'
// v31.1：人格连接 AI LLM——1v1 对话同样接入大模型，人格驱动 LLM 说话（未配置时本地模板兜底）
import { isLLMConfigured, chatCompletion, type LLMMessage } from '../utils/llmClient'
import { buildDialogueMessages, parseDialogueResponse, INTENT_LABELS } from '../data/dialogueMode'
import { extractAdviceFromResponse } from '../data/pathAdviceRules'
// v31：人格状态引擎 + 持久记忆（1v1 对话同样拥有「内心状态」与「跨会话记忆」）
import { createInitialState, getOrInitState, updateState, savePersonaState, clearPersonaState, describeMood, moodEmoji, energyLabel, intimacyLabel, noveltyLabel, type PersonaState } from '../utils/personaEngine'
import { createEmptyMemory, getOrInitMemory, addMemory, savePersonaMemory, clearPersonaMemory, extractMemoryCandidates, MEMORY_KIND_LABELS, type PersonaMemory } from '../utils/personaMemory'
import { recommendedTopics, randomTopic } from '../data/recommendedTopics'
// v32：多领域知识库 RAG——1v1 深度交流接入本地知识库检索（提问科普 + 引用来源）
import { retrieveForQuery, getGlobalStats } from '../utils/knowledgeBase'
// v34：视频知识（全局共享）——收藏的科普视频提炼文字，对话时人格也能引用
import { searchVideos, buildVideoKnowledgeSection } from '../utils/videoKnowledge'
// v38：每日新闻知识（全局共享）——每日自动学习的时事热点，对话时人格也能引用
import { searchNews, buildNewsKnowledgeSection } from '../utils/newsKnowledge'
import type { KnowledgeSource } from '../types'
import { MessageCircle, Send, RotateCcw, Save, Sparkles, ChevronLeft, Lightbulb, BookOpen } from 'lucide-react'
import clsx from 'clsx'
import { PathAdviceCard } from './PathAdviceCard'

interface PersonaChatProps {
  onSaveSession: (topic: string, participants: string[], messages: Message[], mode: 'duel') => void
}

type ChatPhase = 'select' | 'setup' | 'chat'

const STORAGE_KEY = 'mbti_persona_chat_v1'

export function PersonaChat({ onSaveSession }: PersonaChatProps) {
  const [phase, setPhase] = useState<ChatPhase>('select')
  const [personaId, setPersonaId] = useState<string>('')
  const [topic, setTopic] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  // v31.1：LLM 回应的流式打字机文本（逐字渲染，体验与辩论室一致）
  const [streamingText, setStreamingText] = useState('')
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // v32 知识库状态（setup 页展示：已导入领域/块数，提醒配置知识库）
  const [kbStats, setKbStats] = useState<{ docCount: number; chunkCount: number } | null>(null)
  useEffect(() => {
    getGlobalStats().then(s => setKbStats(s)).catch(() => setKbStats(null))
  }, [])

  // ── v31 人格状态 + 记忆（跟随选中人格加载；ref 保证 setTimeout 回调中拿到最新值）──
  const [personaState, setPersonaState] = useState<PersonaState | null>(null)
  const [personaMemory, setPersonaMemory] = useState<PersonaMemory | null>(null)
  const stateRef = useRef<PersonaState | null>(null)
  const memoryRef = useRef<PersonaMemory | null>(null)

  useEffect(() => {
    if (!personaId) return
    const st = getOrInitState(personaId)
    const mem = getOrInitMemory(personaId)
    stateRef.current = st
    memoryRef.current = mem
    setPersonaState(st)
    setPersonaMemory(mem)
  }, [personaId])

  // 提交状态/记忆（ref + React state + localStorage 三同步，跨会话延续）
  const commitState = (st: PersonaState) => {
    stateRef.current = st
    setPersonaState(st)
    savePersonaState(st)
  }
  const commitMemory = (mem: PersonaMemory) => {
    memoryRef.current = mem
    setPersonaMemory(mem)
    savePersonaMemory(mem)
  }

  // 清空状态与记忆（回到「初次相识」）
  const handleResetPersona = () => {
    if (!personaId) return
    clearPersonaState(personaId)
    clearPersonaMemory(personaId)
    commitState(createInitialState(personaId))
    commitMemory(createEmptyMemory(personaId))
  }

  const persona = mbtiProfiles.find(p => p.id === personaId)
  const system = personaId ? personalitySystems[personaId] : null

  // 恢复上次会话
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.personaId && mbtiProfiles.some(p => p.id === data.personaId)) {
          setPersonaId(data.personaId)
          if (data.topic) setTopic(data.topic)
          if (data.messages?.length > 0) {
            setMessages(data.messages)
            setPhase('chat')
          } else {
            setPhase('setup')
          }
        }
      }
    } catch { /* 忽略损坏的存储 */ }
  }, [])

  // 持久化当前会话
  useEffect(() => {
    if (personaId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ personaId, topic, messages }))
    }
  }, [personaId, topic, messages])

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  // 离开页面时自动保存（往来辩论接入战斗记录）
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const savedRef = useRef(saved)
  savedRef.current = saved
  useEffect(() => {
    return () => {
      if (messagesRef.current.length >= 2 && !savedRef.current) {
        autoSave(messagesRef.current)
      }
    }
  }, [])

  const autoSave = useCallback((msgs: Message[]) => {
    if (msgs.length === 0) return
    onSaveSession(topic, [personaId, 'me'], [...msgs], 'duel')
    setSaved(true)
  }, [onSaveSession, personaId, topic])

  const handleSend = async () => {
    const content = input.trim()
    if (!content || typing) return

    const userMsg: Message = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      typeId: 'me', typeName: '你', typeEmoji: '🧑', typeColor: 'var(--color-accent)',
      content, timestamp: Date.now(), isUser: true,
    }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setTyping(true)
    setSaved(false)

    const history = updated.map(m => ({ typeId: m.typeId, content: m.content, isUser: m.isUser }))
    const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

    // v32：本地知识库检索——按提问内容路由领域 + BM25 检索 top-k 片段（失败不阻塞对话）
    let rag: import('../utils/knowledgeBase/rag').RagContext | null = null
    try {
      rag = await retrieveForQuery(content, 4)
    } catch (err) {
      console.warn('[PersonaChat] 知识库检索失败（继续对话）:', err)
    }
    const sources: KnowledgeSource[] | undefined = rag && rag.hits.length > 0
      ? rag.hits.slice(0, 3).map(h => ({
          title: h.title,
          fileName: h.fileName,
          text: h.text,
          domainId: rag.domainId,
          domainName: rag.domainName,
          domainEmoji: rag.domainEmoji,
          domainColor: rag.domainColor,
        }))
      : undefined

    // v34：视频知识检索（全局共享）——收藏的科普视频提炼文字，对话时人格自然引用
    let videoKnowledge: string | null = null
    let videoSources: KnowledgeSource[] = []
    try {
      const vHits = await searchVideos(content, 3)
      if (vHits.length > 0) {
        videoKnowledge = buildVideoKnowledgeSection(vHits)
        videoSources = vHits.slice(0, 3).map(h => ({
          title: h.title,
          fileName: h.title,
          text: h.text,
          domainId: 'videos',
          domainName: '视频收藏',
          domainEmoji: '📺',
          domainColor: '#e897b5',
        }))
      }
    } catch (err) {
      console.warn('[PersonaChat] 视频知识检索失败（跳过）:', err)
    }
    // v38：每日新闻检索（全局共享）——人格对话时引用时事热点
    let newsKnowledge: string | null = null
    let newsSources: KnowledgeSource[] = []
    try {
      const nHits = await searchNews(content, 3)
      if (nHits.length > 0) {
        newsKnowledge = buildNewsKnowledgeSection(nHits)
        newsSources = nHits.slice(0, 3).map(h => ({
          title: h.title,
          fileName: h.title,
          text: h.text,
          domainId: 'news',
          domainName: '今日新闻',
          domainEmoji: '📰',
          domainColor: '#f59e0b',
        }))
      }
    } catch (err) {
      console.warn('[PersonaChat] 新闻知识检索失败（跳过）:', err)
    }
    // 合并参考来源：知识库优先，视频知识 + 新闻追加在后
    const allSources: KnowledgeSource[] | undefined = [...(sources ?? []), ...videoSources, ...newsSources].length > 0
      ? [...(sources ?? []), ...videoSources, ...newsSources]
      : undefined

    let aiMsg: Message | null = null
    try {
      // ── v31.1 LLM 优先：人格连接 AI——TA 以人格身份调用大模型，带着状态与记忆说话 ──
      if (isLLMConfigured()) {
        const recentHistory = updated
          .filter(m => m !== userMsg)
          .slice(-4)
          .map(m => ({
            role: (m.isUser ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content,
          }))
        const msgs: LLMMessage[] = buildDialogueMessages({
          typeId: personaId,
          typeName: persona?.name || personaId,
          userMessage: content,
          recentHistory,
          // 注入人格当前状态 + 持久记忆——TA 感知自己的情绪，记得你们之间的事
          state: stateRef.current ?? undefined,
          memory: memoryRef.current ?? undefined,
          // v32：注入知识库检索上下文——TA 的回答有据可依，能科普能溯源
          rag: rag ?? undefined,
          // v34：注入视频知识——TA「学过」收藏的科普视频，对话时自然引用
          videoKnowledge: videoKnowledge ?? undefined,
          // v38：注入今日新闻——TA「了解」最新时事，对话时自然引用
          newsKnowledge: newsKnowledge ?? undefined,
        })
        const raw = await chatCompletion(msgs, { temperature: 0.85, maxTokens: 700 })
        // 解析【理解】+【回应】——先识别用户内容再回应（v29/v30 语义）
        const parsed = parseDialogueResponse(raw)
        // v33：从回应中分离「路径建议」块（仅困境/决策类问题才有）——正文进气泡，路径进卡片
        const { response: cleanResponse, advice } = extractAdviceFromResponse(parsed.response)
        let understanding = parsed.understanding
        // 结构化识别字段（意图/论题/情绪）→ 徽章文本，拼在思考链开头展示
        const meta = parsed.meta
        if (meta.intent || meta.topic || meta.emotion) {
          const badges: string[] = []
          if (meta.intent) badges.push(`🎯 意图识别：${INTENT_LABELS[meta.intent] ?? meta.intent}`)
          if (meta.topic) badges.push(`📌 核心论题：${meta.topic}`)
          if (meta.emotion) badges.push(`💭 情绪状态：${meta.emotion}`)
          if (badges.length > 0) understanding = badges.join('\n') + '\n' + understanding
        }
        // v32：回答若引用了知识库，在思考链里标注路由到的领域
        if (rag) {
          const routeLine = `📚 知识库：${rag.domainEmoji} ${rag.domainName}（命中 ${rag.hits.length} 条资料${rag.isFallback ? ' · 兜底路由' : ''}）`
          understanding = understanding ? routeLine + '\n' + understanding : routeLine
        }
        // v33：若识别到困境拆解，在思考链里标注（让用户知道 TA 给了路径建议）
        if (advice) {
          const adviceLine = `🧭 困境识别：给出 ${advice.paths.length} 条行动路径 + 风险提示`
          understanding = understanding ? adviceLine + '\n' + understanding : adviceLine
        }
        // 流式打字机输出回应（v33：用剥离路径块后的纯对话文本，路径单独渲染为卡片）
        for (let i = 1; i <= cleanResponse.length; i++) {
          setStreamingText(cleanResponse.substring(0, i))
          await sleep(15 + Math.random() * 15)
        }
        aiMsg = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          typeId: personaId,
          typeName: persona?.name || personaId,
          typeEmoji: persona?.emoji || '💬',
          typeColor: persona?.color || '#888',
          content: cleanResponse,
          timestamp: Date.now(),
          thinking: understanding || undefined,
          sources: allSources,
          advice: advice ?? undefined,
        }
        // v31：状态演化——LLM 意图（A-E）驱动情绪/亲密度/新鲜度变化，确定性可回放
        if (stateRef.current) {
          commitState(updateState(stateRef.current, {
            intent: meta?.intent,
            userText: content,
            topic: meta?.topic || topic,
          }))
        }
      } else {
        // 未配置 LLM → 本地模板引擎兜底（延迟模拟思考）
        await sleep(500 + Math.random() * 700)
        const learning = getLearningMaterial(personaId, topic, 3)
        const response = generateDebateResponse(personaId, topic, history, { learning })
        aiMsg = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          typeId: personaId,
          typeName: persona?.name || personaId,
          typeEmoji: persona?.emoji || '💬',
          typeColor: persona?.color || '#888',
          content: response.content,
          timestamp: Date.now(),
          confidence: response.confidence,
          // v32：未接 LLM 时也把检索到的知识库片段展示给用户（可读原始资料）
          sources: allSources,
        }
        // v31：状态演化（默认自然演化 + 情绪词感染 + 自我披露升温关系）
        if (stateRef.current) {
          commitState(updateState(stateRef.current, { userText: content, topic }))
        }
      }
    } catch (err) {
      console.warn('[PersonaChat] LLM 生成失败，回退本地兜底:', err)
      await sleep(400)
      const learning = getLearningMaterial(personaId, topic, 3)
      const response = generateDebateResponse(personaId, topic, history, { learning })
      aiMsg = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        typeId: personaId,
        typeName: persona?.name || personaId,
        typeEmoji: persona?.emoji || '💬',
        typeColor: persona?.color || '#888',
        content: response.content,
        timestamp: Date.now(),
        confidence: response.confidence,
        sources: allSources,
      }
      if (stateRef.current) {
        commitState(updateState(stateRef.current, { userText: content, topic }))
      }
    }

    // v31：记忆沉淀（LLM / 模板都执行——启发式提取偏好/经历/关系信号，TA 会一直记得）
    const candidates = extractMemoryCandidates(content)
    if (candidates.length > 0 && memoryRef.current) {
      let mem = memoryRef.current
      for (const c of candidates) mem = addMemory(mem, c.text, c.kind)
      commitMemory(mem)
    }

    const finalMsg = aiMsg
    if (finalMsg) setMessages(prev => [...prev, finalMsg])
    setStreamingText('')
    setTyping(false)
  }

  const handleStart = () => {
    if (!personaId || !topic.trim()) return
    setMessages([])
    setSaved(false)
    setPhase('chat')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleReset = () => {
    setMessages([])
    setSaved(false)
    setPhase('setup')
  }

  const handleChangePersona = () => {
    setPersonaId('')
    setTopic('')
    setMessages([])
    setSaved(false)
    setPhase('select')
  }

  // ── 阶段1：选择人格 ──
  if (phase === 'select') {
    return (
      <div className="h-full overflow-y-auto" role="main" aria-label="1v1人格对话">
        <div className="max-w-4xl mx-auto p-4 md:p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3"
              style={{ background: 'var(--color-accent)', color: '#fff' }}>
              <MessageCircle size={14} /> 1v1 深度交流
            </div>
            <h1 className="text-2xl font-bold mb-2 display-title gradient-text">
              选择一位人格，向他提问、与他交流
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              不是辩论——是提问、探讨与常识科普。TA 会以自己的人格方式回应你，并引用你导入的领域知识库
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {mbtiProfiles.map((p, i) => (
              <button
                key={p.id}
                onClick={() => { setPersonaId(p.id); setPhase('setup') }}
                onMouseMove={e => {
                  const r = e.currentTarget.getBoundingClientRect()
                  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
                  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
                }}
                className="stagger-item glass persona-card card-spotlight p-4 rounded-xl text-left transition-all hover:scale-[1.03] cursor-pointer border"
                style={{
                  borderColor: 'var(--color-border)',
                  ...({ '--spot-color': `${p.color}26` } as CSSProperties),
                  animationDelay: `${i * 0.04}s`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                    style={{ background: p.color }}>
                    {p.emoji}
                  </div>
                  <div>
                    <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{p.id}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{p.name}</div>
                  </div>
                </div>
                <p className="text-xs leading-relaxed line-clamp-3" style={{ color: 'var(--color-text-secondary)' }}>
                  {p.description}
                </p>
                <div className="mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full inline-block"
                  style={{ background: 'var(--color-bg)', color: p.color }}>
                  {system?.speechPattern.tone.split('，')[0] || p.debateStyle.split('。')[0]}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── 阶段2：设置话题 ──
  if (phase === 'setup') {
    return (
      <div className="h-full overflow-y-auto" role="main" aria-label="对话话题设置">
        <div className="max-w-2xl mx-auto p-4 md:p-8">
          <button onClick={handleChangePersona}
            className="flex items-center gap-1 text-sm mb-6 hover:opacity-70 transition-all"
            style={{ color: 'var(--color-text-secondary)' }}>
            <ChevronLeft size={16} /> 重新选择人格
          </button>

          {/* 人格信息卡 */}
          <div className="glass p-5 rounded-2xl border mb-6" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
                style={{ background: persona?.color }}>
                {persona?.emoji}
              </div>
              <div>
                <div className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                  {persona?.id} · {persona?.name}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  语气：{system?.speechPattern.tone}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  风格：{persona?.debateStyle.slice(0, 40)}…
                </div>
              </div>
            </div>
            {system && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {system.values.slice(0, 4).map(v => (
                  <span key={v} className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--color-bg)', color: persona?.color }}>
                    ♥ {v}
                  </span>
                ))}
                {system.blindSpots.slice(0, 2).map(b => (
                  <span key={b} className="text-[10px] px-2 py-0.5 rounded-full opacity-60"
                    style={{ background: 'var(--color-bg)', color: 'var(--color-text-tertiary)' }}>
                    ! {b}
                  </span>
                ))}
              </div>
            )}

            {/* 思想弹药库（v27.1：16 人格各自匹配的书籍/思想家，聊天中也会引用） */}
            {PERSONA_SOURCES[personaId]?.length > 0 && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <div className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  📚 思想弹药库 · 聊天中 TA 会引用这些书与观点
                </div>
                <div className="space-y-1">
                  {PERSONA_SOURCES[personaId].map(s => (
                    <div key={s.source} className="text-[11px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                      <span className="font-semibold" style={{ color: persona?.color }}>{s.source}</span>
                      {' — '}{s.idea}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* v31：跨会话记忆——TA 还记得上次聊过的事，见面会自然提起 */}
            {personaMemory && personaMemory.entries.length > 0 && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <div className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  🧠 跨会话记忆 · TA 还记得你上次说过
                </div>
                <div className="space-y-1">
                  {personaMemory.entries.slice(-3).map(e => (
                    <div key={e.id} className="text-[11px] leading-snug flex items-start gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                      <span className="text-[9px] px-1 py-0.5 rounded shrink-0" style={{ background: 'var(--color-bg)', color: persona?.color }}>
                        {MEMORY_KIND_LABELS[e.kind]}
                      </span>
                      <span className="line-clamp-2">{e.text}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleResetPersona}
                  className="mt-2 text-[10px] px-2 py-1 rounded transition-all hover:opacity-70"
                  style={{ background: 'var(--color-bg)', color: 'var(--color-text-tertiary)' }}
                  aria-label="清空人格状态与记忆">
                  忘记我（清空状态与记忆）
                </button>
              </div>
            )}
          </div>

          {/* v32 知识库状态：告诉用户 TA 的知识来源，引导导入 */}
          <div className="glass p-3.5 rounded-2xl border mb-6" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: kbStats && kbStats.chunkCount > 0 ? 'rgba(16,185,129,0.15)' : 'var(--color-bg)' }}>
                <BookOpen size={17} style={{ color: kbStats && kbStats.chunkCount > 0 ? '#2fc9a3' : 'var(--color-text-tertiary)' }} />
              </div>
              <div className="min-w-0 flex-1">
                {kbStats && kbStats.chunkCount > 0 ? (
                  <>
                    <div className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                      📚 知识库已就绪 · {kbStats.docCount} 个文档 / {kbStats.chunkCount} 条资料
                    </div>
                    <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                      提问金融、法律、健康等知识性问题时，TA 会先检索知识库再回答，并附上参考来源
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                      📚 知识库还是空的
                    </div>
                    <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                      到「知识库」页导入你的行业资料（金融/市场/法律…支持 txt / md / docx / pdf），TA 就能基于你的资料回答提问
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 话题设置 */}
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            开场话题（可选，也可以直接开始提问）
          </label>
          <div className="flex gap-2 mb-3">
            <input
              ref={inputRef}
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="想聊点什么？比如：帮我讲讲基金定投…"
              className="flex-1 px-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
            <button
              onClick={() => setTopic(randomTopic())}
              className="px-3 py-2 rounded-xl text-sm flex items-center gap-1.5 transition-all hover:scale-105"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              aria-label="随机生成话题"
            >
              <Sparkles size={16} /> 随机
            </button>
          </div>

          {/* 推荐话题 */}
          <div className="mb-6">
            <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
              <Lightbulb size={13} /> 推荐话题 · 点击填充
            </div>
            <div className="space-y-2">
              {recommendedTopics.map(cat => (
                <div key={cat.id}>
                  <div className="text-[11px] font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {cat.emoji} {cat.label}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.topics.slice(0, 3).map(t => (
                      <button
                        key={t}
                        onClick={() => setTopic(t)}
                        className="text-xs px-2.5 py-1 rounded-full transition-all hover:scale-105 border"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!topic.trim()}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all hover:scale-[1.01] disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${persona?.color || 'var(--color-accent)'}, var(--color-accent))` }}
          >
            {topic.trim() ? `开始与 ${persona?.name} 聊「${topic.slice(0, 12)}」→` : '直接开始提问 →'}
          </button>
        </div>
      </div>
    )
  }

  // ── 阶段3：对话 ──
  const round = Math.ceil(messages.filter(m => !m.isUser).length)

  return (
    <div className="h-full flex flex-col" role="main" aria-label="1v1人格对话窗口">
      {/* 头部：人格信息 + 话题 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: persona?.color }}>
          {persona?.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>
            {persona?.id} · {persona?.name}
            {round > 0 && (
              <span className="ml-2 text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: 'var(--color-bg)', color: persona?.color }}>
                第 {round} 回合
              </span>
            )}
          </div>
          <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
            {topic ? `话题：${topic}` : '自由提问 · 想到什么问什么'}
          </div>
          {/* v31 人格实时状态：情绪/精力/亲密度/话题新鲜度 + 记忆条数 + 重置 */}
          {personaState && (
            <div className="flex items-center gap-1.5 mt-0.5 text-[9px]" style={{ color: 'var(--color-text-tertiary)' }}>
              <span title={`情绪：${describeMood(personaState)}（唤醒度 ${Math.round(personaState.arousal * 100)}%）`}>
                {moodEmoji(personaState)} {describeMood(personaState)}
              </span>
              <span className="opacity-50">·</span>
              <span title={`精力：${energyLabel(personaState.energy)}`}>⚡ {Math.round(personaState.energy * 100)}%</span>
              <span className="opacity-50">·</span>
              <span title={`亲密度：${intimacyLabel(personaState.intimacy)}`}>💞 {intimacyLabel(personaState.intimacy)}</span>
              <span className="opacity-50">·</span>
              <span title={`话题新鲜度：${noveltyLabel(personaState.novelty)}`}>✨ {noveltyLabel(personaState.novelty)}</span>
              {personaMemory && personaMemory.entries.length > 0 && (
                <>
                  <span className="opacity-50">·</span>
                  <span title={personaMemory.entries.map(e => e.text).join('；')}>🧠 {personaMemory.entries.length}</span>
                </>
              )}
              <button
                onClick={handleResetPersona}
                className="ml-1 px-1 py-0.5 rounded hover:opacity-70 transition-opacity"
                style={{ background: 'var(--color-bg)', color: 'var(--color-text-tertiary)' }}
                title="清空 TA 的状态与记忆，回到初次相识" aria-label="重置人格状态与记忆">
                重置
              </button>
            </div>
          )}
        </div>
        <button onClick={handleReset}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all hover:scale-105"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          aria-label="更换话题">
          <RotateCcw size={13} /> 换话题
        </button>
        <button onClick={handleChangePersona}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all hover:scale-105"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          aria-label="更换人格">
          换人格
        </button>
        <button onClick={() => autoSave(messages)}
          disabled={messages.length === 0 || saved}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:scale-105 disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), #ad8fe8)' }}
          aria-label="保存对话到战斗记录">
          <Save size={13} /> {saved ? '已保存' : '保存记录'}
        </button>
      </div>

      {/* 对话区 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="text-center">
          <span className="text-[10px] px-2.5 py-1 rounded-full"
            style={{ background: 'var(--color-bg)', color: 'var(--color-text-tertiary)' }}>
            提问与交流 · 向 {persona?.name} 提问，TA 会以 {persona?.id} 的方式回答并科普
          </span>
        </div>
        {/* v31.1 AI 连接状态：配置 LLM 后 TA 才是真正的大模型人格；否则为本地模板 */}
        <div className="text-center -mt-1">
          {isLLMConfigured() ? (
            <span className="text-[9px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(34,211,238,0.12)', color: '#66c4d4' }}>
              ⚡ 已连接 AI 大模型 · TA 正以 {persona?.id} 人格真实回应
            </span>
          ) : (
            <span className="text-[9px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(244,114,182,0.1)', color: 'var(--color-text-tertiary)' }}>
              🔌 未连接 AI（当前为本地模板人格）· 请到设置页配置 LLM
            </span>
          )}
        </div>

        {messages.map(m => {
          const isUser = m.isUser
          return (
            <div key={m.id} className={clsx('flex gap-2.5', isUser ? 'flex-row-reverse' : '')}>
              {!isUser && (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: m.typeColor }}>
                  {m.typeEmoji}
                </div>
              )}
              <div className={clsx('max-w-[75%]', isUser ? 'text-right' : '')}>
                <div className="text-[10px] mb-1 px-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  {isUser ? '你' : `${m.typeName}（${m.typeId}）`}
                  {!isUser && m.confidence != null && (
                    <span className="ml-1.5" style={{ color: m.typeColor }}>
                      确信度 {m.confidence}%
                    </span>
                  )}
                </div>
                {/* v31.1：AI 先「理解」再「回应」——思考链折叠展示（识别出你的意图后才开口） */}
                {!isUser && m.thinking && (
                  <details className="mb-1 text-left">
                    <summary
                      className="inline-flex items-center gap-1 text-[10px] cursor-pointer select-none rounded px-1.5 py-0.5 transition-opacity hover:opacity-70"
                      style={{ background: 'var(--color-bg)', color: m.typeColor }}
                      aria-label="展开 AI 的理解过程">
                      🧠 TA 先理解了你的话
                    </summary>
                    <pre
                      className="mt-1 whitespace-pre-wrap text-[10px] leading-relaxed rounded-lg px-2.5 py-2"
                      style={{ background: 'var(--color-bg)', color: 'var(--color-text-tertiary)', borderLeft: `2px solid ${m.typeColor}55` }}
                    >{m.thinking}</pre>
                  </details>
                )}
                <div
                  className={clsx('px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap')}
                  style={isUser
                    ? { background: 'var(--color-accent)', color: '#fff', borderRadius: '18px 4px 18px 18px' }
                    : { background: 'var(--color-bg)', color: 'var(--color-text)', border: `1px solid ${m.typeColor}33`, borderRadius: '4px 18px 18px 18px' }
                  }
                >
                  {m.content}
                </div>
                {/* v32 知识库参考来源：回答所依据的资料，可展开查看原文 */}
                {!isUser && m.sources && m.sources.length > 0 && (
                  <details className="mt-1.5 text-left">
                    <summary
                      className="inline-flex items-center gap-1 text-[10px] cursor-pointer select-none rounded px-1.5 py-0.5 transition-opacity hover:opacity-70"
                      style={{ background: 'var(--color-bg)', color: m.typeColor }}
                      aria-label="展开参考来源">
                      📚 参考来源 · {m.sources[0].domainEmoji} {m.sources[0].domainName}（{m.sources.length}）
                    </summary>
                    <div className="mt-1 space-y-1.5 rounded-lg px-2.5 py-2"
                      style={{ background: 'var(--color-bg)', borderLeft: `2px solid ${m.typeColor}55` }}>
                      {m.sources.map((s, i) => (
                        <div key={i} className="text-[10px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                          <div className="font-semibold" style={{ color: m.typeColor }}>
                            [{i + 1}] 《{s.title}》
                            <span className="ml-1 font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
                              {s.domainEmoji} {s.domainName}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-3">{s.text}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {/* v33 专业建议·困境拆解：三条行动路径 + 风险 + 下一步 */}
                {!isUser && m.advice && (
                  <PathAdviceCard advice={m.advice} color={m.typeColor} />
                )}
              </div>
            </div>
          )
        })}

        {typing && (
          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
              style={{ background: persona?.color }}>
              {persona?.emoji}
            </div>
            <div className="px-4 py-3 rounded-2xl" style={{ background: 'var(--color-bg)', border: `1px solid ${persona?.color}33` }}>
              {streamingText ? (
                // v31.1：LLM 回应流式打字机
                <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>
                  {streamingText}
                </div>
              ) : (
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: persona?.color, animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: persona?.color, animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: persona?.color, animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <div className="px-4 py-3 border-t flex-shrink-0" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={`问问 ${persona?.name} 点什么，或随便聊聊…`}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            aria-label="输入你的观点"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || typing}
            className="px-4 rounded-xl text-white transition-all hover:scale-105 disabled:opacity-40 flex items-center gap-1.5"
            style={{ background: persona?.color || 'var(--color-accent)' }}
            aria-label="发送"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
