/**
 * FUIPageBg — FUI 风格页面级动态背景
 *
 * 每个功能页面注入一个 variant，生成对应的 canvas 动画背景：
 * - arena:    辩论室（脉冲同心圆 + 准星）
 * - link:     1v1 对话（数据流 + 波形）
 * - broadcast: 观点广场（信号塔广播波）
 * - analytics: 统计仪表盘（柱状图剪影 + 网格）
 * - combat:   PK 房间（对峙力线 + 战术格）
 * - archive:  知识库（扫描光束 + 书架格）
 * - config:   设置页（终端代码雨）
 * - control:  后台管理（多面板 HUD）
 * - log:      历史记录（时间线滚动）
 * - habitat:  宠物商城（像素格脉冲）
 * - match:    匹配面板（节点连线网络）
 * - scene:    场景模式（聚光灯 + 舞台格）
 *
 * 纯 canvas 2D，零依赖，尊重 prefers-reduced-motion
 */

import { useEffect, useRef } from 'react'

export type FUIBgVariant =
  | 'arena' | 'link' | 'broadcast' | 'analytics' | 'combat'
  | 'archive' | 'config' | 'control' | 'log' | 'habitat'
  | 'match' | 'scene'

interface Props {
  variant: FUIBgVariant
  /** 页面编号（如 "02"）显示在背景左上角 */
  index?: string
  /** 页面英文标签（如 "ARENA"）显示在背景 */
  label?: string
}

const ACCENT = '124, 136, 240' // #7c88f0 in RGB
const INK = '232, 232, 232'
const INK_DIM = '90, 90, 90'
const LINE = '255, 255, 255'

