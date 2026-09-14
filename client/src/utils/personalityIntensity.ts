/**
 * v40.1 人格强度滑块（轻量状态管理 + localStorage）
 *
 * 提供：
 *   - getIntensity(typeId): 读取该人格的强度档（默认 3 标准）
 *   - setIntensity(typeId, level): 设置强度档
 *   - getIntensityForAll(): 一次性读全部
 *   - listIntensity(): 列出 16 人格的强度仪表
 *
 * 升级到云端时只需把 localStorage 换成 Supabase 调用。
 */

import type { MBTI16 } from '../data/personalityCore'
import { INTENSITY_LABELS, INTENSITY_DESCRIPTIONS, type IntensityLevel } from '../data/personalityShell'

const KEY = 'mbti_persona_intensity_v40'

export interface IntensityMap {
  // 加默认值：未设置的人格使用 level=3
  [typeId: string]: IntensityLevel
}

/** 默认强度档（3 标准） */
const DEFAULT: IntensityMap = {
  INTJ: 3, INTP: 3, ENTJ: 3, ENTP: 3,
  INFJ: 3, INFP: 3, ENFJ: 3, ENFP: 3,
  ISTJ: 3, ISFJ: 3, ESTJ: 3, ESFJ: 3,
  ISTP: 3, ISFP: 3, ESTP: 3, ESFP: 3,
}

function loadAll(): IntensityMap {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    if (!raw) return { ...DEFAULT }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT }
    return { ...DEFAULT, ...parsed }
  } catch {
    return { ...DEFAULT }
  }
}

function saveAll(map: IntensityMap): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, JSON.stringify(map))
      window.dispatchEvent(new CustomEvent('mbti:intensity-changed', { detail: map }))
    }
  } catch {
    // 静默失败
  }
}

export function getIntensity(typeId: MBTI16): IntensityLevel {
  const map = loadAll()
  return (map[typeId] ?? 3) as IntensityLevel
}

export function setIntensity(typeId: MBTI16, level: IntensityLevel): void {
  const map = loadAll()
  map[typeId] = level
  saveAll(map)
}

export function getIntensityForAll(): IntensityMap {
  return loadAll()
}

/** 同时设置 16 个人格的强度（"一键重置"用） */
export function resetAllIntensity(level: IntensityLevel = 3): void {
  const all = { ...DEFAULT } as IntensityMap
  Object.keys(all).forEach(k => { all[k] = level })
  saveAll(all)
}

/** UI 用的描述工具 */
export function describeIntensity(level: IntensityLevel): string {
  return `${INTENSITY_LABELS[level]}（${level}/5）· ${INTENSITY_DESCRIPTIONS[level]}`
}

/** React Hook（订阅变化） */
import { useEffect, useState } from 'react'

export function useIntensity(typeId: MBTI16): [IntensityLevel, (level: IntensityLevel) => void] {
  const [level, setLevel] = useState<IntensityLevel>(() => getIntensity(typeId))

  useEffect(() => {
    const refresh = () => setLevel(getIntensity(typeId))
    window.addEventListener('mbti:intensity-changed', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('mbti:intensity-changed', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [typeId])

  const update = (next: IntensityLevel) => {
    setIntensity(typeId, next)
    setLevel(next)
  }

  return [level, update]
}

/** 16 人格强度仪表（一次性读全部） */
export function useIntensityForAll(): IntensityMap {
  const [map, setMap] = useState<IntensityMap>(() => getIntensityForAll())
  useEffect(() => {
    const refresh = () => setMap(getIntensityForAll())
    window.addEventListener('mbti:intensity-changed', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('mbti:intensity-changed', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  return map
}
