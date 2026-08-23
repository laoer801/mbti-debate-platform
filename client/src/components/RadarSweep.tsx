/**
 * RadarSweep — FUI 扫描雷达（SVG）
 * 同心圆 + 十字线 + 旋转扫描束（品牌蓝紫，CSS 动画，reduced-motion 自动停）
 */
interface RadarSweepProps {
  size?: number
  className?: string
}

export function RadarSweep({ size = 148, className }: RadarSweepProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      fill="none"
      role="img"
      aria-label="人格信号扫描雷达"
    >
      <circle cx="50" cy="50" r="48" stroke="rgba(255,255,255,.12)" strokeWidth=".6" />
      <circle cx="50" cy="50" r="34" stroke="rgba(255,255,255,.12)" strokeWidth=".6" />
      <circle cx="50" cy="50" r="20" stroke="rgba(255,255,255,.12)" strokeWidth=".6" />
      <line x1="50" y1="2" x2="50" y2="98" stroke="rgba(255,255,255,.1)" strokeWidth=".6" />
      <line x1="2" y1="50" x2="98" y2="50" stroke="rgba(255,255,255,.1)" strokeWidth=".6" />
      <g className="fui-radar-sweep">
        <line x1="50" y1="50" x2="50" y2="4" stroke="#7c88f0" strokeWidth="1" strokeOpacity=".8" />
      </g>
      <circle cx="66" cy="30" r="1.6" fill="#e8e8e8" />
      <circle cx="34" cy="62" r="1.2" fill="#a0a0a0" />
      <circle cx="50" cy="50" r="2" fill="#e8e8e8" />
    </svg>
  )
}
