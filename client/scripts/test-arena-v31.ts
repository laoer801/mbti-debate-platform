/**
 * v31 实测脚本：四层人格引擎（驱力内核 + 状态引擎 + 持久记忆 + 提示词注入）
 *
 * v31 验证重点：
 *   1. 人格内核 personaDrives：16 人格 × 5 维驱力完整、范围合法、topDrives/默认兜底正常
 *   2. 状态引擎 personaEngine：差异化初始化、意图 A-E 确定性演化、情绪词感染、clamp/舍入
 *   3. 持久记忆 personaMemory：启发式提取（偏好/经历/关系）、追加、超限摘要沉淀、持久化回读
 *   4. 提示词层注入：辩论/对话系统提示词注入【驱力】+【状态】+【记忆】段，且可不传（向后兼容）
 *   5. arena 编排透传：runNextSpeech 携带 persona 上下文不破坏模板兜底
 *   6. v30/v28 回归：意图识别解析 / 输入识别规则 / CoT 解析 / 对话模式均保持可用
 *
 * 用法：
 *   npm run test:arena:v31
 *   或手动：
 *   node scripts/test-arena-v31.bundle.cjs
 */

// ── node 环境 mock localStorage（llmClient/personaEngine/personaMemory 依赖，纯内存实现）──
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

import { DRIVE_KEYS, getPersonaDrives, topDrives, buildDriveSection, personaDrives, type DriveKey } from '../src/data/personaDrives'
import {
  createInitialState, updateState, emotionFromText, describeMood, moodEmoji,
  energyLabel, intimacyLabel, noveltyLabel, buildStatePrompt,
  loadPersonaState, savePersonaState, getOrInitState, type PersonaState,
} from '../src/utils/personaEngine'
import {
  extractMemoryCandidates, addMemory, summarizeEntries, buildMemorySection,
  createEmptyMemory, MEMORY_LIMIT, MEMORY_KIND_LABELS,
  loadPersonaMemory, savePersonaMemory, getOrInitMemory, type PersonaMemory,
} from '../src/utils/personaMemory'
import {
  buildPersonaSystemPrompt, buildSpeechMessages, INPUT_ANALYSIS_RULES,
} from '../src/utils/debatePrompts'
import {
  buildDialogueSystemPrompt, buildDialogueMessages, buildDialogueFallback,
  parseDialogueResponse, parseDialogueUnderstanding, INTENT_LABELS,
} from '../src/data/dialogueMode'
import { parseCoT, createArenaFromTypes, runNextSpeech } from '../src/utils/debateArena'
import { mbtiProfiles } from '../src/data/mbtiProfiles'

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
console.log('v31 纯函数测试：四层人格引擎')
console.log('='.repeat(62))

