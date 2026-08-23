/**
 * 多智能体辩论编排器（v25「结构化对抗」MAD 架构）
 *
 * 流程编排：开场陈词 → 交叉质询 → 自由辩论 → 总结陈词
 * 每个辩手是独立的 LLM Agent（人格系统提示词 + 立场锚定 + 防套话规则），
 * 通过轮流发言 + 动态上下文（对方最新发言 / 历史摘要 / 压缩协议）产生对抗。
 *
 * LLM 未配置或调用失败时，自动回退到本地模板引擎（debateEngine），保证功能不中断。
 */

import { chatCompletion, isLLMConfigured, type LLMMessage } from './llmClient'
import {
  buildSpeechMessages,
  buildStageInstruction,
  buildTopicAnalysisPrompt,
  buildTopicAnalysisFallback,
  buildResearchPrompt,
  buildResearchFallback,
  TOPIC_ANALYSIS_SYSTEM_PROMPT,
  RESEARCH_SYSTEM_PROMPT,
  STANCE_SYSTEM_PROMPT,
  buildStancePrompt,
  buildStanceFallback,
  JUDGE_SYSTEM_PROMPT,
  type DebateStage,
} from './debatePrompts'
import {
  generateDebateResponse,
  judgeDebate,
  sideLabels,
  type Side,
  type DebateEntry,
  type JudgeScore,
} from './debateEngine'
import { mbtiProfiles } from '../data/mbtiProfiles'
// v31：人格状态引擎 + 持久记忆（仅类型引用，无运行时依赖，避免循环 import）
import type { PersonaState } from './personaEngine'
import type { PersonaMemory } from './personaMemory'
// v34：视频知识检索（全局共享——人格辩论时可引用收藏的科普视频内容）
import { retrieveVideoKnowledge } from './videoKnowledge'
// v38：每日新闻知识检索（全局共享——人格辩论时可引用时事热点）
import { retrieveNewsKnowledge } from './newsKnowledge'

// ============ 类型 ============

export interface ArenaDebater {
  typeId: string
  typeName: string
  side: Side
  emoji?: string
  color?: string
}

export interface ArenaSpeech {
  typeId: string
  typeName: string
  side: Side
  content: string
  /** v28 思考链：LLM 输出的【思考】部分，浅色/折叠展示给观众看 */
  thinking?: string
  stage: DebateStage
  round: number
  source: 'llm' | 'template'
}

/** v26.2 审题结果：来源区分 LLM 深度审题 / 本地快速审题 */
export interface TopicAnalysis {
  text: string
  source: 'llm' | 'fallback'
}

/** v27 资料包：LLM 知识库检索 / 本地兜底 */
export interface ArenaResearch {
  text: string
  source: 'llm' | 'fallback'
}

/** v27.2 立场宣言：开赛前每位辩手先亮明「我认为……」，置顶展示 */
export interface ArenaStance {
  typeId: string
  typeName: string
  side: Side
  content: string
  source: 'llm' | 'fallback'
}

export interface ArenaState {
  topic: string
  debaters: ArenaDebater[]
  history: ArenaSpeech[]
  round: number
  maxRounds: number
  /** 当前轮到 debaters 中的哪个下标 */
  activeIndex: number
  /** 整场是否已结束 */
  finished: boolean
  /** 赛前审题报告（v26 起：辩论之前必先审题） */
  topicAnalysis?: TopicAnalysis
  /** 赛前资料包（v27 起：审题后检索辩题资料，供全员引用） */
  research?: ArenaResearch
  /** v27.2 赛前立场宣言（开赛前每人先亮明立场，置顶展示） */
  stance?: ArenaStance[]
}

export interface ArenaJudgeResult {
  scores: JudgeScore[]
  winner: string
  verdict: string
  source: 'llm' | 'template'
}

export interface JudgeLLMEntry {
  typeId: string
  name: string
  logic: number
  evidence: number
  clarity: number
  rebuttal: number
  demeanor: number
  /** v26 对抗质量三维度（0-10） */
  engagement?: number
  depth?: number
  kill?: number
  total: number
  comment: string
  clicheNotes?: string
}

