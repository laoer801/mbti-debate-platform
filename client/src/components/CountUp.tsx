import { useEffect, useRef, useState } from 'react'

/**
 * CountUp — 数字滚动动画（v36，方案 §6「数据加载数字滚动」）
 * 进入视口后从 0 滚动到目标值，带缓动；数字用 tabular-nums 等宽渲染。
 */
interface CountUpProps {
  value: number
  duration?: number  // 毫秒，默认 1200
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

export function CountUp({ value, duration = 1200, decimals = 0, prefix = '', suffix = '', className = '' }: CountUpProps) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true
          const t0 = performance.now()
          const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / duration)
            // easeOutExpo：先快后缓
            const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
            setDisplay(value * eased)
            if (p < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
          io.disconnect()
        }
      },
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [value, duration])

  const fixed = display.toFixed(decimals)
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}{fixed}{suffix}
    </span>
  )
}
