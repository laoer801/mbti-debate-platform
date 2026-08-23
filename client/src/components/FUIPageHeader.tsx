/**
 * FUIPageHeader — FUI 风格页面头
 *
 * 参考图 4 的编号分格标题结构：
 * [编号] 英文标题 · 中文副标 · 右侧状态指示
 *
 * 每个功能页面顶部注入，提供一致的 FUI 章节感
 */

interface Props {
  index: string         // 页面编号，如 "02"
  title: string         // 英文标题，如 "ARENA"
  subtitle?: string     // 中文副标，如 "辩论室"
  status?: string       // 右侧状态文字，如 "DUEL · LIVE"
  live?: boolean        // 右侧呼吸点
  right?: React.ReactNode // 自定义右侧内容
}

export function FUIPageHeader({ index, title, subtitle, status, live, right }: Props) {
  return (
    <div
      className="fui-page-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid var(--fui-line-soft)',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {/* 编号 */}
        <span
          style={{
            fontFamily: 'var(--fui-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            color: 'var(--fui-ink-3)',
            border: '1px solid var(--fui-line)',
            padding: '2px 7px',
            flexShrink: 0,
          }}
        >
          {index}
        </span>
        {/* 英文标题 */}
        <span
          style={{
            fontFamily: 'var(--fui-mono)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: 'var(--fui-ink)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </span>
        {/* 中文副标 */}
        {subtitle && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--fui-ink-2)',
              whiteSpace: 'nowrap',
              opacity: 0.7,
            }}
          >
            · {subtitle}
          </span>
        )}
      </div>

      {/* 右侧 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {right}
        {status && (
          <span
            style={{
              fontFamily: 'var(--fui-mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              color: 'var(--fui-ink-3)',
            }}
          >
            {status}
          </span>
        )}
        {live && (
          <span className="fui-live">
            <i />
            LIVE
          </span>
        )}
      </div>
    </div>
  )
}
