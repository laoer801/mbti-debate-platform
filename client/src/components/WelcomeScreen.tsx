import { motion } from 'framer-motion'
import { Moon, Sun, PanelLeft, PanelRight } from 'lucide-react'
import { mbtiProfiles } from '../data/mbtiProfiles'
import clsx from 'clsx'

interface WelcomeScreenProps {
  selectedTypes: string[]
  onToggleType: (id: string) => void
  onStartDebate: (topic: string) => void
  toggleTheme: () => void
  theme: string
  isSidebarOpen: boolean
  isInfoOpen: boolean
  onToggleSidebar: () => void
  onToggleInfo: () => void
}

const quickTopics = [
  { emoji: '🤖', text: 'AI 是否可能拥有真正意识？' },
  { emoji: '🧬', text: '自由意志是否存在？' },
  { emoji: '💼', text: '996 工作制是奋斗还是剥削？' },
  { emoji: '🚀', text: '技术乐观主义可取吗？' },
  { emoji: '🗣️', text: '外向性格真的更有优势吗？' },
]

export function WelcomeScreen({
  selectedTypes, onToggleType, onStartDebate,
  toggleTheme, theme, isSidebarOpen, isInfoOpen,
  onToggleSidebar, onToggleInfo
}: WelcomeScreenProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Top Bar */}
      <header className="glass border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {!isSidebarOpen && (
            <button onClick={onToggleSidebar} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="打开侧边栏">
              <PanelLeft size={18} />
            </button>
          )}
          <h1 className="text-lg font-bold">
            <span className="gradient-text">MBTI 人格辩论平台</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isInfoOpen && (
            <button onClick={onToggleInfo} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="打开信息面板">
              <PanelRight size={18} />
            </button>
          )}
          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center overflow-y-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-6xl mb-6">🧠</div>
        </motion.div>

        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-bold mb-3"
        >
          让 16 种人格<span className="gradient-text">同台辩论</span>
        </motion.h2>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-gray-500 dark:text-gray-400 max-w-lg mb-10"
        >
          选择不同 MBTI 人格角色，提出你的话题，观看它们各抒己见、碰撞思维火花。
          你也可以随时插话参与辩论。
        </motion.p>

        {/* Quick Topics */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-xl mb-8"
        >
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider font-medium">快速话题</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {quickTopics.map((t, i) => (
              <button
                key={i}
                onClick={() => onStartDebate(t.text)}
                className="px-4 py-2 glass rounded-full text-sm hover:bg-gray-100 dark:hover:bg-gray-800
                           transition-all hover:shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <span>{t.emoji}</span> {t.text}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Selected Personalities Grid */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="w-full max-w-3xl"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse-glow" />
              选择辩论选手 ({selectedTypes.length}/16)
            </p>
            <span className="text-xs text-gray-400">
              {selectedTypes.length < 2 ? '至少选择 2 位' : '点击话题即可开始'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {mbtiProfiles.map(profile => {
              const selected = selectedTypes.includes(profile.id)
              return (
                <motion.button
                  key={profile.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onToggleType(profile.id)}
                  className={clsx(
                    'p-3 rounded-xl text-left transition-all duration-200 border-2',
                    selected
                      ? 'border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                      : 'border-transparent glass hover:shadow-md'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{profile.emoji}</span>
                    <div>
                      <div
                        className="text-xs font-bold"
                        style={{ color: profile.color }}
                      >
                        {profile.id}
                      </div>
                      <div className="text-[10px] text-gray-400">{profile.name}</div>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
