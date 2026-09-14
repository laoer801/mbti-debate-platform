import { useState } from 'react'
import { SceneTemplate } from '../types'
import { sceneTemplates, scenes } from '../data/scenes'
import { mbtiProfiles } from '../data/mbtiProfiles'
import { chatCompletion } from '../utils/llmClient' // v40.6.8：AI 实时命题（知乎直答）
import { Play, Users, Clock, Sparkles, ArrowLeft, Wand2, RefreshCw } from 'lucide-react'

interface SceneModeProps {
  onStartDebate: (topic: string, types: string[], sceneId?: string) => void
}

export function SceneMode({ onStartDebate }: SceneModeProps) {
  const [selectedScene, setSelectedScene] = useState<SceneTemplate | null>(null)
  // v40.6.7：场景话题 = 场景专属话题池（圆桌=哲学/法律=法条议题/脱口秀=有趣话题/街头=日常）
  const [topic, setTopic] = useState('')
  // v40.6.8：AI 实时命题（知乎直答生成，不再依赖本地清单）
  const [aiTopicLoading, setAiTopicLoading] = useState(false)
  const [aiTopicSource, setAiTopicSource] = useState<'ai' | 'pool'>('pool')

  // v40.6.8：AI 按场景实时命题
  const generateByAI = async (sc: SceneTemplate) => {
    setAiTopicLoading(true)
    try {
      const modeHint = sc.mode === 'free'
        ? '讨论开放、没有唯一正确答案，适合各抒己见地交流，不设胜负'
        : '要有清晰可辩的正反立场'
      const goalHint = sc.goal ? `场景目标：${sc.goal}` : ''
      const raw = await chatCompletion([
        { role: 'system', content: '你是资深辩题策划，只输出一条话题本身，不解释、不加编号和引号。' },
        { role: 'user', content: `请为「${sc.title}」场景生成 1 条适合讨论/辩论的话题。场景定位：${sc.description}。${goalHint}。要求：${modeHint}；紧扣${sc.title}的主题气质（法律场景给真实法理议题、圆桌给哲学思辨题、脱口秀给有趣生活题、街头给接地气日常题）；语言自然，30 字左右。` },
      ], { temperature: 0.9, maxTokens: 80 })
      const t = (raw || '').replace(/^[「『""''\s]+|[」』""''\s]+$/g, '').trim()
      if (t.length >= 4) {
        setTopic(t)
        setAiTopicSource('ai')
        return
      }
    } catch (e) {
      console.warn('[Scene] AI 命题失败，暂用本地兜底:', (e as Error).message)
    } finally {
      setAiTopicLoading(false)
    }
    // 失败兜底：本地场景池（保证流程不断）
    setTopic(pickSceneTopic(sc))
    setAiTopicSource('pool')
  }

  const pickSceneTopic = (sc: SceneTemplate): string => {
    const pool = sc.topicPool || []
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)]
    const fallback = scenes.find(s => s.recommendedTypes.some(t => (sc.roles.length ? sc.roles.map(r => r.typeId) : ['INTJ', 'ENTP']).includes(t)))
    return fallback?.topic || '随便聊聊：今天想聊点什么？'
  }

  const openScene = (sc: SceneTemplate) => {
    setSelectedScene(sc)
    setTopic(pickSceneTopic(sc))
    setAiTopicSource('pool')
    // v40.6.8：进入场景即用 AI（知乎直答）实时命题，本地池仅兜底
    void generateByAI(sc)
  }

  if (selectedScene) {
    const isFreeTalk = selectedScene.mode === 'free'
    return (
      <div className="h-full overflow-y-auto p-6" role="main" aria-label={`场景模式 - ${selectedScene.title}`}>
        {/* Back */}
        <button
          onClick={() => setSelectedScene(null)}
          className="flex items-center gap-1.5 text-sm mb-6 hover:underline"
          style={{ color: 'var(--color-accent)' }}
          aria-label="返回场景列表"
        >
          <ArrowLeft size={14} /> 返回场景列表
        </button>

        {/* Scene Header */}
        <div className="glass p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{selectedScene.emoji}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{selectedScene.title}</h2>
                {selectedScene.playHint && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: isFreeTalk ? 'var(--color-accent-light)' : '#d9b87122', color: isFreeTalk ? 'var(--color-accent)' : '#d9b871' }}>
                    {selectedScene.playHint}
                  </span>
                )}
              </div>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{selectedScene.description}</p>
            </div>
          </div>
          <p className="text-sm italic mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
            "{selectedScene.background}"
          </p>

          {/* v40.6.7 玩法目标 */}
          {selectedScene.goal && (
            <div className="mb-4 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-accent-light)', color: 'var(--color-text-secondary)' }}>
              🎯 {selectedScene.goal}
            </div>
          )}

          {/* Roles */}
          {selectedScene.roles.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--color-text-tertiary)' }}>预设角色</h3>
              <div className="flex flex-wrap gap-2">
                {selectedScene.roles.map(role => {
                  const profile = mbtiProfiles.find(p => p.id === role.typeId)
                  return (
                    <div key={role.typeId} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--color-bg-tertiary)' }}>
                      <span style={{ color: profile?.color }}>{profile?.emoji}</span>
                      <div>
                        <div className="text-xs font-bold">{role.roleName}</div>
                        <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{role.description}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rules */}
          <div className="mb-4">
            <h3 className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--color-text-tertiary)' }}>特殊规则</h3>
            <ul className="space-y-1">
              {selectedScene.specialRules.map((rule, i) => (
                <li key={i} className="text-sm flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                  <span style={{ color: 'var(--color-accent)' }}>•</span> {rule}
                </li>
              ))}
            </ul>
          </div>

          {/* Timeline */}
          <div>
            <h3 className="text-xs font-bold uppercase mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
              <Clock size={12} /> 流程
            </h3>
            <p className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--color-text)', background: 'var(--color-accent-light)' }}>
              {selectedScene.timeline}
            </p>
          </div>
        </div>

        {/* v40.6.7 场景话题池：话题围绕本场景（法律议题/哲学问题/有趣话题/生活闲聊） */}
        {selectedScene.topicPool && selectedScene.topicPool.length > 0 && (
          <div className="glass p-5 mb-6">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                <Sparkles size={14} style={{ color: 'var(--color-accent)' }} /> 场景话题
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => generateByAI(selectedScene)}
                  disabled={aiTopicLoading}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all hover:scale-105 disabled:opacity-50"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  {aiTopicLoading
                    ? <><RefreshCw size={13} className="animate-spin" /> AI 命题中…</>
                    : <><Wand2 size={13} /> ✨ AI 实时命题（知乎直答）</>}
                </button>
                <button
                  onClick={() => { setTopic(pickSceneTopic(selectedScene)); setAiTopicSource('pool') }}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all hover:scale-105"
                  style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
                >
                  🎲 内置池随机
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedScene.topicPool?.map(t => (
                <button
                  key={t}
                  onClick={() => { setTopic(t); setAiTopicSource('pool') }}
                  className="text-xs px-3 py-1.5 rounded-full border transition-all hover:scale-105 text-left max-w-full"
                  style={{
                    background: topic === t && aiTopicSource === 'pool' ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                    color: topic === t && aiTopicSource === 'pool' ? '#fff' : 'var(--color-text-secondary)',
                    borderColor: topic === t && aiTopicSource === 'pool' ? 'transparent' : 'var(--color-border)',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="text-sm px-4 py-3 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
              <span className="text-[10px] font-bold mr-2 px-1.5 py-0.5 rounded-full"
                style={{ background: aiTopicSource === 'ai' ? 'var(--color-accent-light)' : 'var(--color-bg-secondary)', color: aiTopicSource === 'ai' ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}>
                {aiTopicSource === 'ai' ? '🤖 AI 实时命题' : '📦 内置兜底'}
              </span>
              <span style={{ color: 'var(--color-text)' }}>{topic || '（AI 正在出题…）'}</span>
            </div>
          </div>
        )}

        {/* Start button */}
        <button
          onClick={() => {
            const types = selectedScene.roles.map(r => r.typeId)
            onStartDebate(topic.trim() || pickSceneTopic(selectedScene), types.length > 0 ? types : ['INTJ', 'ENTP', 'INFJ'], selectedScene.id)
          }}
          disabled={!topic.trim()}
          className="btn btn-primary w-full disabled:opacity-40"
          aria-label={`开始${selectedScene.title}`}
        >
          <Play size={16} />
          {isFreeTalk ? `开始${selectedScene.title}（无正反 · 自由讨论）` : `开始${selectedScene.title}`}
        </button>
      </div>
    )
  }

  // Scene selection grid
  return (
    <div className="h-full overflow-y-auto p-6" role="main" aria-label="场景模式选择">
      <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>场景模式</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>选择一个场景，为辩论赋予独特的氛围和规则</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sceneTemplates.map(scene => (
          <button
            key={scene.id}
            onClick={() => openScene(scene)}
            className="glass p-5 text-left transition-all hover:-translate-y-1 cursor-pointer"
            role="article"
            aria-label={`${scene.title} - ${scene.description}`}
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="text-3xl">{scene.emoji}</span>
              <div>
                <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>{scene.title}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{scene.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="flex items-center gap-1"><Users size={12} /> {scene.roles.length}个预设角色</span>
              <span className="flex items-center gap-1"><Clock size={12} /> {scene.timeline.split('→').length}阶段</span>
              {scene.playHint && (
                <span className="flex items-center gap-1 ml-auto px-2 py-0.5 rounded-full text-[10px]"
                  style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
                  {scene.playHint}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
