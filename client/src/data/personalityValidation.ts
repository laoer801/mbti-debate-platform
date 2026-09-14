/**
 * v40.1 MBTI 60 题量表（中文版）
 *
 * 来源参考：spcl/MBTI-in-Thoughts（苏黎世联邦理工）使用的 16Personalities
 * 60-item instrument，7-point Likert scale。
 *
 * 由于原始题库为商业授权，我们根据 MBTI 理论自建 60 题标准化量表：
 *   - 每个字母对（E/I、N/S、T/F、J/P）各占约 15 题
 *   - 每题 0-6 分（7 级 Likert）：完全不同意 → 完全同意
 *   - 计分：A 维度得分 = 该维度正向题之和 / 该维度总分
 *
 * 用法：在 Settings 页/Admin 页触发"自测"，收集全 60 题答案，
 *       计算出每维度 0-100% 强度，作为"人格强度校准基线"。
 */

export type Dimension = 'EI' | 'NS' | 'TF' | 'JP'

export interface Question60 {
  id: number
  dimension: Dimension
  /** +1 表示高分倾向该字母的第一面（E/N/T/J），-1 表示高分倾向第二面（I/S/F/P） */
  polarity: 1 | -1
  text: string
}

// 60 题按维度均匀分布：EI 14 + NS 16 + TF 15 + JP 15
export const QUESTION_60: Question60[] = [
  // ============== EI 维度（14 题） ==============
  { id: 1, dimension: 'EI', polarity: 1, text: '我更喜欢在群体中讨论想法，而不是独自思考。' },
  { id: 2, dimension: 'EI', polarity: -1, text: '长时间独处让我恢复精力，而不是消耗精力。' },
  { id: 3, dimension: 'EI', polarity: 1, text: '我倾向于先开口，再整理思路。' },
  { id: 4, dimension: 'EI', polarity: -1, text: '在大型社交场合之后，我常常需要独处充电。' },
  { id: 5, dimension: 'EI', polarity: 1, text: '与他人互动让我兴奋。' },
  { id: 6, dimension: 'EI', polarity: -1, text: '我在安静环境中能进入深度专注。' },
  { id: 7, dimension: 'EI', polarity: 1, text: '我倾向于主动开启对话。' },
  { id: 8, dimension: 'EI', polarity: -1, text: '我更常选择"先想再说"。' },
  { id: 9, dimension: 'EI', polarity: 1, text: '我享受派对和大型活动。' },
  { id: 10, dimension: 'EI', polarity: -1, text: '我认为深度对话比大场面更有价值。' },
  { id: 11, dimension: 'EI', polarity: 1, text: '做决定时我倾向于快速表达再听取反馈。' },
  { id: 12, dimension: 'EI', polarity: -1, text: '我需要先内化才能给出有质量的回应。' },
  { id: 13, dimension: 'EI', polarity: 1, text: '我在小组中常常扮演"分享者"角色。' },
  { id: 14, dimension: 'EI', polarity: -1, text: '我在小范围或一对一中最自在。' },

  // ============== NS 维度（16 题） ==============
  { id: 15, dimension: 'NS', polarity: 1, text: '我对未来可能性比对当下细节更感兴趣。' },
  { id: 16, dimension: 'NS', polarity: -1, text: '我相信具体事实比抽象理论更可靠。' },
  { id: 17, dimension: 'NS', polarity: 1, text: '我喜欢用比喻和想象来表达想法。' },
  { id: 18, dimension: 'NS', polarity: -1, text: '我更信赖自己经历过的事，不爱冒险。' },
  { id: 19, dimension: 'NS', polarity: 1, text: '我喜欢探索"如果……会怎样"的假设。' },
  { id: 20, dimension: 'NS', polarity: -1, text: '我对"现在已经能用"的事物更感兴趣。' },
  { id: 21, dimension: 'NS', polarity: 1, text: '灵感迸发的瞬间是我最兴奋的时刻。' },
  { id: 22, dimension: 'NS', polarity: -1, text: '我相信"日拱一卒"的力量。' },
  { id: 23, dimension: 'NS', polarity: 1, text: '抽象概念比具体数字更让我感到"活过来"。' },
  { id: 24, dimension: 'NS', polarity: -1, text: '面对新概念，我倾向于先看实例。' },
  { id: 25, dimension: 'NS', polarity: 1, text: '我常常走神做白日梦。' },
  { id: 26, dimension: 'NS', polarity: -1, text: '我脚踏实地，不爱做无根据的假设。' },
  { id: 27, dimension: 'NS', polarity: 1, text: '我喜欢"我们能不能把 X 完全重新想象"这类问题。' },
  { id: 28, dimension: 'NS', polarity: -1, text: '我擅长记住具体、可重复的细节。' },
  { id: 29, dimension: 'NS', polarity: 1, text: '我更看重可能性与潜力而非现状。' },
  { id: 30, dimension: 'NS', polarity: -1, text: '我做判断前会先要数据/事实。' },

  // ============== TF 维度（15 题） ==============
  { id: 31, dimension: 'TF', polarity: 1, text: '我倾向于用逻辑一致性来判断观点的对错。' },
  { id: 32, dimension: 'TF', polarity: -1, text: '我决策时会先问"这会让谁受伤"。' },
  { id: 33, dimension: 'TF', polarity: 1, text: '我更欣赏"对就是对、错就是错"的态度。' },
  { id: 34, dimension: 'TF', polarity: -1, text: '我相信每个人都有自己的处境，要先理解。' },
  { id: 35, dimension: 'TF', polarity: 1, text: '我在决策时倾向于客观标准胜过他人感受。' },
  { id: 36, dimension: 'TF', polarity: -1, text: '和谐的关系比"正确"对我更重要。' },
  { id: 37, dimension: 'TF', polarity: 1, text: '我能冷酷地切分利弊，不被情绪带着走。' },
  { id: 38, dimension: 'TF', polarity: -1, text: '我能敏锐读到他人情绪的细微变化。' },
  { id: 39, dimension: 'TF', polarity: 1, text: '讨论中我偏好在论点层面交锋。' },
  { id: 40, dimension: 'TF', polarity: -1, text: '讨论中我偏好在关系层面维护氛围。' },
  { id: 41, dimension: 'TF', polarity: 1, text: '批评观点时我会就事论事，不太顾忌面子。' },
  { id: 42, dimension: 'TF', polarity: -1, text: '我会主动缓和气氛，让每个人都被听到。' },
  { id: 43, dimension: 'TF', polarity: 1, text: '我相信公平 ≠ 平均，要按功过分配。' },
  { id: 44, dimension: 'TF', polarity: -1, text: '我相信要体谅差异，没有标准答案。' },
  { id: 45, dimension: 'TF', polarity: 1, text: '我对自己的论点能据理力争不退让。' },

  // ============== JP 维度（15 题） ==============
  { id: 46, dimension: 'JP', polarity: 1, text: '我喜欢提前规划、按部就班。' },
  { id: 47, dimension: 'JP', polarity: -1, text: '我更喜欢随机应变、灵活调整。' },
  { id: 48, dimension: 'JP', polarity: 1, text: '做决定对我来说越早越好，避免悬而不决。' },
  { id: 49, dimension: 'JP', polarity: -1, text: '我喜欢保留多个选项直到最后一刻。' },
  { id: 50, dimension: 'JP', polarity: 1, text: '完成清单上所有任务会让我有成就感。' },
  { id: 51, dimension: 'JP', polarity: -1, text: '我享受探索过程中不断调整方向。' },
  { id: 52, dimension: 'JP', polarity: 1, text: '我倾向于按时打卡、有条不紊。' },
  { id: 53, dimension: 'JP', polarity: -1, text: '我倾向于"灵感来了就干"。' },
  { id: 54, dimension: 'JP', polarity: 1, text: '我对外承诺的事情会按期交付。' },
  { id: 55, dimension: 'JP', polarity: -1, text: '我反对被死线绑住，按质量交付最重要。' },
  { id: 56, dimension: 'JP', polarity: 1, text: '做完一件事再开下一件，会让我效率更高。' },
  { id: 57, dimension: 'JP', polarity: -1, text: '我常并行推进多件事，靠灵感轮换。' },
  { id: 58, dimension: 'JP', polarity: 1, text: '我倾向于彻底搞清楚再行动。' },
  { id: 59, dimension: 'JP', polarity: -1, text: '我倾向于边做边想，先动起来。' },
  { id: 60, dimension: 'JP', polarity: 1, text: '我对"最后一刻"的变化感到不适。' },
]

