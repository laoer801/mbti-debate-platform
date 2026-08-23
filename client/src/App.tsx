import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { TabId, Message, DebateMode, DebateSession, ConfidenceScore, PKRoom, PKPhase } from './types'
import { useTheme } from './hooks/useTheme'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { TabBar } from './components/TabBar'
import { PersonalityTest } from './components/PersonalityTest'
import { LoginForm } from './components/LoginForm'
import { ErrorBoundary } from './components/ErrorBoundary'
import { MiniSkeleton } from './components/Skeleton'
import { OnboardingTour } from './components/OnboardingTour'
import { TopicPicker } from './components/TopicPicker'
import { FUIPageWrapper } from './components/FUIPageWrapper'
import { mbtiProfiles } from './data/mbtiProfiles'
import { personalitySystems } from './data/personalitySystem'
import { loadKnowledgeBase } from './utils/kbIntegration'
import { initContentSync } from './utils/contentSync'
// v38：每日新闻自动学习（启动时检查，超过 12 小时自动抓取）
import { autoFetchIfNeeded } from './utils/newsKnowledge'
import {
  loadPersistedSessions, persistSessions,
  getUserBooks, saveUserBooks,
  fetchCloudBooks, pushBooksToCloud,
  fetchCloudSessions, pushSessionsToCloud,
  mergeCloudBooks, mergeCloudSessions,
} from './utils/learningStore'

// 代码分割：Tab 组件按需懒加载（命名导出 → default 适配）
const HallPage = lazy(() => import('./components/HallPage').then(m => ({ default: m.HallPage })))
const DebateRoom = lazy(() => import('./components/DebateRoom').then(m => ({ default: m.DebateRoom })))
const SceneMode = lazy(() => import('./components/SceneMode').then(m => ({ default: m.SceneMode })))
const CommunitySquare = lazy(() => import('./components/CommunitySquare').then(m => ({ default: m.CommunitySquare })))
const MatchPanel = lazy(() => import('./components/MatchPanel').then(m => ({ default: m.MatchPanel })))
const HistoryPage = lazy(() => import('./components/HistoryPage').then(m => ({ default: m.HistoryPage })))
const SettingsPage = lazy(() => import('./components/SettingsPage').then(m => ({ default: m.SettingsPage })))
const StatsDashboard = lazy(() => import('./components/StatsDashboard').then(m => ({ default: m.StatsDashboard })))
const PKLobby = lazy(() => import('./components/PKLobby').then(m => ({ default: m.PKLobby })))
const PKRoomView = lazy(() => import('./components/PKRoom').then(m => ({ default: m.PKRoom })))
const PetBattleField = lazy(() => import('./components/PetBattleField').then(m => ({ default: m.PetBattleField })))
const PetShop = lazy(() => import('./components/PetShop').then(m => ({ default: m.PetShop })))
const PersonaChat = lazy(() => import('./components/PersonaChat').then(m => ({ default: m.PersonaChat })))
const KnowledgeLibrary = lazy(() => import('./components/KnowledgeLibrary').then(m => ({ default: m.KnowledgeLibrary })))
// v35 后台管理（仅管理员可见，独立分包）
const AdminPage = lazy(() => import('./components/AdminPage').then(m => ({ default: m.AdminPage })))

/** 从 localStorage 恢复历史辩论会话（供回放 + 人格学习） */
function hydrateSessions(): DebateSession[] {
  try {
    return loadPersistedSessions().map(s => ({
      id: s.id,
      topic: s.topic,
      mode: s.mode as DebateMode,
      sceneId: s.sceneId,
      participants: s.participants,
      messages: s.messages.map(m => ({
        id: m.id || `${s.id}_${Math.random().toString(36).slice(2, 8)}`,
        typeId: m.typeId,
        typeName: m.typeName || m.typeId,
        typeEmoji: m.typeEmoji || '🤖',
        typeColor: m.typeColor || '#888',
        content: m.content,
        timestamp: m.timestamp || s.createdAt,
        isUser: m.isUser,
        isHighlight: m.isHighlight,
      })),
      highlights: s.highlights || [],
      createdAt: s.createdAt,
    }))
  } catch {
    return []
  }
}

