import { type FC } from 'react'

interface SkeletonProps {
  lines?: number
  className?: string
}

/**
 * 通用骨架屏组件 — 细腻 shimmer 占位
 * 用于 React.lazy 的 Suspense fallback
 */
export const Skeleton: FC<SkeletonProps> = ({ lines = 4, className = '' }) => (
  <div
    className={`flex flex-col gap-4 p-6 ${className}`}
    role="status"
    aria-label="内容加载中"
  >
    {/* 标题骨架 */}
    <div className="h-7 w-2/5 rounded-lg skeleton-shimmer" />
    {/* 内容骨架 */}
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className="h-4 rounded-md skeleton-shimmer"
        style={{
          width: `${85 - i * 10}%`,
          opacity: 1 - i * 0.12,
        }}
      />
    ))}
    {/* 卡片骨架 */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={`card-${i}`}
          className="h-24 rounded-xl skeleton-shimmer"
          style={{ opacity: 0.5 - i * 0.1 }}
        />
      ))}
    </div>
  </div>
)

/**
 * 小型骨架屏 — 用于 Tab 内容过渡动画
 */
export const MiniSkeleton: FC = () => (
  <div className="flex flex-col gap-3 p-4" role="status" aria-label="加载中">
    <div className="h-5 w-3/5 rounded-md skeleton-shimmer" />
    <div className="h-4 w-4/5 rounded-md skeleton-shimmer" style={{ opacity: 0.7 }} />
    <div className="h-4 w-2/5 rounded-md skeleton-shimmer" style={{ opacity: 0.5 }} />
  </div>
)
