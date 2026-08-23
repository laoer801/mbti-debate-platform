/**
 * 知识库数据层 Hook
 * 从服务端 SQLite 知识库加载人格数据，本地缓存 5 分钟
 */
import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '../config'

const API = API_BASE + '/api/kb'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface KBProfile {
  type_id: string
  type_name: string
  type_emoji: string
  type_color: string
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

interface FewShot {
  id: string
  type_id: string
  category: string
  scenario: string
  user_input: string
  personality_response: string
}

interface KBGroup {
  name: string
  code: string
  emoji: string
  desc: string
  count: number
  members: string[]
}

let profilesCache: { data: KBProfile[]; ts: number } | null = null
let groupsCache: { data: KBGroup[]; ts: number } | null = null

async function fetchJSON(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`KB fetch failed: ${res.status}`)
  return res.json()
}

export function useKnowledgeBase() {
  const [profiles, setProfiles] = useState<KBProfile[]>([])
  const [groups, setGroups] = useState<KBGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfiles = useCallback(async () => {
    // Return cached if fresh
    if (profilesCache && Date.now() - profilesCache.ts < CACHE_TTL) {
      setProfiles(profilesCache.data)
      return profilesCache.data
    }
    const { profiles } = await fetchJSON(`${API}/profiles`)
    profilesCache = { data: profiles, ts: Date.now() }
    setProfiles(profiles)
    return profiles
  }, [])

  const loadGroups = useCallback(async () => {
    if (groupsCache && Date.now() - groupsCache.ts < CACHE_TTL) {
      setGroups(groupsCache.data)
      return groupsCache.data
    }
    const { groups } = await fetchJSON(`${API}/groups`)
    groupsCache = { data: groups, ts: Date.now() }
    setGroups(groups)
    return groups
  }, [])

  useEffect(() => {
    Promise.all([loadProfiles(), loadGroups()])
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const getProfile = useCallback((typeId: string) => {
    return profiles.find(p => p.type_id === typeId) || null
  }, [profiles])

  const getSystemPrompt = useCallback(async (typeId: string) => {
    const { systemPrompt } = await fetchJSON(`${API}/profiles/${typeId}/system-prompt`)
    return systemPrompt
  }, [])

  const getFewShots = useCallback(async (typeId: string, n = 3) => {
    const { examples } = await fetchJSON(`${API}/fewshots/${typeId}/random?n=${n}`)
    return examples as FewShot[]
  }, [])

  const getReflections = useCallback(async (typeId: string, triggerType?: string) => {
    const params = triggerType ? `?trigger_type=${triggerType}` : ''
    const { reflections } = await fetchJSON(`${API}/reflections/${typeId}${params}`)
    return reflections
  }, [])

  return {
    profiles,
    groups,
    loading,
    error,
    getProfile,
    getSystemPrompt,
    getFewShots,
    getReflections,
    reload: () => { profilesCache = null; groupsCache = null; loadProfiles(); loadGroups() },
  }
}

/**
 * 同步版本：从缓存读取已加载的人格数据（不触发网络请求）
 * 用于辩论引擎等需要在渲染循环中快速访问数据的场景
 */
export function getCachedProfile(typeId: string): KBProfile | null {
  return profilesCache?.data?.find(p => p.type_id === typeId) || null
}

export function getCachedProfiles(): KBProfile[] {
  return profilesCache?.data || []
}
