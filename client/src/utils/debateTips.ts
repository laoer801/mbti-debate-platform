/**
 * debateTips.ts — 个性化辩论技巧建议生成器（v40.4）
 * --------------------------------------------------------------------------
 * 基于：
 *  - 当前 7 维裁判分
 *  - 用户过去 N 场比赛的弱项维度
 *  - MBTI 4 字母族系
 *
 * 输出："7 天可执行训练计划" + "人格化语气短句" + "对辩题下次的针对性提醒"
 *
 * 参考：LoL Coach（yacine20005/LoL-Coach）模式：聚合最近多场 → 找规律 → LLM 输出可执行建议
 */

import { mbtiProfiles, type MBTIType } from '../data/mbtiProfiles'

/** 从项目中已有的 16 人格表反查族系 */
function familyOf(typeId?: string): 'NT' | 'NF' | 'SJ' | 'SP' {
  if (!typeId) return 'SP'
  const p = mbtiProfiles.find(x => x.id === typeId)
  if (!p) return 'SP'
  return ({ analyst: 'NT', diplomat: 'NF', sentinel: 'SJ', explorer: 'SP' } as const)[p.category] || 'SP'
}

/** 7 维评分 */
export interface DimScore {
  key: 'logic' | 'evidence' | 'rhetoric' | 'strategy' | 'clarity' | 'demeanor' | 'ethics'
  score: number
}

/** 一条训练建议 */
export interface CoachingTip {
  day: number                     // 第几天（1~7）
  dimension: string               // 训练维度 key
  title: string                   // 标题（如"逻辑加固日"）
  description: string             // 详细方法
  drillQuery: string              // 对应"今日辩题/资料包"建议查询词（连接知识库）
  emoji: string
}

/** 输出 */
export interface CoachingPlan {
  mbtiType: string
  family: 'NT' | 'NF' | 'SJ' | 'SP'
  /** 用户当前最强维度 */
  strongDims: string[]
  /** 用户当前最弱维度（top 2~3） */
  weakDims: string[]
  /** 平均分 */
  avgScore: number
  /** 历史趋势："up" | "down" | "flat" | null（少于 2 场没法判断） */
  trend: 'up' | 'down' | 'flat' | null
  /** 7 天训练计划 */
  weeklyPlan: CoachingTip[]
  /** 一句话风格化鼓励（人格化语气） */
  motto: string
  /** 给管理者建议（管理员可选） */
  meta: { adviceForCoach: string }
}

// ===========================================================
// 1. 维度 → 中文标签 + 练习方法模板
// ===========================================================

const DIM_LABELS: Record<string, string> = {
  logic: '逻辑',
  evidence: '论据',
  rhetoric: '修辞',
  strategy: '策略',
  clarity: '表达',
  demeanor: '风度',
  ethics: '伦理',
}

const DIM_DRILL_TEMPLATES: Record<string, { drillName: string; drillQuery: string; emoji: string }> = {
  logic: {
    drillName: '逻辑加固日',
    drillQuery: '形式逻辑 推理 三段论 因果谬误 案例',
    emoji: '🧠',
  },
  evidence: {
    drillName: '案例积累日',
    drillQuery: '权威数据 案例研究 同行评议 统计方法',
    emoji: '📊',
  },
  rhetoric: {
    drillName: '修辞锤炼日',
    drillQuery: '比喻 排比 反问 类比 修辞格 演讲技巧',
    emoji: '🎭',
  },
  strategy: {
    drillName: '策略推演日',
    drillQuery: '博弈论 战略框架 反驳技巧 提问陷阱',
    emoji: '♟️',
  },
  clarity: {
    drillName: '表达打磨日',
    drillQuery: '结构化表达 金字塔原理 口语化训练',
    emoji: '🎙️',
  },
  demeanor: {
    drillName: '风度涵养日',
    drillQuery: '辩论礼仪 倾听技巧 共情对话',
    emoji: '🤝',
  },
  ethics: {
    drillName: '伦理思辨日',
    drillQuery: '伦理框架 应用伦理 道德两难',
    emoji: '⚖️',
  },
}

