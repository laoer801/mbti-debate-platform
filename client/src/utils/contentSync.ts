/**
 * v35 内容管理同步 — 从后端拉取云端内容并缓存
 *  - 辩论主题（debate_topics）：启动拉取 → 合并进 TopicPicker 候选
 *  - 人格提示词覆盖（persona_overrides）：启动拉取 → buildSpeechMessages 时覆盖系统提示词
 * 离线/后端未启动时静默降级（保持内置主题与默认提示词）
 */

import { API_BASE } from '../config'

export interface CloudTopic {
  id: string
  title: string
  description: string
  sides: string[]
  active: number
  created_at: number
}

export interface PersonaOverride {
  type_id: string
  system_prompt_override: string
  path_advice_override: string
  updated_at: number
}

const TOPICS_KEY = 'ds_cloud_topics'
const OVERRIDES_KEY = 'ds_cloud_overrides'

let memTopics: CloudTopic[] | null = null
let memOverrides: PersonaOverride[] | null = null

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

export function getCloudTopics(): CloudTopic[] {
  if (memTopics) return memTopics
  try {
    if (hasLocalStorage()) {
      const raw = localStorage.getItem(TOPICS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
      }
    }
  } catch { /* ignore */ }
  return []
}

export function getPersonaOverride(typeId: string): PersonaOverride | null {
  const overrides = getCloudOverrides()
  return overrides.find(o => o.type_id.toUpperCase() === typeId.toUpperCase()) || null
}

export function getCloudOverrides(): PersonaOverride[] {
  if (memOverrides) return memOverrides
  try {
    if (hasLocalStorage()) {
      const raw = localStorage.getItem(OVERRIDES_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
      }
    }
  } catch { /* ignore */ }
  return []
}

async function fetchTopics(): Promise<CloudTopic[]> {
  const res = await fetch(`${API_BASE}/api/content/topics`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('拉取云端主题失败')
  const data = await res.json()
  return Array.isArray(data.topics) ? data.topics : []
}

async function fetchOverrides(): Promise<PersonaOverride[]> {
  const res = await fetch(`${API_BASE}/api/content/overrides`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('拉取人格覆盖失败')
  const data = await res.json()
  return Array.isArray(data.overrides) ? data.overrides : []
}

/**
 * 启动时调用：拉取云端内容并缓存（幂等，可重复调用）
 * 失败静默——本地内置内容兜底
 */
export async function initContentSync(): Promise<void> {
  try {
    const [topics, overrides] = await Promise.all([fetchTopics(), fetchOverrides()])
    memTopics = topics
    memOverrides = overrides
    if (hasLocalStorage()) {
      try {
        localStorage.setItem(TOPICS_KEY, JSON.stringify(topics))
        localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides))
      } catch { /* ignore */ }
    }
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('mbti:content-synced', { detail: { topics, overrides } }))
      } catch { /* ignore */ }
    }
  } catch (err) {
    console.warn('[ContentSync] 云端内容拉取失败（使用本地内置内容）:', err)
  }
}

/** 合并云端主题与内置主题（按标题去重，云端优先） */
export function mergeCloudTopics(local: { title: string }[], cloud: CloudTopic[]): CloudTopic[] {
  const map = new Map<string, CloudTopic>()
  for (const c of cloud) map.set(c.title, c)
  // 内置主题保留（云端无同名时）
  for (const l of local) if (!map.has(l.title)) map.set(l.title, { id: 'local_' + l.title, title: l.title, description: '', sides: ['正方', '反方'], active: 1, created_at: 0 })
  return [...map.values()]
}
