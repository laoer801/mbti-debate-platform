import { useRef, type ReactNode, type CSSProperties } from 'react'

/**
 * TiltCard — 3D 倾斜卡片（v36 微交互，方案 §6）
 * 鼠标移动时卡片沿 X/Y 轴轻微旋转，营造物理景深感；离开后回弹。
 * 通过 onMouseMove 时设置 --rx / --ry 变量，由 CSS perspective 驱动，零 re-render。
 */
interface TiltCardProps {
  children: ReactNode
  className?: string
  maxTilt?: number // 最大倾斜角度（deg），默认 6
  glare?: boolean  // 是否带顶部高光（玻璃质感）
  style?: CSSProperties
}

export function TiltCard({ children, className = '', maxTilt = 6, glare = true, style }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    // 旋转方向：鼠标在右上 → 卡片向左上翘（视觉自然）
    const rx = (0.5 - py) * maxTilt
    const ry = (px - 0.5) * maxTilt
    el.style.setProperty('--rx', `${rx.toFixed(2)}deg`)
    el.style.setProperty('--ry', `${ry.toFixed(2)}deg`)
    if (glare) {
      el.style.setProperty('--gx', `${px * 100}%`)
      el.style.setProperty('--gy', `${py * 100}%`)
    }
  }

  const handleLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }

  return (
    <div
      ref={ref}
      className={`tilt-card ${className}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={style}
    >
      {glare && <span className="tilt-card-glare" aria-hidden="true" />}
      {children}
    </div>
  )
}
