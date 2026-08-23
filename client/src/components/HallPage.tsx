import { useState, useRef, useEffect, useCallback } from 'react'
import type { MouseEvent } from 'react'
import { motion } from 'framer-motion'
import { Category, TabId } from '../types'
import { mbtiProfiles } from '../data/mbtiProfiles'
import { recommendedTopics } from '../data/recommendedTopics'
import { Users, Search, FlaskConical, Swords, ArrowRight, LayoutGrid, Clock, BarChart3, BookOpen } from 'lucide-react'
import clsx from 'clsx'
import { PERSONA_SOURCES } from '../utils/debatePrompts'
// v31：人格状态 + 持久记忆（只读展示）
import { getOrInitState, describeMood, moodEmoji, energyLabel, intimacyLabel, type PersonaState } from '../utils/personaEngine'
import { getOrInitMemory, type PersonaMemory } from '../utils/personaMemory'
import { GlobeCanvas } from './GlobeCanvas'
import { DataStream } from './DataStream'
import { RadarSweep } from './RadarSweep'

interface HallPageProps {
  selectedTypes: string[]
  onToggleType: (typeId: string) => void
  onStartTest: () => void
  onStartDebate: () => void
  onNavigate?: (tab: TabId) => void
  onQuickStart?: (topic: string) => void
}

const categories: { id: Category; label: string; emoji: string }[] = [
  { id: 'all', label: '全部', emoji: '🌐' },
  { id: 'analyst', label: '分析家', emoji: '🔬' },
  { id: 'diplomat', label: '外交家', emoji: '🕊️' },
  { id: 'sentinel', label: '守护者', emoji: '🛡️' },
  { id: 'explorer', label: '探险家', emoji: '🗺️' },
]

/** v37 FUI 观测站：气质分组档案 */
const archiveGroups: { id: Category; code: string; en: string; zh: string; desc: string }[] = [
  { id: 'analyst', code: 'NT', en: 'ANALYSTS · RATIONAL MINDS', zh: '分析家', desc: '理性思辨 · 战略头脑' },
  { id: 'diplomat', code: 'NF', en: 'DIPLOMATS · EMPATHIC CORE', zh: '外交家', desc: '理想主义 · 共情洞察' },
  { id: 'sentinel', code: 'SJ', en: 'SENTINELS · ORDER KEEPERS', zh: '守护者', desc: '秩序守护 · 务实可靠' },
  { id: 'explorer', code: 'SP', en: 'EXPLORERS · KINETIC SPIRITS', zh: '探险家', desc: '感官体验 · 灵动应变' },
]

/** 人格全局编号 P-001 ~ P-016 */
const personaIndex = new Map(mbtiProfiles.map((p, i) => [p.id, `P-${String(i + 1).padStart(3, '0')}`]))

const topicCount = recommendedTopics.reduce((n, c) => n + c.topics.length, 0)

