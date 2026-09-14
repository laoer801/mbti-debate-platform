/**
 * v40.6 PK AI 对手引擎
 *
 * 三档难度（不分 MBTI 人格）：
 *   beginner     初级 · 新手感（直答 fast、回复短、不做用户风格学习）
 *   intermediate 中级 · 有套路（fast + 简单 CoT、中等长度、轻微学习用户句式）
 *   master       大师 · 强对抗（thinking + 完整 CoT、长回复、深度模仿用户表达/思考）
 *
 * AI 发言统一走「知乎直答」（服务端 ZHIHU_ACCESS_SECRET），避免依赖客户端 LLM key；
 * 生成失败时抛错由房间驱动层提示「AI 走神了」，绝不落本地模板凑数。
 *
 * 学习模块（ai-learner，不展示）：从用户发言里累计语言特征，输出「表达画像」段落
 * 注入 AI 的 system prompt，让 AI 逐渐像用户（句式/结构/举例习惯），但立场仍是反方。
 */

import { getDB } from './db.js'

// ============ 三档难度配置 ============

export const AI_LEVELS = {
  beginner: {
    id: 'ai__beginner',
    label: '🤖 初级辩友',
    title: '初级',
    model: 'fast',
    temperature: 0.9,
    maxTokens: 150,
    learnUserStyle: false, // 初级不模仿（生涩直接）
    coT: false,
  },
  intermediate: {
    id: 'ai__intermediate',
    label: '🤖 中级辩友',
    title: '中级',
    model: 'fast',
    temperature: 0.65,
    maxTokens: 200,
    learnUserStyle: true,
    coT: true,
  },
  master: {
    id: 'ai__master',
    label: '🤖 大师辩友',
    title: '大师',
    model: 'thinking',
    temperature: 0.45,
    maxTokens: 260,
    learnUserStyle: true,
    coT: true,
  },
}

export const AI_LEVEL_KEYS = Object.keys(AI_LEVELS) // ['beginner','intermediate','master']

// ============ 用户风格学习（静默存储，不展示） ============

/** 单次发言 → 更新该用户的风格统计 */
export function learnFromUserText(db, userId, text) {
  if (!userId || !text || typeof text !== 'string') return
  const clean = text.trim()
  if (!clean) return
  const now = Date.now()
  const row = db.prepare('SELECT * FROM ai_learner_styles WHERE user_id = ?').get(userId)
  const qLen = (clean.match(/[？?]/g) || []).length > 0 ? 1 : 0
  const exLen = (clean.match(/[！!]/g) || []).length > 0 ? 1 : 0
  const listHits = /(^|\s)([①-⑩]|[0-9]+[.、)]|首先|其次|最后|第一|第二|一方面|另一方面)/.test(clean) ? 1 : 0
  const emojiHits = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(clean) ? 1 : 0
  const followupHits = /(所以|因此|但是|不过|然而|换句话说|归根结底)/.test(clean) ? 1 : 0

  if (!row) {
    db.prepare(`
      INSERT INTO ai_learner_styles (user_id, move_count, total_chars, avg_len, q_len, ex_len, list_hits, emoji_hits, followup_hits, last_text, updated_at)
      VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, clean.length, clean.length, qLen, exLen, listHits, emojiHits, followupHits, clean.slice(0, 300), now)
  } else {
    const moveCount = row.move_count + 1
    const total = (row.total_chars || 0) + clean.length
    db.prepare(`
      UPDATE ai_learner_styles SET
        move_count = ?, total_chars = ?, avg_len = ?, q_len = q_len + ?, ex_len = ex_len + ?,
        list_hits = list_hits + ?, emoji_hits = emoji_hits + ?, followup_hits = followup_hits + ?,
        last_text = ?, updated_at = ?
      WHERE user_id = ?
    `).run(moveCount, total, Math.round((total / moveCount) * 10) / 10, qLen, exLen, listHits, emojiHits, followupHits, clean.slice(0, 300), now, userId)
  }
}

/** 生成「对方表达画像」提示段（仅当样本足够时返回有效段） */
export function buildStyleProfile(db, userId) {
  try {
    const row = db.prepare('SELECT * FROM ai_learner_styles WHERE user_id = ?').get(userId)
    if (!row || !row.move_count || row.move_count < 2) return null // 样本太少不模仿
    const tips = []
    if (row.avg_len && row.avg_len < 40) tips.push('偏好短句、口语化表达')
    else if (row.avg_len && row.avg_len > 140) tips.push('偏好长段落、铺陈论证')
    if (row.q_len > row.move_count * 0.4) tips.push('爱用反问/追问来施压')
    if (row.ex_len > row.move_count * 0.3) tips.push('情绪表达鲜明，善用感叹')
    if (row.list_hits > row.move_count * 0.35) tips.push('喜欢分点作答（①/首先/其次…），逻辑结构化')
    if (row.followup_hits > row.move_count * 0.3) tips.push('常用「所以/但是/换句话说」做推进')
    if (row.emoji_hits > row.move_count * 0.2) tips.push('会使用 emoji 增加语气')
    if (tips.length === 0) return null
    return tips.join('；')
  } catch {
    return null
  }
}

// ============ AI 发言生成（知乎直答） ============

async function zhihuChatOnce(model, messages) {
  // 动态 import 避免模块顶层耦合（zhihu.js 由 index.js 初始化）
  const { zhihuEnabled, ZH_BASE_CHAT, ZH_MODEL_FAST, ZH_MODEL_THINKING, ZHIHU_ACCESS_SECRET } = await import('./zhihu.js')
  if (!zhihuEnabled()) throw new Error('知乎直答未启用，无法生成 AI 发言')
  // model 是档位键（fast/thinking/agent）→ 映射到完整模型 id（与 /api/zhihu/chat 一致）
  const pickMap = { fast: ZH_MODEL_FAST, thinking: ZH_MODEL_THINKING, agent: ZH_MODEL_THINKING }
  const realModel = pickMap[model] || ZH_MODEL_FAST

  // v40.6.1：带 15s 超时（避免上游慢/挂起拖慢整场 PK）
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(ZH_BASE_CHAT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ZHIHU_ACCESS_SECRET}`,
          'X-Request-Timestamp': `${Math.floor(Date.now() / 1000)}`,
        },
        body: JSON.stringify({ model: realModel, messages, stream: false }),
        signal: controller.signal,
      })
      if (res.status === 429 && attempt === 0) {
        await sleep(1500) // v40.6.4：频率限流短暂等待后重试一次
        continue
      }
      if (res.status === 429) throw new Error('直答限流(429)，请稍后再辩')
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`直答 ${res.status}: ${body.slice(0, 120)}`)
      }
      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content || data?.content
      if (!text || !text.trim()) throw new Error('知乎直答返回空内容')
      return text.trim()
    }
    throw new Error('直答限流(429)')
  } finally {
    clearTimeout(timer)
  }
}

