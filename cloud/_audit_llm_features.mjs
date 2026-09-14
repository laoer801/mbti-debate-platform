/**
 * 全功能 LLM 接线审计（线上实测 + 代码事实双证）
 *
 * 分类口径（以服务端源码为准，不靠猜）：
 *   LLM        = 该链路会 fetch 知乎直答 /v1/chat/completions（真生成）
 *   检索       = 调知乎检索类 API（搜索/热榜/用户内容）或本地数据库检索
 *   本地        = 纯本地模板/规则，不产生任何外部调用
 *
 * 实测部分只负责回答两个问题：① 端点通不通 ② 返回内容是否合理。
 *
 * 用法：node cloud/_audit_llm_features.mjs
 */
const BASE = process.env.BASE || 'http://47.114.35.97:3001'
const TAG = String(Date.now()).slice(-6)
const NONCE = `紫鲸悖论${TAG}`
const USER = `zaudit${TAG}`
const PW = 'ztest1234'

const rows = []
function rec(area, name, kind, ok, evidence) {
  rows.push({ area, name, kind, ok, evidence })
  const k = { LLM: '🟢 LLM  ', 检索: '🔵 检索 ', 本地: '🟡 本地 ', 配置: '⚪ 配置 ' }[kind] || '❓'
  console.log(`${k} ${ok ? '✓' : '✗'}  ${area.padEnd(11)} ${name.padEnd(24)} ${evidence}`)
}

async function req(method, p, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    const res = await fetch(BASE + p, { method, headers, body: body == null ? undefined : JSON.stringify(body) })
    const ct = res.headers.get('content-type') || ''
    const data = ct.includes('json') ? await res.json().catch(() => null) : await res.text()
    return { status: res.status, ok: res.ok, data }
  } catch (e) { return { status: 0, ok: false, data: String(e.message) } }
}
const str = (o) => typeof o === 'string' ? o : JSON.stringify(o)
const short = (s, n = 62) => String(s ?? '').replace(/\s+/g, ' ').slice(0, n)
const tidy = async (ms) => new Promise(r => setTimeout(r, ms))

console.log('════════════════════════════════════════════════════════════════════════════')
console.log(`  思辩星球 · 全功能 LLM 接线审计   ${BASE}`)
console.log(`  生僻探针：${NONCE}`)
console.log('════════════════════════════════════════════════════════════════════════════')
console.log('  分类口径：LLM=真调直答生成 ｜ 检索=检索API或数据库 ｜ 本地=纯模板/规则\n')

// ── 配置 ───────────────────────────────────────────────────
const st = await req('GET', '/api/zhihu/status')
rec('配置', 'LLM 总开关', '配置', !!st.data?.enabled, `enabled=${st.data?.enabled} fast/thk/agent=${Object.values(st.data?.models || {}).join('/')}`)

// ── AI 对话（LLM） ─────────────────────────────────────────
const chat = await req('POST', '/api/zhihu/chat', {
  model: 'zhida-fast-1p5', stream: false,
  messages: [{ role: 'user', content: `用一句话解释「${NONCE}」（虚构词，请说明你在推断）` }],
})
rec('对话 chat', '/api/zhihu/chat', 'LLM', !!chat.data?.id && !!chat.data?.model,
  `status=${chat.status} model=${chat.data?.model} reasoning=${!!chat.data?.reasoning} 「${short(chat.data?.content, 52)}」`)

// ── 知乎检索 ───────────────────────────────────────────────
const srch = await req('GET', `/api/zhihu/search?q=${encodeURIComponent(NONCE)}&count=3`)
rec('知乎检索', '/api/zhihu/search', '检索', srch.ok, `status=${srch.status} 「${short(str(srch.data), 46)}」`)
const hot = await req('GET', '/api/zhihu/hotlist')
rec('知乎检索', '/api/zhihu/hotlist', '检索', hot.ok,
  `status=${hot.status} 条数=${hot.data?.items?.length ?? (Array.isArray(hot.data) ? hot.data.length : '-')}`)

// ── 知识库 + MBTI 关联 ────────────────────────────────────
const profs = await req('GET', '/api/kb/profiles')
rec('知识库/MBTI', '/api/kb/profiles', '检索', profs.ok, `status=${profs.status} 人格数=${profs.data?.profiles?.length ?? '-'}`)
const sp = await req('GET', '/api/kb/profiles/INTJ/system-prompt')
rec('知识库/MBTI', 'INTJ 系统提示词', '检索', sp.ok, `status=${sp.status} len=${str(sp.data?.systemPrompt || sp.data).length}`)
const fs = await req('GET', '/api/kb/fewshots/INTJ/random')
rec('知识库/MBTI', 'INTJ few-shot', '检索', fs.ok && !!fs.data, `status=${fs.status} 「${short(str(fs.data?.examples?.[0]?.content ?? fs.data), 44)}」`)
const kbS = await req('GET', `/api/kb/search?q=${encodeURIComponent(NONCE)}&limit=3`)
rec('知识库/MBTI', '/api/kb/search', '检索', kbS.ok, `status=${kbS.status} 命中=${kbS.data?.results?.length ?? '-'}`)
const ckS = await req('POST', '/api/cloudkb/search', { query: NONCE, limit: 3 }, 'x')
rec('知识库/MBTI', '/api/cloudkb/search', '检索', ckS.ok, `status=${ckS.status} 「${short(str(ckS.data), 40)}」`)

