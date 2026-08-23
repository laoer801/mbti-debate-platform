/**
 * 知识库集成适配层
 * 将 SQLite 知识库数据注入辩论引擎
 * 不破坏现有同步 API，渐进式增强
 */

import { personalitySystems } from '../data/personalitySystem'
import type { PersonalitySystem, FewShotExample } from '../data/personalitySystem'
import { API_BASE } from '../config'

const API = API_BASE + '/api/kb'

// ── 类型 ──

interface KBProfile {
  type_id: string
  type_name: string
  group_name: string
  identity_statement: string
  energy_source: string
  info_processing: string
  decision_style: string
  life_style: string
  tone: string
  word_preference: string
  sentence_pattern: string
  catchphrases: string[]
  emotion_expression: string
  core_values: string[]
  blind_spots: string[]
  core_instructions: string[]
  debate_stances: string[]
  avg_sentence_length: number
}

interface KBFewShot {
  id: string
  type_id: string
  category: string
  scenario: string
  user_input: string
  personality_response: string
}

// ── 缓存 ──

let kbProfiles: KBProfile[] = []
let kbFewShots: KBFewShot[] = []
let kbLoaded = false

/** 从 API 加载知识库数据 */
export async function loadKnowledgeBase(): Promise<boolean> {
  if (kbLoaded) return true
  try {
    const [profilesRes, fewshotsRes] = await Promise.all([
      fetch(`${API}/profiles`).then(r => r.json()),
      fetch(`${API}/fewshots/all`).then(r => r.json()).catch(() => null),
    ])
    kbProfiles = profilesRes.profiles || []
    kbFewShots = fewshotsRes?.examples || []
    kbLoaded = true
    console.log(`[KB] 加载完成: ${kbProfiles.length} 人格, ${kbFewShots.length} 示例`)
    return true
  } catch (e) {
    console.warn('[KB] 加载失败，回退静态数据:', e)
    return false
  }
}

/** 获取 KB 增强后的 PersonalitySystem */
export function getKBEnhancedSystem(typeId: string): PersonalitySystem | null {
  const base = personalitySystems[typeId]
  if (!base) return null

  const kbP = kbProfiles.find(p => p.type_id === typeId)
  if (!kbP) return base

  // 从 KB 补充 few-shot 示例
  const kbShots = kbFewShots
    .filter(s => s.type_id === typeId)
    .map(s => ({
      scenario: s.scenario,
      userSays: s.user_input,
      response: s.personality_response,
    } as FewShotExample))

  // 合并静态和 KB 数据（KB 优先）
  return {
    ...base,
    speechPattern: {
      ...base.speechPattern,
      tone: kbP.tone || base.speechPattern.tone,
      wordPreference: kbP.word_preference || base.speechPattern.wordPreference,
      typicalSentence: kbP.sentence_pattern || base.speechPattern.typicalSentence,
    },
    values: kbP.core_values.length > 0 ? kbP.core_values : base.values,
    blindSpots: kbP.blind_spots.length > 0 ? kbP.blind_spots : base.blindSpots,
    debateStances: kbP.debate_stances.length > 0 ? kbP.debate_stances : base.debateStances,
    fewShotExamples: kbShots.length > 0 ? kbShots : base.fewShotExamples,
  }
}

/** 获取 KB 人格完整五层数据 */
export function getKBProfile(typeId: string): KBProfile | null {
  return kbProfiles.find(p => p.type_id === typeId) || null
}

/** 获取 KB Few-shot 示例 */
export function getKBFewShots(typeId: string, category?: string): KBFewShot[] {
  let shots = kbFewShots.filter(s => s.type_id === typeId)
  if (category) shots = shots.filter(s => s.category === category)
  return shots
}

/** KB 是否已加载 */
export function isKBLoaded(): boolean {
  return kbLoaded
}