// ============ 阶段推导 ============

/**
 * 8 轮赛制阶段规划：
 *   round 0           → 开场陈词
 *   round 1           → 交叉质询（第一个辩手攻，后续守）
 *   round 2..N-2      → 自由辩论
 *   round N-1         → 总结陈词
 */
export function stageForRound(round: number, maxRounds: number): DebateStage {
  if (round <= 0) return 'opening'
  if (round === 1) return 'cross_exam'
  if (round >= maxRounds - 1) return 'summary'
  return 'free_debate'
}

// ============ 创建辩论场 ============

export function createArena(
  topic: string,
  debaters: ArenaDebater[],
  maxRounds = 8
): ArenaState {
  return {
    topic,
    debaters,
    history: [],
    round: 0,
    maxRounds,
    activeIndex: 0,
    finished: false,
    // v26：赛前分析由 prepareArena() 生成（LLM 优先，本地兜底）
    topicAnalysis: undefined,
  }
}

/** 便捷创建：从 typeId 列表 + 正反方分配 */
export function createArenaFromTypes(
  topic: string,
  proTypes: string[],
  conTypes: string[]
): ArenaState {
  const toDebater = (typeId: string, side: Side): ArenaDebater => {
    const profile = mbtiProfiles.find(p => p.id === typeId)
    return {
      typeId,
      typeName: profile?.name || typeId,
      side,
      emoji: profile?.emoji,
      color: profile?.color,
    }
  }
  return createArena(
    topic,
    [...proTypes.map(t => toDebater(t, 'pro')), ...conTypes.map(t => toDebater(t, 'con'))]
  )
}

// ============ 赛前辩题分析（v26 硬性流程） ============

/**
 * 生成赛前审题报告：LLM 优先，失败/未配置时返回本地兜底审题。
 * 返回 { text, source }——UI 据此区分「AI 深度审题」与「本地快速审题」。
 * 不抛错——保证辩论流程永不因审题失败中断，但审题必须发生。
 */
export async function analyzeTopic(
  topic: string,
  typeIds: string[]
): Promise<TopicAnalysis> {
  if (isLLMConfigured()) {
    try {
      const raw = await chatCompletion(
        [
          { role: 'system', content: TOPIC_ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: buildTopicAnalysisPrompt(topic, typeIds) },
        ],
        { temperature: 0.4, maxTokens: 700 }
      )
      if (raw && raw.trim().length > 20) {
        return { text: raw.trim(), source: 'llm' }
      }
    } catch (err) {
      console.warn('[Arena] LLM 审题失败，使用本地审题:', err)
    }
  }
  return { text: buildTopicAnalysisFallback(topic, typeIds), source: 'fallback' }
}

/**
 * 辩论赛前的审题流程：审题 → 把审题报告写入 arena 状态。
 * LLM 未配置/失败时自动使用本地审题，保证「辩论之前一定有审题」。
 * 调用方（UI / 测试脚本）在开赛前调用一次即可。
 */
export async function prepareArena(state: ArenaState): Promise<ArenaState> {
  const analysis = await analyzeTopic(
    state.topic,
    state.debaters.map(d => d.typeId)
  )
  return { ...state, topicAnalysis: analysis }
}

// ============ 赛前资料检索（v27「审题之后、辩论之前先检索资料」） ============

/**
 * 生成赛前资料包：LLM 知识库检索优先，失败/未配置时返回本地兜底。
 * 返回 { text, source }——UI 据此区分「AI 深度检索」与「本地快速检索」。
 * 不抛错——保证辩论流程永不因检索失败中断，但检索必须发生。
 */
