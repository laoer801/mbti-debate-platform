/**
 * v30 实测脚本：输入识别与处理闭环（先识别，再回应）
 *
 * v30 验证重点：
 *   1. INPUT_ANALYSIS_RULES 注入人格系统提示词（意图识别 A-E / 论题提取 / 上下文关联 / 关键禁止 / 铁律）
 *   2. COT_FORMAT_RULE 思考链前置输入识别维度（意图类型/核心论题/回应的对象/情绪状态）
 *   3. parseDialogueUnderstanding 结构化解析（意图/论题/情绪/回应的对象）
 *   4. parseDialogueResponse 返回 meta 结构化字段
 *   5. 对话模式提示词【理解】含意图类型维度
 *   6. v28 回归：CoT 解析 / 对话模式 / 提示词注入均保持可用
 *
 * 用法：
 *   npm run test:arena:v30
 *   或手动：
 *   node scripts/test-arena-v30.bundle.cjs
 */

// ── node 环境 mock localStorage（llmClient 依赖，纯内存实现）──
;(globalThis as any).localStorage = (() => {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  }
})()

import { parseCoT } from '../src/utils/debateArena'
import {
  buildPersonaSystemPrompt,
  buildSpeechMessages,
  COT_FORMAT_RULE,
  INPUT_ANALYSIS_RULES,
} from '../src/utils/debatePrompts'
import {
  buildDialogueSystemPrompt,
  buildDialogueMessages,
  buildDialogueFallback,
  parseDialogueResponse,
  parseDialogueUnderstanding,
  INTENT_LABELS,
  type DialogueContext,
} from '../src/data/dialogueMode'

const TOPIC = 'AI应该拥有权利吗'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    pass++
    console.log(`  ✅ ${label}`)
  } else {
    fail++
    console.log(`  ❌ ${label}${detail ? ` —— ${detail}` : ''}`)
  }
}

console.log('='.repeat(62))
console.log('v30 纯函数测试：输入识别与处理闭环')
console.log('='.repeat(62))

// ── 1. 人格系统提示词注入 INPUT_ANALYSIS_RULES ──
console.log('\n🎯 1.1 人格系统提示词注入「输入识别与处理规则」')
const prompt = buildPersonaSystemPrompt('INTJ', TOPIC, 'pro')
check('含意图识别规则', prompt.includes('输入识别与处理规则'), prompt.length.toString())
check('含第一层意图识别 A-E', prompt.includes('A. 发起新话题') && prompt.includes('E. 寻求建议'))
check('含第二层论题提取', prompt.includes('第二层：论题提取') && prompt.includes('核心概念'))
check('含第三层上下文关联', prompt.includes('第三层：上下文关联'))
check('含第四层回复生成（辩论四步）', prompt.includes('标明立场') && prompt.includes('引用对方观点'))
check('含关键禁止', prompt.includes('关键禁止') && prompt.includes('禁止偏离已识别的'))
check('含结尾铁律「真的听懂了」', prompt.includes('你真的听懂了他说的话'))

// ── 2. CoT 思考链前置输入识别维度 ──
console.log('\n🧠 1.2 COT_FORMAT_RULE 思考链含输入识别维度')
check('【思考】含意图类型', COT_FORMAT_RULE.includes('对方意图类型'))
check('【思考】含核心论题', COT_FORMAT_RULE.includes('核心论题'))
check('【思考】含回应的对象', COT_FORMAT_RULE.includes('对方在回应我的哪一句'))
check('【思考】含情绪状态', COT_FORMAT_RULE.includes('对方情绪状态'))
check('仍保留【发言】', COT_FORMAT_RULE.includes('【发言】'))
// 通过 buildSpeechMessages 注入验证
const speechMsgs = buildSpeechMessages({
  typeId: 'INTJ',
  typeName: '建筑师',
  side: 'pro',
  topic: TOPIC,
  stage: 'opening',
  ownSpeechCount: 0,
  recentHistory: [],
} as any)
const userMsg = speechMsgs.find(m => m.role === 'user')
check('buildSpeechMessages user 消息含新 CoT', (userMsg?.content ?? '').includes('对方意图类型'))