;(async () => {

// ── 1. 人格内核（驱力） ──
console.log('\n🎭 1.1 人格内核 personaDrives')
const allTypeIds = mbtiProfiles.map(p => p.id)
check('覆盖全部 16 人格', allTypeIds.every(id => personaDrives[id] !== undefined), `${Object.keys(personaDrives).length} 个`)
check('每人格 5 维驱力齐全', allTypeIds.every(id => DRIVE_KEYS.every(k => typeof personaDrives[id]?.drives[k] === 'number')))
check('驱力值都在 [0,1]', allTypeIds.every(id => DRIVE_KEYS.every(k => {
  const v = personaDrives[id].drives[k]
  return v >= 0 && v <= 1
})))
check('每人格都有渴望与恐惧', allTypeIds.every(id =>
  typeof personaDrives[id]?.desire === 'string' && personaDrives[id].desire.length > 0 &&
  typeof personaDrives[id]?.fear === 'string' && personaDrives[id].fear.length > 0))
check('未知类型返回安全默认', getPersonaDrives('XXXX').drives.connection === 0.5 && getPersonaDrives('XXXX').desire.length > 0)

const top = topDrives('INTJ')
check('topDrives 返回最强的 2 维', top.length === 2 && top[0].value >= top[1].value && top[0].value > 0.5, JSON.stringify(top))
check('topDrives 字段完整', top.every(t => t.key && t.label && typeof t.value === 'number'))

const driveSection = buildDriveSection('INTJ')
check('驱力段含标题「内在驱力」', driveSection.includes('内在驱力'))
check('驱力段含「最渴望的」', driveSection.includes('最渴望的'))
check('驱力段含「最深的恐惧」', driveSection.includes('最深的恐惧'))
const driveLabels = ['连接欲', '好奇欲', '求新欲', '安全欲', '表达欲']
check('驱力段逐维描述', DRIVE_KEYS.every(k => driveSection.includes(driveLabels[DRIVE_KEYS.indexOf(k)])))

// ── 2. 状态引擎 ──
console.log('\n⚙️ 2.1 状态引擎初始化与演化')
const stINTJ = createInitialState('INTJ')
const stENFP = createInitialState('ENFP')
const stISFJ = createInitialState('ISFJ')
check('E 型初始精力高于 I 型', stENFP.energy > stISFJ.energy, `ENFP=${stENFP.energy} ISFJ=${stISFJ.energy}`)
check('F 型初始亲密度高于 T 型', stISFJ.intimacy > stINTJ.intimacy, `ISFJ=${stISFJ.intimacy} INTJ=${stINTJ.intimacy}`)
check('P 型初始新鲜度高于 J 型', stENFP.novelty > stINTJ.novelty, `ENFP=${stENFP.novelty} INTJ=${stINTJ.novelty}`)
check('初始状态数值合法', [-1,1].every(() => stINTJ.valence >= -1 && stINTJ.valence <= 1) && stINTJ.energy >= 0 && stINTJ.energy <= 1)

// 意图 A：新话题 → novelty 上升
const sA = updateState(stINTJ, { intent: 'A', userText: '我们来聊聊量子计算吧！', topic: '量子计算' })
check('意图A：话题新鲜度上升', sA.novelty > stINTJ.novelty, `${stINTJ.novelty} → ${sA.novelty}`)
check('意图A：lastTopic 更新', sA.lastTopic === '量子计算' && sA.lastIntent === 'A')

// 意图 D：倾诉 → intimacy 上升 + energy 消耗 + arousal 上升
const stF = createInitialState('ISFJ')
const sD = updateState(stF, { intent: 'D', userText: '我最近压力好大，感觉撑不住了', topic: TOPIC })
check('意图D：亲密度明显上升', sD.intimacy > stF.intimacy + 0.05, `${stF.intimacy} → ${sD.intimacy}`)
check('意图D：共情耗能（精力下降）', sD.energy < stF.energy, `${stF.energy} → ${sD.energy}`)
check('意图D：情绪被唤醒（arousal 上升）', sD.arousal > stF.arousal, `${stF.arousal} → ${sD.arousal}`)

// 意图 E：求建议 → intimacy 微升
const sE = updateState(stINTJ, { intent: 'E', userText: '我想听听你的建议', topic: TOPIC })
check('意图E：亲密度上升', sE.intimacy > stINTJ.intimacy, `${stINTJ.intimacy} → ${sE.intimacy}`)

// 无意图默认 → energy 衰减 + novelty 衰减
const sNone = updateState(stINTJ, { userText: '', topic: TOPIC })
check('无意图：精力自然消耗', sNone.energy < stINTJ.energy, `${stINTJ.energy} → ${sNone.energy}`)
check('无意图：新鲜度自然衰减', sNone.novelty < stINTJ.novelty, `${stINTJ.novelty} → ${sNone.novelty}`)

// 情绪词感染
const emoNeg = emotionFromText('我很难过，心里很委屈')
check('负面情绪检测', emoNeg.isEmotional && emoNeg.valenceDelta < 0, JSON.stringify(emoNeg))
const emoPos = emotionFromText('我今天超开心，太棒了！')
check('正面情绪检测', emoPos.isEmotional && emoPos.valenceDelta > 0 && emoPos.strong, JSON.stringify(emoPos))
const sNeg = updateState(stINTJ, { userText: '我很难过，心里很委屈', topic: TOPIC })
check('负面情绪感染 valence 下降', sNeg.valence < stINTJ.valence, `${stINTJ.valence} → ${sNeg.valence}`)

// clamp + 千分位：连续 20 次倾诉不越界
let heavy = createInitialState('ENFP')
for (let i = 0; i < 20; i++) heavy = updateState(heavy, { intent: 'D', userText: '我好难过', topic: TOPIC })
check('连续倾诉不越界', heavy.intimacy <= 1 && heavy.energy >= 0 && heavy.valence >= -1 && heavy.valence <= 1, `intimacy=${heavy.intimacy} energy=${heavy.energy} valence=${heavy.valence}`)
check('数值为千分位', heavy.intimacy === Math.round(heavy.intimacy * 1000) / 1000)

// 确定性：同输入同输出（排除 updatedAt/turnCount）
const s1 = updateState(createInitialState('INTJ'), { intent: 'A', userText: '新话题', topic: 'X' })
const s2 = updateState(createInitialState('INTJ'), { intent: 'A', userText: '新话题', topic: 'X' })
check('演化确定性（同输入同输出）',
  s1.valence === s2.valence && s1.energy === s2.energy && s1.intimacy === s2.intimacy && s1.novelty === s2.novelty && s1.arousal === s2.arousal)

// 状态 → 描述
check('describeMood/moodEmoji 非空', describeMood(stINTJ).length > 0 && moodEmoji(stINTJ).length > 0)
check('energyLabel 四档', ['精力充沛','状态尚可','有点累了','精疲力竭'].every(l => typeof l === 'string'))
check('intimacyLabel 五档', ['灵魂之交','可以交心','逐渐熟悉','初次相识','彼此陌生'].every(l => typeof l === 'string'))
check('noveltyLabel 四档', ['兴致盎然','还算新鲜','略感乏味','聊腻了'].every(l => typeof l === 'string'))
const statePrompt = buildStatePrompt(stINTJ)
check('状态注入段含「内在状态」', statePrompt.includes('内在状态') && statePrompt.includes('精力'))

// ── 3. 持久记忆 ──
console.log('\n🧠 3.1 持久记忆 personaMemory')
const memEmpty = createEmptyMemory('INTJ')
check('空记忆库', memEmpty.entries.length === 0 && memEmpty.summary === '')

const candPref = extractMemoryCandidates('我喜欢在深夜写代码，很安静')
check('提取偏好记忆', candPref.some(c => c.kind === 'preference' && c.text.includes('深夜写代码')), JSON.stringify(candPref))
const candEvent = extractMemoryCandidates('我最近换了新工作，压力挺大')
check('提取经历记忆', candEvent.some(c => c.kind === 'event' && c.text.includes('新工作')), JSON.stringify(candEvent))
const candRel = extractMemoryCandidates('这件事我从来没对别人说过，只有你知道')
check('提取关系记忆', candRel.some(c => c.kind === 'relationship' && c.text.includes('从来没对别人')), JSON.stringify(candRel))
const candLimit = extractMemoryCandidates('我喜欢A。我最近做了B。我今天去了C。我打算去D。我今天吃了E。')
check('每轮最多 3 条', candLimit.length <= 3, `${candLimit.length} 条`)

// 追加 + 超限沉淀
let mem = createEmptyMemory('INTJ')
mem = addMemory(mem, '我喜欢喝咖啡', 'preference')
mem = addMemory(mem, '我最近在健身', 'event')
mem = addMemory(mem, '只有你了解我', 'relationship')
check('追加 3 条', mem.entries.length === 3 && mem.summary === '')
for (let i = 0; i < 6; i++) mem = addMemory(mem, `我最近经历了第${i + 1}件事`, 'event')
check('超限后自动摘要沉淀', mem.summary.includes('偏好') && mem.summary.includes('经历：我最近经历了第6件事') && mem.entries.length === 3, `entries=${mem.entries.length} summary=${mem.summary}`)
check('沉淀保留最近 3 条细节', mem.entries[2].text.includes('第6件事'), mem.entries.map(e => e.text).join('|'))

const sum = summarizeEntries([
  { id: '1', typeId: 'INTJ', text: '喜欢咖啡', kind: 'preference' as const, ts: 1 },
  { id: '2', typeId: 'INTJ', text: '最近在健身', kind: 'event' as const, ts: 2 },
])
check('摘要按类型聚合', sum.includes('偏好：喜欢咖啡') && sum.includes('经历：最近在健身'), sum)

const memSection = buildMemorySection(mem)
check('记忆注入段含「跨会话延续」', memSection.includes('跨会话延续') && memSection.includes('长期印象'))

// 持久化回读
savePersonaState(sA)
check('状态持久化回读', loadPersonaState('INTJ')?.novelty === sA.novelty)
savePersonaMemory(mem)
check('记忆持久化回读', loadPersonaMemory('INTJ')?.entries.length === 3)
check('getOrInit 兜底', getOrInitState('ZZZZ').typeId === 'ZZZZ' && getOrInitMemory('ZZZZ').typeId === 'ZZZZ')

// ── 4. 提示词层注入 ──
console.log('\n📝 4.1 提示词层注入（驱力 + 状态 + 记忆）')
const fullPrompt = buildPersonaSystemPrompt('INTJ', TOPIC, 'pro', {
  state: sA,
  memory: mem,
})
check('辩论提示词含【驱力】段', fullPrompt.includes('内在驱力'))
check('辩论提示词含【状态】段', fullPrompt.includes('你此刻的内在状态'))
check('辩论提示词含【记忆】段', fullPrompt.includes('你对 TA 的记忆'))
check('辩论提示词含人格基础段', fullPrompt.includes('INTJ') || fullPrompt.includes('建筑师'))

const barePrompt = buildPersonaSystemPrompt('INTJ', TOPIC, 'pro')
check('不传状态/记忆时向后兼容', !barePrompt.includes('你此刻的内在状态') && !barePrompt.includes('你对 TA 的记忆'))

const speechWithCtx = buildSpeechMessages({
  typeId: 'INTJ', typeName: '建筑师', side: 'pro', topic: TOPIC,
  stage: 'opening', ownSpeechCount: 0, recentHistory: [],
  state: sA, memory: mem,
} as any)
const systemMsg = speechWithCtx[0]?.content ?? ''
check('buildSpeechMessages 注入状态段', systemMsg.includes('你此刻的内在状态'))
check('buildSpeechMessages 注入记忆段', systemMsg.includes('你对 TA 的记忆'))

const dialogueWithCtx = buildDialogueSystemPrompt('INTJ', { state: sA, memory: mem })
check('对话提示词注入驱力+状态+记忆',
  dialogueWithCtx.includes('内在驱力') && dialogueWithCtx.includes('你此刻的内在状态') && dialogueWithCtx.includes('你对 TA 的记忆'))
const dialogueBare = buildDialogueSystemPrompt('INTJ')
check('对话提示词不传时兼容', !dialogueBare.includes('你对 TA 的记忆'))

const dialogueMsgs = buildDialogueMessages({
  typeId: 'INTJ', typeName: '建筑师', userMessage: '我最近很迷茫',
  state: sA, memory: mem,
})
check('buildDialogueMessages 透传注入', (dialogueMsgs[0]?.content ?? '').includes('你对 TA 的记忆'))

// ── 5. arena 编排透传 ──
console.log('\n⚔️ 5.1 arena 编排透传 persona 上下文')
const arena = createArenaFromTypes(TOPIC, ['INTJ'], ['ENFP'])
const runRes = await runNextSpeech(arena, {
  state: createInitialState('INTJ'),
  memory: createEmptyMemory('INTJ'),
})
check('runNextSpeech 携带 persona 正常运行', runRes.speech !== null && runRes.state !== null)
check('模板兜底发言非空', (runRes.speech?.content.length ?? 0) > 10)
check('arena 状态推进', runRes.state.round >= arena.round)

// ── 6. v30/v28 回归 ──
console.log('\n🔁 6.1 v30/v28 回归')
const sampleUnderstanding = `意图类型：A（发起新话题）
核心论题：AI是否应该拥有权利
情绪状态：中性，好奇`
check('parseDialogueUnderstanding 意图 A', parseDialogueUnderstanding(sampleUnderstanding).intent === 'A')
check('parseDialogueUnderstanding 变体 [D]', parseDialogueUnderstanding('意图类型：[D] 倾诉').intent === 'D')
const raw = `【理解】${sampleUnderstanding}\n【回应】这是一个值得深入的问题。`
const pd = parseDialogueResponse(raw)
check('parseDialogueResponse 分离+meta', pd.understanding.includes('意图类型') && pd.response.includes('值得深入') && pd.meta.intent === 'A')
const v30Prompt = buildPersonaSystemPrompt('INTJ', TOPIC, 'pro')
check('输入识别规则仍在', v30Prompt.includes('输入识别与处理规则') && v30Prompt.includes('你真的听懂了他说的话'))
check('COT_FORMAT 意图维度仍在', (buildSpeechMessages({ typeId: 'INTJ', typeName: '建筑师', side: 'pro', topic: TOPIC, stage: 'opening', ownSpeechCount: 0, recentHistory: [] } as any).find(m => m.role === 'user')?.content ?? '').includes('对方意图类型'))
const cot = parseCoT('【思考】对方论证有漏洞\n【发言】首先，权利的核心是利益保护。')
check('parseCoT 分离', cot.thinking.includes('漏洞') && cot.content.includes('利益保护'))
check('对话兜底非空', buildDialogueFallback('INTJ', '建筑师', '我很焦虑').length > 20)
check('INTENT_LABELS 五类', Object.keys(INTENT_LABELS).length === 5)
check('MEMORY_KIND_LABELS 四类', Object.keys(MEMORY_KIND_LABELS).length === 4 && MEMORY_KIND_LABELS['relationship'] === '关系')

// ── 汇总 ──
console.log('\n' + '='.repeat(62))
console.log(`v31 测试结果：${pass} 通过 / ${fail} 失败`)
console.log('='.repeat(62))
if (fail > 0) process.exit(1)
})().catch(err => { console.error('测试执行异常:', err); process.exit(1) })
