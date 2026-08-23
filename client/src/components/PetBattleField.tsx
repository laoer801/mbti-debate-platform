import { useState, useEffect, useRef } from 'react'
import { PixelPet } from './PixelPet'
import { PKParticipant, PKPhase, BattleState, PetBattleEvent } from '../types'
import { Swords } from 'lucide-react'

interface PetBattleFieldProps {
  participants: PKParticipant[]
  battleStates: BattleState[]
  battleEvent: PetBattleEvent | null
  phase: PKPhase
}

interface DamageNumber {
  id: number
  userId: string
  damage: number
  crit: boolean
}

/**
 * v40 宠物擂台 —— 服务器权威战斗的可视化层
 * HP 全部来自服务端 pk_battle_state 快照（battle-init / pet-battle 事件驱动），
 * 本组件只负责播放动画，不计算任何伤害，保证两端画面一致。
 */
export function PetBattleField({ participants, battleStates, battleEvent, phase }: PetBattleFieldProps) {
  const [attacking, setAttacking] = useState<Record<string, boolean>>({})
  const [takingDmg, setTakingDmg] = useState<Record<string, boolean>>({})
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([])
  const timersRef = useRef<number[]>([])

  // 攻击事件 → 播放三段动画（攻击 → 受击+伤害数字 → 清理）
  useEffect(() => {
    if (!battleEvent) return
    const { attackerId, defenderId, damage, crit, seq } = battleEvent
    const dmgId = seq

    setAttacking(prev => ({ ...prev, [attackerId]: true }))
    const t1 = window.setTimeout(() => setAttacking(prev => ({ ...prev, [attackerId]: false })), 600)

    const t2 = window.setTimeout(() => {
      setTakingDmg(prev => ({ ...prev, [defenderId]: true }))
      setDamageNumbers(prev => [...prev, { id: dmgId, userId: defenderId, damage, crit }])
    }, 300)

    const t3 = window.setTimeout(() => {
      setTakingDmg(prev => ({ ...prev, [defenderId]: false }))
    }, 1000)

    const t4 = window.setTimeout(() => {
      setDamageNumbers(prev => prev.filter(d => d.id !== dmgId))
    }, 2000)

    timersRef.current.push(t1, t2, t3, t4)
    return () => { [t1, t2, t3, t4].forEach(clearTimeout) }
  }, [battleEvent?.seq])

  useEffect(() => () => { timersRef.current.forEach(clearTimeout) }, [])

  // 尚未开战（waiting / preparation 未初始化）→ 轻量占位条，擂台位置恒定不跳版式
  if (battleStates.length === 0) {
    const hint = phase === 'preparation'
      ? '宠物属性锁定中...'
      : phase === 'waiting'
        ? '等待双方入场，宠物擂台待命'
        : '宠物擂台待命'
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-2 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
        <Swords size={14} style={{ color: 'var(--color-text-tertiary)' }} />
        <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>🐾 {hint}</span>
      </div>
    )
  }

  const leftP = participants[0]
  const rightP = participants[1]
  const leftState = battleStates.find(s => s.userId === leftP?.user_id)
  const rightState = battleStates.find(s => s.userId === rightP?.user_id)

  return (
    <div className="relative px-4 py-2.5 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
      {/* VS 徽章 */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="w-9 h-9 rounded-full flex items-center justify-center animate-pulse shadow-lg"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), #e57e7e)' }}>
          <Swords size={16} style={{ color: '#fff' }} />
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        {/* 左侧宠物 */}
        <div className="flex items-end gap-2 min-w-0 flex-1">
          {leftState && leftP ? (
            <PetSlot
              state={leftState}
              username={leftP.username}
              attacking={!!attacking[leftState.userId]}
              takingDamage={!!takingDmg[leftState.userId]}
              damageNumbers={damageNumbers.filter(d => d.userId === leftState.userId)}
            />
          ) : <EmptySlot />}
        </div>

        {/* 右侧宠物（镜像朝向左） */}
        <div className="flex items-end gap-2 min-w-0 flex-1 justify-end">
          {rightState && rightP ? (
            <div style={{ transform: 'scaleX(-1)' }}>
              <div style={{ transform: 'scaleX(-1)' }}>
                <PetSlot
                  state={rightState}
                  username={rightP.username}
                  attacking={!!attacking[rightState.userId]}
                  takingDamage={!!takingDmg[rightState.userId]}
                  damageNumbers={damageNumbers.filter(d => d.userId === rightState.userId)}
                />
              </div>
            </div>
          ) : <EmptySlot />}
        </div>
      </div>
    </div>
  )
}

/** 单个宠物槽位：像素宠物 + 名字 + 服务器权威 HP 条 + 战斗统计 */
function PetSlot({
  state, username, attacking, takingDamage, damageNumbers,
}: {
  state: BattleState
  username?: string
  attacking: boolean
  takingDamage: boolean
  damageNumbers: DamageNumber[]
}) {
  const hpPercent = Math.max(0, Math.min(100, (state.hp / state.maxHp) * 100))
  const ko = state.hp <= 0
  const hpColor = hpPercent > 50 ? '#5fbf77' : hpPercent > 25 ? '#d9b871' : '#e57e7e'

  return (
    <div className="relative">
      {/* 伤害数字 */}
      {damageNumbers.map(d => (
        <span
          key={d.id}
          className={`absolute -top-2 left-1/2 -translate-x-1/2 z-20 font-bold pointer-events-none ${d.crit ? 'text-base' : 'text-sm'}`}
          style={{
            color: d.crit ? '#d9b871' : '#e57e7e',
            textShadow: '0 1px 3px rgba(0,0,0,0.4)',
            animation: 'bounce 0.6s ease-out 2',
          }}>
          {d.crit ? '暴击!' : ''}-{d.damage}
        </span>
      ))}

      <div className="flex items-end gap-2">
        <PixelPet
          pet={{
            id: state.userId,
            user_id: state.userId,
            name: state.name,
            sprite_type: state.spriteType,
            emoji: state.emoji,
            hp: state.hp,
            max_hp: state.maxHp,
            atk: state.atk,
            def: state.def,
            spd: state.spd,
            level: 1,
            exp: 0,
          }}
          size={56}
          attacking={attacking}
          takingDamage={takingDamage}
        />
        <div className="min-w-0 pb-0.5">
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold truncate" style={{ color: ko ? 'var(--color-text-tertiary)' : 'var(--color-text)' }}>
              {state.isTemp ? '✨' : '🐾'} {state.name}
            </span>
            {ko && <span className="text-[10px] font-bold px-1 rounded" style={{ background: '#e57e7e22', color: '#e57e7e' }}>KO</span>}
          </div>
          <p className="text-[10px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>{username || '玩家'}</p>

          {/* 服务器权威 HP 条 */}
          <div className="w-24 h-1.5 rounded-full overflow-hidden mt-0.5" style={{ background: 'var(--color-border)' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${hpPercent}%`, background: hpColor }} />
          </div>
          <p className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {state.hp}/{state.maxHp} · 输出{state.damageDealt}
          </p>
        </div>
      </div>
    </div>
  )
}

/** 空槽位（对方无战斗快照时的占位） */
function EmptySlot() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ border: '1px dashed var(--color-border)' }}>
      <span className="text-lg opacity-30">🐾</span>
      <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>暂无宠物</span>
    </div>
  )
}