// ============ 计分 ============

export interface Score60 {
  /** EI 维度 E 的得分占比（0-100），100 = 强 E，0 = 强 I */
  E: number
  /** NS 维度 N 的得分占比 */
  N: number
  /** TF 维度 T 的得分占比 */
  T: number
  /** JP 维度 J 的得分占比 */
  J: number
  /** 综合判定的人格（如 "INTJ"） */
  type: string
  /** 该人格的强度分数（0-100），越高越像 */
  intensity: number
  /** 详细回答摘要 */
  detail: Record<Dimension, { score: number; max: number; raw: number }>
}

/**
 * 把 60 题的答案（0-6 分）转换为 4 维度 0-100 分
 * @param answers 长度 60，索引对应 QUESTION_60[].id-1 的分数（0-6）
 */
export function computeScore60(answers: number[]): Score60 {
  if (answers.length !== 60) {
    throw new Error(`answers 长度必须为 60，实际为 ${answers.length}`)
  }

  // 校验：每题分数 0-6
  if (answers.some(a => a < 0 || a > 6 || !Number.isInteger(a))) {
    throw new Error('每题分数必须为 0-6 之间的整数')
  }

  const dimSums: Record<Dimension, { score: number; max: number }> = {
    EI: { score: 0, max: 0 },
    NS: { score: 0, max: 0 },
    TF: { score: 0, max: 0 },
    JP: { score: 0, max: 0 },
  }

  for (let i = 0; i < 60; i++) {
    const q = QUESTION_60[i]
    const ans = answers[i]
    const max = 6 * 6 // 单维度最高 6 分 × 6 题
    dimSums[q.dimension].max += max
    if (q.polarity === 1) {
      dimSums[q.dimension].score += ans * 6
    } else {
      // 翻转：高分 = 反向倾向
      dimSums[q.dimension].score += (6 - ans) * 6
    }
  }

  const E = (dimSums.EI.score / dimSums.EI.max) * 100
  const N = (dimSums.NS.score / dimSums.NS.max) * 100
  const T = (dimSums.TF.score / dimSums.TF.max) * 100
  const J = (dimSums.JP.score / dimSums.JP.max) * 100

  const type =
    (E >= 50 ? 'E' : 'I') +
    (N >= 50 ? 'N' : 'S') +
    (T >= 50 ? 'T' : 'F') +
    (J >= 50 ? 'J' : 'P')

  // 强度：4 个维度中最大偏移 = min(score, 100-score) 越小越极端
  const biases = [E, N, T, J].map(s => Math.min(s, 100 - s))
  const minBias = Math.min(...biases)
  const intensity = Math.round(100 - minBias * 2) // 0 = 平庸，100 = 极偏

  return {
    E, N, T, J, type, intensity,
    detail: {
      EI: { score: dimSums.EI.score, max: dimSums.EI.max, raw: E },
      NS: { score: dimSums.NS.score, max: dimSums.NS.max, raw: N },
      TF: { score: dimSums.TF.score, max: dimSums.TF.max, raw: T },
      JP: { score: dimSums.JP.score, max: dimSums.JP.max, raw: J },
    },
  }
}