// ── 大师 ───────────────────────────────────────────────────
const mt = await req('POST', '/api/master/analyze-topic', { topic: NONCE })
const mtKeys = mt.data && typeof mt.data === 'object' ? Object.keys(mt.data).join(',') : '-'
rec('大师', '/api/master/analyze-topic', '本地', mt.ok, `status=${mt.status} 返回字段=${mtKeys}`)
const mr = await req('POST', '/api/master/research', { topic: NONCE, useZhihu: true, count: 3 })
const mrKeys = mr.data && typeof mr.data === 'object' ? Object.keys(mr.data).join(',') : '-'
rec('大师', '/api/master/research', '检索', mr.ok, `status=${mr.status} 返回字段=${mrKeys} enabled=${mr.data?.research?.enabled ?? mr.data?.enabled ?? '-'}`)
const mrev = await req('POST', '/api/master/review', { topic: NONCE, messages: [{ role: 'user', content: `${NONCE} 的意思是说` }] })
rec('大师', '/api/master/review', '本地', mrev.ok, `status=${mrev.status} 「${short(str(mrev.data?.feedback ?? mrev.data), 44)}」`)
const mtip = await req('POST', '/api/master/tip', { stage: 'opening', typeId: 'INTJ', topic: NONCE })
rec('大师', '/api/master/tip', '本地', mtip.ok, `status=${mtip.status} 「${short(str(mtip.data?.tip ?? mtip.data), 44)}」`)

// ── 圆桌辩论 ───────────────────────────────────────────────
const d1 = await req('POST', '/api/debate/respond', { typeId: 'INTJ', topic: NONCE, history: [] })
rec('圆桌辩论', '/api/debate/respond', '本地', d1.ok, `status=${d1.status} 「${short(d1.data?.content, 46)}」`)
const d2 = await req('POST', '/api/debate/round', { topic: NONCE, participants: ['INTJ', 'ENFP'], history: [] })
rec('圆桌辩论', '/api/debate/round', '本地', d2.ok, `status=${d2.status} 发言数=${d2.data?.responses?.length ?? '-'}`)

// ── 注册测试号 ─────────────────────────────────────────────
let reg = await req('POST', '/api/auth/register', { username: USER, password: PW, mbtiType: 'INTJ' })
if (!reg.ok) reg = await req('POST', '/api/auth/login', { username: USER, password: PW })
const token = reg.data?.token, uid = reg.data?.user?.id
const cleanup = []
console.log(`\n  · 测试账号 ${USER} → ${uid ? uid.slice(0, 8) : '失败'}`)

// ── 社区广场（本地模板） ───────────────────────────────────
if (uid) {
  const post = await req('POST', '/api/posts', { title: `审计帖 ${TAG}`, content: `关于「${NONCE}」的看法`, tags: ['审计'] }, token)
  const pid = post.data?.post?.id || post.data?.id
  if (pid) { cleanup.push({ t: 'post', id: pid }); await tidy(13000) }
  const d = await req('GET', `/api/posts/${pid}`)
  const ai = (d.data?.comments || []).filter(c => c.is_ai)
  const hit = ai.some(c => String(c.content).includes(NONCE))
  // v40.8.2 起：社区广场 AI 回复改走 LLM（模板仅兜底）→ 提及探针即证明走了 LLM
  rec('社区广场', '发帖后 AI 回复', 'LLM', ai.length > 0 && hit,
    `AI 回复 ${ai.length} 条，提及探针=${hit} 「${short(ai[0]?.content, 40)}」`)
}

// ── PK：AI 对手发言（LLM） ─────────────────────────────────
if (uid) {
  const mk = await req('POST', '/api/pk/ai/create', { userId: uid, level: 'beginner', topic: `关于「${NONCE}」的讨论` })
  const rid = mk.data?.room?.id
  if (rid) {
    cleanup.push({ t: 'room', id: rid })
    await req('POST', `/api/pk/${rid}/phase`, { phase: 'preparation', userId: uid })
    await tidy(22000) // 8s 自动推进 opening + 3.5s kickoff + LLM 生成
    const d = await req('GET', `/api/pk/${rid}`)
    // ⚠️ 该接口返回 camelCase：userId（不是 user_id）
    const aiMoves = (d.data?.moves || []).filter(m => String(m.userId || m.user_id || '').startsWith('ai__'))
    const hit = aiMoves.some(m => String(m.content).includes(NONCE))
    rec('PK 对战', 'AI 对手发言', 'LLM', aiMoves.length > 0,
      `AI 发言 ${aiMoves.length} 条，围绕探针生成=${hit} 「${short(aiMoves[0]?.content, 40)}」`)
  } else {
    rec('PK 对战', 'AI 对手发言', 'LLM', false, `建房失败 ${short(str(mk.data), 40)}`)
  }
}

// ── 汇总 ───────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════════════════════════════════')
const okN = rows.filter(r => r.ok).length
console.log(`  端点实测：${okN} / ${rows.length} 通过`)
const bad = rows.filter(r => !r.ok)
if (bad.length) { console.log('\n  ❌ 未通过:'); bad.forEach(r => console.log(`     ${r.area}/${r.name} — ${r.evidence}`)) }
console.log('\n  🟢 真·LLM 生成:')
;[...new Set(rows.filter(r => r.kind === 'LLM').map(r => r.name))].forEach(n => console.log(`     ${n}`))
console.log('\n  🟡 纯本地模板/规则（未调 LLM）:')
;[...new Set(rows.filter(r => r.kind === '本地').map(r => r.name))].forEach(n => console.log(`     ${n}`))
console.log('\n  🔵 检索类（知乎检索 API / 本地库）:')
;[...new Set(rows.filter(r => r.kind === '检索').map(r => r.name))].forEach(n => console.log(`     ${n}`))
if (cleanup.length) console.log('\n  待清理: ' + cleanup.map(c => `${c.t}=${c.id}`).join(' '))
console.log('════════════════════════════════════════════════════════════════════════════')
