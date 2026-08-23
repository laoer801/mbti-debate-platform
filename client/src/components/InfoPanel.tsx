import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelRightClose, TrendingUp, Info, Users, Brain, Eye, Zap } from 'lucide-react'
import { ConfidenceScore } from '../types'
import { mbtiProfiles } from '../data/mbtiProfiles'
import { personalitySystems } from '../data/personalitySystem'

interface InfoPanelProps {
  isOpen: boolean
  selectedTypes: string[]
  confidenceScores: ConfidenceScore[]
  topic: string
  onToggle: () => void
}

export function InfoPanel({ isOpen, selectedTypes, confidenceScores, topic, onToggle }: InfoPanelProps) {
  const profiles = selectedTypes.map(id => mbtiProfiles.find(p => p.id === id)!).filter(Boolean)
  const [activeProfile, setActiveProfile] = useState<string | undefined>(profiles[0]?.id)

  useEffect(() => {
    if (profiles.length > 0 && !profiles.find(p => p.id === activeProfile)) {
      setActiveProfile(profiles[0].id)
    } else if (profiles.length === 0) {
      setActiveProfile(undefined)
    }
  }, [selectedTypes])

  const activeSystem = activeProfile ? personalitySystems[activeProfile] : null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          className="h-full glass border-l flex flex-col shrink-0 overflow-hidden"
        >
          <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/40 flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Info size={16} className="text-accent-500" />
              人格档案卡
            </h2>
            <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="关闭信息面板">
              <PanelRightClose size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* 确信度排名 */}
            {confidenceScores.length > 0 && (
              <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/40">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <TrendingUp size={12} /> 确信度排名
                </h3>
                <div className="space-y-2">
                  {confidenceScores.map((cs, i) => (
                    <div key={cs.typeId} className="flex items-center gap-3">
                      <span className="text-xs font-bold w-6 text-gray-400">#{i + 1}</span>
                      <span className="text-lg">{cs.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold" style={{ color: cs.color }}>{cs.typeId}</span>
                          <span className="text-xs font-bold" style={{ color: cs.color }}>{cs.score}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${cs.score}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${cs.color}80, ${cs.color})` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 人格档案卡 */}
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users size={12} /> 场上人格档案
              </h3>
              {profiles.length === 0 ? (
                <p className="text-xs text-gray-400">尚未选择任何人格</p>
              ) : (
                <div className="space-y-2">
                  {profiles.map(profile => {
                    const sys = personalitySystems[profile.id]
                    return (
                      <div key={profile.id}>
                        <button
                          onClick={() => setActiveProfile(profile.id)}
                          className={`w-full p-2.5 rounded-xl text-left transition-all ${
                            activeProfile === profile.id
                              ? 'bg-gray-100 dark:bg-gray-800 shadow-sm'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">{profile.emoji}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold" style={{ color: profile.color }}>{profile.id}</span>
                                <span className="text-[10px] text-gray-500">{profile.name}</span>
                                <span className="text-[10px] text-gray-400">· {profile.alias}</span>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{profile.description}</p>
                            </div>
                          </div>
                        </button>

                        {/* 展开的人格完整档案 */}
                        {activeProfile === profile.id && sys && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="px-3 pb-3 ml-2 border-l-2 border-gray-200 dark:border-gray-700"
                          >
                            <div className="pt-2 space-y-3">
                              {/* 认知模式 */}
                              <div>
                                <p className="text-[10px] text-gray-400 mb-1.5 flex items-center gap-1">
                                  <Brain size={10} /> 认知模式
                                </p>
                                <div className="grid grid-cols-2 gap-1">
                                  {[
                                    { label: '能量', value: sys.cognitiveMode.energySource.slice(0, 4) },
                                    { label: '信息', value: sys.cognitiveMode.infoProcess.slice(0, 4) },
                                    { label: '决策', value: sys.cognitiveMode.decisionStyle.slice(0, 4) },
                                    { label: '生活', value: sys.cognitiveMode.lifeStyle.slice(0, 4) },
                                  ].map(({ label, value }) => (
                                    <div key={label} className="text-[10px] px-1.5 py-1 rounded" style={{ background: `${profile.color}10` }}>
                                      <span className="opacity-50">{label}</span>{' '}
                                      <span className="font-medium" style={{ color: profile.color }}>{value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* 说话风格 */}
                              <div>
                                <p className="text-[10px] text-gray-400 mb-1.5 flex items-center gap-1">
                                  <Zap size={10} /> 说话风格
                                </p>
                                <div className="space-y-1">
                                  <div className="flex gap-1 text-[10px]">
                                    <span className="text-gray-400">语气：</span>
                                    <span className="text-gray-600 dark:text-gray-300">{sys.speechPattern.tone}</span>
                                  </div>
                                  <div className="flex gap-1 text-[10px]">
                                    <span className="text-gray-400">用词：</span>
                                    <span className="text-gray-600 dark:text-gray-300">{sys.speechPattern.wordPreference}</span>
                                  </div>
                                </div>
                              </div>

                              {/* 价值观 */}
                              <div>
                                <p className="text-[10px] text-gray-400 mb-1">核心价值观</p>
                                <div className="flex flex-wrap gap-1">
                                  {sys.values.map(v => (
                                    <span key={v} className="text-[10px] px-1.5 py-0.5 rounded-full"
                                      style={{ background: `${profile.color}15`, color: profile.color }}>
                                      {v}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* 盲点 */}
                              <div>
                                <p className="text-[10px] text-gray-400 mb-1 flex items-center gap-1">
                                  <Eye size={10} /> 性格盲点
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {sys.blindSpots.slice(0, 3).map(b => (
                                    <span key={b} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                                      {b}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Few-shot 示例预览 */}
                              {sys.fewShotExamples.length > 0 && (
                                <div>
                                  <p className="text-[10px] text-gray-400 mb-1">典型对话风格</p>
                                  <div className="text-[10px] p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 italic leading-relaxed">
                                    "{
                                      sys.fewShotExamples[0].response.length > 120
                                        ? sys.fewShotExamples[0].response.slice(0, 120) + '…'
                                        : sys.fewShotExamples[0].response
                                    }"
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
