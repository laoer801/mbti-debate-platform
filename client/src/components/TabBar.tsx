import { useState, useEffect } from 'react'
import { TabId } from '../types'
import { Home, MessageSquare, LayoutGrid, TrendingUp, Heart, History, BarChart3, Settings, Swords, PawPrint, Menu, X, MessagesSquare, BookOpen, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../hooks/useAuth'
import { usePresence } from '../hooks/usePresence'

const tabs: { id: TabId; label: string; en: string; icon: typeof Home; shortcut: string }[] = [
  { id: 'hall', label: '人格大厅', en: 'HALL', icon: Home, shortcut: '1' },
  { id: 'debate', label: '辩论室', en: 'ARENA', icon: MessageSquare, shortcut: '2' },
  { id: 'scene', label: '场景模式', en: 'SCENE', icon: LayoutGrid, shortcut: '3' },
  { id: 'square', label: '观点广场', en: 'SQUARE', icon: TrendingUp, shortcut: '4' },
  { id: 'match', label: '匹配推荐', en: 'MATCH', icon: Heart, shortcut: '5' },
  { id: 'history', label: '战斗记录', en: 'LOG', icon: History, shortcut: '6' },
  { id: 'stats', label: '数据统计', en: 'STATS', icon: BarChart3, shortcut: '7' },
  { id: 'pk', label: 'PK房间', en: 'PK', icon: Swords, shortcut: '8' },
  { id: 'pets', label: '宠物商城', en: 'PETS', icon: PawPrint, shortcut: '9' },
  { id: 'chat', label: '1v1对话', en: 'CHAT', icon: MessagesSquare, shortcut: 'Q' },
  { id: 'library', label: '知识库', en: 'LIB', icon: BookOpen, shortcut: 'K' },
  { id: 'settings', label: '设置', en: 'SYS', icon: Settings, shortcut: '0' },
]

/** 抽屉菜单分组 */
const drawerGroups: { label: string; items: TabId[] }[] = [
  { label: '人格大厅', items: ['hall'] },
  { label: '辩论场', items: ['debate', 'scene', 'pk', 'chat'] },
  { label: '观点广场', items: ['square', 'match'] },
  { label: '我的空间', items: ['history', 'stats', 'pets', 'library'] },
  { label: '系统', items: ['settings'] },
]

interface TabBarProps {
  activeTab: TabId
  onChange: (tab: TabId) => void
  debateCount?: number
  notificationDot?: TabId | null
  onLoginClick: () => void
}

export function TabBar({ activeTab, onChange, debateCount, notificationDot, onLoginClick }: TabBarProps) {
  const { isLoggedIn, user, logout } = useAuth()
  const { onlineCount, connected } = usePresence()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [clock, setClock] = useState('')

  // FUI 实时时钟
  useEffect(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const tick = () => {
      const n = new Date()
      setClock(`${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // 抽屉打开时锁定滚动 + Esc 关闭
  useEffect(() => {
    if (!drawerOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  const handleSelect = (tab: TabId) => {
    onChange(tab)
    setDrawerOpen(false)
  }

  return (
    <nav
      className="relative flex items-center h-14 px-4 z-10"
      style={{
        borderBottom: '1px solid var(--fui-line)',
        background: 'rgba(5, 5, 5, 0.82)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
      role="tablist"
      aria-label="主导航"
    >
      {/* Logo：线框星球标记 + mono 字标 */}
      <div className="flex items-center gap-2.5 mr-4 pr-4" style={{ borderRight: '1px solid var(--fui-line-soft)' }}>
        <span
          aria-hidden="true"
          className="relative inline-block w-[11px] h-[11px] rounded-full"
          style={{ border: '1.5px solid var(--fui-ink)' }}
        >
          <span className="absolute rounded-full" style={{ inset: 2, background: 'var(--fui-accent)' }} />
        </span>
        <span className="hidden sm:block text-[13px] font-semibold" style={{ fontFamily: 'var(--fui-mono)', letterSpacing: '0.22em', color: 'var(--fui-ink)' }}>
          DEBATESPHERE
        </span>
        <span className="hidden lg:block fui-tag" style={{ fontSize: 8 }}>DS-2.0</span>
      </div>

      {/* 桌面端横向标签（md 及以上）：FUI mono 线框 */}
      <div className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto py-1">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              onClick={() => handleSelect(tab.id)}
              className={clsx('fui-tab relative', isActive && 'on')}
              title={tab.label}
            >
              {tab.en}
              {tab.id === 'debate' && debateCount && debateCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {debateCount}
                </span>
              )}
              {notificationDot === tab.id && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--fui-accent)' }} />
              )}
            </button>
          )
        })}
      </div>

      {/* 抽屉菜单遮罩 */}
      <div
        className={clsx('drawer-overlay', drawerOpen && 'drawer-open')}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* 全屏抽屉菜单（右侧展开）— FUI 化 */}
      <div
        className={clsx('drawer-menu', drawerOpen && 'drawer-open')}
        role="dialog"
        aria-modal="true"
        aria-label="全屏导航菜单"
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-2 safe-top">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="relative inline-block w-[11px] h-[11px] rounded-full"
              style={{ border: '1.5px solid var(--fui-ink)' }}
            >
              <span className="absolute rounded-full" style={{ inset: 2, background: 'var(--fui-accent)' }} />
            </span>
            <span className="text-base font-semibold" style={{ fontFamily: 'var(--fui-mono)', letterSpacing: '0.22em', color: 'var(--fui-ink)' }}>
              DEBATESPHERE
            </span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="fui-btn"
            style={{ padding: '8px 10px' }}
            aria-label="关闭菜单"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {drawerGroups.map(group => (
            <div key={group.label} className="mb-2">
              <div className="fui-tag px-2 pt-3 pb-1.5" style={{ letterSpacing: '0.24em' }}>{group.label}</div>
              {group.items.map((id, gi) => {
                const tab = tabs.find(t => t.id === id)!
                const isActive = activeTab === id
                return (
                  <button
                    key={id}
                    role="menuitem"
                    aria-label={tab.label}
                    onClick={() => handleSelect(id)}
                    className={clsx('drawer-item w-full text-left', isActive && 'active')}
                  >
                    <span className="drawer-num w-6">{String(gi + 1).padStart(2, '0')}</span>
                    <tab.icon size={18} style={{ color: isActive ? 'var(--fui-accent)' : undefined }} />
                    <span className="text-base">{tab.label}</span>
                    <span className="fui-tag ml-2" style={{ fontSize: 8 }}>{tab.en}</span>
                    {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'var(--fui-accent)' }} />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="px-6 pb-8 safe-bottom">
          <p className="fui-tag" style={{ lineHeight: 2 }}>
            SIXTEEN MINDS. ONE ARENA.<br />用逻辑和观点，探索世界的 B 面
          </p>
        </div>
      </div>

      {/* 抽屉触发按钮 */}
      <button
        className="fui-btn ml-1"
        style={{ padding: '7px 9px' }}
        aria-label={drawerOpen ? '关闭导航菜单' : '打开全屏导航菜单'}
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(v => !v)}
      >
        {drawerOpen ? <X size={15} /> : <Menu size={15} />}
      </button>

      {/* User section */}
      <div className="flex items-center gap-2.5 ml-auto flex-shrink-0">
        {/* FUI 实时时钟 */}
        <span className="hidden xl:block fui-tag fui-tabular" style={{ color: 'var(--fui-ink-2)', fontSize: 10 }}>
          {clock}
        </span>
        {/* 在线人数徽章（FUI 线框版） */}
        {connected && (
          <span
            className="hidden sm:flex fui-live"
            style={{ border: '1px solid var(--fui-line)', padding: '5px 10px' }}
            title="当前在线人数（含游客）"
          >
            <i />
            <span className="fui-tabular">{onlineCount}</span> ONLINE
          </span>
        )}
        {isLoggedIn ? (
          <div className="flex items-center gap-2">
            <span className="fui-tag hidden lg:block" style={{ color: 'var(--fui-ink-2)' }}>
              {user?.username}
              {user?.mbtiType && <span style={{ color: 'var(--fui-ink-3)' }}> ({user.mbtiType})</span>}
              {user?.role === 'admin' && (
                <span className="fui-idx-badge ml-1.5" style={{ color: 'var(--fui-accent)', borderColor: 'rgba(124,136,240,.4)', fontSize: 8 }}>ADMIN</span>
              )}
            </span>
            {user?.role === 'admin' && (
              <button
                onClick={() => onChange('admin')}
                className={clsx('fui-tab', activeTab === 'admin' && 'on')}
                title="后台管理：数据看板 / 用户 / 内容"
              >
                <ShieldCheck size={12} className="inline -mt-0.5 mr-1" />
                ADMIN
              </button>
            )}
            <button onClick={logout} className="fui-btn" style={{ padding: '6px 12px', fontSize: 10 }}>
              EXIT
            </button>
          </div>
        ) : (
          <button onClick={onLoginClick} className="fui-btn-primary" style={{ padding: '7px 16px', fontSize: 10 }}>
            LOGIN
          </button>
        )}
      </div>
    </nav>
  )
}
