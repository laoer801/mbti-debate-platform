import { useEffect, useRef } from 'react'

/**
 * GlobeCanvas — FUI 点阵星球
 * 大陆高斯簇采样 + 正交投影 + 缓慢自转 + 经纬网格 + 刻度环 + 目标标记
 * 尊重 prefers-reduced-motion（静态渲染一帧）
 */
interface GlobeCanvasProps {
  width?: number
  height?: number
  radius?: number
  className?: string
}

/* 大陆中心簇（lat°, lon°, 半径°）——近似真实大陆分布 */
const LANDS: [number, number, number][] = [
  [48, -100, 22], [35, -95, 14], [-15, -60, 16], [-5, -70, 10], [5, 20, 22], [-20, 25, 12],
  [52, 15, 11], [45, 95, 24], [30, 80, 12], [12, 102, 9], [-25, 135, 11], [62, 95, 14],
  [55, -45, 7], [36, 138, 6], [-2, 118, 8],
]

function hash(x: number): number {
  const s = Math.sin(x * 127.1) * 43758.5453
  return s - Math.floor(s)
}

/* 预生成星球表面点（只算一次） */
const POINTS: [number, number][] = (() => {
  const pts: [number, number][] = []
  for (let i = 0; i < 9000 && pts.length < 1500; i++) {
    const lat = (hash(i * 1.7) - 0.5) * 170
    const lon = (hash(i * 2.3) - 0.5) * 360
    for (const L of LANDS) {
      const dlat = lat - L[0]
      let dlon = lon - L[1]
      if (dlon > 180) dlon -= 360
      if (dlon < -180) dlon += 360
      const cosLat = Math.cos((lat * Math.PI) / 180)
      const dd = Math.sqrt(dlat * dlat + dlon * dlon * cosLat * cosLat)
      const jitter = (hash(i * 3.1 + L[1] * 7.7) - 0.5) * 7
      if (dd < L[2] + jitter) { pts.push([lat, lon]); break }
    }
  }
  return pts
})()

export function GlobeCanvas({ width = 520, height = 400, radius, className }: GlobeCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return

    const W = width, H = height
    const CX = W / 2, CY = H / 2 + 8
    const R = radius ?? Math.min(W, H) * 0.32
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let rot = 0

    const draw = (rotation: number) => {
      ctx.clearRect(0, 0, W, H)

      /* 外轨道环 */
      ctx.strokeStyle = 'rgba(255,255,255,.10)'
      ctx.lineWidth = 0.7
      ctx.beginPath()
      ctx.ellipse(CX, CY, R + 44, (R + 44) * 0.32, -0.28, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(124,136,240,.22)'
      ctx.beginPath()
      ctx.ellipse(CX, CY, R + 58, (R + 58) * 0.28, -0.28, Math.PI * 0.15, Math.PI * 0.85)
      ctx.stroke()

      /* 刻度环 */
      ctx.strokeStyle = 'rgba(255,255,255,.14)'
      ctx.lineWidth = 0.6
      for (let a = 0; a < 360; a += 6) {
        const rad = (a * Math.PI) / 180
        const r1 = R + 16
        const r2 = R + 16 + (a % 30 === 0 ? 7 : 3)
        ctx.beginPath()
        ctx.moveTo(CX + Math.cos(rad) * r1, CY + Math.sin(rad) * r1)
        ctx.lineTo(CX + Math.cos(rad) * r2, CY + Math.sin(rad) * r2)
        ctx.stroke()
      }

      /* 纬线 */
      for (let la = -60; la <= 60; la += 30) {
        const y = CY - R * Math.sin((la * Math.PI) / 180)
        const rw = R * Math.cos((la * Math.PI) / 180)
        ctx.strokeStyle = 'rgba(255,255,255,.07)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.ellipse(CX, y, rw, rw * 0.18, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      /* 经线（随自转变化明暗） */
      for (let lo = 0; lo < 180; lo += 30) {
        const ph = (lo + rotation) % 360
        const sx = Math.cos((ph * Math.PI) / 180)
        ctx.strokeStyle = `rgba(255,255,255,${sx > 0 ? 0.1 : 0.04})`
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.ellipse(CX, CY, Math.abs(R * sx), R, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      /* 大陆点阵 */
      for (const [latD, lonD] of POINTS) {
        const lat2 = (latD * Math.PI) / 180
        const lon2 = ((lonD + rotation) * Math.PI) / 180
        const x3 = Math.cos(lat2) * Math.sin(lon2)
        const y3 = Math.sin(lat2)
        const z3 = Math.cos(lat2) * Math.cos(lon2)
        if (z3 < -0.05) continue
        const px = CX + R * x3
        const py = CY - R * y3
        const alpha = z3 < 0 ? 0.08 : 0.25 + z3 * 0.55
        ctx.fillStyle = `rgba(232,232,232,${alpha.toFixed(3)})`
        const sz = z3 > 0.6 ? 1.3 : 1
        ctx.fillRect(px, py, sz, sz)
      }

      /* 边缘品牌微光 */
      const g = ctx.createRadialGradient(CX, CY, R * 0.7, CX, CY, R + 10)
      g.addColorStop(0, 'rgba(124,136,240,0)')
      g.addColorStop(0.85, 'rgba(124,136,240,.05)')
      g.addColorStop(1, 'rgba(124,136,240,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(CX, CY, R + 10, 0, Math.PI * 2)
      ctx.fill()

      /* 球体轮廓 */
      ctx.strokeStyle = 'rgba(255,255,255,.16)'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.arc(CX, CY, R, 0, Math.PI * 2)
      ctx.stroke()

      /* 目标标记（运动中的 SIG-XXXX） */
      const tm = Date.now() / 900
      const tx = CX + Math.cos(tm * 0.7) * R * 0.45
      const ty = CY - Math.sin(tm * 0.5) * R * 0.3
      ctx.strokeStyle = 'rgba(124,136,240,.85)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(tx, ty, 5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#7c88f0'
      ctx.fillRect(tx - 0.8, ty - 0.8, 1.6, 1.6)
      ctx.strokeStyle = 'rgba(124,136,240,.35)'
      ctx.beginPath()
      ctx.moveTo(tx + 7, ty - 7)
      ctx.lineTo(tx + 22, ty - 22)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,.5)'
      ctx.font = '8px ui-monospace, monospace'
      ctx.fillText('SIG-' + String(Math.floor(tm % 9000)).padStart(4, '0'), tx + 24, ty - 24)
    }

    const loop = () => {
      rot = (rot + 0.06) % 360
      draw(rot)
      raf = requestAnimationFrame(loop)
    }

    if (reduced) {
      draw(20) // 静态一帧
    } else {
      loop()
    }
    return () => cancelAnimationFrame(raf)
  }, [width, height, radius])

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="思辩星球点阵地球，缓慢自转"
    />
  )
}