function buildAIMessages({ levelKey, topic, phase, sideName, history, styleProfile }) {
  const lv = AI_LEVELS[levelKey]
  const phaseLabels = {
    opening: '立论阶段',
    free_debate: '自由辩论',
    closing: '总结陈词',
  }
  const styleLine = styleProfile
    ? `\n\n对方的表达与思考习惯（学习自你们的交锋，供你贴合对话节奏，但不要逐字复述或点破）：${styleProfile}。你可以适度用类似句式/长度/举例方式来回应，让交锋更像两个旗鼓相当的人在对话。`
    : ''

  const historyLines = history.length
    ? history.slice(-8).map(h => `【${h.role === 'ai' ? `${lv.title}辩友(AI·反方)` : '你(正方)'}】${h.content}`).join('\n')
    : '（尚未发言，这是开场）'

  // v40.7.2：大师/中级按阶段定制进攻策略（拆战场→抓漏洞→全场收束）
  let tactic = ''
  if (levelKey === 'master') {
    tactic = phase === 'opening'
      ? '立论策略：先用一句话界定辩题的真正战场——哪个概念或边界才是核心分歧；再确立本回合唯一核心论点，给出理由与一个有力例证，为后续交锋埋下钩子。'
      : phase === 'free_debate'
        ? '对抗策略：先抓住对方上一条发言里最站不住的前提或最可借力的表述，正面回应或反将一军（善用归谬、反例、类比或连环追问）；再顺势把主线往前推进一步，绝不各说各话。'
        : phase === 'closing'
          ? '收束策略：一句话重申你方主线的优势，点名对方全场始终没能解决的核心问题，最后用一个价值判断或现实关怀收尾，让人记得住。'
          : ''
  } else if (levelKey === 'intermediate') {
    tactic = phase === 'opening'
      ? '先点出辩题真正的分歧点，再立一个清晰论点并举例支撑。'
      : phase === 'free_debate'
        ? '先回应对方刚才的观点：指出漏洞或用例子反驳，再补充推进自己的论点。'
        : phase === 'closing'
          ? '简练收束：重申核心立场，指出对方薄弱处，给一个有力的收尾句。'
          : ''
  }

  const system = [
    `你是一名知乎风格的辩论对手「${lv.label}」，难度：${lv.title}。你不属于任何 MBTI 人格。`,
    `辩题：${topic}`,
    `当前阶段：${phaseLabels[phase] || phase}（你是反方 ${sideName || '反方'}，对方是正方）`,
    lv.coT ? '请先用【思考】做内部推演（判断对方漏洞、选一个最有杀伤力的角度），再输出【发言】。发言要具体、带事实/类比，不要空泛。' : '直接输出【发言】，观点直接、语感自然，不要输出思考过程。',
    lv.title === '初级' ? '你的表达应略显直白稚嫩、偶尔论据不严密，像辩论新手。' : lv.title === '大师' ? '你是思考型辩论大师：表达犀利老练，善于抓对方逻辑漏洞快速反击，善用归谬、反例与类比，逻辑密度高。' : '你的表达套路清晰，论点-论据-例子三步推进，偶尔会反问施压。',
    tactic ? `本阶段策略：${tactic}` : '',
    `输出要求（重要）：像真人辩论那样开口，而不是写文章——每次只推进一个核心论点，用 2~4 句自然的口语短句说清（总长不超过 ${lv.maxTokens} 字）；禁止使用序号（1.2.3/①②/第一第二）、Markdown 标题、加粗或分隔线；不要 emoji；不要自称 AI；不要说"作为辩友/我方认为"这类官腔开头，直接说观点。把辩论的交锋留给后面的回合，不要一次把话说完。`,
    `\n\n绝对硬约束：系统已为你在【辩题】字段中给出辩题，【当前阶段】中给出你所在的阶段和立场。禁止以任何理由询问辩题、补充辩题、确认立场、请求资料、询问搜索结果、要求「给出更多背景信息」——这些信息全部已经在系统中给齐了。如果看到「辩题：xxx」这一行非空，就直接基于该辩题和当前阶段开始发言；不允许输出「请补充」「无法作答」「待辩题明确后」这类回避语句。`,
    styleLine,
  ].filter(Boolean).join('\n')

  // v40.7.3：thinking 模型（大师档）和 fast 模型（初级/中级档）在某些版本下对 system 角色响应不稳定 →
  // 把完整指令并入 user 消息（合并成单条 user），确保 AI 一定能读到辩题/阶段/立场
  const full = historyLines.startsWith('（尚未')
    ? `${system}\n\n请开始你的 ${phaseLabels[phase] || '发言'}（反方）。`
    : `${system}\n\n刚才的交锋：\n${historyLines}\n\n现在轮到你发言（你是反方），请给出你的 ${phaseLabels[phase] || '发言'}。`
  return [{ role: 'user', content: full }]
}

