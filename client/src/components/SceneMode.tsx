import { useState } from 'react'
import { SceneTemplate } from '../types'
import { sceneTemplates, scenes } from '../data/scenes'
import { mbtiProfiles } from '../data/mbtiProfiles'
import { Play, Users, Clock, Sparkles, ArrowLeft } from 'lucide-react'

interface SceneModeProps {
  onStartDebate: (topic: string, types: string[], sceneId?: string) => void
}

export function SceneMode({ onStartDebate }: SceneModeProps) {
  const [selectedScene, setSelectedScene] = useState<SceneTemplate | null>(null)

  if (selectedScene) {
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
              <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{selectedScene.title}</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{selectedScene.description}</p>
            </div>
          </div>
          <p className="text-sm italic mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
            "{selectedScene.background}"
          </p>

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

        {/* Start button */}
        <button
          onClick={() => {
            const types = selectedScene.roles.map(r => r.typeId)
            const topic = scenes.find(s => s.recommendedTypes.some(t => types.includes(t)))?.topic || '请开始辩论'
            onStartDebate(topic, types.length > 0 ? types : ['INTJ', 'ENTP', 'INFJ'], selectedScene.id)
          }}
          className="btn btn-primary w-full"
          aria-label={`开始${selectedScene.title}辩论`}
        >
          <Play size={16} /> 开始{selectedScene.title}
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
            onClick={() => setSelectedScene(scene)}
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
              <span className="flex items-center gap-1 ml-auto"><Sparkles size={12} /> 进入</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