function AppContent() {
  const { theme, setTheme, fontSize, setFontSize, toggleTheme } = useTheme()
  const { isLoggedIn, user } = useAuth()
  const cloudSyncedRef = useRef(false)
  const cloudPushTimerRef = useRef<number | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<TabId>('hall')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [topic, setTopic] = useState('')
  const [debateMode, setDebateMode] = useState<DebateMode>('free')
  const [sceneId, setSceneId] = useState<string>()
  const [sessions, setSessions] = useState<DebateSession[]>(hydrateSessions)
  const [showTest, setShowTest] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showTopicPicker, setShowTopicPicker] = useState(false)
  const [activePKRoomId, setActivePKRoomId] = useState<string | null>(null)
  const prevTabRef = useRef<TabId>('hall')

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.metaKey && !e.altKey) {
        const keyMap: Record<string, TabId> = { '1': 'hall', '2': 'debate', '3': 'scene', '4': 'square', '5': 'match', '6': 'history', '7': 'stats', '8': 'pk', '9': 'pets', '0': 'settings', 'q': 'chat', 'k': 'library', 'a': 'admin' }
        const tab = keyMap[e.key]
        if (tab) { e.preventDefault(); setActiveTab(tab) }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 登出时重置同步标记，允许下一个账号登录时重新合并
  useEffect(() => {
    if (!isLoggedIn) cloudSyncedRef.current = false
  }, [isLoggedIn])

  // 加载知识库数据
  useEffect(() => {
    loadKnowledgeBase()
  }, [])

  // v35 内容同步：启动拉取云端辩论主题 + 人格提示词覆盖（失败静默降级内置内容）
  useEffect(() => {
    initContentSync()
    // v38：每日新闻自动学习（后台静默，失败不影响主功能）
    autoFetchIfNeeded().catch(() => {})
  }, [])

  // v35 权限守卫：非管理员访问后台 → 跳回大厅（防快捷键/URL 直入）
  useEffect(() => {
    if (activeTab === 'admin' && user?.role !== 'admin') {
      setActiveTab('hall')
    }
  }, [activeTab, user?.role])

  // 持久化辩论会话 → 供回放 & 人格"实时学习"历史辩论
  // 已登录时：防抖推送到云端（用户信息跟随账号）
  useEffect(() => {
    persistSessions(sessions)
    if (isLoggedIn && cloudSyncedRef.current) {
      const token = localStorage.getItem('mbti_token') || sessionStorage.getItem('mbti_token')
      if (!token) return
      window.clearTimeout(cloudPushTimerRef.current)
      cloudPushTimerRef.current = window.setTimeout(() => {
        pushSessionsToCloud(token, sessions).catch(() => {})
      }, 1500)
    }
  }, [sessions, isLoggedIn])

  // 登录后：云端 ↔ 本地 双向合并（书籍 + 历史辩论会话）
  useEffect(() => {
    if (!isLoggedIn || cloudSyncedRef.current) return
    cloudSyncedRef.current = true
    const token = localStorage.getItem('mbti_token') || sessionStorage.getItem('mbti_token')
    if (!token) return
    ;(async () => {
      try {
        const [cloudBooks, cloudSessions] = await Promise.all([
          fetchCloudBooks(token),
          fetchCloudSessions(token),
        ])
        // 书籍：本地 + 云端 合并 → 落本地 → 回传云端
        const mergedBooks = mergeCloudBooks(getUserBooks(), cloudBooks)
        saveUserBooks(mergedBooks)
        await pushBooksToCloud(token, mergedBooks)
        // 会话：本地 + 云端 合并 → 更新 state → 回传云端
        const mergedSessions = mergeCloudSessions(loadPersistedSessions(), cloudSessions)
        persistSessions(mergedSessions)
        setSessions(prev => {
          const map = new Map<string, DebateSession>()
          // 云端+本地合并结果优先（补全 Message 缺省字段，与 hydrateSessions 一致）
          for (const s of mergedSessions) {
            map.set(s.id, {
              id: s.id,
              topic: s.topic,
              mode: s.mode as DebateMode,
              sceneId: s.sceneId,
              participants: s.participants,
              messages: s.messages.map(m => ({
                id: m.id || `${s.id}_${Math.random().toString(36).slice(2, 8)}`,
                typeId: m.typeId,
                typeName: m.typeName || m.typeId,
                typeEmoji: m.typeEmoji || '🤖',
                typeColor: m.typeColor || '#888',
                content: m.content,
                timestamp: m.timestamp || s.createdAt,
                isUser: m.isUser,
                isHighlight: m.isHighlight,
                confidence: (m as any).confidence,
                side: (m as any).side,
              })),
              highlights: s.highlights || [],
              createdAt: s.createdAt,
            })
          }
          for (const s of prev) if (!map.has(s.id)) map.set(s.id, s)
          return [...map.values()].sort((a, b) => b.createdAt - a.createdAt)
        })
        await pushSessionsToCloud(token, mergedSessions)
      } catch (e) {
        // 离线/后端未启动：允许下次登录重试，本地数据不受影响
        console.warn('云端同步失败，已保留本地数据：', e)
        cloudSyncedRef.current = false
      }
    })()
  }, [isLoggedIn])

  // Save session when leaving debate
  const saveSession = useCallback(() => {
    if (messages.length === 0) return
    const session: DebateSession = {
      id: Date.now().toString(36),
      topic,
      mode: debateMode,
      sceneId,
      participants: selectedTypes,
      messages: [...messages],
      highlights: messages.filter(m => m.isHighlight).map(m => m.content.substring(0, 40)),
      createdAt: Date.now(),
    }
    setSessions(prev => [session, ...prev])
  }, [messages, topic, debateMode, sceneId, selectedTypes])

  // Tab change tracking
  const handleTabChange = useCallback((tab: TabId) => {
    if (prevTabRef.current === 'debate' && tab !== 'debate' && messages.length > 0) {
      saveSession()
    }
    if (prevTabRef.current === 'pk' && tab !== 'pk') {
      setActivePKRoomId(null)
    }
    prevTabRef.current = tab
    setActiveTab(tab)
    setShowTest(false)
  }, [saveSession, messages])

  // Reset debate
  const resetDebate = useCallback(() => {
    setMessages([])
    setTopic('')
    setDebateMode('free')
    setSceneId(undefined)
  }, [])

  // 1v1 人格对话保存（往来辩论接入战斗记录）
  const saveDuelSession = useCallback((t: string, participants: string[], msgs: Message[], mode: DebateMode) => {
    if (msgs.length === 0) return
    const session: DebateSession = {
      id: Date.now().toString(36),
      topic: t,
      mode,
      participants,
      messages: [...msgs],
      highlights: msgs.filter(m => m.isHighlight).map(m => m.content.substring(0, 40)),
      createdAt: Date.now(),
    }
    setSessions(prev => [session, ...prev])
  }, [])

  // Start debate from different entry points
  const startDebate = useCallback((t: string, types: string[], sId?: string) => {
    setMessages([])
    setTopic(t)
    if (types.length > 0) setSelectedTypes(types)
    setSceneId(sId)
    setActiveTab('debate')
  }, [])

  // 大厅"开始辩论" → 主题选择 → 确认后进入辩论（自动开辩）
  const handleTopicConfirm = useCallback((t: string) => {
    setShowTopicPicker(false)
    startDebate(t, selectedTypes)
  }, [startDebate, selectedTypes])

  // Debate message handlers
  const handleSendMessage = useCallback((content: string) => {
    const msg: Message = {
      id: Date.now().toString(36),
      typeId: 'user',
      typeName: '你',
      typeEmoji: '💬',
      typeColor: 'var(--color-accent)',
      content,
      timestamp: Date.now(),
      isUser: true,
    }
    setMessages(prev => [...prev, msg])
  }, [])

  const handleBotMessage = useCallback((typeId: string, content: string, confidence?: number, side?: 'pro' | 'con', thinking?: string) => {
    
    const profile = mbtiProfiles.find(p => p.id === typeId)
    const msg: Message = {
      id: Date.now().toString(36) + Math.random(),
      typeId,
      typeName: profile?.name || typeId,
      typeEmoji: profile?.emoji || '🤖',
      typeColor: profile?.color || '#888',
      content,
      timestamp: Date.now(),
      confidence,
      side,
      thinking,
    }
    setMessages(prev => [...prev, msg])
  }, [])

  const confidenceScores: ConfidenceScore[] = (() => {
    return selectedTypes.map(id => {
      const profile = mbtiProfiles.find(p => p.id === id)
      const sys = personalitySystems[id]
      const msgs = messages.filter(m => m.typeId === id)
      const baseScore = 50 + (msgs.length * 3) + (msgs.filter(m => m.isHighlight).length * 8)
      const isThinker = sys?.cognitiveMode?.decisionStyle?.includes('思考')
      return {
        typeId: id,
        name: profile?.name || id,
        emoji: profile?.emoji || '🤖',
        score: Math.min(100, baseScore),
        color: profile?.color || '#888',
        logic: Math.min(100, (isThinker ? 65 : 45) + msgs.length * 4),
        persuasion: Math.min(100, 45 + msgs.length * 3 + (msgs.filter(m => m.isHighlight).length * 5)),
        fun: Math.min(100, 30 + msgs.length * 2 + Math.floor(Math.random() * 30)),
      }
    })
  })()

  // Replay session
  const handleReplay = useCallback((session: DebateSession) => {
    setTopic(session.topic)
    setSelectedTypes(session.participants)
    setMessages(session.messages)
    setDebateMode(session.mode)
    setSceneId(session.sceneId)
    setActiveTab('debate')
  }, [])

  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id))
  }, [])

  return (
    <ErrorBoundary>
      <div className="h-full flex flex-col" style={{ background: 'var(--color-bg)' }}>
        {/* 深空星云氛围背景（DebateSphere 沉浸式） */}
        <div className="deepspace-bg" aria-hidden="true" />
        {/* 胶片噪点层（Linear/Stripe 质感，消除纯色塑料感） */}
        <div className="grain-overlay" aria-hidden="true" />
        {/* v37 FUI 扫描线覆层（观测站 HUD 质感） */}
        <div className="fui-scanlines" aria-hidden="true" />

        {/* Login modal */}
        {showLogin && <LoginForm onClose={() => setShowLogin(false)} />}

        {/* 辩论主题选择 */}
        {showTopicPicker && (
          <TopicPicker
            participantCount={selectedTypes.length}
            onConfirm={handleTopicConfirm}
            onCancel={() => setShowTopicPicker(false)}
          />
        )}

        {/* Skip to content link */}
        <a href="#main-content" className="skip-link">跳转到主内容</a>

        {/* 新手引导（首次访问展示） */}
        <OnboardingTour activeTab={showTest ? 'hall' : activeTab} onNavigate={handleTabChange} />

        {/* Top navigation */}
        <TabBar
          activeTab={showTest ? 'hall' : activeTab}
          onChange={handleTabChange}
          debateCount={0}
          onLoginClick={() => setShowLogin(true)}
        />

        {/* Main content area */}
        <main id="main-content" className="flex-1 overflow-hidden" style={{ position: 'relative', zIndex: 1 }}>
          {/* Personality Test (overlay) */}
          {showTest && (
            <PersonalityTest
              onClose={() => setShowTest(false)}
              onResult={(typeId) => {
                if (!selectedTypes.includes(typeId)) {
                  setSelectedTypes(prev => [...prev.slice(-4), typeId])
                }
              }}
            />
          )}

          {/* Tab pages — 懒加载 + Suspense */}
          {!showTest && activeTab === 'hall' && (
            <Suspense fallback={<MiniSkeleton />}>
              <HallPage
                selectedTypes={selectedTypes}
                onToggleType={(id: string) => setSelectedTypes(prev =>
                  prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
                )}
                onStartTest={() => setShowTest(true)}
                onStartDebate={() => {
                  if (selectedTypes.length >= 2) setShowTopicPicker(true)
                }}
                onNavigate={handleTabChange}
                onQuickStart={(t: string) => {
                  if (selectedTypes.length >= 2) startDebate(t, selectedTypes)
                }}
              />
            </Suspense>
          )}

          {activeTab === 'debate' && (
            <Suspense fallback={<MiniSkeleton />}>
              <FUIPageWrapper variant="arena" index="02" title="ARENA" subtitle="辩论室" live>
                <DebateRoom
                  topic={topic}
                  messages={messages}
                  selectedTypes={selectedTypes}
                  onSendMessage={handleSendMessage}
                  onBotMessage={handleBotMessage}
                  isDebating={true}
                  setIsDebating={() => {}}
                  toggleTheme={toggleTheme}
                  theme={theme}
                  isSidebarOpen={false}
                  isInfoOpen={true}
                  onToggleSidebar={() => {}}
                  onToggleInfo={() => {}}
                  debateMode={debateMode}
                  setDebateMode={setDebateMode}
                  confidenceScores={confidenceScores}
                />
              </FUIPageWrapper>
            </Suspense>
          )}

          {activeTab === 'scene' && (
            <Suspense fallback={<MiniSkeleton />}>
              <FUIPageWrapper variant="scene" index="03" title="SCENE" subtitle="场景模式">
                <SceneMode onStartDebate={(t: string, types: string[], sId?: string) => startDebate(t, types, sId)} />
              </FUIPageWrapper>
            </Suspense>
          )}

          {activeTab === 'square' && (
            <Suspense fallback={<MiniSkeleton />}>
              <FUIPageWrapper variant="broadcast" index="04" title="SQUARE" subtitle="观点广场" live>
                <CommunitySquare />
              </FUIPageWrapper>
            </Suspense>
          )}

          {activeTab === 'match' && (
            <Suspense fallback={<MiniSkeleton />}>
              <FUIPageWrapper variant="match" index="05" title="MATCH" subtitle="人格匹配">
                <MatchPanel />
              </FUIPageWrapper>
            </Suspense>
          )}

          {activeTab === 'history' && (
            <Suspense fallback={<MiniSkeleton />}>
              <FUIPageWrapper variant="log" index="06" title="ARCHIVE" subtitle="历史记录">
                <HistoryPage
                  sessions={sessions}
                  onReplay={handleReplay}
                  onDelete={handleDeleteSession}
                />
              </FUIPageWrapper>
            </Suspense>
          )}

          {activeTab === 'stats' && (
            <Suspense fallback={<MiniSkeleton />}>
              <FUIPageWrapper variant="analytics" index="07" title="ANALYTICS" subtitle="数据统计">
                <StatsDashboard />
              </FUIPageWrapper>
            </Suspense>
          )}

          {activeTab === 'pk' && (
            <Suspense fallback={<MiniSkeleton />}>
              <FUIPageWrapper variant="combat" index="08" title="COMBAT" subtitle="PK 对战" live>
                {activePKRoomId ? (
                  <PKRoomView
                    roomId={activePKRoomId}
                    onLeave={() => setActivePKRoomId(null)}
                  />
                ) : (
                  <PKLobby
                    onJoinRoom={(roomId: string) => setActivePKRoomId(roomId)}
                  />
                )}
              </FUIPageWrapper>
            </Suspense>
          )}

          {activeTab === 'pets' && (
            <Suspense fallback={<MiniSkeleton />}>
              <FUIPageWrapper variant="habitat" index="09" title="HABITAT" subtitle="宠物商城">
                <PetShop />
              </FUIPageWrapper>
            </Suspense>
          )}

          {activeTab === 'chat' && (
            <Suspense fallback={<MiniSkeleton />}>
              <FUIPageWrapper variant="link" index="10" title="DIALOGUE" subtitle="1v1 对话" live>
                <PersonaChat onSaveSession={saveDuelSession} />
              </FUIPageWrapper>
            </Suspense>
          )}

          {activeTab === 'library' && (
            <Suspense fallback={<MiniSkeleton />}>
              <FUIPageWrapper variant="archive" index="11" title="ARCHIVE" subtitle="知识库">
                <KnowledgeLibrary />
              </FUIPageWrapper>
            </Suspense>
          )}

          {/* v35 后台管理（仅管理员可进入，权限守卫兜底） */}
          {activeTab === 'admin' && user?.role === 'admin' && (
            <Suspense fallback={<MiniSkeleton />}>
              <FUIPageWrapper variant="control" index="12" title="CONTROL" subtitle="后台管理" live>
                <AdminPage />
              </FUIPageWrapper>
            </Suspense>
          )}

          {activeTab === 'settings' && (
            <Suspense fallback={<MiniSkeleton />}>
              <FUIPageWrapper variant="config" index="13" title="CONFIG" subtitle="设置">
                <SettingsPage
                  theme={theme}
                  setTheme={setTheme}
                  fontSize={fontSize}
                  setFontSize={setFontSize}
                />
              </FUIPageWrapper>
            </Suspense>
          )}
        </main>
      </div>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