// ===========================================================
// 2. MBTI 4 族系激励语
// ===========================================================

const MOTTO_BY_FAMILY: Record<string, string[]> = {
  // NT 理性派
  NT: [
    '事实不会让我们转向，但事实会让我们走得更远',
    '十次推演失败，不如一次推理自洽',
    '逻辑的最高荣誉，是对结论保持怀疑',
  ],
  // NF 理想派
  NF: [
    '辩论不是为了赢，是为了理解',
    '你的真诚，永远是说服力的源点',
    '观点易逝，价值观永存',
  ],
  // SJ 守护派
  SJ: [
    '扎实的数据 + 沉稳的论辩，胜过空泛的激情',
    '可靠的细节，是被信任的开始',
    '每个反驳都是被重新理解的契机',
  ],
  // SP 行动派
  SP: [
    '现场反应快 ≠ 论据扎实，让我们给直觉添点钉子',
    '快而准，是辩论场上的最高美德',
    '刀锋可以一时失手，但不能一日不磨',
  ],
}

// ===========================================================
// 3. 主生成函数
// ===========================================================

export interface GeneratePlanInput {
  typeId?: string
  /** 本场 7 维 */
  currentDims: DimScore[]
  /** 用户最近 5 场 7 维（不含当前场） */
  recentHistory?: DimScore[][]
}

/**
 * 生成本场的 7 天训练计划 + 鼓励语。
 * 纯函数，deterministic —— 不依赖 LLM / 网络。
 */
export function generateCoachingPlan(input: GeneratePlanInput): CoachingPlan {
  const { typeId, currentDims, recentHistory = [] } = input

  // MBTI 族系（从项目人格档案反查）
  const family: 'NT' | 'NF' | 'SJ' | 'SP' = familyOf(typeId)

  // 强弱维度排序
  const sorted = [...currentDims].sort((a, b) => a.score - b.score)
  const weakDims = sorted.slice(0, 2).map(d => d.key)
  const strongDims = sorted.slice(-2).reverse().map(d => d.key)
  const avgScore = Math.round(currentDims.reduce((s, d) => s + d.score, 0) / Math.max(1, currentDims.length))

  // 历史趋势判断
  let trend: CoachingPlan['trend'] = null
  if (recentHistory.length >= 2) {
    const headAvg = avgDims(recentHistory[0])
    const tailAvg = avgDims(recentHistory[recentHistory.length - 1])
    const headTotal = headAvg.reduce((s, d) => s + d.score, 0)
    const tailTotal = tailAvg.reduce((s, d) => s + d.score, 0)
    if (tailTotal - headTotal > 10) trend = 'up'
    else if (headTotal - tailTotal > 10) trend = 'down'
    else trend = 'flat'
  }

  // 7 天训练计划：弱项占比 70%，常规训练占 30%
  const weeklyPlan: CoachingTip[] = []
  const focusQueue = [...weakDims, ...strongDims.slice().reverse()]  // 弱项优先 + 强项巩固

  for (let day = 1; day <= 7; day++) {
    let key: string
    if (day <= 4) key = weakDims[(day - 1) % weakDims.length]                  // 第 1~4 天集中练弱项
    else if (day === 5 || day === 6) key = strongDims[(day - 5) % strongDims.length] // 第 5~6 天巩固强项
    else key = 'clarity'  // 第 7 天综合训练（默认选「表达」便于推广，如已练过则跳过）

    // 避免重复
    if (weeklyPlan.find(p => p.dimension === key)) {
      const alt = Object.keys(DIM_LABELS).find(k => !weeklyPlan.find(p => p.dimension === k))
      if (alt) key = alt
    }

    const tpl = DIM_DRILL_TEMPLATES[key]
    weeklyPlan.push({
      day,
      dimension: key,
      title: tpl.drillName,
      description: drillDescription(key, DIM_LABELS[key], DIM_LABELS[weakDims[0]] || '逻辑'),
      drillQuery: tpl.drillQuery,
      emoji: tpl.emoji,
    })
  }

  // 激励语：随机抽一条（不传给 LLM 时是 deterministic）
  const mottos = MOTTO_BY_FAMILY[family] || MOTTO_BY_FAMILY.SP
  const motto = mottos[Math.abs(hashCode(typeId || 'guest') + Date.now()) % mottos.length]

  return {
    mbtiType: typeId || 'UNKNOWN',
    family,
    strongDims: strongDims.map(d => DIM_LABELS[d]),
    weakDims: weakDims.map(d => DIM_LABELS[d]),
    avgScore,
    trend,
    weeklyPlan,
    motto,
    meta: {
      adviceForCoach: trend === 'down'
        ? '该用户近期表现下滑，建议从最弱维度切入；如重复 3 次仍无提升，考虑调整难度或换辩题风格。'
        : trend === 'up'
          ? '该用户处于上升期，可适度推高难度、提供进阶辩题。'
          : '该用户表现稳定，可保持当前训练节奏。',
    },
  }
}

