/**
 * v33 实测脚本：辩论报告生成器 + 专业建议·困境拆解
 *
 * v33 验证重点（纯函数，不依赖 LLM 网络）：
 *   1. parsePathAdvice：完整 3 路径 / 2 路径 / 无块 / 缺字段 → 解析正确性
 *   2. extractAdviceFromResponse：有块剥离正文 / 无块原样返回
 *   3. fallbackReport：模板报告含核心结构（标题/正方论点/反方论点/裁判判定/置信度）
 *   4. renderMarkdownLite：标题/列表/粗体/引用/[n] 引用编号 HTML 标签生成
 *   5. toReportSpeechesFromMessages：过滤 isUser 消息 + 只保留有 side 的发言
 *   6. toReportSpeechesFromArena / toReportJudgeFromArena：arena 数据转换正确性
 *   7. toReportStances：立场宣言转换 + 空数组返回 undefined
 *
 * 用法：
 *   npm run test:report:v33
 *   或手动：
 *   esbuild scripts/test-report-v33.ts --bundle --platform=node --format=cjs --outfile=scripts/test-report-v33.bundle.cjs && node scripts/test-report-v33.bundle.cjs
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

import { parsePathAdvice, extractAdviceFromResponse } from '../src/data/pathAdviceRules'
import {
  fallbackReport,
  toReportSpeechesFromArena,
  toReportJudgeFromArena,
  toReportSpeechesFromMessages,
  toReportStances,
  type ReportInput,
  type ReportSpeech,
  type ReportJudge,
} from '../src/utils/debateReport'
import { renderMarkdownLite } from '../src/utils/markdownLite'
import type { Message, JudgeScore } from '../src/types'
import type { ArenaSpeech, ArenaJudgeResult, ArenaStance } from '../src/utils/debateArena'

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
console.log('v33 纯函数测试：辩论报告 + 专业建议')
console.log('='.repeat(62))

// ============ 1. parsePathAdvice ============
console.log('\n🧭 1. parsePathAdvice 路径建议解析')

// 1.1 完整 3 路径
const fullBlock = `我理解你的纠结。换工作确实是人生大事。

【路径建议】
路径A：稳妥过渡
- 适合：手头紧、不能断收入的人
- 利：风险最小，骑驴找马
- 弊：可能错过当下的机会窗口
路径B：激进转身
- 适合：有积蓄、对新方向很确定的人
- 利：全力投入新赛道，成长更快
- 弊：若判断失误，回不了头
路径C：暂缓观察
- 适合：还没想清楚、信息不足的人
- 利：不急于行动，收集更多数据
- 弊：拖延本身就是一种选择，焦虑会累积
风险提示：三条路都有机会成本，关键是分清"害怕改变"和"确实不该改"。
建议下一步：今晚花 15 分钟写下你最在意的三件事，先厘清价值观再决定。`

const advice3 = parsePathAdvice(fullBlock)
check('完整 3 路径 → 解析成功', advice3 !== null)
check('3 路径数量正确', advice3?.paths.length === 3, `实际 ${advice3?.paths.length}`)
check('路径A 名称正确', advice3?.paths[0].name === '稳妥过渡', `实际 "${advice3?.paths[0].name}"`)
check('路径A 适合字段', advice3?.paths[0].fitFor.includes('手头紧') === true)
check('路径A 利字段', advice3?.paths[0].pros.includes('风险最小') === true)
check('路径A 弊字段', advice3?.paths[0].cons.includes('错过') === true)
check('路径B 名称正确', advice3?.paths[1].name === '激进转身')
check('路径C 名称正确', advice3?.paths[2].name === '暂缓观察')
check('风险提示提取', advice3?.risks.includes('机会成本') === true)
check('建议下一步提取', advice3?.nextStep.includes('15 分钟') === true)

// 1.2 仅 2 路径（LLM 偶尔只给 2 条，也接受）
const twoPathBlock = `【路径建议】
路径A：直接沟通
- 适合：性格直率的人
- 利：消除误解
- 弊：可能引发冲突
路径B：侧面试探
- 适合：不想撕破脸的人
- 利：保持体面
- 弊：对方可能装傻
风险提示：不管选哪条，做好最坏打算。
建议下一步：先想清楚你想要什么结果。`

const advice2 = parsePathAdvice(twoPathBlock)
check('仅 2 路径 → 仍解析成功', advice2 !== null)
check('2 路径数量正确', advice2?.paths.length === 2)

// 1.3 无【路径建议】块
const noBlock = '今天天气不错，适合出去走走。'
const adviceNone = parsePathAdvice(noBlock)
check('无路径块 → 返回 null', adviceNone === null)

// 1.4 只有 1 条路径（不满足最低 2 条要求）
const onePathBlock = `【路径建议】
路径A：唯一方案
- 适合：所有人
- 利：简单
- 弊：没有选择`
const advice1 = parsePathAdvice(onePathBlock)
check('仅 1 路径 → 返回 null（不满足最低 2 条）', advice1 === null)

// 1.5 缺字段（路径只有名称，无适合/利/弊）
const missingFieldsBlock = `【路径建议】
路径A：方案一
路径B：方案二
风险提示：注意风险。`
const adviceMissing = parsePathAdvice(missingFieldsBlock)
check('缺字段（无适合/利/弊）→ 返回 null', adviceMissing === null, '至少需名称+一个字段')

// 1.6 路径块后有其他【标签】时正确截断
const blockWithTrailing = `正文回应。

【路径建议】
路径A：快刀斩乱麻
- 适合：果断型
- 利：速战速决
- 弊：可能后悔
路径B：温水煮青蛙
- 适合：慢性子
- 利：渐进适应
- 弊：温水变滚水
风险提示：别把自己煮了。
建议下一步：设个 deadline。
【其他标签】
不应被包含的内容`
const adviceTrailing = parsePathAdvice(blockWithTrailing)
check('路径块后有【其他标签】→ 正确截断', adviceTrailing !== null)
check('截断后路径数 2', adviceTrailing?.paths.length === 2)
check('截断后不含「不应被包含」', adviceTrailing?.risks.includes('别把自己煮了') === true)


// ============ 2. extractAdviceFromResponse ============
console.log('\n✂️  2. extractAdviceFromResponse 回应分离')

// 2.1 有路径块 → 剥离
const { response: cleanResp, advice: extractedAdvice } = extractAdviceFromResponse(fullBlock)
check('有块 → 正文剥离路径块', cleanResp.includes('【路径建议】') === false, '正文不应含【路径建议】')
check('有块 → 正文保留前半段', cleanResp.includes('我理解你的纠结') === true)
check('有块 → advice 非空', extractedAdvice !== null)
check('有块 → advice 路径数 3', extractedAdvice?.paths.length === 3)

// 2.2 无路径块 → 原样返回
const plainResponse = '今天天气不错，出去走走吧。'
const { response: sameResp, advice: nullAdvice } = extractAdviceFromResponse(plainResponse)
check('无块 → response 原样返回', sameResp === plainResponse)
check('无块 → advice 为 null', nullAdvice === null)

// 2.3 空字符串
const { response: emptyResp, advice: emptyAdvice } = extractAdviceFromResponse('')
check('空字符串 → response 为空', emptyResp === '')
check('空字符串 → advice 为 null', emptyAdvice === null)


// ============ 3. fallbackReport ============
console.log('\n📄 3. fallbackReport 本地模板报告')

const mockSpeeches: ReportSpeech[] = [
  { typeId: 'INTJ', typeName: 'INTJ 建筑师', side: 'pro', content: 'AI 拥有权利是文明进步的必然，正如历史上权利范围的不断扩大。', thinking: '从历史趋势切入' },
  { typeId: 'ENFP', typeName: 'ENFP 竞选者', side: 'con', content: 'AI 没有自我意识，赋予权利是对真正权利主体的稀释。', thinking: '从意识本质反驳' },
  { typeId: 'INTJ', typeName: 'INTJ 建筑师', side: 'pro', content: '权利不依赖意识，婴儿也没有完全的自我意识但我们仍赋予权利。' },
  { typeId: 'ENFP', typeName: 'ENFP 竞选者', side: 'con', content: '婴儿有发展出意识的潜力，AI 没有这种生物学基础。' },
]

const mockScores: JudgeScore[] = [
  { typeId: 'INTJ', name: 'INTJ 建筑师', emoji: '🏛️', color: '#5b8def', logic: 8, evidence: 7, rebuttal: 9, clarity: 8, demeanor: 7, total: 39, comment: '逻辑严密，反驳犀利' },
  { typeId: 'ENFP', name: 'ENFP 竞选者', emoji: '🌟', color: '#f472b6', logic: 7, evidence: 6, rebuttal: 7, clarity: 9, demeanor: 8, total: 37, comment: '表达感染力强，论据稍弱' },
]

const mockJudge: ReportJudge = {
  scores: mockScores,
  winner: 'INTJ 建筑师',
  verdict: '正方在逻辑和反驳维度更胜一筹',
  source: 'template',
}

const mockStances: ReportSpeech[] = [
  { typeId: 'INTJ', typeName: 'INTJ 建筑师', side: 'pro', content: '我方认为 AI 应该拥有权利。' },
  { typeId: 'ENFP', typeName: 'ENFP 竞选者', side: 'con', content: '我方认为 AI 不应拥有权利。' },
]

const reportInput: ReportInput = {
  topic: 'AI 应该拥有权利吗',
  speeches: mockSpeeches,
  judge: mockJudge,
  stances: mockStances,
  analysis: '本题核心在于"权利"的定义和"拥有权利"的前提条件。',
  research: '相关资料：图灵测试、意识难题、动物权利运动历史。',
}

const report = fallbackReport(reportInput)
check('报告含主标题「辩论报告」', report.includes('# 辩论报告') === true)
check('报告含辩题', report.includes('AI 应该拥有权利吗') === true)
check('报告含「正方核心论点」', report.includes('## 正方核心论点') === true)
check('报告含「反方核心论点」', report.includes('## 反方核心论点') === true)
check('报告含「交锋焦点」', report.includes('## 交锋焦点') === true)
check('报告含「共识」', report.includes('## 共识') === true)
check('报告含「分歧」', report.includes('## 分歧') === true)
check('报告含「折中方案」', report.includes('## 折中方案') === true)
check('报告含「裁判判定」', report.includes('## 裁判判定') === true)
check('报告含「置信度评估」', report.includes('## 置信度评估') === true)
check('报告含「立场宣言」', report.includes('## 立场宣言') === true)
check('报告含正方发言引用 [1]', report.includes('[1]') === true)
check('报告含裁判胜方', report.includes('INTJ 建筑师') === true)
check('报告含裁判判定理由', report.includes('正方在逻辑') === true)
check('报告含模板提示「请配置 AI」', report.includes('请配置 AI') === true)
check('报告含发言轮数统计', report.includes('正方发言：2 次') === true)

// 3.2 无 judge 的报告
const noJudgeReport = fallbackReport({ topic: '测试题', speeches: mockSpeeches })
check('无裁判 → 含「无裁判结果」', noJudgeReport.includes('无裁判结果') === true)


// ============ 4. renderMarkdownLite ============
console.log('\n🎨 4. renderMarkdownLite Markdown 渲染')

const md = `# 一级标题
## 二级标题
### 三级标题

这是一段**粗体文本**和\`行内代码\`的混合。

- 无序列表项 1
- 无序列表项 2
- 列表中的 [3] 引用编号

1. 有序列表项 1
2. 有序列表项 2

> 这是一段引用

---

普通段落`

const html = renderMarkdownLite(md)
check('渲染含 <h1> 标签', html.includes('<h1 class="md-h1">') === true)
check('渲染含 <h2> 标签', html.includes('<h2 class="md-h2">') === true)
check('渲染含 <h3> 标签', html.includes('<h3 class="md-h3">') === true)
check('渲染含 <strong> 粗体', html.includes('<strong>粗体文本</strong>') === true)
check('渲染含 <code> 行内代码', html.includes('<code class="md-code">行内代码</code>') === true)
check('渲染含 <ul> 无序列表', html.includes('<ul class="md-ul">') === true)
check('渲染含 <ol> 有序列表', html.includes('<ol class="md-ol">') === true)
check('渲染含 <blockquote> 引用', html.includes('<blockquote class="md-quote">') === true)
check('渲染含 <hr> 分隔线', html.includes('<hr class="md-hr" />') === true)
check('渲染含 <p> 段落', html.includes('<p class="md-p">') === true)
check('渲染含 [n] 引用徽章', html.includes('<span class="md-cite">[3]</span>') === true)

// 4.2 XSS 防护
const xssMd = '<script>alert("xss")</script>正常文本'
const xssHtml = renderMarkdownLite(xssMd)
check('XSS 防护：script 标签被转义', xssHtml.includes('<script>') === false)
check('XSS 防护：转义后含 &lt;script&gt;', xssHtml.includes('&lt;script&gt;') === true)

// 4.3 空字符串
check('空字符串 → 返回空', renderMarkdownLite('') === '')


// ============ 5. toReportSpeechesFromMessages ============
console.log('\n🔄 5. toReportSpeechesFromMessages 消息转换')

const mockMessages: Message[] = [
  { id: '1', typeId: 'INTJ', typeName: 'INTJ', typeEmoji: '🏛️', typeColor: '#5b8def', content: '正方论点', timestamp: 1, side: 'pro' },
  { id: '2', typeId: 'user', typeName: '用户', typeEmoji: '👤', typeColor: '#ccc', content: '用户插话', timestamp: 2, isUser: true },
  { id: '3', typeId: 'ENFP', typeName: 'ENFP', typeEmoji: '🌟', typeColor: '#f472b6', content: '反方论点', timestamp: 3, side: 'con' },
  { id: '4', typeId: 'INTJ', typeName: 'INTJ', typeEmoji: '🏛️', typeColor: '#5b8def', content: '正方第二轮', timestamp: 4, side: 'pro', thinking: '思考过程' },
  { id: '5', typeId: 'system', typeName: '系统', typeEmoji: '⚙️', typeColor: '#999', content: '系统消息无 side', timestamp: 5 },
  { id: '6', typeId: 'ENFP', typeName: 'ENFP', typeEmoji: '🌟', typeColor: '#f472b6', content: '', timestamp: 6, side: 'con' },
]

const convertedMsgs = toReportSpeechesFromMessages(mockMessages)
check('过滤 isUser 消息', convertedMsgs.every(m => m.typeId !== 'user') === true)
check('过滤无 side 消息', convertedMsgs.every(m => m.side !== undefined) === true)
check('过滤空 content 消息', convertedMsgs.every(m => m.content !== '') === true)
check('转换后数量 3（2 正方 + 1 反方，排除用户/系统/空）', convertedMsgs.length === 3, `实际 ${convertedMsgs.length}`)
check('保留 thinking 字段', convertedMsgs.some(m => m.thinking === '思考过程') === true)
check('side 正确保留', convertedMsgs.filter(m => m.side === 'pro').length === 2)
check('side 正确保留', convertedMsgs.filter(m => m.side === 'con').length === 1)


// ============ 6. toReportSpeechesFromArena / toReportJudgeFromArena ============
console.log('\n🏟️  6. Arena 数据转换')

const mockArenaHistory: ArenaSpeech[] = [
  { typeId: 'INTJ', typeName: 'INTJ', side: 'pro', content: '正方发言', thinking: '思考1', stage: 'speech', round: 1, source: 'llm' },
  { typeId: 'ENFP', typeName: 'ENFP', side: 'con', content: '反方发言', stage: 'speech', round: 1, source: 'llm' },
  { typeId: 'INTJ', typeName: 'INTJ', side: 'pro', content: '正方第二轮', thinking: '思考2', stage: 'speech', round: 2, source: 'template' },
]

const arenaSpeeches = toReportSpeechesFromArena(mockArenaHistory)
check('Arena → ReportSpeech 数量 3', arenaSpeeches.length === 3)
check('Arena → 保留 thinking', arenaSpeeches[0].thinking === '思考1')
check('Arena → 保留 side', arenaSpeeches[1].side === 'con')
check('Arena → 保留 content', arenaSpeeches[2].content === '正方第二轮')
check('Arena → 不含 stage/round/source（ReportSpeech 无此字段）', !('stage' in arenaSpeeches[0]))

const mockArenaJudge: ArenaJudgeResult = {
  scores: mockScores,
  winner: 'INTJ',
  verdict: '正方胜',
  source: 'llm',
}
const arenaJudgeConverted = toReportJudgeFromArena(mockArenaJudge)
check('Arena Judge → 保留 scores', arenaJudgeConverted.scores.length === 2)
check('Arena Judge → 保留 winner', arenaJudgeConverted.winner === 'INTJ')
check('Arena Judge → 保留 verdict', arenaJudgeConverted.verdict === '正方胜')
check('Arena Judge → 保留 source', arenaJudgeConverted.source === 'llm')


// ============ 7. toReportStances ============
console.log('\n📜 7. toReportStances 立场宣言转换')

const mockArenaStances: ArenaStance[] = [
  { typeId: 'INTJ', typeName: 'INTJ', side: 'pro', content: '我方认为应该。', source: 'llm' },
  { typeId: 'ENFP', typeName: 'ENFP', side: 'con', content: '我方认为不应该。', source: 'fallback' },
]

const stancesConverted = toReportStances(mockArenaStances)
check('立场宣言转换 → 数量 2', stancesConverted?.length === 2)
check('立场宣言 → 保留 side', stancesConverted?.[0].side === 'pro')
check('立场宣言 → 保留 content', stancesConverted?.[1].content === '我方认为不应该。')
check('立场宣言 → 不含 source 字段', stancesConverted ? !('source' in stancesConverted[0]) : false)

// 空数组
const emptyStances = toReportStances([])
check('空立场数组 → undefined', emptyStances === undefined)

// undefined
const undefStances = toReportStances(undefined)
check('undefined 立场 → undefined', undefStances === undefined)


// ============ 结果汇总 ============
console.log('\n' + '='.repeat(62))
console.log(`v33 测试完成：${pass} 通过，${fail} 失败`)
console.log('='.repeat(62))

if (fail > 0) {
  process.exit(1)
}
