import { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  hint?: string
  actionLabel?: string
  onAction?: () => void
}

/**
 * 统一空态组件：图标 + 标题 + 描述 + 可选提示/CTA
 * 避免用户将空页面误认为加载失败
 */
export function EmptyState({ icon, title, description, hint, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="h-full flex items-center justify-center p-8" role="status" aria-label="空状态">
      <div className="text-center max-w-sm">
        <div className="empty-orb" aria-hidden="true">
          {icon || <Inbox size={36} />}
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          {title}
        </h2>
        {description && (
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            {description}
          </p>
        )}
        {hint && (
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
            {hint}
          </p>
        )}
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-transform hover:scale-105"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #ad8fe8)' }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