export function HallPage({ selectedTypes, onToggleType, onStartTest, onStartDebate, onNavigate }: HallPageProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')
  const [hotIdx, setHotIdx] = useState(0)
  const [clock, setClock] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)

  // v31：加载 16 人格各自的状态与记忆
  const [personaStates, setPersonaStates] = useState<Record<string, PersonaState>>({})
  const [personaMemories, setPersonaMemories] = useState<Record<string, PersonaMemory>>({})
  useEffect(() => {
    const states: Record<string, PersonaState> = {}
    const mems: Record<string, PersonaMemory> = {}
    for (const p of mbtiProfiles) {
      states[p.id] = getOrInitState(p.id)
      mems[p.id] = getOrInitMemory(p.id)
    }
    setPersonaStates(states)
    setPersonaMemories(mems)
  }, [])

  // 热门信号轮播
  useEffect(() => {
    const all = recommendedTopics.flatMap(c => c.topics)
    const timer = setInterval(() => setHotIdx(i => (i + 1) % all.length), 3200)
    return () => clearInterval(timer)
  }, [])

  // 实时时钟
  useEffect(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const tick = () => {
      const n = new Date()
      setClock(`${n.getFullYear()}/${pad(n.getMonth() + 1)}/${pad(n.getDate())} ${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // 点击「开始辩论」→ 粒子迸发（保留 v23 品牌仪式）
  const burstParticles = useCallback((e: MouseEvent<HTMLElement>) => {
    const x = e.clientX, y = e.clientY
    const colors = ['#e8e8e8', '#7c88f0', '#a0a0a0', '#ffffff']
    const burst = document.createElement('div')
    burst.className = 'particle-burst'
    burst.style.left = `${x}px`
    burst.style.top = `${y}px`
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('span')
      p.className = 'particle'
      const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.6
      const dist = 42 + Math.random() * 78
      p.style.setProperty('--px', `${Math.cos(angle) * dist}px`)
      p.style.setProperty('--py', `${Math.sin(angle) * dist}px`)
      p.style.background = colors[i % colors.length]
      const size = 3 + Math.random() * 4
      p.style.width = `${size}px`
      p.style.height = `${size}px`
      burst.appendChild(p)
    }
    document.body.appendChild(burst)
    setTimeout(() => burst.remove(), 1000)
  }, [])

  const hotTopicPool = recommendedTopics.flatMap(c => c.topics)
  const currentHot = hotTopicPool[hotIdx] || hotTopicPool[0]

  // 搜索/分类过滤（跨组）
  const visibleGroups = archiveGroups.map(g => ({
    ...g,
    members: mbtiProfiles.filter(p => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false
      if (p.category !== g.id) return false
      if (search && !p.name.includes(search.toUpperCase()) && !p.alias.includes(search) && !p.id.includes(search.toUpperCase())) return false
      return true
    }),
  })).filter(g => g.members.length > 0)

  const totalFiltered = visibleGroups.reduce((n, g) => n + g.members.length, 0)

  return (
    <div className="h-full overflow-y-auto" role="main" aria-label="人格大厅" style={{ background: 'transparent' }}>

      {/* ============ HUD Hero（超大 mono 标题 + 雷达） ============ */}
      <section className="relative px-6 pt-10 pb-8 max-w-6xl mx-auto">
        <span className="fui-crosshair" style={{ top: 20, right: '30%' }} aria-hidden="true" />
        <span className="fui-crosshair" style={{ bottom: 16, left: '22%' }} aria-hidden="true" />

        <div className="flex items-end justify-between gap-6 flex-wrap">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="fui-tag" style={{ color: 'var(--fui-ink-2)' }}>#</span>
              <span className="fui-tag" style={{ letterSpacing: '0.3em' }}>未来辩论观测协议 · FUTURE DEBATE PROTOCOL</span>
            </div>
            <h1
              className="font-bold leading-none"
              style={{
                fontFamily: 'var(--fui-mono)',
                fontSize: 'clamp(56px, 9vw, 116px)',
                letterSpacing: '-0.01em',
                color: 'var(--fui-ink)',
              }}
              aria-label="思辩星球"
            >
              SPHERE<span style={{ color: 'var(--fui-accent)' }}>.</span>
            </h1>
            <div className="mt-4 text-lg font-semibold" style={{ letterSpacing: '0.5em', color: 'var(--fui-ink-2)' }}>
              思 辩 星 球
            </div>
            <p className="fui-tag mt-2.5" style={{ letterSpacing: '0.28em' }}>
              SIXTEEN MINDS. ONE ARENA. — 16 种人格 · 一个擂台
            </p>
          </motion.div>

          <motion.div
            className="hidden md:flex flex-col items-end gap-3 pb-1"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }}
          >
            <RadarSweep size={132} />
            <div className="fui-tag text-right" style={{ lineHeight: 2 }}>
              SYS <b>ONLINE</b><br />MODE <b>OBSERVE</b><br />REV <b>DS-037</b>
            </div>
          </motion.div>
        </div>

        {/* 操作行 */}
        <motion.div
          className="mt-8 flex flex-wrap items-center gap-3"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}
        >
          <button
            onClick={e => { burstParticles(e); onStartDebate() }}
            className="fui-btn-primary"
            aria-label="开始辩论"
            disabled={selectedTypes.length < 2}
          >
            <Swords size={14} /> INITIATE DEBATE
            <span style={{ opacity: 0.65 }}>· {selectedTypes.length} SELECTED</span>
          </button>
          <button onClick={onStartTest} className="fui-btn" aria-label="人格匹配测试">
            <FlaskConical size={13} /> MATCH TEST
          </button>
          <span className="fui-live ml-2"><i />LIVE</span>
          {selectedTypes.length < 2 && (
            <span className="fui-tag fui-caret" style={{ color: 'var(--fui-ink-3)' }}>
              在下方矩阵选择 2 位以上辩手以点亮
            </span>
          )}
        </motion.div>
      </section>

      {/* ============ 观测控制台三分格 ============ */}
      <section className="px-6 max-w-6xl mx-auto">
        <motion.div
          className="grid gap-px lg:grid-cols-[290px_1fr_310px] grid-cols-1 fui-corners"
          style={{ background: 'var(--fui-line-soft)', border: '1px solid var(--fui-line)' }}
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.55 }}
        >
          {/* 左：SYSTEM STATUS */}
          <div style={{ background: 'var(--fui-bg)' }} className="p-5">
            <div className="fui-panel-h"><span>SYSTEM STATUS</span><span className="idx">SYS.01</span></div>
            {[
              { lb: 'PERSONAS', pct: 100, val: '16/16', hi: false },
              { lb: 'ENGINE', pct: 92, val: '92%', hi: false },
              { lb: 'RAG INDEX', pct: 78, val: '78%', hi: false },
              { lb: 'VOICE', pct: 64, val: '64%', hi: false },
              { lb: 'SOCKET', pct: 90, val: '90%', hi: true },
            ].map(s => (
              <div key={s.lb} className="flex items-center gap-2.5 py-2">
                <span className="fui-tag w-[76px] shrink-0" style={{ color: 'var(--fui-ink-2)' }}>{s.lb}</span>
                <span className="fui-bar"><i className={clsx(s.hi && 'hi')} style={{ width: `${s.pct}%` }} /></span>
                <span className="fui-tag fui-tabular w-10 text-right">{s.val}</span>
              </div>
            ))}
            <div className="fui-hairline-dash mt-3 pt-3 flex items-center justify-between">
              <span className="fui-tag" style={{ color: 'var(--fui-ink-2)' }}>SYSTEM NORMAL</span>
              <span className="fui-live"><i /></span>
            </div>

            <div className="fui-panel-h" style={{ marginTop: 22 }}><span>ENVIRONMENT</span><span className="idx">ENV.02</span></div>
            {[
              ['TOPICS POOL', String(topicCount)],
              ['PERSONA MODES', '3'],
              ['MEMORY BANKS', '∞'],
              ['LATENCY', '23 ms'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <span className="fui-tag">{k}</span>
                <span className="fui-num text-xs">{v}</span>
              </div>
            ))}

            <div className="fui-panel-h" style={{ marginTop: 22 }}><span>SIGNAL LOG</span><span className="idx">LOG.03</span></div>
            {[
              ['NOW', 'Signal sweep active'],
              ['21:28', 'Debate engine synchronized'],
              ['21:20', 'RAG knowledge index updated'],
              ['21:15', 'New topic signal detected'],
            ].map(([t, m], i) => (
              <div key={t + m} className="flex gap-3 py-1.5 text-[11px]" style={{ color: i === 0 ? 'var(--fui-ink)' : 'var(--fui-ink-2)' }}>
                <span className="fui-tag shrink-0" style={{ color: i === 0 ? 'var(--fui-accent)' : undefined }}>{t}</span>
                <span>{m}</span>
              </div>
            ))}
          </div>

          {/* 中：点阵星球 */}
          <div className="relative flex items-center justify-center overflow-hidden" style={{ background: 'var(--fui-bg)', minHeight: 420 }}>
            <div className="absolute top-4 left-5">
              <div className="fui-tag">SPHERE</div>
              <div className="fui-tag"><b>PLANET ID: DS-16-E7</b></div>
            </div>
            <div className="absolute top-4 right-5 text-right">
              <div className="fui-tag">COORDINATES</div>
              <div className="fui-tag"><b>NT · NF · SJ · SP</b></div>
              <div className="fui-tag">QUADRANT MAP</div>
            </div>
            <GlobeCanvas width={520} height={400} className="max-w-full" />
            <div className="absolute bottom-12 left-5">
              <div className="fui-tag">TARGET</div>
              <div className="text-[11px] mt-0.5 max-w-[200px] truncate" style={{ color: 'var(--fui-ink)' }} title={currentHot}>
                {currentHot}
              </div>
            </div>
            <div className="absolute bottom-12 right-5 text-right">
              <div className="fui-tag">DISTANCE</div>
              <div className="fui-num text-xs mt-0.5">384,400 KM</div>
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3" aria-hidden="true">
              {[0, 1, 2, 3, 4].map(i => (
                <span key={i} className="w-1 h-1 rounded-full" style={{ background: i === 0 ? 'var(--fui-ink)' : 'rgba(255,255,255,.25)' }} />
              ))}
            </div>
          </div>

          {/* 右：ANALYTICS */}
          <div style={{ background: 'var(--fui-bg)' }} className="p-5">
            <div className="fui-panel-h"><span>DEBATE ANALYTICS</span><span className="idx">ANA.01</span></div>
            <div className="p-3" style={{ border: '1px solid var(--fui-line-soft)' }}>
              <div className="flex justify-between fui-tag mb-2"><span>ARGUMENT DENSITY / 24H</span><span>MAX 100</span></div>
              <svg viewBox="0 0 280 80" width="100%" height="72" aria-hidden="true">
                <g stroke="rgba(255,255,255,.07)" strokeWidth=".5">
                  <line x1="0" y1="20" x2="280" y2="20" /><line x1="0" y1="40" x2="280" y2="40" /><line x1="0" y1="60" x2="280" y2="60" />
                </g>
                <path d="M0,62 L20,55 L40,58 L60,42 L80,46 L100,34 L120,39 L140,23 L160,30 L180,20 L200,27 L220,16 L240,23 L260,12 L280,18" fill="none" stroke="#e8e8e8" strokeWidth="1.2" />
                <path d="M0,70 L20,66 L40,68 L60,60 L80,62 L100,55 L120,58 L140,51 L160,53 L180,47 L200,51 L220,44 L240,47 L260,42 L280,45" fill="none" stroke="rgba(124,136,240,.7)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx="180" cy="20" r="2.4" fill="#7c88f0" />
                <circle cx="180" cy="20" r="5" fill="none" stroke="rgba(124,136,240,.4)" strokeWidth=".8" />
              </svg>
            </div>

            <div className="grid grid-cols-2 gap-px mt-4" style={{ background: 'var(--fui-line-soft)', border: '1px solid var(--fui-line-soft)' }}>
              {[
                ['PERSONAS', '16'], ['TOPICS', String(topicCount)],
                ['ARENA MODES', '3'], ['SIGNAL', '76%'],
              ].map(([k, v]) => (
                <div key={k} className="px-3.5 py-3" style={{ background: 'var(--fui-bg)' }}>
                  <div className="fui-tag">{k}</div>
                  <div className="fui-num text-xl mt-0.5">{v}</div>
                </div>
              ))}
            </div>

            <div className="p-3 mt-4" style={{ border: '1px solid var(--fui-line-soft)' }}>
              <div className="flex justify-between fui-tag mb-2">
                <span>DATA STREAM</span>
                <span className="fui-live" style={{ fontSize: 9 }}><i />LIVE</span>
              </div>
              <DataStream width={280} height={64} />
            </div>

            <div className="fui-panel-h" style={{ marginTop: 20 }}><span>QUICK ACCESS</span><span className="idx">NAV.02</span></div>
            <div className="grid grid-cols-4 gap-px" style={{ background: 'var(--fui-line-soft)', border: '1px solid var(--fui-line-soft)' }}>
              {[
                { icon: LayoutGrid, label: 'SQUARE', tab: 'square' as TabId },
                { icon: Clock, label: 'HISTORY', tab: 'history' as TabId },
                { icon: BarChart3, label: 'STATS', tab: 'stats' as TabId },
                { icon: BookOpen, label: 'LIBRARY', tab: 'library' as TabId },
              ].map(q => (
                <button
                  key={q.label}
                  onClick={() => onNavigate?.(q.tab)}
                  className="py-3 px-1 text-center transition-colors hover:bg-white/5"
                  style={{ background: 'var(--fui-bg)', color: 'var(--fui-ink-2)' }}
                  aria-label={`进入${q.label}`}
                >
                  <q.icon size={16} className="mx-auto mb-1.5" />
                  <span className="fui-tag" style={{ fontSize: 8 }}>{q.label}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ============ 01 人格光谱矩阵 ============ */}
      <section ref={gridRef} className="px-6 pb-8 max-w-6xl mx-auto" style={{ marginTop: 52 }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.55 }}>
          <div className="flex items-baseline gap-4 pb-3.5 mb-5 relative" style={{ borderBottom: '1px solid var(--fui-line)' }}>
            <span className="fui-num text-2xl font-semibold">01</span>
            <h2 className="text-[15px] font-semibold" style={{ letterSpacing: '0.12em', color: 'var(--fui-ink)' }}>人格光谱矩阵</h2>
            <span className="fui-tag ml-auto">PERSONA SPECTRUM MATRIX — {totalFiltered} / 16 UNITS</span>
          </div>

          {/* 搜索 + 分类 */}
          <div className="flex flex-wrap gap-3 items-center mb-5">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fui-ink-3)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="SEARCH PERSONA…"
                className="fui-input pl-9"
                aria-label="搜索人格"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="人格分类">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  role="tab"
                  aria-selected={activeCategory === cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={clsx('fui-tab', activeCategory === cat.id && 'on')}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={onStartTest} className="fui-btn" style={{ padding: '7px 14px' }} aria-label="人格匹配测试">
                <FlaskConical size={12} /> TEST
              </button>
              <button onClick={onStartDebate} disabled={selectedTypes.length < 2} className="fui-btn-primary" style={{ padding: '7px 14px' }} aria-label={`开始辩论（已选${selectedTypes.length}人）`}>
                <Swords size={12} /> DEBATE ({selectedTypes.length})
              </button>
            </div>
          </div>

          {/* 分组陈列 */}
          <div className="space-y-9">
            {visibleGroups.map(group => (
              <div key={group.id}>
                <div className="flex items-center gap-3.5 mb-3">
                  <span className="fui-idx-badge" style={{ fontWeight: 600, color: 'var(--fui-ink)' }}>{group.code}</span>
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--fui-ink)' }}>{group.zh}</span>
                  <span className="fui-tag">{group.en}</span>
                  <span className="flex-1" style={{ height: 1, background: 'linear-gradient(90deg, var(--fui-line), transparent)' }} />
                  <span className="fui-tag fui-tabular">{group.members.length} UNITS</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px" style={{ background: 'var(--fui-line-soft)', border: '1px solid var(--fui-line-soft)' }}>
                  {group.members.map((profile, pi) => {
                    const isSelected = selectedTypes.includes(profile.id)
                    const state = personaStates[profile.id]
                    const mem = personaMemories[profile.id]
                    return (
                      <motion.button
                        key={profile.id}
                        onClick={() => onToggleType(profile.id)}
                        className={clsx('fui-pcard', isSelected && 'selected')}
                        role="checkbox"
                        aria-checked={isSelected}
                        aria-label={`${profile.name} ${profile.alias}${isSelected ? '，已选中' : ''}`}
                        initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }}
                        transition={{ duration: 0.35, delay: (pi % 4) * 0.04 }}
                      >
                        <span className="fui-tag absolute top-2.5 right-3" style={{ fontSize: 8 }}>{personaIndex.get(profile.id)}</span>
                        <div
                          className="fui-num text-[22px] font-bold transition-colors"
                          style={{ letterSpacing: '0.04em', color: isSelected ? 'var(--fui-accent)' : 'var(--fui-ink)' }}
                        >
                          {profile.name}
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--fui-ink-2)' }}>
                          {profile.emoji} {profile.alias}
                        </div>
                        <div className="fui-tag mt-2.5" style={{ fontSize: 8 }}>
                          {profile.traits.slice(0, 2).join(' · ').toUpperCase()}
                        </div>

                        {PERSONA_SOURCES[profile.id]?.length > 0 && (
                          <div
                            className="mt-2 text-[9px] leading-tight truncate"
                            style={{ color: 'var(--fui-ink-3)' }}
                            title={PERSONA_SOURCES[profile.id].map(s => `${s.source}：${s.idea}`).join('\n')}
                          >
                            📚 {PERSONA_SOURCES[profile.id].map(s => s.source).join(' · ')}
                          </div>
                        )}

                        <div className="fui-hairline mt-3" style={{ position: 'relative' }}>
                          <span className="absolute left-0 top-0 h-px w-[22px]" style={{ background: 'var(--fui-ink-2)' }} />
                        </div>

                        {state && (
                          <div
                            className="mt-2 flex items-center gap-1.5 text-[9px]"
                            style={{ color: 'var(--fui-ink-3)' }}
                            title={`情绪：${describeMood(state)} · 精力：${energyLabel(state.energy)} · 亲密度：${intimacyLabel(state.intimacy)}`}
                          >
                            <span>{moodEmoji(state)} {describeMood(state)}</span>
                            <span className="opacity-50">·</span>
                            <span>⚡{Math.round(state.energy * 100)}%</span>
                            {mem && mem.entries.length > 0 && (
                              <span className="ml-auto shrink-0" title={mem.entries.map(e => e.text).join('；')}>
                                🧠{mem.entries.length}
                              </span>
                            )}
                          </div>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {totalFiltered === 0 && (
            <div className="text-center py-12" style={{ color: 'var(--fui-ink-3)' }}>
              <Users size={44} className="mx-auto mb-3 opacity-30" />
              <p className="fui-tag">NO SIGNAL MATCHED — 没有找到匹配的人格</p>
            </div>
          )}
        </motion.div>
      </section>

      {/* ============ 02 观测协议（功能入口） ============ */}
      <section className="px-6 pb-10 max-w-6xl mx-auto" style={{ marginTop: 20 }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.55 }}>
          <div className="flex items-baseline gap-4 pb-3.5 mb-5 relative" style={{ borderBottom: '1px solid var(--fui-line)' }}>
            <span className="fui-num text-2xl font-semibold">02</span>
            <h2 className="text-[15px] font-semibold" style={{ letterSpacing: '0.12em', color: 'var(--fui-ink)' }}>观测协议</h2>
            <span className="fui-tag ml-auto">OBSERVATION PROTOCOLS — 3 MODES</span>
          </div>

          <div className="grid md:grid-cols-3 gap-px" style={{ background: 'var(--fui-line-soft)', border: '1px solid var(--fui-line-soft)' }}>
            {[
              {
                idx: 'MOD.01', code: 'DUEL · 1V1', zh: '人格对决',
                desc: '任选两种人格就同一辩题实时交锋：立场宣言 → 四步论证 → 精准反驳 → 一句封喉。',
                foot: ['ROUNDS', '7'], action: onStartDebate, disabled: selectedTypes.length < 2, cta: 'ENTER →',
              },
              {
                idx: 'MOD.02', code: 'SPECTATE', zh: '自动观战',
                desc: '多智能体编排器驱动：审题 → 检索 → 立场 → 交锋 → 总结，思考链全程可视化。',
                foot: ['AGENTS', '3+1'], action: () => onNavigate?.('debate'), disabled: false, cta: 'ENTER →',
              },
              {
                idx: 'MOD.03', code: 'DIALOGUE', zh: '人格深谈',
                desc: '与单一人格 1v1 深度对话，无胜负无裁判。五维驱力演化 + 持久记忆，越聊越懂你。',
                foot: ['MEMORY', '∞'], action: () => onNavigate?.('chat'), disabled: false, cta: 'ENTER →',
              },
            ].map(m => (
              <div key={m.idx} className="p-6 relative transition-colors hover:bg-white/[0.04]" style={{ background: 'var(--fui-bg)' }}>
                <span className="fui-tag absolute top-3.5 right-4" style={{ fontSize: 9 }}>{m.idx}</span>
                <div className="w-8 h-8 flex items-center justify-center mb-4" style={{ border: '1px solid var(--fui-line)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--fui-ink)' }} />
                </div>
                <h3 className="fui-num text-[15px] font-semibold" style={{ letterSpacing: '0.14em' }}>{m.code}</h3>
                <div className="text-xs mt-0.5" style={{ color: 'var(--fui-ink-2)' }}>{m.zh}</div>
                <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--fui-ink-3)' }}>{m.desc}</p>
                <div className="fui-hairline-dash mt-4 pt-3 flex items-center justify-between">
                  <span className="fui-tag">{m.foot[0]} <b style={{ color: 'var(--fui-accent)' }}>{m.foot[1]}</b></span>
                  <button
                    onClick={m.action}
                    disabled={m.disabled}
                    className="fui-tag transition-colors hover:text-white disabled:opacity-30"
                    style={{ color: 'var(--fui-ink-2)', background: 'none', border: 'none', cursor: m.disabled ? 'not-allowed' : 'pointer' }}
                    aria-label={`进入${m.zh}`}
                  >
                    {m.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 关键词行 */}
          <div className="flex flex-wrap gap-2 mt-6">
            {['PERSONA', 'RAG', 'MULTI-AGENT', 'REALTIME', 'VOICE', 'PK ARENA', 'MEMORY', 'JUDGE', 'COT VISIBLE', 'DRIVES 5D'].map(k => (
              <span key={k} className="fui-kw">{k}</span>
            ))}
          </div>

          {/* 信条 */}
          <div className="mt-6 p-5 flex flex-wrap items-center gap-5 justify-between" style={{ border: '1px solid var(--fui-line-soft)' }}>
            <span className="fui-tag" style={{ color: 'var(--fui-ink)' }}>SIGNAL →→</span>
            <p className="text-sm flex-1 min-w-[240px]" style={{ color: 'var(--fui-ink)', borderLeft: '2px solid var(--fui-accent)', paddingLeft: 16, lineHeight: 2 }}>
              「16 种看世界的方式，在同一个擂台上相遇。不是要分出对错，而是让每种思维都被认真听见。」
              <span className="fui-tag block mt-1">OBSERVATORY DOCTRINE · REV 037</span>
            </p>
            <ArrowRight size={16} style={{ color: 'var(--fui-ink-3)' }} aria-hidden="true" />
          </div>
        </motion.div>
      </section>

      {/* ============ 底部状态栏 ============ */}
      <footer className="px-6 pb-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-px fui-corners" style={{ background: 'var(--fui-line-soft)', border: '1px solid var(--fui-line)' }}>
          {[
            { k: 'MODE', v: 'OBSERVE' },
            { k: 'OPERATOR', v: 'GUEST_01' },
            { k: 'LOCAL TIME', v: clock, mono: true },
            { k: 'SYSTEM ID', v: 'DS-7F3Q-37' },
          ].map(c => (
            <div key={c.k} className="px-4 py-3.5" style={{ background: 'var(--fui-bg)' }}>
              <div className="fui-tag">{c.k}</div>
              <div className="fui-num text-[13px] mt-1 fui-tabular">{c.v}</div>
            </div>
          ))}
          <div className="px-4 py-3.5" style={{ background: 'var(--fui-bg)' }}>
            <div className="fui-tag">SIGNAL</div>
            <div className="fui-signal mt-1.5"><i /><i /><i /><i /><i /></div>
          </div>
        </div>
        <div className="flex justify-between items-center pt-5">
          <span className="fui-tag">NOT A GENERATION OF PAGES, BUT A STEP TOWARD REAL DIALOGUE.</span>
          <span className="fui-tag">DEBATESPHERE · 思辩星球 — 2026</span>
        </div>
      </footer>
    </div>
  )
}
