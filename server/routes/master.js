/**
 * v40.2 辩论大师路由
 *
 * 端点：
 *   POST /api/master/analyze-topic  审题（核心争点 / 隐藏假设 / 双方骨架）
 *   POST /api/master/research        资料包（关键词 + 推荐检索）
 *   POST /api/master/tip             单次赛中提示（按 stage + history 输出 toTypeId 的 tipText）
 *   POST /api/master/review          赛后复盘（关键转折、失误、可学习论点）
 *
 * 借鉴 aquatiko/agent-debate 的 Moderator 角色设计
 *
 * 注意：本路由不强依赖 LLM；如果 LLM 未配则返回基于规则的结构化输出（避免断裂）。
 */

import { Router } from 'express'
import { getDB } from '../db.js'
import { zhihuEnabled, zhihuFetch, ZH_BASE_SEARCH } from '../zhihu.js'

export const masterRoutes = Router()

// 简单的关键词 → 议题类别映射（heuristic）
const TOPIC_KEYWORDS = {
  ai: ['AI', '人工智能', '算法', '机器学习', '深度学习', 'GPT', '大模型'],
  ethics: ['道德', '伦理', '隐私', '歧视', '公正', '自由', '权利'],
  social: ['社会', '人类', '人类命运', '文明', '民主', '制度'],
  work: ['工作', '996', '远程办公', '内卷', '躺平', '失业'],
  tech: ['技术', '互联网', '代码', '区块链', '元宇宙', 'Web3'],
  life: ['人生', '生活', '关系', '婚姻', '教育', '孩子'],
  philosophy: ['存在', '意识', '自由意志', '意义', '虚无', '死亡'],
  environment: ['气候', '环境', '碳排放', '生态', '可持续'],
}

// 段落/话题骨架模板
const PRO_SKELETON = (topic, hints) => [
  `核心论题：${topic}`,
  `关键假设：${hints.assumptions[0] || '人是被理性驱动的'} → 主张方把它作为隐含前提`,
  `支持论据 1：经验/历史类比`,
  `支持论据 2：数据/案例`,
  `反驳路径：如被问「但是不是 X 反而更好」，回到论据 1`,
]
const CON_SKELETON = (topic, hints) => [
  `核心论题：${topic}`,
  `关键假设：${hints.assumptions[1] || '人是被情境驱动的'} → 反对方把它作为隐含前提`,
  `反对论据 1：现实代价`,
  `反对论据 2：可能滑坡`,
  `反驳路径：如被问「所以应该怎么办」，提出替代方案`,
]

function detectCategory(topic = '') {
  const t = topic.toLowerCase()
  for (const [cat, kws] of Object.entries(TOPIC_KEYWORDS)) {
    if (kws.some(k => t.includes(k.toLowerCase()))) return cat
  }
  return 'other'
}