export function FUIPageBg({ variant, index, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let t = 0
    let w = 0, h = 0, dpr = 1

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = parent.clientWidth
      h = parent.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // ── 公共绘制工具 ──
    const drawGrid = (alpha: number, gap: number) => {
      ctx.strokeStyle = `rgba(${LINE}, ${alpha})`
      ctx.lineWidth = 1
      for (let x = 0; x < w; x += gap) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
      }
      for (let y = 0; y < h; y += gap) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
      }
    }

    const drawCorners = (x: number, y: number, s = 16) => {
      ctx.strokeStyle = `rgba(${INK_DIM}, 0.5)`
      ctx.lineWidth = 1
      // TL
      ctx.beginPath(); ctx.moveTo(x, y + s); ctx.lineTo(x, y); ctx.lineTo(x + s, y); ctx.stroke()
      // TR
      ctx.beginPath(); ctx.moveTo(x + w - s, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + s); ctx.stroke()
      // BL
      ctx.beginPath(); ctx.moveTo(x, y + h - s); ctx.lineTo(x, y + h); ctx.lineTo(x + s, y + h); ctx.stroke()
      // BR
      ctx.beginPath(); ctx.moveTo(x + w - s, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - s); ctx.stroke()
    }

    const drawLabel = () => {
      if (!index && !label) return
      ctx.font = '10px ui-monospace, "JetBrains Mono", monospace'
      ctx.fillStyle = `rgba(${INK_DIM}, 0.35)`
      ctx.textBaseline = 'top'
      if (index) {
        ctx.fillText(`[ ${index} ]`, 16, 14)
      }
      if (label) {
        ctx.fillText(label, 16, 28)
      }
    }

    // ── 变体绘制 ──

    // arena: 脉冲同心圆 + 中心准星
    const drawArena = () => {
      drawGrid(0.018, 48)
      const cx = w * 0.5, cy = h * 0.5
      const maxR = Math.min(w, h) * 0.42
      for (let i = 0; i < 5; i++) {
        const phase = (t * 0.0006 + i * 0.2) % 1
        const r = phase * maxR
        const a = (1 - phase) * 0.15
        ctx.strokeStyle = `rgba(${ACCENT}, ${a})`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
      }
      // 中心准星
      ctx.strokeStyle = `rgba(${INK_DIM}, 0.4)`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 5, cy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 14, cy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy - 5); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 14); ctx.stroke()
      drawCorners(8, 8)
      drawLabel()
    }

    // link: 数据流 + 波形
    const drawLink = () => {
      drawGrid(0.015, 64)
      const cy = h * 0.5
      // 三条波形
      for (let ch = 0; ch < 3; ch++) {
        const offsetY = (ch - 1) * 40
        ctx.strokeStyle = `rgba(${ACCENT}, ${0.10 - ch * 0.02})`
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let x = 0; x <= w; x += 4) {
          const y = cy + offsetY + Math.sin(x * 0.012 + t * 0.002 + ch) * 18 * Math.sin(x * 0.003 + t * 0.001)
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      // 流动数据点
      for (let i = 0; i < 6; i++) {
        const px = ((t * 0.04 + i * 120) % (w + 40)) - 20
        const py = cy + Math.sin(px * 0.012 + t * 0.002) * 18
        ctx.fillStyle = `rgba(${INK}, 0.25)`
        ctx.fillRect(px, py - 1.5, 3, 3)
      }
      drawCorners(8, 8)
      drawLabel()
    }

    // broadcast: 信号塔广播波
    const drawBroadcast = () => {
      drawGrid(0.015, 56)
      const cx = w * 0.5, cy = h * 0.55
      const maxR = Math.min(w, h) * 0.5
      for (let i = 0; i < 6; i++) {
        const phase = (t * 0.0005 + i * 0.167) % 1
        const r = phase * maxR
        const a = (1 - phase) * 0.10
        ctx.strokeStyle = `rgba(${ACCENT}, ${a})`
        ctx.lineWidth = 1
        // 半圆（朝上）
        ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.stroke()
      }
      // 塔基
      ctx.strokeStyle = `rgba(${INK_DIM}, 0.3)`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + 30); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx - 16, cy + 30); ctx.lineTo(cx + 16, cy + 30); ctx.stroke()
      drawCorners(8, 8)
      drawLabel()
    }

    // analytics: 柱状图剪影 + 网格
    const drawAnalytics = () => {
      drawGrid(0.022, 40)
      const barCount = 24
      const barW = w / barCount
      const baseY = h - 12
      for (let i = 0; i < barCount; i++) {
        const seed = Math.sin(i * 2.3 + t * 0.0008) * 0.5 + 0.5
        const barH = 20 + seed * (h * 0.3)
        ctx.fillStyle = `rgba(${INK}, ${0.025 + seed * 0.03})`
        ctx.fillRect(i * barW + 2, baseY - barH, barW - 4, barH)
        ctx.strokeStyle = `rgba(${INK_DIM}, 0.12)`
        ctx.lineWidth = 0.5
        ctx.strokeRect(i * barW + 2, baseY - barH, barW - 4, barH)
      }
      // 底部刻度线
      ctx.strokeStyle = `rgba(${INK_DIM}, 0.3)`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, baseY); ctx.lineTo(w, baseY); ctx.stroke()
      drawCorners(8, 8)
      drawLabel()
    }

    // combat: 对峙力线
    const drawCombat = () => {
      drawGrid(0.02, 50)
      const cy = h * 0.5
      // 左右对峙线
      for (let i = 0; i < 8; i++) {
        const phase = (t * 0.001 + i * 0.125) % 1
        const reach = phase * w * 0.42
        const a = (1 - phase) * 0.12
        // 左→右
        ctx.strokeStyle = `rgba(${INK}, ${a})`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(10, cy + (i - 4) * 22); ctx.lineTo(10 + reach, cy + (i - 4) * 22); ctx.stroke()
        // 右→左
        ctx.strokeStyle = `rgba(${ACCENT}, ${a})`
        ctx.beginPath(); ctx.moveTo(w - 10, cy + (i - 4) * 22); ctx.lineTo(w - 10 - reach, cy + (i - 4) * 22); ctx.stroke()
      }
      // 中线
      ctx.strokeStyle = `rgba(${INK_DIM}, 0.15)`
      ctx.setLineDash([4, 4])
      ctx.beginPath(); ctx.moveTo(w * 0.5, 20); ctx.lineTo(w * 0.5, h - 20); ctx.stroke()
      ctx.setLineDash([])
      drawCorners(8, 8)
      drawLabel()
    }

    // archive: 扫描光束 + 书架格
    const drawArchive = () => {
      drawGrid(0.018, 52)
      // 垂直书架线
      for (let x = 60; x < w; x += 80) {
        ctx.strokeStyle = `rgba(${INK_DIM}, 0.06)`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, h - 40); ctx.stroke()
      }
      // 扫描光束（水平移动）
      const beamX = (t * 0.03) % w
      const beamGrad = ctx.createLinearGradient(beamX - 60, 0, beamX + 60, 0)
      beamGrad.addColorStop(0, `rgba(${ACCENT}, 0)`)
      beamGrad.addColorStop(0.5, `rgba(${ACCENT}, 0.06)`)
      beamGrad.addColorStop(1, `rgba(${ACCENT}, 0)`)
      ctx.fillStyle = beamGrad
      ctx.fillRect(beamX - 60, 0, 120, h)
      drawCorners(8, 8)
      drawLabel()
    }

    // config: 终端代码雨
    const drawConfig = () => {
      drawGrid(0.015, 60)
      const cols = Math.floor(w / 20)
      for (let i = 0; i < cols; i++) {
        const x = i * 20 + 10
        const speed = 0.3 + (i % 7) * 0.1
        const yLen = 40 + (i % 5) * 20
        const yBase = ((t * speed * 0.1) % (h + yLen)) - yLen
        ctx.fillStyle = `rgba(${INK}, 0.04)`
        ctx.font = '10px ui-monospace, monospace'
        const chars = ['0', '1', '#', '$', '%', '+', '-', '|', '/']
        for (let j = 0; j < yLen / 14; j++) {
          const ch = chars[(i + j) % chars.length]
          ctx.fillText(ch, x, yBase + j * 14)
        }
      }
      drawCorners(8, 8)
      drawLabel()
    }

    // control: 多面板 HUD
    const drawControl = () => {
      drawGrid(0.02, 44)
      // 面板分割线
      ctx.strokeStyle = `rgba(${INK_DIM}, 0.08)`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(w * 0.33, 10); ctx.lineTo(w * 0.33, h - 10); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(w * 0.67, 10); ctx.lineTo(w * 0.67, h - 10); ctx.stroke()
      // 旋转扫描扇形
      const cx = w * 0.5, cy = h * 0.5
      const angle = t * 0.0008
      const grad = ctx.createConicGradient ? ctx.createConicGradient(angle, cx, cy) : null
      if (grad) {
        grad.addColorStop(0, `rgba(${ACCENT}, 0.05)`)
        grad.addColorStop(0.15, `rgba(${ACCENT}, 0)`)
        grad.addColorStop(1, `rgba(${ACCENT}, 0)`)
        ctx.fillStyle = grad
        ctx.fillRect(cx - 200, cy - 200, 400, 400)
      }
      drawCorners(8, 8)
      drawLabel()
    }

    // log: 时间线滚动
    const drawLog = () => {
      drawGrid(0.015, 56)
      // 水平时间线
      const lineY = h * 0.5
      ctx.strokeStyle = `rgba(${INK_DIM}, 0.15)`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(20, lineY); ctx.lineTo(w - 20, lineY); ctx.stroke()
      // 滚动节点
      const nodeCount = 12
      for (let i = 0; i < nodeCount; i++) {
        const px = ((t * 0.02 + i * (w / 6)) % (w + 40)) - 20
        const isMajor = i % 3 === 0
        ctx.fillStyle = isMajor ? `rgba(${ACCENT}, 0.3)` : `rgba(${INK_DIM}, 0.25)`
        ctx.beginPath(); ctx.arc(px, lineY, isMajor ? 3 : 1.5, 0, Math.PI * 2); ctx.fill()
        if (isMajor) {
          ctx.strokeStyle = `rgba(${INK_DIM}, 0.1)`
          ctx.beginPath(); ctx.moveTo(px, lineY); ctx.lineTo(px, lineY - 24); ctx.stroke()
        }
      }
      drawCorners(8, 8)
      drawLabel()
    }

    // habitat: 像素格脉冲
    const drawHabitat = () => {
      const gap = 32
      drawGrid(0.02, gap)
      // 像素脉冲
      const pulse = (Math.sin(t * 0.001) * 0.5 + 0.5)
      for (let x = gap; x < w; x += gap) {
        for (let y = gap; y < h; y += gap) {
          const d = Math.hypot(x - w * 0.5, y - h * 0.5)
          const wave = Math.sin(d * 0.02 - t * 0.003) * 0.5 + 0.5
          if (wave > 0.7) {
            ctx.fillStyle = `rgba(${INK}, ${0.03 + wave * 0.04})`
            ctx.fillRect(x - 3, y - 3, 6, 6)
          }
        }
      }
      drawCorners(8, 8)
      drawLabel()
    }

    // match: 节点连线网络
    const drawMatch = () => {
      drawGrid(0.015, 64)
      const nodeCount = 14
      const nodes: { x: number; y: number; vx: number; vy: number }[] = []
      for (let i = 0; i < nodeCount; i++) {
        const seed = i * 1.7
        nodes.push({
          x: (Math.sin(seed * 2.1) * 0.5 + 0.5) * w,
          y: (Math.cos(seed * 1.3) * 0.5 + 0.5) * h,
          vx: Math.sin(seed) * 0.3,
          vy: Math.cos(seed) * 0.3,
        })
      }
      // 连线
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.hypot(dx, dy)
          if (dist < 200) {
            const a = (1 - dist / 200) * 0.06
            ctx.strokeStyle = `rgba(${INK}, ${a})`
            ctx.lineWidth = 0.5
            ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke()
          }
        }
      }
      // 节点
      nodes.forEach((n, i) => {
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > w) n.vx *= -1
        if (n.y < 0 || n.y > h) n.vy *= -1
        const isHub = i % 5 === 0
        ctx.fillStyle = isHub ? `rgba(${ACCENT}, 0.4)` : `rgba(${INK_DIM}, 0.3)`
        ctx.beginPath(); ctx.arc(n.x, n.y, isHub ? 2.5 : 1.5, 0, Math.PI * 2); ctx.fill()
      })
      drawCorners(8, 8)
      drawLabel()
    }

    // scene: 聚光灯 + 舞台格
    const drawScene = () => {
      drawGrid(0.018, 48)
      const cx = w * 0.5, cy = h * 0.35
      // 聚光锥
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.5)
      grad.addColorStop(0, `rgba(${ACCENT}, 0.04)`)
      grad.addColorStop(0.5, `rgba(${ACCENT}, 0.015)`)
      grad.addColorStop(1, `rgba(${ACCENT}, 0)`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
      // 舞台地面透视线
      ctx.strokeStyle = `rgba(${INK_DIM}, 0.08)`
      ctx.lineWidth = 1
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(cx + i * 60, cy); ctx.lineTo(cx + i * 180, h); ctx.stroke()
      }
      drawCorners(8, 8)
      drawLabel()
    }

    const drawMap: Record<FUIBgVariant, () => void> = {
      arena: drawArena,
      link: drawLink,
      broadcast: drawBroadcast,
      analytics: drawAnalytics,
      combat: drawCombat,
      archive: drawArchive,
      config: drawConfig,
      control: drawControl,
      log: drawLog,
      habitat: drawHabitat,
      match: drawMatch,
      scene: drawScene,
    }

    const render = () => {
      ctx.clearRect(0, 0, w, h)
      drawMap[variant]()
      t += 16
      raf = requestAnimationFrame(render)
    }

    if (reduced) {
      // 只画一帧静态
      ctx.clearRect(0, 0, w, h)
      drawMap[variant]()
    } else {
      render()
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [variant, index, label])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.9,
      }}
    />
  )
}
