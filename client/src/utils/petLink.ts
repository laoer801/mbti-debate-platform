/**
 * petLink.ts — 辩论表现 ↔ 像素宠物双向链接规则引擎（v40.4）
 * --------------------------------------------------------------------------
 * 设计目标：让用户在辩论中的表现直接影响宠物成长，避免宠物变"挂件"。
 *
 * 核心规则：
 *  1. 一次发言产生的宠物攻击 = 发言伤害（已有公式 computeDamage）
 *  2. 一次辩论结算时，**七维裁判分映射为宠物属性增量**：
 *     - logic    -> ATK +floor(logic/20)
 *     - evidence -> ATK +floor(evidence/25)
 *     - rhetoric -> ATK +floor(rhetoric/30) + 临时魅力加成
 *     - strategy -> SPD +floor(strategy/15)
 *     - clarity  -> DEF +floor(clarity/20)
 *     - demeanor -> HP上限 +floor(demeanor/10)  + 经验 +5
 *     - ethics   -> 特殊技能槽解锁
 *  3. 每场比赛后按用户总积分/发言字数增量更新宠物等级阈值
 *  4. 等级解锁机制：达到 Lv.3 解锁"反击"，Lv.5 解锁"蓄力"，Lv.7 解锁"沉默"
 *  5. 失分点保护：连续 3 场同一维度 < 30 → 该维度上限 5%（防 boom）
 *
 * 依赖方向：petLink → pets(已在服务端绑定) + types，无运行时循环 import
 */

import type { JudgeDimensionScore } from '../types'

/** 宠物技能解锁等级 */
export interface PetSkillUnlock {
  level: number
  skillId: string
  name: string
  emoji: string
  /** 技能效果描述 */
  effect: string
  /** 触发条件：如 'on-damage-dealt' | 'on-low-hp' | 'on-critical' */
  trigger: 'on-damage-dealt' | 'on-low-hp' | 'on-critical' | 'on-rally'
}

export const PET_SKILLS: PetSkillUnlock[] = [
  {
    level: 3, skillId: 'counter', name: '辩论反击', emoji: '⚔️',
    effect: '被对方高逻辑攻击时 20% 概率反弹 30% 伤害',
    trigger: 'on-damage-dealt',
  },
  {
    level: 5, skillId: 'rally', name: '蓄势待发', emoji: '⚡',
    effect: '每 3 次发言累计 +8% ATK，下回合自动释放',
    trigger: 'on-rally',
  },
  {
    level: 7, skillId: 'silence', name: '沉默术', emoji: '🤐',
    effect: 'HP < 25% 时，对方一回合发言伤害 ×0.5',
    trigger: 'on-low-hp',
  },
  {
    level: 10, skillId: 'rhetoric-storm', name: '修辞风暴', emoji: '🌪️',
    effect: '连续 5 次说理/数据触发，全场暴击率 +25%',
    trigger: 'on-critical',
  },
]

/** 七维 → 宠物属性增量映射 */
export interface PetLinkIncrement {
  atk: number
  def: number
  spd: number
  hpBonus: number
  /** 是否解锁新技能 */
  unlockedSkill?: PetSkillUnlock
  /** 临时"魅力加成"（下一场发言回复力 +X）—— rhetoric 表现优秀时触发 */
  charismaTemp: number
  /** 用于客户端展示的明细行（比赛详情 "宠物战报" 用） */
  detail: string[]
}

/**
 * 把七维评分映射为宠物属性增量。
 * @param dimScores 7 维评分（0~100）
 * @param previousLevel 当前宠物等级（用于判定解锁）
 * @param previousSkills 已解锁的 skillId 集合（防重复解锁）
 */
