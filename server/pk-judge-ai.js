/**
 * v40.6.4 PK 客观 AI 裁判
 *
 * 取代「关键词计数」启发式：由知乎直答按固定维度评分，
 * 每个维度必须引用选手原话作为打分依据（可解释、可复核 → 客观），
 * 输出专业复盘报告。与旧 judgeDebate 返回结构对齐，前端零改动：
 *   { players, results:[{userId, username, total, scores{logic,evidence,eloquence,rebuttal,etiquette}}], winner, winnerName, feedback }
 *
 * 调用失败向上抛，由 judge 路由回退启发式（保证流程不中断）。
 */

const DIM_WEIGHTS = { logic: 0.30, evidence: 0.25, eloquence: 0.20, rebuttal: 0.15, etiquette: 0.10 }

function buildJudgePrompt(room, participants, moves) {
  const sideName = p => (p.side === 'pro' ? '正方' : '反方')
  const texts = moves.map(m => {
    const u = participants.find(p => p.user_id === m.user_id)
    return `【${u?.username || m.user_id}（${sideName(u || { side: '?' })}）】${m.content}`
  }).join('\n\n')

  const players = participants.map(p => `${p.username}（${sideName(p)}）`)
  const scoredPlayers = participants.filter(p => moves.some(m => m.user_id === p.user_id))

  return [
    '你是一名资深、公正的辩论裁判。请基于下面这场辩论的完整发言记录，做客观评分。',
    '',
    `辩题：${room.topic}`,
    `选手：${players.join(' vs ')}`,
    '',
    '## 评分规则（必须逐条遵守）',
    '1. 对【实际发言过的】每位选手，按 5 个固定维度打分，每维 0–100 整数：',
    '   - logic 逻辑性：论证是否因果清晰、前后自洽，无逻辑跳跃/循环论证',
    '   - evidence 论据质量：是否有事实/数据/案例/公认常识支撑，而非空泛断言',
    '   - eloquence 语言表达：是否清晰、有力、有条理，句子是否完整自然',
    '   - rebuttal 反驳能力：是否正面回应对手观点并指出其漏洞，还是自说自话',
    '   - etiquette 礼仪风度：是否尊重对手；出现人身攻击/侮辱时本维最高 30 分',
    '2. 每个维度的分数必须有据可依：在 reason 中引用该选手发言原文（可截取）证明分数，不得臆测或虚构。',
    '3. 选手用其唯一身份标识 side（pro=正方 / con=反方）指代；JSON 中 userId 字段填写该选手的 side 字符串（如 "pro"），禁止编造其它 ID。',
    '4. 综合分 total = logic*0.30 + evidence*0.25 + eloquence*0.20 + rebuttal*0.15 + etiquette*0.10（四舍五入整数）。',
    '5. winnerUserId = 综合分更高者的 side（如 "pro"）。',
    '6. 只输出一个 JSON 对象，不要输出其它文字。',
    '',
    '## JSON 输出格式',
    '{',
    '  "results": [{ "userId": "pro或con", "total": 0,',
    '     "scores": { "logic": 0, "evidence": 0, "eloquence": 0, "rebuttal": 0, "etiquette": 0 },',
    '     "dimNotes": [{ "key": "logic", "score": 0, "reason": "引用的原话与理由" }] }],',
    '  "winnerUserId": "pro或con",',
    '  "review": {',
    '    "winnerStrongPoints": ["..."],',
    '    "loserImprovements": ["..."],',
    '    "keyClash": "整场最关键的攻防交锋小结"',
    '  }',
    '}',
    '',
    '## 发言记录',
    texts,
  ].join('\n')
}

