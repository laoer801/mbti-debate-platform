/**
 * v33 专业建议·困境拆解（pathAdviceRules.ts）
 *
 * 对标 Cognix Problem Mode / llm-parliament：当用户在 1v1 对话中表达困境、选择、
 * 决策类问题（如"要不要换工作""选 A 还是选 B"）时，LLM 除常规共情回应外，
 * 在回答末尾追加结构化的「路径建议」块——三条真正不同的行动路径 + 共同风险 + 下一步。
 *
 * 设计原则（与 Dialectic/llm-parliament 对齐）：
 * - 不给唯一"正确答案"，呈现选择空间让用户自己决断
 * - 三条路径要真正不同（不是同一条的变体）
 * - 路径要结合知识库资料 [n] 和用户当前处境
 * - 非困境类问题（纯知识问答/闲聊/纯倾诉）不输出此块
 *
 * 依赖方向：pathAdviceRules → types（type-only），不反向引用 dialogueMode，无循环依赖
 */

import type { PathAdvice, PathOption } from '../types'

// ============ 一、困境拆解提示词（注入对话系统提示词） ============

export const PROBLEM_SOLVING_RULES = `## 困境/决策类问题处理（v33）

当【理解】层判断用户的意图为**困境、选择或决策类**问题（典型信号：要不要…、选 A 还是 B、我该怎么决定、面对 X 怎么办）时，除常规共情回应外，**在回答最末尾追加**一个结构化路径建议块。

### 追加格式（严格按此结构，仅在困境类问题时输出）

【路径建议】
路径A：{简短名称（4-8字）}
- 适合：{适合什么样的处境或性格，1句}
- 利：{主要好处，1句}
- 弊：{主要代价，1句}
路径B：{简短名称}
- 适合：...
- 利：...
- 弊：...
路径C：{简短名称}
- 适合：...
- 利：...
- 弊：...
风险提示：{三条路径共同的、或都需要警惕的风险，1-2句}
建议下一步：{一个可以立即执行的小动作，帮用户从"想"过渡到"动"，1句}

### 规则
- **三条路径必须真正不同**——不是同一条路的微调变体，而是不同的取舍方向（如：稳妥过渡 / 激进转身 / 暂缓观察）
- 路径要结合知识库资料（有命中时用 [n] 标注支撑）和用户当前处境
- **不要给唯一"正确答案"**——你的职责是呈现选择空间，把判断权交还给用户
- 路径名称要具体、有画面感，不要"方案一/方案二"这种空洞命名
- **非困境类问题绝不输出此块**：纯知识问答、闲聊、纯情绪倾诉、观点讨论都不触发
- 若用户只是想倾诉（D类），即使涉及困境也先共情，可轻声问"你想听听几种可能的走法吗？"，得到确认后再给路径`

// ============ 二、路径建议解析 ============

/**
 * 从 LLM 原始输出中解析【路径建议】块为结构化 PathAdvice。
 *
 * 解析策略：
 * 1. 定位 `【路径建议】` 到下一个【标签】或文本末尾的区间
 * 2. 用正则匹配「路径X：名称」+「- 适合/利/弊」三行（容错：字段顺序/缺失）
 * 3. 匹配「风险提示：」「建议下一步：」
 *
 * 解析失败（找不到块或路径数 < 2）返回 null——视为非困境类问题，不渲染卡片。
 *
 * @param raw LLM 完整输出（通常为 parseDialogueResponse 的 response 部分）
 */
export function parsePathAdvice(raw: string): PathAdvice | null {
  // 定位【路径建议】块：到下一个【...】标签或字符串末尾
  const blockMatch = raw.match(/【路径建议】([\s\S]*?)(?=【[^】]+】|$)/)
  if (!blockMatch) return null
  const block = blockMatch[1]

  // 解析路径条目：路径X：名称 \n - 适合：... \n - 利：... \n - 弊：...
  // 容错：字段可能顺序不同、可能缺失；用独立正则逐条捕获
  const paths: PathOption[] = []
  // 先按「路径X：」切分块，再在每个片段内提取字段，更稳健
  const segments = block.split(/(?=路径[A-C]\s*[：:])/)
  for (const seg of segments) {
    const headMatch = seg.match(/路径([A-C])\s*[：:]\s*([^\n]+)/)
    if (!headMatch) continue
    const name = headMatch[2].trim()
    if (!name) continue
    const fitFor = extractField(seg, '适合')
    const pros = extractField(seg, '利')
    const cons = extractField(seg, '弊')
    // 至少要有名称和一个字段才算有效路径
    if (!fitFor && !pros && !cons) continue
    paths.push({ name, fitFor: fitFor || '—', pros: pros || '—', cons: cons || '—' })
  }

  // 风险提示
  const risksMatch = block.match(/风险提示\s*[：:]\s*([^\n]+)/)
  const risks = risksMatch ? risksMatch[1].trim() : ''

  // 建议下一步
  const nextMatch = block.match(/建议下一步\s*[：:]\s*([^\n]+)/)
  const nextStep = nextMatch ? nextMatch[1].trim() : ''

  // 至少 2 条路径才算有效的困境拆解（LLM 偶尔只给 2 条也接受）
  if (paths.length < 2) return null

  return { paths, risks, nextStep }
}

/** 从一段文本中提取「- 字段名：值」的值部分（容错顺序与缺失） */
function extractField(text: string, fieldName: string): string {
  const re = new RegExp(`-\\s*${fieldName}\\s*[：:]\\s*([^\\n]+)`)
  const m = text.match(re)
  return m ? m[1].trim() : ''
}

/**
 * 从 LLM 回应中分离「纯对话回应」与「路径建议」。
 *
 * - 把【路径建议】块从回应文本里剥离，正文保留给对话气泡
 * - 路径块解析为 PathAdvice（解析失败则 advice 为 null，response 原样返回）
 *
 * @param raw parseDialogueResponse 返回的 response 部分（可能含【路径建议】块）
 * @returns { response: 纯对话回应, advice: 路径建议或 null }
 */
export function extractAdviceFromResponse(raw: string): {
  response: string
  advice: PathAdvice | null
} {
  const advice = parsePathAdvice(raw)
  if (!advice) {
    return { response: raw.trim(), advice: null }
  }
  // 剥离【路径建议】块（含其前导换行/空白），保留正文
  const cleaned = raw.replace(/【路径建议】[\s\S]*?(?=【[^】]+】|$)/, '').trim()
  return { response: cleaned, advice }
}
