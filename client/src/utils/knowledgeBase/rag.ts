/**
 * v32 RAG 编排层（rag.ts）——「检索增强生成」主流程
 *
 * 用户提问 → ① 路由智能体（router 判断领域）
 *           → ② 检索智能体（store 在领域内 BM25 检索 top-k 片段）
 *           → ③ 组装「知识库上下文」注入人格提示词（带 [n] 引用标记）
 *
 * 引用溯源：检索到的片段原样保留（title / fileName / text），
 * 回答后 UI 以「📚 参考来源」卡片展示，实现可溯源的科普。
 */

import { getAllDomains, searchDomain, type DomainRecord } from './store'
import { pickDomain, routeDomain } from './router'
import { tokenize, tokenizeQuery } from './tokenizer'
import type { BM25Hit } from './bm25'

export interface RagHit {
  title: string
  fileName: string
  text: string
  score: number
}

export interface RagContext {
  domainId: string
  domainName: string
  domainEmoji: string
  domainColor: string
  /** 路由命中的领域关键词（展示用） */
  hitKeywords: string[]
  /** 检索到的片段（按分数降序，最多 topK 条） */
  hits: RagHit[]
  /** 是否属于「兜底路由」：没有明确领域但用了 general 知识库 */
  isFallback: boolean
  totalChunks: number
}

const MAX_HITS = 4

/**
 * 执行完整检索增强：路由 + 检索，组装 RagContext。
 * @param query 用户提问
 * @param topK  每个来源取多少片段
 * @returns 无任何可用知识库时返回 null（调用方降级为纯人格对话）
 */
export async function retrieveForQuery(query: string, topK = MAX_HITS): Promise<RagContext | null> {
  const domains = await getAllDomains()
  const enabled = domains.filter(d => d.enabled)
  if (enabled.length === 0) return null

  // ① 路由
  const ranked = routeDomain(query, enabled, tokenize)
  const { match, general } = pickDomain(query, enabled, tokenize)

  // 决定检索目标：明确命中领域优先；否则 general 兜底；都没有则全领域合并检索
  let targets: DomainRecord[] = []
  let isFallback = false
  if (match && (match.score >= 2 || match.hitKeywords.length >= 1)) {
    targets = [match.domain]
    // 分数不高时，同时带 general 补检索
    if (match.score < 3 && general && general.id !== match.domain.id) targets.push(general)
  } else if (general) {
    targets = [general]
    isFallback = true
  } else {
    targets = enabled.filter(d => d.id !== 'general').slice(0, 3)
    isFallback = true
  }

  // ② 检索
  const collected: { hit: BM25Hit; domain: DomainRecord }[] = []
  let totalChunks = 0
  for (const domain of targets) {
    const hits = await searchDomain(domain.id, query, topK)
    totalChunks += hits.length
    for (const h of hits) collected.push({ hit: h, domain })
  }
  if (collected.length === 0) return null

  // 跨领域合并去重，取分数最高 topK
  const seen = new Set<string>()
  const merged = collected
    .sort((a, b) => b.hit.score - a.hit.score)
    .filter(x => {
      if (seen.has(x.hit.id)) return false
      seen.add(x.hit.id)
      return true
    })
    .slice(0, topK)

  const primary = targets[0]
  return {
    domainId: primary.id,
    domainName: primary.name,
    domainEmoji: primary.emoji,
    domainColor: primary.color,
    hitKeywords: match?.hitKeywords ?? [],
    hits: merged.map(x => ({
      title: x.hit.title ?? '',
      fileName: x.hit.text ? x.hit.title ?? '' : '',
      text: x.hit.text,
      score: x.hit.score,
    })),
    isFallback,
    totalChunks,
  }
}

/**
 * 生成注入人格系统提示词的「知识库上下文」段。
 * 片段按 [1]..[n] 编号，指示 LLM 引用时标注对应序号。
 */
export function buildKnowledgeSection(rag: RagContext): string {
  if (!rag || rag.hits.length === 0) return ''
  const hitsText = rag.hits
    .map((h, i) => `[${i + 1}] 《${h.title}》：${h.text}`)
    .join('\n\n')

  return `## 知识库上下文（来自「${rag.domainEmoji} ${rag.domainName}」领域知识库）

以下是检索到的参考资料，回答用户问题时**优先依据这些资料**：

${hitsText}

### 使用准则
1. 资料中明确提到的内容，可以自信地回答；引用时在句末标注序号，如「根据资料[1]，…」或「…（[2]）」
2. 资料未覆盖的部分：如属常识且你确定，可以补充说明并注明「这是我的理解」；不确定则明确说「这部分超出我的知识库范围」
3. 严禁编造资料中不存在的具体数字、法条、配方或结论——宁可说不知道
4. 区分「资料事实」与「个人观点」：讲事实引用资料，谈看法时用「我作为${rag.domainName}的思考是…」`
}

/** 从回答文本中提取引用序号（如 [1][2]），供 UI 高亮 */
export function extractCitations(text: string): number[] {
  const nums = new Set<number>()
  const re = /\[(\d+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10)
    if (n >= 1 && n <= 9) nums.add(n)
  }
  return [...nums].sort((a, b) => a - b)
}

/** 判断知识库是否已导入内容（全局统计，供 UI 提示） */
export async function hasAnyKnowledge(): Promise<boolean> {
  const domains = await getAllDomains()
  for (const d of domains) {
    if (!d.enabled) continue
    const hits = await searchDomain(d.id, '知识 内容 资料 说明 介绍', 1)
    if (hits.length > 0) return true
  }
  return false
}
