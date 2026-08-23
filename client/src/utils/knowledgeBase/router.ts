/**
 * v32 领域路由（router.ts）——「路由智能体」
 *
 * 用户提问 → 判断属于哪个领域知识库。
 * 纯本地启发式：query 分词后与领域关键词表匹配打分，
 * 不依赖 LLM（离线可用、零延迟），保证稳定路由。
 *
 * 打分规则：
 *  - token 完全等于领域关键词：+2
 *  - token 包含领域关键词 / 关键词包含 token：+1
 *  - 命中「通用领域」关键词不额外计分（general 是兜底，不参与竞争）
 */

import type { DomainRecord } from './store'

export interface DomainMatch {
  domain: DomainRecord
  score: number
  hitKeywords: string[]
}

/**
 * 对查询做领域打分，返回降序候选（分数 <= 0 的剔除）。
 */
export function routeDomain(query: string, domains: DomainRecord[], tokenizeFn: (text: string) => string[]): DomainMatch[] {
  const tokens = tokenizeFn(query)
  if (tokens.length === 0) return []

  const results: DomainMatch[] = []
  for (const domain of domains) {
    if (!domain.enabled) continue
    if (domain.id === 'general') continue // 兜底领域不参与打分

    const kw = domain.keywords.map(k => k.toLowerCase())
    let score = 0
    const hitKeywords: string[] = []
    for (const t of tokens) {
      for (const k of kw) {
        if (k === t) {
          score += 2
          hitKeywords.push(k)
          break
        }
        if (t.includes(k) || k.includes(t)) {
          score += 1
          hitKeywords.push(k)
          break
        }
      }
    }
    if (score > 0) results.push({ domain, score, hitKeywords: [...new Set(hitKeywords)] })
  }

  return results.sort((a, b) => b.score - a.score)
}

/**
 * 路由主入口：返回最佳领域（无命中时回退 general 兜底领域）。
 */
export function pickDomain(query: string, domains: DomainRecord[], tokenizeFn: (text: string) => string[]): { match: DomainMatch | null; general: DomainRecord | undefined } {
  const ranked = routeDomain(query, domains, tokenizeFn)
  const general = domains.find(d => d.id === 'general')
  const top = ranked.length > 0 ? ranked[0] : null
  // 兜底：top 分数过低（如仅 1 分边缘命中）且 general 有数据时，交给 general
  if (top && top.score >= 2) return { match: top, general }
  return { match: null, general }
}