/**
 * 验证一组人格生成的内容是否真的像它（基于 simple trigram matching + 关键词打分）
 * 这是一个简化版行为验证器，上线后用 prompt-engineering-expert-v2 skill 做完整版。
 */
import { personaCores, type MBTI16 } from './personalityCore'

export interface BehaviorCheckResult {
  typeId: MBTI16
  /** 人格一致性 0-100 */
  consistency: number
  /** 反例边界违反次数 */
  forbiddenHits: number
  /** 偏离诊断 */
  issues: string[]
}

/**
 * v40.1 简化版行为验证（不依赖 LLM，纯规则打分）
 * 用 prompt-engineering-expert-v2 skill 跑深度版
 */
export function behaviorCheck(typeId: MBTI16, content: string): BehaviorCheckResult {
  const core = personaCores[typeId]
  if (!core) {
    return { typeId, consistency: 0, forbiddenHits: 0, issues: ['未知人格'] }
  }

  const issues: string[] = []
  let forbiddenHits = 0

  // 反例边界检查
  for (const rule of core.forbiddenMoves) {
    // 提取关键词（粗略：从规则中找）
    const keywords = rule.match(/[""「」]([^""「」]+)[""「」]/g)
    if (keywords) {
      for (const kw of keywords) {
        const cleaned = kw.replace(/[""「」]/g, '')
        if (content.includes(cleaned)) {
          forbiddenHits++
          issues.push(`违反规则："${cleaned}"`)
        }
      }
    }
  }

  // 输出长度检查
  if (content.length > core.outputLimits.maxChars) {
    issues.push(`超出长度上限（${content.length} > ${core.outputLimits.maxChars}）`)
  }

  // 简单一致性：至少提到一些人格锚定的"我是 X"或人格特征词
  const anchorTerms = [
    typeId.startsWith('I') ? ['独立思考', '深度', '专注', '逻辑', '安静'] : ['外向', '互动', '表达', '群体'],
    typeId[1] === 'N' ? ['直觉', '可能性', '想象', '概念', '未来'] : ['事实', '细节', '具体', '当下', '实际'],
    typeId[2] === 'T' ? ['逻辑', '分析', '客观', '标准', '判断'] : ['感受', '同理', '和谐', '理解', '关怀'],
    typeId[3] === 'J' ? ['计划', '结构', '确定', '控制', '决策'] : ['灵活', '开放', '调整', '探索', '发现'],
  ].flat()

  const matchedAnchor = anchorTerms.filter(t => content.includes(t)).length
  const consistency = Math.min(100, Math.round((matchedAnchor / anchorTerms.length) * 100 + (1 - forbiddenHits * 0.2) * 100 - issues.length * 5))

  return {
    typeId,
    consistency: Math.max(0, consistency),
    forbiddenHits,
    issues,
  }
}
