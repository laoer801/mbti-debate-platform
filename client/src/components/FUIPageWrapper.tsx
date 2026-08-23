/**
 * FUIPageWrapper — FUI 风格页面外壳
 *
 * 为每个功能页面提供：
 * 1. 页面级动态 canvas 背景（FUIPageBg）
 * 2. FUI 编号分格页头（FUIPageHeader）
 * 3. 内容容器（z-index 高于背景）
 *
 * 用法：在 App.tsx 中包裹每个页面
 * <FUIPageWrapper variant="arena" index="02" title="ARENA" subtitle="辩论室" live>
 *   <DebateRoom ... />
 * </FUIPageWrapper>
 */

import type { ReactNode } from 'react'
import { FUIPageBg, type FUIBgVariant } from './FUIPageBg'
import { FUIPageHeader } from './FUIPageHeader'

interface Props {
  variant: FUIBgVariant
  index: string
  title: string
  subtitle?: string
  status?: string
  live?: boolean
  right?: ReactNode
  children: ReactNode
}

export function FUIPageWrapper({ variant, index, title, subtitle, status, live, right, children }: Props) {
  return (
    <div
      className="fui-page-wrapper"
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'auto',
        background: 'var(--fui-bg)',
      }}
    >
      {/* 动态背景层 */}
      <FUIPageBg variant={variant} index={index} label={title} />

      {/* FUI 页头 */}
      <FUIPageHeader index={index} title={title} subtitle={subtitle} status={status} live={live} right={right} />

      {/* 页面内容（高于背景） */}
      <div
        className="fui-page-content"
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: 'calc(100% - 49px)',
        }}
      >
        {children}
      </div>

      {/* 底部状态条 */}
      <div
        className="fui-page-footer"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '6px 16px',
          borderTop: '1px solid var(--fui-line-soft)',
          fontFamily: 'var(--fui-mono)',
          fontSize: 9,
          letterSpacing: '0.18em',
          color: 'var(--fui-ink-3)',
          textTransform: 'uppercase',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <span>SPHERE / {title}</span>
        <span className="fui-signal">
          <i /><i /><i /><i /><i />
        </span>
        <span>SYS-{index}</span>
      </div>
    </div>
  )
}