// ── 3. parseDialogueUnderstanding 结构化解析 ──
console.log('\n🔍 1.3 parseDialogueUnderstanding 结构化解析')
const sampleUnderstanding = `意图类型：A（发起新话题）
核心论题：AI是否应该拥有权利
回应的对象：无，开启新话题
情绪状态：中性，好奇
潜在诉求：想听听不同立场的观点
言外之意：可能希望得到开放式的思考引导`
const meta = parseDialogueUnderstanding(sampleUnderstanding)
check('意图类型 = A', meta.intent === 'A', `实际: ${meta.intent}`)
check('核心论题提取', meta.topic === 'AI是否应该拥有权利', `实际: ${meta.topic}`)
check('情绪状态提取', meta.emotion === '中性，好奇', `实际: ${meta.emotion}`)
check('回应的对象提取', meta.respondingTo === '无，开启新话题', `实际: ${meta.respondingTo}`)

// 变体格式：中括号 + 类
const meta2 = parseDialogueUnderstanding('意图类型：[D] 表达情绪或倾诉\n核心论题：工作倦怠\n情绪状态：疲惫、沮丧')
check('变体 [D] 解析', meta2.intent === 'D', `实际: ${meta2.intent}`)
check('变体论题/情绪', meta2.topic === '工作倦怠' && meta2.emotion === '疲惫、沮丧')

// 无匹配兜底
const meta3 = parseDialogueUnderstanding('完全没有任何结构化标签的文本')
check('无标签兜底返回空对象', meta3.intent === undefined && meta3.topic === undefined && meta3.emotion === undefined)

// ── 4. parseDialogueResponse 返回 meta ──
console.log('\n📦 1.4 parseDialogueResponse 结构化返回')
const rawSample = `【理解】${sampleUnderstanding}
【回应】我觉得这是一个值得深入的问题。你怎么看待？`
const parsed = parseDialogueResponse(rawSample)
check('理解部分提取', parsed.understanding.includes('意图类型'))
check('回应部分提取', parsed.response.includes('值得深入'))
check('meta 随响应返回', parsed.meta.intent === 'A' && parsed.meta.topic?.includes('AI'))

// 无标签兜底
const parsedNoTag = parseDialogueResponse('直接回应没有标签')
check('无标签全部作为回应', parsedNoTag.response === '直接回应没有标签' && parsedNoTag.understanding === '')

// ── 5. 对话模式提示词含意图类型维度 ──
console.log('\n💬 1.5 对话模式提示词【理解】含意图分类')
const dialoguePrompt = buildDialogueSystemPrompt('INTJ')
check('【理解】含意图类型', dialoguePrompt.includes('意图类型'))
check('【理解】含核心论题', dialoguePrompt.includes('核心论题'))
check('【理解】含回应的对象', dialoguePrompt.includes('回应的对象'))
check('输入识别补充规则（D类优先情绪）', dialoguePrompt.includes('倾诉') && dialoguePrompt.includes('优先回应情绪'))
check('输入识别补充规则（E类先确认）', dialoguePrompt.includes('你是需要建议，还是希望我倾听'))

// ── 6. v28 回归 ──
console.log('\n🔁 1.6 v28 回归测试')
const sampleCoT = `【思考】对方提到AI没有意识所以不该有权利，但这个论证有问题。\n【发言】首先，对方认为AI没有意识所以不该有权利，但权利体系的核心不是意识而是利益保护。`
const cot = parseCoT(sampleCoT)
check('parseCoT 思考/发言分离', cot.thinking.includes('论证有问题') && cot.content.includes('利益保护'))
const noCoT = parseCoT('纯发言无标记')
check('parseCoT 无标记兜底', noCoT.content === '纯发言无标记' && noCoT.thinking === '')
const ctx: DialogueContext = {
  typeId: 'INTJ',
  typeName: '建筑师',
  history: [{ role: 'user', content: '最近感觉很迷茫' }],
  userMessage: '你觉得人生的意义是找到的还是创造的？',
}
const messages = buildDialogueMessages(ctx)
check('buildDialogueMessages system 正常', messages[0]?.role === 'system' && messages.some(m => m.role === 'user'))
const fallback = buildDialogueFallback('INTJ', '建筑师', '我感到很焦虑')
check('本地兜底非空', fallback.length > 20)
check('INTENT_LABELS 五类齐全', Object.keys(INTENT_LABELS).length === 5 && INTENT_LABELS['C']?.includes('转移话题'))

// ── 汇总 ──
console.log('\n' + '='.repeat(62))
console.log(`v30 测试结果：${pass} 通过 / ${fail} 失败`)
console.log('='.repeat(62))
if (fail > 0) process.exit(1)
