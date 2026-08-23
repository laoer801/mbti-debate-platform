import { motion, AnimatePresence } from 'framer-motion'
import { Volume2, Brain, ChevronDown } from 'lucide-react'
import { Message } from '../types'
import { useState, type CSSProperties } from 'react'
import clsx from 'clsx'
import { speakMessageOnce } from '../utils/voiceEngine'

interface ChatMessageProps {
  message: Message
  isLast: boolean
}

export function ChatMessage({ message, isLast }: ChatMessageProps) {
  const isUser = message.isUser
  const [thinkingOpen, setThinkingOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={clsx('flex gap-3 px-4 py-3', isUser && 'flex-row-reverse')}
      role="article"
      aria-label={`${message.typeName}: ${message.content.substring(0, 50)}`}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-md"
        style={{
          background: isUser
            ? 'var(--gradient-brand)'
            : `${message.typeColor}15`,
          border: `2px solid ${message.typeColor}40`,
          boxShadow: isUser
            ? 'var(--glow-accent)'
            : `0 4px 14px ${message.typeColor}22`,
        }}
      >
        {message.typeEmoji}
      </div>

      {/* Content */}
      <div className={clsx('flex-1 min-w-0', isUser && 'flex flex-col items-end')}>
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-xs font-semibold"
            style={{ color: message.typeColor }}
          >
            {message.typeName}
          </span>
          {message.side && (
            <span className={clsx('side-badge', message.side === 'pro' ? 'side-badge-pro' : 'side-badge-con')}>
              {message.side === 'pro' ? '正' : '反'}
            </span>
          )}
          {/* AI 发言可点击朗读（排队模式，不打断当前朗读） */}
          {!isUser && (
            <button
              onClick={() => speakMessageOnce(message.typeId, message.content)}
              className="p-1 rounded-md transition-colors hover:opacity-70"
              style={{ color: 'var(--color-text-tertiary)' }}
              aria-label={`朗读 ${message.typeName} 的这条发言`}
              title="朗读这条发言"
            >
              <Volume2 size={12} />
            </button>
          )}
          {message.confidence !== undefined && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium">
              确信度 {message.confidence}%
            </span>
          )}
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* 思考链（CoT）展示 —— 浅色/折叠，仅 LLM 发言且有 thinking 时显示 */}
        {!isUser && message.thinking && (
          <div className="mb-1.5">
            <button
              onClick={() => setThinkingOpen(o => !o)}
              className="flex items-center gap-1.5 text-[11px] font-medium transition-colors hover:opacity-70"
              style={{ color: 'var(--color-text-tertiary)' }}
              aria-expanded={thinkingOpen}
              aria-label="展开/折叠思考过程"
            >
              <Brain size={12} style={{ color: message.typeColor }} />
              <span>思考过程</span>
              <ChevronDown
                size={11}
                className={clsx('transition-transform', thinkingOpen && 'rotate-180')}
              />
            </button>
            <AnimatePresence>
              {thinkingOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden mt-1"
                >
                  <div
                    className="rounded-lg px-3 py-2 text-[12px] leading-relaxed border-l-2"
                    style={{
                      background: `${message.typeColor}08`,
                      borderColor: `${message.typeColor}30`,
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {message.thinking}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className={clsx(
          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
          isUser
            ? 'text-white rounded-tr-md shadow-md'
            : 'bubble-gradient'
        )}
          style={isUser
            ? { background: 'var(--gradient-brand)', boxShadow: 'var(--glow-accent)' }
            : ({
                '--bubble-a': message.typeColor,
                '--bubble-b': `color-mix(in srgb, ${message.typeColor} 55%, var(--color-accent-3))`,
                boxShadow: `0 4px 18px ${message.typeColor}14`,
              } as CSSProperties)}
        >
          <p className={clsx(isLast && !isUser && 'typing-cursor')}>
            {message.content}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