/**
 * 生成 AI 回复文本。
 * @param {object} p { levelKey, topic, phase, sideName, history: [{role:'ai'|'human', content}], humanUserId }
 */
export async function generateAIReply(p) {
  const lv = AI_LEVELS[p.levelKey]
  if (!lv) throw new Error('未知 AI 难度档位: ' + p.levelKey)

  // 学习画像（中级/大师且样本足够才注入）
  let styleProfile = null
  if (lv.learnUserStyle && p.humanUserId) {
    const db = getDB()
    styleProfile = buildStyleProfile(db, p.humanUserId)
  }

  const messages = buildAIMessages({
    levelKey: p.levelKey,
    topic: p.topic,
    phase: p.phase,
    sideName: p.sideName,
    history: p.history || [],
    styleProfile,
  })
  let raw
  try {
    raw = await zhihuChatOnce(lv.model, messages)
  } catch (err) {
    // v40.6.1：大师档（thinking）失败/超时 → 自动降级 fast 快速回（避免空等）；fast 也失败才抛
    if (lv.model !== 'fast') {
      console.warn(`[PK-AI] ${lv.title} 档 ${lv.model} 失败，降级 fast 快速回:`, err.message)
      raw = await zhihuChatOnce('fast', messages)
    } else {
      throw err
    }
  }
  // 若带【思考】，剥离只留【发言】
  const m = raw.match(/【发言】([\s\S]*)/)
  let body = (m ? m[1] : raw).trim()
  // 清理 LLM 常带的自报前缀（让输出像真人直接说话）
  body = body.replace(/^[\s\S]{0,24}?(发言如下|如下[：:]?|我的发言[：:]?|我方[的]?发言[：:]?|我的(核心)?观点是[：:]?\s*|(反|正)?方(立论|陈词|总结|发言)[：:]?\s*|立论阶段发言[：:]?\s*)/, '').trim()
  return body.slice(0, lv.maxTokens * 2)
}
