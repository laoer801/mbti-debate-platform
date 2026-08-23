import { DebateMode } from '../types'

export interface DebateModeConfig {
  id: DebateMode
  name: string
  emoji: string
  description: string
  turnStyle: 'sequential' | 'interruptible' | 'paired' | 'questionChain'
  maxRounds: number
  timePerTurn: number | null
  specialRules: string[]
}

export const debateModes: DebateModeConfig[] = [
  {
    id: 'free',
    name: '自由辩论',
    emoji: '🗣️',
    description: '所有人格自由发言，AI控制流畅度',
    turnStyle: 'sequential',
    maxRounds: 10,
    timePerTurn: null,
    specialRules: ['无固定发言顺序', '可随时表达观点'],
  },
  {
    id: 'roundRobin',
    name: '轮转辩论',
    emoji: '🔄',
    description: '每轮选一个立场辩手，其他人轮流向TA发问',
    turnStyle: 'sequential',
    maxRounds: 8,
    timePerTurn: 120,
    specialRules: ['每轮一位"守擂者"', '其他人为"挑战者"', '每轮结束后守擂者轮换'],
  },
  {
    id: 'adversarial',
    name: '对抗模式',
    emoji: '⚔️',
    description: '两两配对，逐点对攻，论点被反驳即扣确信度',
    turnStyle: 'paired',
    maxRounds: 6,
    timePerTurn: 90,
    specialRules: ['每轮配对辩论', '论点被有效反驳扣分', '支持同一论点可合力'],
  },
  {
    id: 'socratic',
    name: '苏格拉底模式',
    emoji: '🏛️',
    description: '以提问链推进，一个人格不断被追问底层逻辑',
    turnStyle: 'questionChain',
    maxRounds: 12,
    timePerTurn: null,
    specialRules: ['每次回答后紧跟追问', '追问必须针对前一个回答', '三问后可以反问'],
  },
  {
    id: 'duel',
    name: '1v1往来',
    emoji: '⚡',
    description: '与单个人格一来一回的交锋，往来记录可保存',
    turnStyle: 'paired',
    maxRounds: 20,
    timePerTurn: null,
    specialRules: ['双方交替发言', '人格按自身风格回应', '往来记录自动接入战斗记录'],
  },
  {
    id: 'dialogue',
    name: '对话模式',
    emoji: '💬',
    description: '倾听→回应→邀请，无裁判无胜负，立场可流动',
    turnStyle: 'interruptible',
    maxRounds: 30,
    timePerTurn: null,
    specialRules: ['三层结构：倾听→回应→邀请', '无裁判无胜负', '立场可流动', '16人格对话风格差异化', '先回应情绪再回应内容'],
  },
]
