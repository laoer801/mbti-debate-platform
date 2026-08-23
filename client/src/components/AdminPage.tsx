import { useState, useCallback, useEffect } from 'react'
import { API_BASE } from '../config'
import { getToken } from '../hooks/useAuth'
import { usePresence } from '../hooks/usePresence'
import { mbtiProfiles } from '../data/mbtiProfiles'
import { Users, LayoutDashboard, FileText, ShieldCheck, ShieldOff, Plus, Trash2, Save, RefreshCw, Activity, MessageSquare, Swords, BarChart3 } from 'lucide-react'

interface Stats {
  online: { count: number; users: { username: string; mbtiType: string | null; joinedAt: number }[] }
  totalUsers: number
  totalSessions: number
  totalPKRooms: number
  totalPosts: number
  totalMessages: number
  personaHeat: { type: string; count: number }[]
  registrations7d: { day: number; count: number }[]
  debates7d: { day: number; count: number }[]
}

interface AdminUser {
  id: string
  username: string
  mbti_type: string | null
  avatar: string
  bio: string
  role: 'admin' | 'user'
  banned: number
  created_at: number
  login_at: number | null
}

interface Topic {
  id: string
  title: string
  description: string
  sides: string
  active: number
  created_at: number
}

interface Override {
  type_id: string
  system_prompt_override: string
  path_advice_override: string
  updated_at: number
}

type AdminTab = 'dashboard' | 'users' | 'content'

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `请求失败 (${res.status})`)
  }
  return res.json()
}