masterRoutes.post('/analyze-topic', (req, res) => {
  try {
    const { topic } = req.body || {}
    if (!topic) return res.status(400).json({ error: 'topic 必填' })
    const category = detectCategory(topic)

    // 提取可能命题（粗糙：用"是否""能不能""该不该"等关键词判定是是非题）
    const isYesNo = /(是否|能不能|该不该|会不会|该不该|该不该)/.test(topic)
    const assumptions = [
      `问题情境中存在两种对立的价值取向`,
      `这个判断在短期可见，可被验证或推翻`,
    ]

    res.json({
      ok: true,
      analysis: {
        topic,
        category,
        isYesNo,
        coreTheme: `${category} 类辩题 · 核心争点通常是"取舍 + 边界 + 后果预测"`,
        hiddenAssumptions: assumptions,
        proSkeleton: PRO_SKELETON(topic, { assumptions }),
        conSkeleton: CON_SKELETON(topic, { assumptions }),
        recommendedTypes: {
          analyst: ['INTJ', 'ENTP'], // 逻辑+智趣
          diplomat: ['INFJ', 'ENFJ'], // 价值+人心
          sentinel: ['ISTJ', 'ESTJ'], // 数据+规则
          explorer: ['ISTP', 'ESTP'], // 行动+现实
        }[category === 'philosophy' ? 'diplomat'
          : category === 'work' || category === 'tech' ? 'analyst'
          : category === 'social' || category === 'ethics' ? 'diplomat'
          : category === 'environment' ? 'sentinel'
          : 'analyst'],
        advice: '建议阵容：正方 1 逻辑 + 1 共情，反方 1 创新 + 1 务实。',
      },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

masterRoutes.post('/research', async (req, res) => {
  try {
    const { topic, sides = ['pro', 'con'], useZhihu = true, count = 5 } = req.body || {}
    if (!topic) return res.status(400).json({ error: 'topic 必填' })
    const category = detectCategory(topic)

    // 给关键词包 + 推荐检索（来源：本地 knowledge_base + 用户上传资料 + 公网搜索建议）
    const keywords = TOPIC_KEYWORDS[category] || []

    const proSearchQueries = [
      `${topic} 数据支持 ${category}`,
      `${topic} 案例研究`,
      `${topic} 历史先例`,
    ]
    const conSearchQueries = [
      `${topic} 反对案例`,
      `${topic} 现实代价`,
      `${topic} 替代方案`,
    ]

    // 用 v40+ 知乎全网搜索：真去取资料（zhihuEnabled 才用，否则只返回骨架）
    let zhihuResults = { pro: [], con: [] }
    if (useZhihu && zhihuEnabled()) {
      try {
        const [proRes, conRes] = await Promise.allSettled([
          zhihuFetch(ZH_BASE_SEARCH, { method: 'GET', params: { Query: `${topic} ${proSearchQueries[0]}`, Count: count } }),
          zhihuFetch(ZH_BASE_SEARCH, { method: 'GET', params: { Query: `${topic} ${conSearchQueries[0]}`, Count: count } }),
        ])
        zhihuResults.pro = proRes.status === 'fulfilled'
          ? (proRes.value?.Data?.Items || []).map(mapZhihuItem).slice(0, count)
          : []
        zhihuResults.con = conRes.status === 'fulfilled'
          ? (conRes.value?.Data?.Items || []).map(mapZhihuItem).slice(0, count)
          : []
      } catch (e) {
        console.warn('知乎 research fallback:', e.message)
      }
    }

    res.json({
      ok: true,
      research: {
        topic,
        category,
        coreConcepts: keywords.slice(0, 6),
        proSearchQueries,
        conSearchQueries,
        sourceHint: '本地：news_articles + user 上传；云端：lexiang-knowledge-base + 知乎全网搜索',
        // 新增：来自知乎的真实资料（前端拿到可以注入到 LLM prompt 中）
        zhihu: zhihuResults,
        enriched: zhihuResults.pro.length + zhihuResults.con.length > 0,
      },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

function mapZhihuItem(it) {
  return {
    title: it.Title,
    contentType: it.ContentType,
    snippet: (it.ContentText || '').replace(/<[^>]+>/g, '').slice(0, 280),
    url: it.Url,
    author: it.AuthorName,
    voteUp: it.VoteUpCount,
    commentCount: it.CommentCount,
    authorityLevel: it.AuthorityLevel,
    editTime: it.EditTime,
  }
}

masterRoutes.post('/tip', (req, res) => {
  try {
    const { stage, typeId, topic, history } = req.body || {}
    if (!stage || !typeId || !topic) return res.status(400).json({ error: 'stage/typeId/topic 必填' })
    // 简单 tip 模板（按 stage × typeId 派生）
    const tips = {
      opening: {
        INTJ: '把 4 步论证（观点-依据-比方-结论）压缩到 80 字，给对手留思考空间',
        ENTP: '开口先放反讽，设置一个悬念——避免一开始就铺观点',
        ENFP: '用一个小故事开场，比逻辑开场更有感染力',
        ISTJ: '摆出 1-2 个数据/案例，比抽象论证更可信',
        default: '定位立场要清晰，避免被对手抢先定义核心论题',
      },
      cross: {
        INTJ: '抓住对方论证的隐藏假设，拆完继续要反例',
        ENTP: '故意当坏人，指出对方最薄弱的环节',
        ENFP: '问一个"对方没想过的角度"，让对方主动暴露盲点',
        ISTJ: '核对对方引用的事实/数据是否准确',
        default: '回应要"先认同再反驳"，避免陷入情绪对峙',
      },
      free: {
        INTJ: '避免连续三段都是抽象推理，插入一个具体例子',
        ENTP: '可以主动让步一个小论点，换取对方核心立场的退让',
        ENFP: '注意保持热情但不要跑题，每 3 段回到核心',
        ISTJ: '不要重复数据，重点回答"所以呢"',
        default: '避免重复论点，每个阶段推进新维度',
      },
      closing: {
        INTJ: '一句封喉 + 1 条可操作的建议',
        ENTP: '留一个开放性的悖论，让评委回味',
        ENFP: '收回一句金句，将全场情绪推上顶点',
        ISTJ: '用 3 条数据 + 1 条结论收束',
        default: '避免在结束时引出新论题 —— 留 30 秒回顾全场',
      },
    }
    const stageTips = tips[stage] || tips.opening
    const tipText = stageTips[typeId] || stageTips.default

    res.json({
      ok: true,
      tip: {
        stage,
        toTypeId: typeId,
        tipText,
        severity: stage === 'closing' ? 'info' : 'tip',
        meta: {
          historyLength: Array.isArray(history) ? history.length : 0,
          topicBrief: topic.length > 30 ? topic.slice(0, 30) + '…' : topic,
        },
      },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

masterRoutes.post('/review', (req, res) => {
  try {
    const { sessionId, messages, rubricVersion } = req.body || {}
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages 必填' })
    const db = getDB()

    // 用 judge 的启发式评分器
    const scores = heuristicReviewer(messages)

    // 关键转折：找"被反复引用的话"
    const refCount = new Map()
    for (const m of messages) {
      if (typeof m.content !== 'string') continue
      const quoted = m.content.match(/「([^」]+)」/g) || []
      for (const q of quoted) {
        const cleaned = q.replace(/[「」]/g, '').slice(0, 30)
        refCount.set(cleaned, (refCount.get(cleaned) || 0) + 1)
      }
    }
    const turningPoints = [...refCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([text, n]) => ({
      refCount: n,
      quote: text,
    }))

    // 失误识别：找攻击性词过多的发言
    const mistakes = []
    for (const m of messages) {
      if (typeof m.content !== 'string') continue
      const attacks = (m.content.match(/你错了|你蠢|闭嘴|可笑|白痴/g) || []).length
      if (attacks > 0) mistakes.push({ typeId: m.typeId, content: m.content.slice(0, 60), attacks })
    }

    // 用户上传内容学习到的引用
    const dbCitations = db.prepare(`
      SELECT DISTINCT ref_text FROM user_citations
      WHERE session_id = ? LIMIT 5
    `).all(sessionId || '_none_')

    res.json({
      ok: true,
      review: {
        sessionId,
        scores,
        turningPoints,
        mistakes,
        citationsUsed: dbCitations.map(c => c.ref_text),
        highlights: [
          turningPoints.length > 0 ? `关键转折是「${turningPoints[0].quote}」(被引用 ${turningPoints[0].refCount} 次)` : null,
          mistakes.length > 0 ? `${mistakes[0].typeId} 的攻击性过强，影响说服力` : null,
          scores[0] ? `${scores[0].name} 本场最佳，注意其策略可迁移` : null,
        ].filter(Boolean),
      },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

function heuristicReviewer(messages) {
  // 与 judge.js 的启发式评分一致的简化版
  const byType = {}
  for (const m of messages) {
    if (m.isUser || !m.typeId) continue
    if (!byType[m.typeId]) byType[m.typeId] = { name: m.typeName, msgs: [] }
    byType[m.typeId].msgs.push(m)
  }
  const scores = []
  for (const [typeId, data] of Object.entries(byType)) {
    const text = data.msgs.map(m => m.content).join(' ')
    const logicMarks = (text.match(/因为|所以|因此/g) || []).length
    const rebuttalMarks = (text.match(/反驳|不同意|漏洞|站不住/g) || []).length
    const total = Math.min(100, 40 + logicMarks * 4 + rebuttalMarks * 4 + (data.msgs.length > 2 ? 8 : 0))
    scores.push({ typeId, name: data.name, total, msgCount: data.msgs.length })
  }
  return scores.sort((a, b) => b.total - a.total)
}
