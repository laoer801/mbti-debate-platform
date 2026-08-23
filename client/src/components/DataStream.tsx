import { useEffect, useRef } from 'react'

/**
 * DataStream — FUI 数据流波形
 * 三层正弦波形 + 流动数据点，用于「实时动态」面板
 * 尊重 prefers-reduced-motion（静态渲染一帧）
 */
interface DataStreamProps {
  width?: number
  height?: number
  className?: string
}

const WAVES = [
  { c: 'rgba(232,232,232,.9)', w: 1.1, a: 0.20, f: 0.045, sp: 0.05, ph: 0 },
  { c: 'rgba(124,136,240,.6)', w: 0.8, a: 0.14, f: 0.07, sp: 0.07, ph: 2 },
  { c: 'rgba(255,255,255,.28)', w: 0.6, a: 0.26, f: 0.03, sp: 0.035, ph: 4 },
]

export function DataStream({ width = 280, height = 70, className }: DataStreamProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return

    const W = width, H = height
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let t = 0

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      /* 网格 */
      ctx.strokeStyle = 'rgba(255,255,255,.07)'
      ctx.lineWidth = 0.5
      for (let y = 14; y < H; y += 14) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }
      /* 三层波形 */
      for (const wv of WAVES) {
        ctx.strokeStyle = wv.c
        ctx.lineWidth = wv.w
        ctx.beginPath()
        for (let x = 0; x <= W; x += 2) {
          const yy = H / 2 + Math.sin(x * wv.f + t * wv.sp + wv.ph) * (wv.a * H) * Math.sin((x / W) * Math.PI)
          x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy)
        }
        ctx.stroke()
      }
      /* 流动数据点 */
      for (let i = 0; i < 7; i++) {
        const dx = (t * 0.8 + i * 47) % W
        ctx.fillStyle = 'rgba(124,136,240,.8)'
        ctx.fillRect(dx, H / 2 - 1, 2, 2)
      }
      t++
    }

    if (reduced) {
      draw()
    } else {
      const loop = () => { draw(); raf = requestAnimationFrame(loop) }
      loop()
    }
    return () => cancelAnimationFrame(raf)
  }, [width, height])

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className={className}
      style={{ width: '100%', height }}
      role="img"
      aria-label="实时数据流波形"
    />
  )
}