function fmtTime(ts?: number | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtDay(day: number): string {
  const d = new Date(day * 86400000)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: number | string; color: string }) {
  return (
    <div className="p-4 rounded-2xl flex items-center gap-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}1a`, color }}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-bold leading-none" style={{ color: 'var(--color-text)' }}>{value}</div>
        <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{label}</div>
      </div>
    </div>
  )
}

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('dashboard')
  const { onlineUsers } = usePresence()
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [overrides, setOverrides] = useState<Override[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const showNotice = useCallback((msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(''), 2500)
  }, [])

  const loadStats = useCallback(async () => {
    try {
      setStats(await api<Stats>('/api/admin/stats'))
    } catch (e: any) { setError(e.message) }
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      const data = await api<{ users: AdminUser[] }>('/api/admin/users')
      setUsers(data.users)
    } catch (e: any) { setError(e.message) }
  }, [])

  const loadTopics = useCallback(async () => {
    try {
      const data = await api<{ topics: Topic[] }>('/api/admin/topics')
      setTopics(data.topics)
    } catch (e: any) { setError(e.message) }
  }, [])

  const loadOverrides = useCallback(async () => {
    try {
      const data = await api<{ overrides: Override[] }>('/api/admin/overrides')
      setOverrides(data.overrides)
    } catch (e: any) { setError(e.message) }
  }, [])

  // 切换 tab 时按需加载
  useEffect(() => {
    setError('')
    if (tab === 'dashboard') loadStats()
    if (tab === 'users') loadUsers()
    if (tab === 'content') { loadTopics(); loadOverrides() }
  }, [tab, loadStats, loadUsers, loadTopics, loadOverrides])

  // 实时在线：presence 每 5s 与 stats 合并展示
  const liveOnline = onlineUsers.length > 0 ? onlineUsers : stats?.online.users || []

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-5xl mx-auto space-y-4">
        {/* 头部 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <ShieldCheck size={20} style={{ color: '#e897b5' }} />
              后台管理
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              运营看板 · 用户管理 · 内容管理（仅管理员可见）
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); Promise.all([loadStats(), loadUsers()]).finally(() => setLoading(false)) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
            style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>

        {notice && (
          <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(34,197,94,0.12)', color: '#2fc9a3' }}>{notice}</div>
        )}
        {error && (
          <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(231,76,60,0.15)', color: '#e74c3c' }}>{error}</div>
        )}

        {/* 子导航 */}
        <div className="flex gap-2 flex-wrap">
          {([
            { id: 'dashboard', label: '数据看板', icon: LayoutDashboard },
            { id: 'users', label: '用户管理', icon: Users },
            { id: 'content', label: '内容管理', icon: FileText },
          ] as { id: AdminTab; label: string; icon: typeof Users }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={tab === t.id
                ? { background: 'var(--gradient-brand)', color: '#fff', boxShadow: 'var(--glow-accent)' }
                : { background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ========== 数据看板 ========== */}
        {tab === 'dashboard' && (
          <div className="space-y-4">
            {/* 在线面板（实时） */}
            <div className="p-5 rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid rgba(34,211,238,0.25)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="relative flex w-2.5 h-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: '#66c4d4' }} />
                  <span className="relative inline-flex rounded-full w-2.5 h-2.5" style={{ background: '#66c4d4' }} />
                </span>
                <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  实时在线 <span className="text-lg" style={{ color: '#66c4d4' }}>{liveOnline.length}</span> 人
                </span>
                <Activity size={16} style={{ color: '#66c4d4' }} />
              </div>
              {liveOnline.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>暂无在线用户——把应用分享给朋友，同一个局域网/服务器就能看到大家在线</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {liveOnline.map((u, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', color: 'var(--color-text)' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#66c4d4' }} />
                      {u.username}
                      {u.mbtiType && <span className="text-xs opacity-60">({u.mbtiType})</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Users} label="注册用户" value={stats?.totalUsers ?? '—'} color="#e897b5" />
              <StatCard icon={MessageSquare} label="辩论场次" value={stats?.totalSessions ?? '—'} color="#66c4d4" />
              <StatCard icon={Swords} label="PK 房间" value={stats?.totalPKRooms ?? '—'} color="#a79bf0" />
              <StatCard icon={BarChart3} label="发言总数" value={stats?.totalMessages ?? '—'} color="#d9b871" />
            </div>

            {/* 人格热度 */}
            <div className="p-5 rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>人格热度分布（注册用户）</h3>
              {(stats?.personaHeat?.length ?? 0) === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>暂无数据</p>
              ) : (
                <div className="space-y-2">
                  {stats!.personaHeat.slice(0, 8).map(h => {
                    const max = stats!.personaHeat[0]?.count || 1
                    const profile = mbtiProfiles.find(p => p.id === h.type)
                    return (
                      <div key={h.type} className="flex items-center gap-3">
                        <span className="w-16 text-xs font-medium flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                          {profile ? `${profile.emoji} ${h.type}` : h.type}
                        </span>
                        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-bg)' }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(h.count / max) * 100}%`, background: 'var(--gradient-brand)' }} />
                        </div>
                        <span className="text-xs w-6 text-right" style={{ color: 'var(--color-text)' }}>{h.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 7 天趋势 */}
            <div className="p-5 rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>近 7 天趋势</h3>
              <div className="flex items-end gap-2 h-28">
                {Array.from({ length: 7 }, (_, i) => {
                  const day = Math.floor(Date.now() / 86400000) - (6 - i)
                  const reg = stats?.registrations7d?.find(r => r.day === day)?.count || 0
                  const db = stats?.debates7d?.find(r => r.day === day)?.count || 0
                  const maxV = Math.max(1, ...(stats?.registrations7d || []).map(r => r.count), ...(stats?.debates7d || []).map(r => r.count))
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center gap-1" style={{ height: 96 }}>
                        <div className="w-3 rounded-t" style={{ height: `${(reg / maxV) * 92}px`, background: '#e897b5', opacity: 0.85 }} title={`注册 ${reg}`} />
                        <div className="w-3 rounded-t" style={{ height: `${(db / maxV) * 92}px`, background: '#66c4d4', opacity: 0.85 }} title={`辩论 ${db}`} />
                      </div>
                      <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{fmtDay(day)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#e897b5' }} />注册</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#66c4d4' }} />辩论</span>
              </div>
            </div>
          </div>
        )}

        {/* ========== 用户管理 ========== */}
        {tab === 'users' && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
              <span className="font-semibold" style={{ color: 'var(--color-text)' }}>用户列表（{users.length}）</span>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {users.length === 0 && <p className="p-5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>暂无用户</p>}
              {users.map(u => (
                <div key={u.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: 'var(--color-text)' }}>{u.username}</span>
                      {u.role === 'admin' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(244,114,182,0.15)', color: '#e897b5' }}>ADMIN</span>
                      )}
                      {u.banned === 1 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(231,76,60,0.15)', color: '#e74c3c' }}>已封禁</span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                      {u.mbti_type || '未填写 MBTI'} · 注册 {fmtTime(u.created_at)} · 最近登录 {fmtTime(u.login_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        try {
                          await api(`/api/admin/users/${u.id}/role`, { method: 'PUT', body: JSON.stringify({ role: u.role === 'admin' ? 'user' : 'admin' }) })
                          showNotice(u.role === 'admin' ? `已取消 ${u.username} 的管理员权限` : `已将 ${u.username} 设为管理员`)
                          loadUsers()
                        } catch (e: any) { setError(e.message) }
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                      style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                    >
                      {u.role === 'admin' ? '取消管理员' : '设为管理员'}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await api(`/api/admin/users/${u.id}/ban`, { method: 'PUT', body: JSON.stringify({ banned: u.banned === 1 ? 0 : 1 }) })
                          showNotice(u.banned === 1 ? `已解封 ${u.username}` : `已封禁 ${u.username}`)
                          loadUsers()
                        } catch (e: any) { setError(e.message) }
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                      style={u.banned === 1
                        ? { background: 'rgba(34,197,94,0.12)', color: '#2fc9a3', border: '1px solid rgba(34,197,94,0.3)' }
                        : { background: 'rgba(231,76,60,0.1)', color: '#e74c3c', border: '1px solid rgba(231,76,60,0.25)' }}
                    >
                      {u.banned === 1 ? <ShieldCheck size={12} /> : <ShieldOff size={12} />}
                      {u.banned === 1 ? '解封' : '封禁'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== 内容管理 ========== */}
        {tab === 'content' && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* 辩论主题 */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                  <Swords size={16} style={{ color: '#a79bf0' }} />辩论主题管理
                </h3>
                <button
                  onClick={async () => {
                    const title = window.prompt('新主题标题：')
                    if (!title?.trim()) return
                    try {
                      await api('/api/admin/topics', { method: 'POST', body: JSON.stringify({ title: title.trim() }) })
                      showNotice('主题已添加')
                      loadTopics()
                    } catch (e: any) { setError(e.message) }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                  style={{ background: 'var(--gradient-brand)', color: '#fff' }}
                >
                  <Plus size={13} />添加主题
                </button>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {topics.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>暂无云端主题（前端仍用内置主题）</p>}
                {topics.map(t => (
                  <div key={t.id} className="p-3 rounded-xl flex items-center gap-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{t.title}</div>
                      {t.description && <div className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{t.description}</div>}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: t.active === 1 ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.15)', color: t.active === 1 ? '#2fc9a3' : 'var(--color-text-tertiary)' }}>
                      {t.active === 1 ? '启用' : '停用'}
                    </span>
                    <button
                      onClick={async () => {
                        try {
                          await api(`/api/admin/topics/${t.id}`, { method: 'PUT', body: JSON.stringify({ active: t.active === 1 ? 0 : 1 }) })
                          loadTopics()
                        } catch (e: any) { setError(e.message) }
                      }}
                      className="text-xs px-2 py-1 rounded-lg transition-all hover:scale-105 flex-shrink-0"
                      style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                    >
                      {t.active === 1 ? '停用' : '启用'}
                    </button>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`删除主题「${t.title}」？`)) return
                        try {
                          await api(`/api/admin/topics/${t.id}`, { method: 'DELETE' })
                          showNotice('主题已删除')
                          loadTopics()
                        } catch (e: any) { setError(e.message) }
                      }}
                      className="p-1.5 rounded-lg transition-all hover:scale-110 flex-shrink-0"
                      style={{ color: '#e74c3c' }}
                      aria-label="删除主题"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 人格提示词覆盖 */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <h3 className="font-semibold mb-1 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <FileText size={16} style={{ color: '#e897b5' }} />人格提示词覆盖
              </h3>
              <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
                选择人格 → 编辑系统提示词（覆盖默认人格设定，同步到所有客户端）
              </p>
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {mbtiProfiles.map(p => {
                  const hasOv = overrides.some(o => o.type_id === p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        const ov = overrides.find(o => o.type_id === p.id)
                        const text = window.prompt(`编辑 ${p.id} ${p.name} 的系统提示词（留空=删除覆盖）`, ov?.system_prompt_override || '')
                        if (text === null) return
                        ;(async () => {
                          try {
                            if (text.trim() === '') {
                              await api(`/api/admin/overrides/${p.id}`, { method: 'DELETE' })
                              showNotice(`已清除 ${p.id} 的覆盖`)
                            } else {
                              await api(`/api/admin/overrides/${p.id}`, { method: 'PUT', body: JSON.stringify({ systemPromptOverride: text.trim() }) })
                              showNotice(`已保存 ${p.id} 的提示词覆盖`)
                            }
                            loadOverrides()
                          } catch (e: any) { setError(e.message) }
                        })()
                      }}
                      className="px-1 py-2 rounded-lg text-xs font-medium transition-all hover:scale-105"
                      style={{
                        background: hasOv ? 'rgba(244,114,182,0.15)' : 'var(--color-bg)',
                        color: hasOv ? '#e897b5' : 'var(--color-text-secondary)',
                        border: hasOv ? '1px solid rgba(244,114,182,0.4)' : '1px solid var(--color-border)',
                      }}
                      title={`${p.id} ${p.name}${hasOv ? '（已覆盖）' : ''}`}
                    >
                      {p.id}
                      {hasOv && <span className="ml-0.5">●</span>}
                    </button>
                  )
                })}
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {overrides.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>暂无覆盖，所有人格使用默认设定</p>}
                {overrides.map(o => {
                  const p = mbtiProfiles.find(pp => pp.id === o.type_id)
                  return (
                    <div key={o.type_id} className="p-3 rounded-xl" style={{ background: 'var(--color-bg)', border: '1px solid rgba(244,114,182,0.25)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{p?.emoji} {o.type_id} {p?.name}</span>
                        <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>更新于 {fmtTime(o.updated_at)}</span>
                      </div>
                      <p className="text-xs leading-relaxed line-clamp-3" style={{ color: 'var(--color-text-secondary)' }}>{o.system_prompt_override || o.path_advice_override || '（空）'}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