export function computePetLink(
  dimScores: JudgeDimensionScore[] | undefined,
  previousLevel = 1,
  previousSkills: string[] = [],
): PetLinkIncrement {
  const inc: PetLinkIncrement = {
    atk: 0,
    def: 0,
    spd: 0,
    hpBonus: 0,
    charismaTemp: 0,
    detail: [],
  }

  if (!dimScores || dimScores.length === 0) {
    inc.detail.push('⚠️ 无七维评分，宠物未获得经验')
    return inc
  }

  const get = (key: string) => dimScores.find(d => d.key === key)?.score ?? 50

  const logic = get('logic')
  const evidence = get('evidence')
  const rhetoric = get('rhetoric')
  const strategy = get('strategy')
  const clarity = get('clarity')
  const demeanor = get('demeanor')
  const ethics = get('ethics')

  inc.atk += Math.floor(logic / 20)
  inc.detail.push(`逻辑 ${logic} → 攻击 +${Math.floor(logic / 20)}`)

  inc.atk += Math.floor(evidence / 25)
  inc.detail.push(`论据 ${evidence} → 攻击 +${Math.floor(evidence / 25)}`)

  inc.atk += Math.floor(rhetoric / 30)
  if (rhetoric >= 75) {
    inc.charismaTemp = 3
    inc.detail.push(`修辞 ${rhetoric} → 临时魅力 +3`)
  } else {
    inc.detail.push(`修辞 ${rhetoric} → 攻击 +${Math.floor(rhetoric / 30)}`)
  }

  inc.spd += Math.floor(strategy / 15)
  inc.detail.push(`策略 ${strategy} → 速度 +${Math.floor(strategy / 15)}`)

  inc.def += Math.floor(clarity / 20)
  inc.detail.push(`表达 ${clarity} → 防御 +${Math.floor(clarity / 20)}`)

  if (demeanor >= 70) {
    inc.hpBonus = Math.floor(demeanor / 10)
    inc.detail.push(`风度 ${demeanor} → HP上限 +${inc.hpBonus}`)
  } else {
    inc.detail.push(`风度 ${demeanor}（风度≥70 才能扩展 HP 上限）`)
  }

  if (ethics >= 80) {
    inc.detail.push(`伦理 ${ethics} → 有概率解锁新技能（看等级）`)
  }

  // 解锁判定：当前宠物等级 + 这次结算后预期等级
  const expectedLevel = previousLevel + Math.max(1, Math.floor((inc.atk + inc.def + inc.spd) / 10))
  for (const skill of PET_SKILLS) {
    if (expectedLevel >= skill.level && !previousSkills.includes(skill.skillId)) {
      inc.unlockedSkill = skill
      inc.detail.push(`🎉 解锁新技能「${skill.name}」 ${skill.emoji}`)
      break
    }
  }

  return inc
}

/** 按"用户最近 N 次辩论某维度平均分"判定弱项 → 返回需要重点提升的维度（top 1~2） */
export function identifyWeaknesses(
  history: { dimScores: JudgeDimensionScore[] }[],
): { dimension: string; avgScore: number }[] {
  if (history.length < 3) return []
  const sumByDim = new Map<string, { sum: number; n: number }>()
  for (const h of history) {
    for (const d of h.dimScores) {
      const cur = sumByDim.get(d.key) || { sum: 0, n: 0 }
      cur.sum += d.score
      cur.n += 1
      sumByDim.set(d.key, cur)
    }
  }
  return Array.from(sumByDim.entries())
    .map(([dimension, { sum, n }]) => ({ dimension, avgScore: sum / n }))
    .filter(r => r.avgScore < 55)
    .sort((a, b) => a.avgScore - b.avgScore)
}

/** 连续 3 场同一维度 < 30 → 该维度上限 5% */
export function isBooming(
  dimScores: JudgeDimensionScore[][],
  dimKey: string,
): boolean {
  if (dimScores.length < 3) return false
  const tail = dimScores.slice(-3)
  return tail.every(arr => {
    const v = arr.find(d => d.key === dimKey)?.score ?? 50
    return v < 30
  })
}