async function zhihuJudgeOnce(messages) {
  const { zhihuEnabled, ZH_BASE_CHAT, ZH_MODEL_FAST, ZHIHU_ACCESS_SECRET } = await import('./zhihu.js')
  if (!zhihuEnabled()) throw new Error('知乎直答未启用')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  try {
    // 429（频率限流）时自动等待后重试 1 次
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(ZH_BASE_CHAT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ZHIHU_ACCESS_SECRET}`,
          'X-Request-Timestamp': `${Math.floor(Date.now() / 1000)}`,
        },
        body: JSON.stringify({ model: ZH_MODEL_FAST, messages, stream: false }),
        signal: controller.signal,
      })
      if (res.status === 429 && attempt === 0) {
        await sleep(1500)
        continue
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`直答 ${res.status}: ${body.slice(0, 120)}`)
      }
      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content || data?.content
      if (!text || !text.trim()) throw new Error('直答返回空内容')
      return text.trim()
    }
    throw new Error('直答限流(429)')
  } finally {
    clearTimeout(timer)
  }
}

/**
 * AI 客观裁判。
 * @returns 与旧 judgeDebate 对齐的结构；任何失败 throw（调用方回退启发式）。
 */
export async function aiJudgeDebate(room, participants, moves) {
  // 只取最近若干条发言（控制 prompt 长度，防止超时/超长），并保证两端都有代表内容
  const recent = (moves || []).slice(-14)
  const prompt = buildJudgePrompt(room, participants, recent)
  const raw = await zhihuJudgeOnce([
    { role: 'system', content: '你是专业辩论裁判，只依据发言记录客观评分，禁止虚构发言内容。' },
    { role: 'user', content: prompt },
  ])

  // 提取首个 JSON 对象（鲁棒：兼容 ```json 包裹）
  let parsed = null
  const jsonMatch = raw.replace(/```json/gi, '').replace(/```/g, '').match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try { parsed = JSON.parse(jsonMatch[0]) } catch { /* fallthrough */ }
  }
  if (!parsed || !Array.isArray(parsed.results) || parsed.results.length === 0) {
    throw new Error('裁判 JSON 解析失败')
  }

  const sideName = p => (p.side === 'pro' ? '正方' : '反方')
  const bySide = {}
  participants.forEach(p => { bySide[p.side] = { userId: p.user_id, username: p.username, side: p.side } })

  const results = parsed.results
    .map(r => {
      const side = String(r.userId || '').toLowerCase() === 'con' ? 'con' : 'pro'
      const owner = bySide[side]
      if (!owner) return null
      const s = r.scores || {}
      const total = Math.round(
        (Number(s.logic) || 0) * DIM_WEIGHTS.logic +
        (Number(s.evidence) || 0) * DIM_WEIGHTS.evidence +
        (Number(s.eloquence) || 0) * DIM_WEIGHTS.eloquence +
        (Number(s.rebuttal) || 0) * DIM_WEIGHTS.rebuttal +
        (Number(s.etiquette) || 0) * DIM_WEIGHTS.etiquette
      )
      return {
        userId: owner.userId,
        username: owner.username,
        mbtiType: null,
        side,
        total,
        scores: {
          logic: Math.max(0, Math.min(100, Math.round(Number(s.logic) || 0))),
          evidence: Math.max(0, Math.min(100, Math.round(Number(s.evidence) || 0))),
          eloquence: Math.max(0, Math.min(100, Math.round(Number(s.eloquence) || 0))),
          rebuttal: Math.max(0, Math.min(100, Math.round(Number(s.rebuttal) || 0))),
          etiquette: Math.max(0, Math.min(100, Math.round(Number(s.etiquette) || 0))),
        },
        dimNotes: r.dimNotes || [],
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total)

  if (results.length === 0) throw new Error('裁判结果为空')
  // winnerUserId 来自模型的 side 值；直接以综合分最高的为准（客观、可复核）
  const winner = results[0]
  const loser = results.find(r => r.userId !== winner.userId)
  const rv = parsed.review || {}

  // 组装专业复盘报告（markdown）
  const dimLabels = { logic: '逻辑性', evidence: '论据质量', eloquence: '语言表达', rebuttal: '反驳能力', etiquette: '礼仪风度' }
  const lines = []
  lines.push(`# 🏆 PK 裁判报告 · ${winner.username} 获胜`)
  lines.push('')
  lines.push(`**辩题**：${room.topic}`)
  lines.push('')
  lines.push('## 📊 综合评分（客观维度 × 权重）')
  results.forEach((p, i) => {
    const medal = i === 0 ? '🥇' : '🥈'
    lines.push(`${medal} **${p.username}**（${sideName(p)}）：总分 **${p.total}**`)
  })
  results.forEach(p => {
    lines.push('')
    lines.push(`### ${p.username} · 总分 ${p.total}`)
    const notesByKey = {}
    ;(p.dimNotes || []).forEach(n => { notesByKey[n.key] = n })
    for (const key of Object.keys(DIM_WEIGHTS)) {
      const score = p.scores[key]
      const note = notesByKey[key]
      lines.push(`- **${dimLabels[key]}** ${score}/100${note?.reason ? `｜依据：${note.reason}` : ''}`)
    }
  })
  lines.push('')
  lines.push('## ⚔️ 关键攻防')
  lines.push(rv.keyClash || '（无）')
  if (winner && Array.isArray(rv.winnerStrongPoints) && rv.winnerStrongPoints.length) {
    lines.push('')
    lines.push(`## ✨ ${winner.username} 的胜点`)
    rv.winnerStrongPoints.forEach(t => lines.push(`- ${t}`))
  }
  if (loser && Array.isArray(rv.loserImprovements) && rv.loserImprovements.length) {
    lines.push('')
    lines.push(`## 📈 给 ${loser.username} 的提升建议`)
    rv.loserImprovements.forEach(t => lines.push(`- ${t}`))
  }
  lines.push('')
  lines.push('🎁 胜者获得 **30积分**，可用于宠物商城！')

  return {
    players: results,
    results,
    winner: winner.userId,
    winnerName: winner.username,
    feedback: lines.join('\n'),
  }
}
