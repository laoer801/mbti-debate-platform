/**
 * v28 实测脚本：INTJ vs ENFP「AI应该拥有权利吗」
 *
 * 新增 v28 验证：
 *   1. 好辩论示例匹配（findExamplesForTopic）
 *   2. CoT 思考链解析（parseCoT）
 *   3. 对话模式提示词（buildDialogueSystemPrompt / buildDialogueMessages）
 *   4. 完整 LLM 辩论（含思考链分离存储）
 *
 * 用法：
 *   npm run test:arena:v28
 *   或手动：
 *   DS_API_KEY=sk-xxx node scripts/test-arena-v28.bundle.cjs
 *   可选：DS_BASE_URL / DS_MODEL
 *
 * 无 API Key 时自动跑 Part 1（纯函数测试），有 Key 时跑完整流程。
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

import { setLLMConfig } from '../src/utils/llmClient'
import {
  createArenaFromTypes,
  prepareFullArena,
  runFullArena,
  judgeArena,
  parseCoT,
} from '../src/utils/debateArena'
import { findExamplesForTopic } from '../src/data/debateExamples'
import {
  buildDialogueSystemPrompt,
  buildDialogueMessages,
  buildDialogueFallback,
  type DialogueContext,
} from '../src/data/dialogueMode'
import { buildPersonaSystemPrompt, buildSpeechMessages } from '../src/utils/debatePrompts'

const TOPIC = 'AI应该拥有权利吗'
const PRO_TYPES = ['ENFP']
const CON_TYPES = ['INTJ']

// ════════════════════════════════════════════════════════════
// Part 1: 纯函数测试（无需 API Key）
// ════════════════════════════════════════════════════════════

function testPureFunctions(): void {
  console.log('='.repeat(62))
  console.log('Part 1: 纯函数测试（无需 API Key）')
  console.log('='.repeat(62))

  // ── 1.1 好辩论示例匹配 ──
  console.log('\n📚 1.1 好辩论示例匹配（findExamplesForTopic）')
  const examples = findExamplesForTopic(TOPIC, 3)
  console.log(`   匹配到 ${examples.length} 组示例：`)
  for (const ex of examples) {
    console.log(`   - [${ex.id}] ${ex.topic} | 策略: ${ex.strategy.join(', ')} | 领域: ${ex.field}`)
    console.log(`     收获: ${ex.takeaway.substring(0, 60)}...`)
  }
  if (examples.length === 0) {
    console.warn('   ⚠️ 未匹配到示例——检查关键词')
  } else {
    console.log(`   ✅ 示例匹配正常（${examples.length} 组）`)
  }

  // ── 1.2 CoT 思考链解析 ──
  console.log('\n🧠 1.2 CoT 思考链解析（parseCoT）')
  const sampleCoT = `【思考】对方提到AI没有意识所以不该有权利，但这个论证有问题——权利体系的核心不是意识而是利益保护。动物没有自我意识也有动物权利。我选择"攻击前提"策略，指出对方的隐含假设：权利=意识主体专属。\n【发言】首先，对方认为AI没有意识所以不该有权利，但这个论证存在一个隐含假设——权利只属于有意识的存在。这个假设站不住脚：我们给动物立法保护，不是因为他们有自我意识，而是因为它们有需要被保护的利益。AI如果能够自主决策、承担责任，它就有了需要被保护的利益边界。`

  const parsed = parseCoT(sampleCoT)
  const hasThinking = parsed.thinking.length > 0
  const hasContent = parsed.content.length > 0
  const thinkingOK = parsed.thinking.includes('攻击前提')
  const contentOK = parsed.content.includes('隐含假设')

  console.log(`   思考部分: ${parsed.thinking.substring(0, 50)}...`)
  console.log(`   发言部分: ${parsed.content.substring(0, 50)}...`)
  console.log(`   思考非空: ${hasThinking ? '✅' : '❌'} | 发言非空: ${hasContent ? '✅' : '❌'}`)
  console.log(`   思考含策略关键词: ${thinkingOK ? '✅' : '❌'} | 发言含论点关键词: ${contentOK ? '✅' : '❌'}`)

  // 测试无 CoT 格式的输入（纯发言）
  const noCoT = parseCoT('这是一段没有思考链标记的纯发言内容')
  console.log(`   无标记输入兜底: 发言="${noCoT.content.substring(0, 30)}..." thinking="${noCoT.thinking || '(空)'}" ${noCoT.content.length > 0 ? '✅' : '❌'}`)

  // ── 1.3 对话模式系统提示词 ──
  console.log('\n💬 1.3 对话模式系统提示词（buildDialogueSystemPrompt）')
  const intjDialogue = buildDialogueSystemPrompt('INTJ')
  const hasRules = intjDialogue.includes('倾听')
  const hasStyle = intjDialogue.includes('慢') || intjDialogue.includes('精简') || intjDialogue.includes('停顿')
  const hasExample = intjDialogue.includes('D1') || intjDialogue.includes('深夜')
  console.log(`   INTJ 提示词长度: ${intjDialogue.length} 字符`)
  console.log(`   含对话核心规则: ${hasRules ? '✅' : '❌'} | 含人格风格: ${hasStyle ? '✅' : '❌'} | 含 few-shot: ${hasExample ? '✅' : '❌'}`)

  // 测试 ENFP 对话风格差异
  const enfpDialogue = buildDialogueSystemPrompt('ENFP')
  const styleDiff = intjDialogue !== enfpDialogue
  console.log(`   ENFP 提示词与 INTJ 不同: ${styleDiff ? '✅' : '❌'}`)
  if (styleDiff) {
    console.log(`   INTJ 关键词: 慢/精简/停顿 | ENFP 关键词: 快/发散/感叹`)
  }

  // ── 1.4 对话模式消息构建 ──
  console.log('\n📨 1.4 对话模式消息构建（buildDialogueMessages）')
  const ctx: DialogueContext = {
    typeId: 'INTJ',
    typeName: '建筑师',
    history: [
      { role: 'user', content: '最近感觉很迷茫，不知道工作的意义是什么' },
    ],
    userMessage: '你觉得人生的意义是找到的还是创造的？',
  }
  const messages = buildDialogueMessages(ctx)
  const hasSystem = messages[0]?.role === 'system'
  const hasUser = messages.some(m => m.role === 'user')
  console.log(`   消息数: ${messages.length} | 系统: ${hasSystem ? '✅' : '❌'} | 用户: ${hasUser ? '✅' : '❌'}`)
  console.log(`   系统提示词前 80 字: ${messages[0]?.content.substring(0, 80)}...`)

  // ── 1.5 对话模式本地兜底 ──
  console.log('\n🔄 1.5 对话模式本地兜底（buildDialogueFallback）')
  const fallback = buildDialogueFallback('INTJ', '建筑师', '我感到很焦虑')
  const fallbackOK = fallback.length > 20
  console.log(`   兜底回复长度: ${fallback.length} 字符 | 非空: ${fallbackOK ? '✅' : '❌'}`)
  console.log(`   兜底内容: ${fallback.substring(0, 60)}...`)

  // ── 1.6 辩论提示词含思维框架 ──
  console.log('\n🎯 1.6 辩论提示词含思维框架（buildPersonaSystemPrompt）')
  const prompt = buildPersonaSystemPrompt('INTJ', '建筑师', TOPIC, 'pro')
  const hasFramework = prompt.includes('好辩论') || prompt.includes('三问')
  const hasStrategy = prompt.includes('策略') || prompt.includes('攻击依据')
  const hasExampleSection = prompt.includes('示例') || prompt.includes('反例')
  console.log(`   提示词长度: ${prompt.length} 字符`)
  console.log(`   含思维框架: ${hasFramework ? '✅' : '❌'} | 含策略工具箱: ${hasStrategy ? '✅' : '❌'} | 含示例注入: ${hasExampleSection ? '✅' : '❌'}`)

  // ── 1.7 发言消息含 CoT 格式指令 ──
  console.log('\n📝 1.7 发言消息含 CoT 格式指令（buildSpeechMessages）')
  const speechMsgs = buildSpeechMessages({
    typeId: 'INTJ',
    typeName: '建筑师',
    side: 'pro',
    topic: TOPIC,
    stage: 'opening',
    topicAnalysis: '辩题分析文本',
    research: '资料检索文本',
    ownSpeechCount: 0,
    recentHistory: [],
  } as any)
  const userMsg = speechMsgs.find(m => m.role === 'user')
  const hasCoTRule = userMsg?.content.includes('【思考】') && userMsg?.content.includes('【发言】')
  console.log(`   user 消息含 CoT 格式指令: ${hasCoTRule ? '✅' : '❌'}`)

  // ── 汇总 ──
  console.log('\n' + '='.repeat(62))
  console.log('Part 1 纯函数测试完成')
  console.log('='.repeat(62))
}

// ════════════════════════════════════════════════════════════
// Part 2: 完整 LLM 辩论实测（需要 DS_API_KEY）
// ════════════════════════════════════════════════════════════

async function testLLMArena(): Promise<void> {
  const apiKey = process.env.DS_API_KEY || ''
  const baseURL = process.env.DS_BASE_URL || 'https://api.deepseek.com'
  const model = process.env.DS_MODEL || 'deepseek-chat'

  if (!apiKey) {
    console.log('\n' + '─'.repeat(62))
    console.log('⚠️  缺少 DS_API_KEY 环境变量，跳过 LLM 实测')
    console.log('─'.repeat(62))
    console.log('配置方法：')
    console.log('  1. 获取 DeepSeek API Key: https://platform.deepseek.com/')
    console.log('  2. 运行：DS_API_KEY=sk-xxx node scripts/test-arena-v28.bundle.cjs')
    console.log('  3. 或在应用设置页直接填写 API Key')
    console.log('')
    console.log('Part 1 纯函数测试已验证 v28 数据层+提示词层正确性。')
    console.log('LLM 实测将验证：思考链分离存储 + 8轮交锋含策略 + 裁判三维度评分')
    return
  }

  setLLMConfig({ apiKey, baseURL, model })

  console.log('\n' + '='.repeat(62))
  console.log('Part 2: LLM 完整辩论实测')
  console.log('='.repeat(62))
  console.log(`🎤 辩题：${TOPIC}`)
  console.log(`👥 正方 ${PRO_TYPES.join(', ')} vs 反方 ${CON_TYPES.join(', ')}`)
  console.log(`🔌 ${baseURL} ｜ 模型：${model}`)
  console.log('='.repeat(62))

  // 1) 赛前完整流程（审题 → 检索 → 立场宣言）
  let arena = createArenaFromTypes(TOPIC, PRO_TYPES, CON_TYPES)
  console.log('\n🧐 [赛前] 审题 + 检索 + 立场宣言…')
  arena = await prepareFullArena(arena)

  const asrc = arena.topicAnalysis?.source === 'llm' ? '🤖 AI 深度审题' : '⚙️ 本地快速审题'
  console.log(`\n📋 审题报告（${asrc}）：\n${arena.topicAnalysis?.text ?? '(空)'}`)

  const rsrc = arena.research?.source === 'llm' ? '🤖 AI 深度检索' : '⚙️ 本地快速检索'
  console.log(`\n📚 资料包（${rsrc}）：\n${arena.research?.text ?? '(空)'}`)

  if (arena.stance?.length) {
    console.log('\n📣 立场宣言：')
    for (const s of arena.stance) {
      const side = s.side === 'pro' ? '正方' : '反方'
      const src = s.source === 'llm' ? '🤖' : '⚙️'
      console.log(`  ${src} ${s.typeName}（${side}）：${s.content.substring(0, 100)}...`)
    }
  }

  // 2) 完整 8 轮交锋（含 CoT 思考链）
  console.log('\n' + '─'.repeat(62))
  console.log('🎙️ 辩论开始（开场陈词 → 交叉质询 → 自由辩论 → 总结陈词）')
  console.log('─'.repeat(62))

  let count = 0
  let thinkingCount = 0

  arena = await runFullArena(arena, (speech, i) => {
    count = i + 1
    const sideName = speech.side === 'pro' ? '正方' : '反方'
    const src = speech.source === 'llm' ? '🤖 LLM' : '🧱 模板兜底'
    console.log(`\n【第 ${speech.round + 1} 轮 · ${speech.typeName}（${sideName}）· ${src}】`)

    // v28 新增：思考链展示
    if (speech.thinking) {
      thinkingCount++
      console.log(`  🧠 思考：${speech.thinking.substring(0, 120)}...`)
    }
    console.log(`  📢 发言：${speech.content.substring(0, 200)}${speech.content.length > 200 ? '...' : ''}`)
  })

  console.log(`\n${'─'.repeat(62)}`)
  console.log(`✅ 辩论结束，共 ${count} 条发言`)
  console.log(`🧠 含思考链的发言：${thinkingCount}/${count} ${thinkingCount > 0 ? '✅' : '⚠️（LLM 可能未按 CoT 格式输出）'}`)

  // 3) AI 裁判裁决
  console.log('\n⚖️  [AI 裁判裁决中…]\n')
  const result = await judgeArena(arena)
  if (result.source === 'template') {
    console.warn('⚠️  LLM 裁判不可用，回退本地正则裁判')
  }

  for (const s of result.scores) {
    console.log(`${s.emoji} ${s.name}（${s.typeId}）  🏁 总分 ${s.total}`)
    console.log(`   逻辑 ${s.logic}｜论据 ${s.evidence}｜反驳 ${s.rebuttal}｜表达 ${s.clarity}｜风度 ${s.demeanor}`)
    if (s.engagement !== undefined) {
      console.log(`   🔥 交锋 ${s.engagement}/10｜📈 深度推进 ${s.depth}/10｜💀 致命打击 ${s.kill}/10`)
    }
    console.log(`   💬 ${s.comment}`)
    console.log('')
  }
  console.log(`🏆 胜者：${result.winner}`)
  console.log(`📜 裁判总结：${result.verdict}`)
  console.log('='.repeat(62))
}

// ── 主入口 ──
async function main(): Promise<void> {
  testPureFunctions()
  await testLLMArena()
}

main().catch(err => {
  console.error('❌ 测试失败:', err)
  process.exit(1)
})