// ===========================================================
// 工具函数
// ===========================================================

function avgDims(dims: DimScore[]): DimScore[] { return dims }

function deriveFamilyFromTypeId(typeId?: string): 'NT' | 'NF' | 'SJ' | 'SP' {
  if (!typeId) return 'SP'
  const c = typeId[1].toUpperCase()
  if (c === 'N') return typeId[2].toUpperCase() === 'T' ? 'NT' : 'NF'
  if (c === 'S') return typeId[2].toUpperCase() === 'J' ? 'SJ' : 'SP'
  return 'SP'
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return h
}

function drillDescription(dimension: string, label: string, weakLabel: string): string {
  const map: Record<string, (w: string) => string> = {
    logic:    (w) => `用 3 个因果或类比案例训练「${w}」维；每晚读一段哲学小品并复述其逻辑骨架。`,
    evidence: (w) => `围绕你最常谈的领域积累 5 个权威数据 / 案例；列个清单，每场辩论前调出 1 条。`,
    rhetoric: (w) => `为本周 3 个核心论点各准备 1 个比喻 / 排比 / 反问的开场。`,
    strategy: (w) => `看一段辩论录像，反推对方用了几种提问陷阱；下次主动制造同款陷阱。`,
    clarity:  (w) => `把你的核心论点缩到 30 字一句；每天大声朗读 2 次。`,
    demeanor: (w) => `对方同意你的情况下立刻回应"感谢 / 这一点我没考虑到"，养成反射。`,
    ethics:   (w) => `本周辩论时刻意加一句"我意识到这一点在不同文化视角下可能不同"——降低伦理扣分。`,
  }
  return (map[dimension] || map.clarity)(weakLabel)
}

// ===========================================================
// 4. 导出 Markdown 形式（直接喂报告生成器）
// ===========================================================

export function coachingPlanToMarkdown(plan: CoachingPlan): string {
  const lines: string[] = []
  lines.push(`## 🎯 个性化辩论技巧建议`)
  lines.push('')
  lines.push(`**你的人格族系**：${plan.family} · ${plan.mbtiType}`)
  lines.push(`**平均分**：${plan.avgScore} · **趋势**：${plan.trend ? (plan.trend === 'up' ? '📈 上升' : plan.trend === 'down' ? '📉 下滑' : '➡️ 平稳') : '样本不足'}`)
  lines.push('')
  lines.push(`### 🌟 强项：${plan.strongDims.join('、')}`)
  lines.push(`### 📉 待提升：${plan.weakDims.join('、')}`)
  lines.push('')
  lines.push(`### 📅 7 天可执行训练计划`)
  for (const tip of plan.weeklyPlan) {
    lines.push(`- **Day ${tip.day} · ${tip.title}** ${tip.emoji}`)
    lines.push(`  ${tip.description}`)
    lines.push(`  > 检索词：\`${tip.drillQuery}\`（连接云端知识库可一键调出相关资料）`)
  }
  lines.push('')
  lines.push(`### 🪴 本周座右铭`)
  lines.push(`> ${plan.motto}`)
  if (plan.meta.adviceForCoach) {
    lines.push('')
    lines.push(`<sub>📒 教练备注：${plan.meta.adviceForCoach}</sub>`)
  }
  return lines.join('\n')
}