export async function runResearch(state: ArenaState): Promise<ArenaState> {
  if (state.research) return state
  const typeIds = state.debaters.map(d => d.typeId)
  if (isLLMConfigured()) {
    try {
      const raw = await chatCompletion(
        [
          { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
          { role: 'user', content: buildResearchPrompt(state.topic, typeIds) },
        ],
        { temperature: 0.4, maxTokens: 800 }
      )
      if (raw && raw.trim().length > 30) {
        return { ...state, research: { text: raw.trim(), source: 'llm' } }
      }
    } catch (err) {
      console.warn('[Arena] LLM 资料检索失败，使用本地资料包:', err)
    }
  }
  return { ...state, research: { text: buildResearchFallback(state.topic), source: 'fallback' } }
}

/**
 * 完整赛前流程：审题 → 检索资料 → 立场宣言 → 写入 arena 状态。
 * 三个环节各自 LLM 优先、本地兜底，保证「辩论之前必有审题、必有资料、必亮立场」。
 * 已完成的环节自动跳过（幂等），可安全重复调用。
 */
export async function prepareFullArena(state: ArenaState): Promise<ArenaState> {
  let cur = state.topicAnalysis ? state : await prepareArena(state)
  cur = await runResearch(cur)
  cur = await runStance(cur)
  return cur
}

// ============ 赛前立场宣言（v27.2「先表明自己的辩题立场，我认为……」） ============

/**
 * 为某位辩手生成立场宣言：LLM 优先，失败/未配置时返回本地兜底骨架。
 * 不抛错——保证每位辩手在开赛前都能亮明「我认为……因为……」
 */
export async function generateStanceForDebater(
  debater: ArenaDebater,
  topic: string
): Promise<ArenaStance> {
  if (isLLMConfigured()) {
    try {
      const raw = await chatCompletion(
        [
          { role: 'system', content: STANCE_SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildStancePrompt(debater.typeId, debater.typeName, topic, debater.side),
          },
        ],
        { temperature: 0.8, maxTokens: 450 }
      )
      const clean = (raw || '').trim()
      if (clean.length > 30) {
        // 硬性校验：第一句必须是「我认为『辩题』成立/不成立」
        const stance = debater.side === 'pro' ? '成立' : '不成立'
        const content = clean.startsWith('我认为')
          ? clean
          : `我认为「${topic}」${stance}，因为：${clean}`
        return {
          typeId: debater.typeId,
          typeName: debater.typeName,
          side: debater.side,
          content,
          source: 'llm',
        }
      }
    } catch (err) {
      console.warn('[Arena] LLM 立场宣言失败，使用本地骨架:', err)
    }
  }
  return {
    typeId: debater.typeId,
    typeName: debater.typeName,
    side: debater.side,
    content: buildStanceFallback(debater.typeId, debater.typeName, topic, debater.side),
    source: 'fallback',
  }
}

/**
 * 生成全场立场宣言：所有辩手并行各发一段「我认为……」。
 * 已生成时幂等跳过，可安全重复调用。
 */
export async function runStance(state: ArenaState): Promise<ArenaState> {
  if (state.stance && state.stance.length > 0) return state
  const stance = await Promise.all(
    state.debaters.map(d => generateStanceForDebater(d, state.topic))
  )
  return { ...state, stance }
}

// ============ 发言生成 ============

// ============ v28 思考链 CoT 解析 ============

/**
 * 解析 LLM 输出的【思考】+【发言】两部分：
 * - 如果输出包含「【思考】」和「【发言】」标签，按标签分离
 * - 如果不包含标签（LLM 未遵守格式），全部作为发言内容
 *
 * @param raw LLM 原始输出
 * @returns { thinking: 思考部分, content: 发言部分 }
 */
export function parseCoT(raw: string): { thinking: string; content: string } {
  // 尝试匹配【思考】...【发言】... 格式
  const thinkingMatch = raw.match(/【思考】([\s\S]*?)(?=【发言】|$)/)
  const speechMatch = raw.match(/【发言】([\s\S]*?)$/)

  if (thinkingMatch && speechMatch) {
    return {
      thinking: thinkingMatch[1].trim(),
      content: speechMatch[1].trim(),
    }
  }

  // 兜底：没有标签，全部作为发言
  return { thinking: '', content: raw.trim() }
}

/**
 * 生成当前辩手的下一条发言（LLM 优先，模板兜底）
 *
 * @param persona 当前辩手的人格上下文（v31：状态 + 记忆，可选——测试/无 UI 场景不传）
 */
export async function generateArenaSpeech(
  state: ArenaState,
  persona?: { state?: PersonaState; memory?: PersonaMemory }
): Promise<ArenaSpeech> {
  const debater = state.debaters[state.activeIndex]
  const stage = stageForRound(state.round, state.maxRounds)

  // 对方最新发言 = 上一条非本人的发言
  const opponentLatest = [...state.history]
    .reverse()
    .find(s => s.typeId !== debater.typeId)

  const ownSpeechCount = state.history.filter(
    s => s.typeId === debater.typeId
  ).length

  const recentHistory = state.history.slice(-3).map(s => {
    const sideName = sideLabels[s.side]
    return `【${s.typeName}（${sideName}）】${s.content}`
  })

  // 尝试 LLM
  if (isLLMConfigured()) {
    try {
      // v34：检索视频知识（全局共享）——失败静默跳过，不阻塞辩论
      let videoKnowledge: string | null = null
      try {
        videoKnowledge = await retrieveVideoKnowledge(state.topic, 3)
      } catch (err) {
        console.warn('[Arena] 视频知识检索失败（跳过）:', err)
      }
      // v38：检索今日新闻（全局共享）——失败静默跳过
      let newsKnowledge: string | null = null
      try {
        newsKnowledge = await retrieveNewsKnowledge(state.topic, 3)
      } catch (err) {
        console.warn('[Arena] 新闻知识检索失败（跳过）:', err)
      }
      const messages = buildSpeechMessages({
        typeId: debater.typeId,
        typeName: debater.typeName,
        side: debater.side,
        topic: state.topic,
        stage,
        // 未走 prepareArena 时兜底注入本地审题，保证每轮都有审题框架
        topicAnalysis:
          state.topicAnalysis?.text ??
          buildTopicAnalysisFallback(
            state.topic,
            state.debaters.map(d => d.typeId)
          ),
        // v27：资料包（LLM 检索 / 本地兜底），引用时须标注来源
        research:
          state.research?.text ?? buildResearchFallback(state.topic),
        // v34：视频知识（收藏的科普视频提炼文字，人格学习后可引用）
        videoKnowledge: videoKnowledge ?? undefined,
        // v38：今日新闻（每日自动学习的时事热点，辩论时可引用）
        newsKnowledge: newsKnowledge ?? undefined,
        opponentLatest: opponentLatest
          ? {
              typeId: opponentLatest.typeId,
              typeName: opponentLatest.typeName,
              side: opponentLatest.side,
              content: opponentLatest.content,
            }
          : undefined,
        ownSpeechCount,
        recentHistory,
        // v31：注入人格当前状态 + 持久记忆，让辩手带着「此刻的感受」与「你们之间的过���」发言
        state: persona?.state,
        memory: persona?.memory,
      }) as unknown as LLMMessage[]

      const raw = await chatCompletion(messages, { temperature: 0.85, maxTokens: 700 })

      // v28：解析思考链 CoT——【思考】+【发言】分离存储
      const { thinking, content } = parseCoT(raw)

      return {
        typeId: debater.typeId,
        typeName: debater.typeName,
        side: debater.side,
        content,
        thinking: thinking || undefined,
        stage,
        round: state.round,
        source: 'llm',
      }
    } catch (err) {
      console.warn('[Arena] LLM 生成失败，回退模板引擎:', err)
    }
  }

  // 模板兜底
  const entries: DebateEntry[] = state.history.map(s => ({
    typeId: s.typeId,
    content: s.content,
    side: s.side,
  }))
  const result = generateDebateResponse(debater.typeId, state.topic, entries, {
    side: debater.side,
    sceneName: 'arena',
  })
  return {
    typeId: debater.typeId,
    typeName: debater.typeName,
    side: debater.side,
    content: result.content,
    stage,
    round: state.round,
    source: 'template',
  }
}

/**
 * 推进一轮：生成下一条发言并更新状态。
 * @returns 新状态 + 本次发言；若已结束返回 null 发言
 */
export async function runNextSpeech(
  state: ArenaState,
  persona?: { state?: PersonaState; memory?: PersonaMemory }
): Promise<{
  state: ArenaState
  speech: ArenaSpeech | null
}> {
  if (state.finished) return { state, speech: null }

  const speech = await generateArenaSpeech(state, persona)

  const nextState: ArenaState = {
    ...state,
    history: [...state.history, speech],
    activeIndex: (state.activeIndex + 1) % state.debaters.length,
  }

  // 一轮完成 → 推进 round
  if (nextState.activeIndex === 0) {
    nextState.round += 1
  }

  // 结束判定：round 达到 maxRounds 且所有人已发言
  nextState.finished =
    nextState.round >= state.maxRounds && nextState.activeIndex === 0

  return { state: nextState, speech }
}

/**
 * 跑完整场（测试/无 UI 场景）
 */
export async function runFullArena(
  state: ArenaState,
  onSpeech?: (speech: ArenaSpeech, index: number) => void
): Promise<ArenaState> {
  let cur = state
  let index = 0
  while (!cur.finished) {
    const { state: next, speech } = await runNextSpeech(cur)
    cur = next
    if (speech && onSpeech) onSpeech(speech, index)
    index += 1
    // 安全阀：防止异常循环
    if (index > 200) break
  }
  return cur
}

// ============ 裁判 ============

/** 整理全场发言文本，供裁判使用 */
export function buildTranscript(state: ArenaState): string {
  return state.history
    .map((s, i) => {
      const sideName = sideLabels[s.side]
      const stageName =
        s.stage === 'opening'
          ? '开场陈词'
          : s.stage === 'cross_exam'
            ? '交叉质询'
            : s.stage === 'free_debate'
              ? '自由辩论'
              : '总结陈词'
      return `【第${i + 1}轮｜${stageName}｜${s.typeName}（${sideName}）】
${s.content}
`
    })
    .join('\n')
}

/** 从 LLM 输出中提取 JSON（容忍 ```json 包裹） */
function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1]
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return text
}

