/**
 * v33 辩论报告生成器（debateReport.ts）
 *
 * 对标 Dialectic / debate-bot / llm-parliament：辩论结束后一键生成结构化 Markdown 报告，
 * 包含双方核心论点（带 [n] 引用）、交锋焦点、共识与分歧、折中方案、裁判判定与置信度。
 *
 * 双路生成：
 * - LLM 优先：把整场发言 + 裁判结果喂给 LLM，要求严格 Markdown 结构输出
 * - 本地兜底：LLM 未配置/失败时，用模板从 speeches + judge 拼一份基础报告
 *
 * 依赖方向：debateReport → llmClient（运行时）+ types + debateArena（type-only），无循环依赖
 */

import { chatCompletion, isLLMConfigured, type LLMMessage } from './llmClient'
import type { JudgeScore, Message } from '../types'
import type { ArenaSpeech, ArenaJudgeResult, ArenaStance } from './debateArena'

// ============ 一、统一报告输入类型 ============

/** 统一的发言记录（arena 与模板模式共用） */
export interface ReportSpeech {
  typeId: string
  typeName: string
  side: 'pro' | 'con'
  content: string
  thinking?: string
}

/** 统一的裁判结果 */
export interface ReportJudge {
  scores: JudgeScore[]
  winner: string
  verdict: string
  source: 'llm' | 'template'
}

/** 报告生成输入——调用方负责把 arena/模板数据转换为此结构 */
export interface ReportInput {
  topic: string
  speeches: ReportSpeech[]
  judge?: ReportJudge
  /** 赛前立场宣言 */
  stances?: ReportSpeech[]
  /** 审题报告文本 */
  analysis?: string
  /** 资料包文本 */
  research?: string
}

// ============ 二、数据转换辅助（供 DebateRoom 调用） ============

/** 从 arena 的 ArenaSpeech[] 转换 */
export function toReportSpeechesFromArena(history: ArenaSpeech[]): ReportSpeech[] {
  return history.map(s => ({
    typeId: s.typeId,
    typeName: s.typeName,
    side: s.side,
    content: s.content,
    thinking: s.thinking,
  }))
}

/** 从 arena 的 ArenaJudgeResult 转换 */
export function toReportJudgeFromArena(judge: ArenaJudgeResult): ReportJudge {
  return {
    scores: judge.scores,
    winner: judge.winner,
    verdict: judge.verdict,
    source: judge.source,
  }
}

/** 从模板模式的 Message[] 转换（只取有人格 side 的发言） */
export function toReportSpeechesFromMessages(messages: Message[]): ReportSpeech[] {
  return messages
    .filter(m => !m.isUser && m.side && m.content)
    .map(m => ({
      typeId: m.typeId,
      typeName: m.typeName,
      side: m.side as 'pro' | 'con',
      content: m.content,
      thinking: m.thinking,
    }))
}

/** 从 ArenaStance[] 转换为立场宣言报告片段 */
export function toReportStances(stances: ArenaStance[] | undefined): ReportSpeech[] | undefined {
  if (!stances || stances.length === 0) return undefined
  return stances.map(s => ({
    typeId: s.typeId,
    typeName: s.typeName,
    side: s.side,
    content: s.content,
  }))
}

// ============ 三、LLM 报告生成 ============

/**
 * 构建 LLM 报告生成提示词。
 * 把发言记录、裁判结果、立场、审题、资料全部喂给 LLM，要求严格 Markdown 结构。
 */
