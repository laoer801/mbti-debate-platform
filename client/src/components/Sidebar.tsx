import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelLeftClose, PanelLeft, Users, MessageSquare, Sparkles } from 'lucide-react'
import { mbtiProfiles, categories, scenes } from '../data/mbtiProfiles'
import { Category } from '../types'
import clsx from 'clsx'

interface SidebarProps {
  isOpen: boolean
  selectedTypes: string[]
  onToggleType: (id: string) => void
  onToggleSidebar: () => void
  onStartDebate: (topic: string) => void
  isDebating: boolean
}

export function Sidebar({ isOpen, selectedTypes, onToggleType, onToggleSidebar, onStartDebate, isDebating }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'personalities' | 'scenes'>('personalities')
  const [categoryFilter, setCategoryFilter] = useState<Category>('all')
  const [customTopic, setCustomTopic] = useState('')

  const filtered = categoryFilter === 'all'
    ? mbtiProfiles
    : mbtiProfiles.filter(p => p.category === categoryFilter)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          className="h-full glass border-r flex flex-col shrink-0 overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/40 flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Sparkles size={16} className="text-primary-500" />
              MBTI 辩论平台
            </h2>
            <button onClick={onToggleSidebar} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="关闭侧边栏">
              <PanelLeftClose size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200/60 dark:border-gray-700/40"              role="tablist"
              aria-label="面板切换"
            >
            <button
              role="tab"
              aria-selected={activeTab === 'personalities'}
              onClick={() => setActiveTab('personalities')}
              className={clsx(
                'flex-1 py-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
                activeTab === 'personalities'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              <Users size={14} /> 人格角色
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'scenes'}
              onClick={() => setActiveTab('scenes')}
              className={clsx(
                'flex-1 py-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
                activeTab === 'scenes'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              <MessageSquare size={14} /> 辩论场景
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {activeTab === 'personalities' && (
              <>
                {/* Category Filter */}
                <div className="flex gap-1 flex-wrap mb-3">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setCategoryFilter(cat.id)}
                      className={clsx(
                        'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                        categoryFilter === cat.id
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                      )}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>

                {/* Selected count */}
                {selectedTypes.length > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-1">
                    已选 {selectedTypes.length} 人 · 最少 2 人可开始辩论
                  </div>
                )}

                {/* Personality List */}
                {filtered.map(profile => {
                  const selected = selectedTypes.includes(profile.id)
                  return (
                    <motion.button
                      key={profile.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onToggleType(profile.id)}
                      className={clsx(
                        'w-full p-3 rounded-xl text-left transition-all duration-200 group',
                        selected
                          ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700/50 shadow-sm'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{profile.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-sm font-semibold"
                              style={{ color: profile.color }}
                            >
                              {profile.id}
                            </span>
                            <span className="text-xs text-gray-500">{profile.name}</span>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                            {profile.traits.slice(0, 3).join(' · ')}
                          </p>
                        </div>
                        <div className={clsx(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0',
                          selected
                            ? 'bg-primary-500 border-primary-500'
                            : 'border-gray-300 dark:border-gray-600'
                        )}>
                          {selected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </div>
                    </motion.button>
                  )
                })}
              </>
            )}

            {activeTab === 'scenes' && (
              <div className="space-y-3">
                {scenes.map(scene => (
                  <div
                    key={scene.id}
                    className="p-3 rounded-xl glass-card cursor-pointer group"
                    onClick={() => {
                      if (scene.id !== 'custom') {
                        scene.recommendedTypes.forEach(id => {
                          if (!selectedTypes.includes(id)) onToggleType(id)
                        })
                        onStartDebate(scene.topic)
                      }
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-primary-600 transition-colors">
                        {scene.title}
                      </h3>
                      <span className={clsx(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                        scene.difficulty === 'hard' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                        scene.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                      )}>
                        {scene.difficulty === 'hard' ? '🔥 高难度' : scene.difficulty === 'medium' ? '⚡ 中等' : '🌱 入门'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{scene.description}</p>
                    {scene.recommendedTypes.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {scene.recommendedTypes.map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Custom topic */}
                <div className="pt-2">
                  <textarea
                    value={customTopic}
                    onChange={e => setCustomTopic(e.target.value)}
                    placeholder="输入你感兴趣的任何话题..."
                    className="input-field text-sm h-20 resize-none"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (customTopic.trim()) onStartDebate(customTopic.trim())
                      }
                    }}
                  />
                  <button
                    onClick={() => customTopic.trim() && onStartDebate(customTopic.trim())}
                    disabled={!customTopic.trim()}
                    className="btn-primary w-full mt-2 text-sm disabled:opacity-50"
                  >
                    开始辩论
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