/** 解析裁判 JSON 输出 */
function parseJudgeLLMOutput(
  text: string,
  validTypeIds: string[],
  /** typeId → 人格名 映射，用于宽容匹配 LLM 把 typeId 写成名字的情况 */
  typeNameMap: Record<string, string> = {}
): {
  scores: JudgeLLMEntry[]
  winner: string
  verdict: string
} {
  let data: any = null
  try {
    data = JSON.parse(extractJSON(text))
  } catch {
    throw new Error('裁判输出无法解析为 JSON')
  }

  const clamp = (n: unknown, dft = 70) => {
    const v = typeof n === 'number' ? n : Number(n)
    return Number.isFinite(v) ? Math.max(1, Math.min(100, Math.round(v))) : dft
  }
  const clamp10 = (n: unknown, dft = 5) => {
    const v = typeof n === 'number' ? n : Number(n)
    return Number.isFinite(v) ? Math.max(0, Math.min(10, Math.round(v))) : dft
  }

  // 宽容归一化：LLM 可能把 typeId 写成「竞选者」（人格名）而非「ENFP」（类型码）。
  // 按 typeId → 类型码；失败则用 name 反查人格名；再失败保留原样交给 filter 剔除。
  const normalizeTypeId = (s: any): string | null => {
    const raw = String(s?.typeId || '').trim()
    if (validTypeIds.includes(raw)) return raw
    for (const [tid, tname] of Object.entries(typeNameMap)) {
      if (raw === tname) return tid
      if (String(s?.name || '').trim() === tname) return tid
    }
    return raw || null
  }

  const scores: JudgeLLMEntry[] = (data?.scores || []).map((s: any) => {
    const typeId = normalizeTypeId(s)
    return {
      typeId: typeId || '',
      name: s.name || s.typeId || '',
      logic: clamp(s.logic),
      evidence: clamp(s.evidence),
      clarity: clamp(s.clarity),
      rebuttal: clamp(s.rebuttal),
      demeanor: clamp(s.demeanor),
      engagement: clamp10(s.engagement),
      depth: clamp10(s.depth),
      kill: clamp10(s.kill),
      total: clamp(s.total, Math.round((clamp(s.logic) + clamp(s.evidence) + clamp(s.clarity) + clamp(s.rebuttal) + clamp(s.demeanor)) / 5)),
      comment: s.comment || '',
      clicheNotes: s.clicheNotes || '',
    }
  }).filter((s: JudgeLLMEntry): s is JudgeLLMEntry => validTypeIds.includes(s.typeId))

  // v26.1 自洽性校验：LLM 常把"正方/反方"的分数与 typeId 交叉错位。
  // 以"可复算的 total 最高者"为准，拒绝与最高分矛盾的 winner，避免裁判自打脸。
  let winner = data?.winner || ''
  const top = scores.length > 0 ? [...scores].sort((a, b) => b.total - a.total)[0] : null
  if (top) {
    const winnerEntry = scores.find(s => s.typeId === winner)
    if (!winnerEntry || winnerEntry.total < top.total) {
      winner = top.typeId
    }
  }

  return {
    scores,
    winner,
    verdict: data?.verdict || '',
  }
}