function buildReportPrompt(input: ReportInput): LLMMessage[] {
  const { topic, speeches, judge, stances, analysis, research } = input

  const proSpeeches = speeches.filter(s => s.side === 'pro')
  const conSpeeches = speeches.filter(s => s.side === 'con')

  const formatSpeeches = (arr: ReportSpeech[]) =>
    arr.map((s, i) => `[${i + 1}] ${s.typeName}（${s.side === 'pro' ? '正方' : '反方'}）：${s.content}`).join('\n')

  const judgeText = judge
    ? `裁判来源：${judge.source === 'llm' ? 'AI 裁判' : '本地裁判'}\n胜方：${judge.winner}\n判定：${judge.verdict}\n各维度评分：\n${judge.scores.map(s => `- ${s.name}：逻辑${s.logic} 论据${s.evidence} 反驳${s.rebuttal} 表达${s.clarity} 风度${s.demeanor} 总分${s.total}（${s.comment}）`).join('\n')}`
    : '（无裁判结果）'

  const stanceText = stances && stances.length > 0
    ? `立场宣言：\n${stances.map(s => `- ${s.typeName}（${s.side === 'pro' ? '正方' : '反方'}）：${s.content}`).join('\n')}`
    : ''

  const analysisText = analysis ? `审题报告：${analysis}` : ''
  const researchText = research ? `资料包：${research}` : ''

  const system = `你是专业辩论报告撰写者。请根据提供的辩论记录生成一份结构化、客观中立的 Markdown 辩论报告。

要求：
1. 严格按给定的小节结构输出，不要增减小节
2. 引用具体发言时用 [n] 标注来源编号（对应正方/反方发言序号）
3. 客观陈述双方观点，不偏袒
4. 不编造记录中未提及的内容
5. 「交锋焦点」要挑出双方分歧最大的 2-3 点；「共识」是双方都认同的部分；「折中方案」是融合双方立场的可落地中间立场
6. 「置信度评估」说明本报告结论的可靠程度（如发言轮数、论据充分度、裁判一致性的影响）`

  const user = `辩题：${topic}

${analysisText}

${researchText}

${stanceText}

正方发言：
${formatSpeeches(proSpeeches) || '（无）'}

反方发言：
${formatSpeeches(conSpeeches) || '（无）'}

${judgeText}

请按以下结构输出 Markdown 报告（保留所有小节标题）：

# 辩论报告：${topic}

## 辩论概览
（辩题、双方立场概述、发言轮数、裁判来源）

## 正方核心论点
- 论点1（[n]）
- 论点2（[n]）
（提炼正方 3-5 个核心论点，每条标注引用来源）

## 反方核心论点
- 论点1（[n]）
- 论点2（[n]）

## 交锋焦点
### 焦点一：{标题}
（双方在此点的分歧，各引用 [n]）
### 焦点二：{标题}
（…）

## 共识
- 双方都认同的点是…

## 分歧
- 双方无法调和的分歧是…

## 折中方案
（融合双方立场、可落地的中间立场，2-3 句）

## 裁判判定
### 各维度评分
（列出每位辩手的总分与关键维度）
### 胜方理由
（裁判为什么判这一方胜出）

## 置信度评估
（本报告结论的可靠程度：发言轮数、论据充分度、裁判一致性等影响因素）`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/**
 * 生成辩论报告（LLM 优先，失败回退本地模板）。
 * @returns Markdown 字符串
 */
export async function generateDebateReport(input: ReportInput): Promise<{ markdown: string; source: 'llm' | 'template' }> {
  if (isLLMConfigured()) {
    try {
      const messages = buildReportPrompt(input)
      const raw = await chatCompletion(messages, { temperature: 0.6, maxTokens: 1200 })
      const trimmed = raw.trim()
      // LLM 输出应包含「辩论报告」标题；过短视为失败回退
      if (trimmed.length > 100 && /辩论报告|辩论概览|核心论点/.test(trimmed)) {
        return { markdown: trimmed, source: 'llm' }
      }
      console.warn('[Report] LLM 输出过短或格式异常，回退本地模板')
    } catch (err) {
      console.warn('[Report] LLM 生成失败，回退本地模板:', err)
    }
  }
  return { markdown: fallbackReport(input), source: 'template' }
}

// ============ 四、本地兜底报告（模板） ============

/**
 * LLM 不可用时的本地模板报告：从 speeches + judge 机械拼接，保证有内容可看。
 */
export function fallbackReport(input: ReportInput): string {
  const { topic, speeches, judge, stances } = input
  const pro = speeches.filter(s => s.side === 'pro')
  const con = speeches.filter(s => s.side === 'con')

  const lines: string[] = []
  lines.push(`# 辩论报告：${topic}`)
  lines.push('')
  lines.push('## 辩论概览')
  lines.push(`- 辩题：${topic}`)
  lines.push(`- 正方发言：${pro.length} 次`)
  lines.push(`- 反方发言：${con.length} 次`)
  lines.push(`- 裁判来源：${judge?.source === 'llm' ? 'AI 裁判' : '本地裁判'}`)
  lines.push('')

  if (stances && stances.length > 0) {
    lines.push('## 立场宣言')
    for (const s of stances) {
      lines.push(`- **${s.typeName}**（${s.side === 'pro' ? '正方' : '反方'}）：${s.content}`)
    }
    lines.push('')
  }

  lines.push('## 正方核心论点')
  pro.forEach((s, i) => {
    lines.push(`- [${i + 1}] ${s.content.slice(0, 80)}${s.content.length > 80 ? '…' : ''}`)
  })
  lines.push('')

  lines.push('## 反方核心论点')
  con.forEach((s, i) => {
    lines.push(`- [${i + 1}] ${s.content.slice(0, 80)}${s.content.length > 80 ? '…' : ''}`)
  })
  lines.push('')

  lines.push('## 交锋焦点')
  lines.push('> 本地模板无法自动提炼交锋焦点，请配置 AI 大模型以获得深度分析。')
  lines.push('')

  lines.push('## 共识')
  lines.push('> 本地模板无法自动提炼共识，请配置 AI 大模型。')
  lines.push('')

  lines.push('## 分歧')
  lines.push('> 本地模板无法自动提炼分歧，请配置 AI 大模型。')
  lines.push('')

  lines.push('## 折中方案')
  lines.push('> 本地模板无法自动生成折中方案，请配置 AI 大模型。')
  lines.push('')

  lines.push('## 裁判判定')
  if (judge) {
    lines.push('### 各维度评分')
    for (const s of judge.scores) {
      lines.push(`- **${s.name}**（${s.typeId}）：逻辑 ${s.logic} · 论据 ${s.evidence} · 反驳 ${s.rebuttal} · 表达 ${s.clarity} · 风度 ${s.demeanor} · 总分 ${s.total}`)
      lines.push(`  - ${s.comment}`)
    }
    lines.push('')
    lines.push('### 胜方理由')
    lines.push(`- 胜方：${judge.winner}`)
    lines.push(`- 判定：${judge.verdict}`)
  } else {
    lines.push('（本场无裁判结果）')
  }
  lines.push('')

  lines.push('## 置信度评估')
  lines.push(`- 发言轮数：正方 ${pro.length} 次 / 反方 ${con.length} 次`)
  lines.push(`- 报告来源：本地模板（未连接 AI，分析深度有限）`)
  lines.push('- 建议：配置 AI 大模型后重新生成，可获得交锋焦点、共识分歧、折中方案的深度分析')

  return lines.join('\n')
}

// ============ 五、导出工具 ============

/** 触发浏览器下载 Markdown 文件 */
export function downloadMarkdown(md: string, filename: string): void {
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 复制文本到剪贴板（带降级） */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 降级到 execCommand
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
