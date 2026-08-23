/**
 * v26 实测脚本：INTJ vs ENFP「AI应该拥有权利吗」
 *
 * 验证：赛前辩题分析 → 8 轮交锋（引用-识别-回应 + 攻击优先级 + 深度推进）→ AI 裁判三维度裁决
 *
 * 用法（先构建 bundle）：
 *   npm run test:arena
 * 或手动：
 *   DS_API_KEY=sk-xxx node scripts/test-arena-v26.bundle.cjs
 *   可选：DS_BASE_URL / DS_MODEL
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
} from '../src/utils/debateArena'

const TOPIC = 'AI应该拥有权利吗'
const PRO_TYPES = ['ENFP']
const CON_TYPES = ['INTJ']

async function main(): Promise<void> {
  const apiKey = process.env.DS_API_KEY || ''
  const baseURL = process.env.DS_BASE_URL || 'https://api.deepseek.com'
  const model = process.env.DS_MODEL || 'deepseek-chat'

  if (!apiKey) {
    console.error('❌ 缺少 DS_API_KEY 环境变量（DeepSeek API Key）')
    console.error('   用法：DS_API_KEY=sk-xxx node scripts/test-arena-v26.bundle.cjs')
    process.exit(1)
  }
  setLLMConfig({ apiKey, baseURL, model })

  console.log('='.repeat(62))
  console.log(`🎤 辩题：${TOPIC}`)
  console.log(`👥 正方 ${PRO_TYPES.join(', ')} vs 反方 ${CON_TYPES.join(', ')}`)
  console.log(`🔌 服务商：${baseURL} ｜ 模型：${model}`)
  console.log('='.repeat(62))

  // 1) 赛前完整流程（v26.2 审题 → v27 检索资料）
  let arena = createArenaFromTypes(TOPIC, PRO_TYPES, CON_TYPES)
  console.log('\n🧐 [赛前] 正在审题…')
  arena = await prepareFullArena(arena)
  const asrc = arena.topicAnalysis?.source === 'llm' ? '🤖 AI 深度审题' : '⚙️ 本地快速审题'
  console.log(`📋 审题报告（${asrc}）：\n` + (arena.topicAnalysis?.text ?? '(空)'))
  const rsrc = arena.research?.source === 'llm' ? '🤖 AI 深度检索' : '⚙️ 本地快速检索'
  console.log(`\n📚 资料包（${rsrc}）：\n` + (arena.research?.text ?? '(空)'))

  // 2) 完整 8 轮交锋
  console.log('\n' + '─'.repeat(62))
  console.log('🎙️ 辩论开始（开场陈词 → 交叉质询 → 自由辩论 → 总结陈词）')
  console.log('─'.repeat(62))

  let count = 0
  arena = await runFullArena(arena, (speech, i) => {
    count = i + 1
    const sideName = speech.side === 'pro' ? '正方' : '反方'
    const src = speech.source === 'llm' ? '🤖 LLM' : '🧱 模板兜底'
    console.log(`\n【第 ${speech.round + 1} 轮 · ${speech.typeName}（${sideName}）· ${src}】`)
    console.log(speech.content)
  })
  console.log(`\n${'─'.repeat(62)}`)
  console.log(`✅ 辩论结束，共 ${count} 条发言`)

  // 3) AI 裁判裁决（五维 + 对抗三维度 + 套话检测）
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

main().catch(err => {
  console.error('❌ 测试失败:', err)
  process.exit(1)
})