/**
 * 整场裁决：LLM 裁判优先，本地正则裁判兜底
 */
export async function judgeArena(state: ArenaState): Promise<ArenaJudgeResult> {
  if (state.history.length === 0) {
    return { scores: [], winner: '', verdict: '场上没有发言，无法裁决。', source: 'template' }
  }

  const validTypeIds = state.debaters.map(d => d.typeId)

  // 尝试 LLM 裁判
  if (isLLMConfigured()) {
    try {
      const transcript = buildTranscript(state)
      const userMsg = `以下是本场辩论的完整记录。请以裁判身份按你的评分维度给出分数，严格输出 JSON。\n\n辩题：${state.topic}\n\n${transcript}`
      const raw = await chatCompletion(
        [
          { role: 'system', content: JUDGE_SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
        { temperature: 0.2, maxTokens: 2000 }
      )
      const typeNameMap: Record<string, string> = {}
      for (const d of state.debaters) typeNameMap[d.typeId] = d.typeName
      const parsed = parseJudgeLLMOutput(raw, validTypeIds, typeNameMap)
      if (parsed.scores.length === 0) {
        // 诊断：LLM 返回了内容但解析不出有效评分，输出原文帮助排查
        console.warn('[Arena] LLM 裁判返回但无有效评分，原始输出:\n' + raw.slice(0, 400))
      }
      if (parsed.scores.length > 0) {
        return {
          scores: parsed.scores.map(s => {
            const debater = state.debaters.find(d => d.typeId === s.typeId)
            return {
              typeId: s.typeId,
              // LLM 若拿 typeId 充名字，回退到人格名（如 INTJ → 建筑师）
              name: s.name && s.name !== s.typeId ? s.name : debater?.typeName || s.typeId,
              emoji: debater?.emoji || '🤖',
              color: debater?.color || '#888',
              logic: s.logic,
              evidence: s.evidence,
              rebuttal: s.rebuttal,
              clarity: s.clarity,
              demeanor: s.demeanor,
              engagement: s.engagement,
              depth: s.depth,
              kill: s.kill,
              total: s.total,
              comment: s.clicheNotes ? `${s.comment}（套话检测：${s.clicheNotes}）` : s.comment,
            }
          }),
          winner: parsed.winner,
          verdict: parsed.verdict,
          source: 'llm',
        }
      }
    } catch (err) {
      console.warn('[Arena] LLM 裁判失败，回退本地裁判:', err)
    }
  }

  // 本地裁判兜底
  const entries = state.history.map(s => {
    const debater = state.debaters.find(d => d.typeId === s.typeId)
    return {
      typeId: s.typeId,
      typeName: s.typeName,
      typeEmoji: debater?.emoji || '🤖',
      typeColor: debater?.color || '#888',
      content: s.content,
    }
  })
  const scores = judgeDebate(entries)
  const winner = scores[0]?.typeId || ''
  return {
    scores,
    winner,
    verdict: winner
      ? `本地裁判裁决：${scores.find(s => s.typeId === winner)?.name || winner} 以 ${scores[0].total} 分胜出。配置 LLM API Key 可启用 AI 裁判（含套话检测）。`
      : '裁判暂无法给出裁决。',
    source: 'template',
  }
}
