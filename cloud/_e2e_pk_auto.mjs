/**
 * v40.8 PK 自动模式验收：AI 房服务端自动推进
 *
 * 验证：
 *   1) POST /phase preparation 后，服务端在 8s 后**自动**推进到 opening（无需再调 /phase）
 *   2) opening 的 AI kickoff（3.5s）自动产生发言，且以 new-move 广播（前端能收到）+ pet-battle
 *   3) （长跑模式）自由辩论自循环 → closing → judging → 自动裁判 + 总结 → finished
 *   4) 退房后定时器被清理（房间不再变化）
 *
 * 用法：
 *   node cloud/_e2e_pk_auto.mjs            # 快检（约 25s，验证 1/2/4）
 *   WATCH=420 node cloud/_e2e_pk_auto.mjs  # 长跑（约 7min，验证全链路含自动裁判）
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_DIR = process.env.CLIENT_DIR || path.resolve(__dirname, '..', 'client')
const require = createRequire(path.join(CLIENT_DIR, 'noop.js'))
const { io } = require('socket.io-client')

const BASE = process.env.BASE || 'http://47.114.35.97:3001'
const TAG = process.env.TAG || String(Date.now()).slice(-6)
const USER = `zauto${TAG}`
const PW = 'ztest1234'
const WATCH_MS = Number(process.env.WATCH || 0)

let pass = 0, fail = 0
const fails = []
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; fails.push(name); console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function api(method, p, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + p, { method, headers, body: body == null ? undefined : JSON.stringify(body) })
  const ct = res.headers.get('content-type') || ''
  return { status: res.status, ok: res.ok, data: ct.includes('json') ? await res.json().catch(() => null) : await res.text() }
}

console.log('═══════════════════════════════════════════════════════════')
console.log(`  v40.8 PK 自动模式验收  BASE=${BASE}`)
console.log(`  测试账号: ${USER}${WATCH_MS ? `  长跑 ${Math.round(WATCH_MS / 1000)}s` : '  快检'}`)
console.log('═══════════════════════════════════════════════════════════')

let sock, user, roomId
const created = { users: [], rooms: [] }

try {
  // ── 建号 ───────────────────────────────────────────────────
  let r = await api('POST', '/api/auth/register', { username: USER, password: PW, mbtiType: 'INTJ' })
  if (!r.ok) r = await api('POST', '/api/auth/login', { username: USER, password: PW })
  check('测试账号就绪', r.ok && !!r.data?.token, `role=${r.data?.user?.role}`)
  user = r.data.user
  created.users.push(user.id)

  // ── 建 AI 房 ───────────────────────────────────────────────
  console.log('\n[1] 创建 AI 对战房')
  const mk = await api('POST', '/api/pk/ai/create', { userId: user.id, level: 'beginner', topic: `自动模式验收辩题 ${TAG}` })
  roomId = mk.data?.room?.id
  created.rooms.push(roomId)
  check('AI 房创建成功', mk.ok && !!roomId, `room=${roomId} 对手=${mk.data?.opponent?.label}`)
  check('初始阶段为 waiting', mk.data?.room?.current_phase === 'waiting', `phase=${mk.data?.room?.current_phase}`)

  // ── 连 socket ──────────────────────────────────────────────
  sock = await new Promise((resolve, reject) => {
    const s = io(BASE, { transports: ['websocket'], reconnection: true, timeout: 15000 })
    const t = setTimeout(() => reject(new Error('socket 超时')), 20000)
    s.on('connect', () => { clearTimeout(t); s.emit('identify', { token: r.data.token }); s.emit('join-room', roomId); resolve(s) })
    s.on('connect_error', (e) => { clearTimeout(t); reject(new Error(e.message)) })
  })
  console.log(`  · socket 已连接 ${sock.id}`)

  const moves = []
  const battles = []
  const phases = []
  sock.on('new-move', (m) => moves.push(m))
  sock.on('pet-battle', (b) => battles.push(b))
  sock.on('phase-changed', (p) => phases.push(p))
  await sleep(500)

  // ── 触发第一次切阶段（客户端本来就会做这一步） ─────────────
  console.log('\n[2] 触发 preparation，观察服务端是否自动推进')
  const p1 = await api('POST', `/api/pk/${roomId}/phase`, { phase: 'preparation', userId: user.id })
  check('preparation 切换成功（AI 房 8s）', p1.ok && p1.data?.duration === 8, `duration=${p1.data?.duration}s`)

  const t0 = Date.now()
  let autoPhase = null
  for (let i = 0; i < 40; i++) {
    await sleep(1000)
    const st = await api('GET', `/api/pk/${roomId}`)
    const ph = st.data?.room?.current_phase
    if (ph && ph !== 'preparation') { autoPhase = ph; break }
  }
  const elapsed = Math.round((Date.now() - t0) / 1000)
  check('服务端自动推进（未再调 /phase）', autoPhase === 'opening', `${elapsed}s 后 → ${autoPhase}`)
  check('收到 phase-changed 广播', phases.some(p => p.phase === 'opening'), `共 ${phases.length} 次`)

  // ── AI kickoff 自动发言 ────────────────────────────────────
  console.log('\n[3] opening 阶段 AI 自动 kickoff')
  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    if (moves.some(m => String(m.userId || '').startsWith('ai__'))) break
  }
  const aiMoves = moves.filter(m => String(m.userId || '').startsWith('ai__'))
  check('AI 自动发言（new-move 广播）', aiMoves.length > 0,
    aiMoves.length ? `${aiMoves.length} 条，例「${String(aiMoves[0].content).slice(0, 20)}…」` : '未收到')
  check('AI 发言字段完整（前端可渲染）', aiMoves.length === 0 ? false : !!(aiMoves[0].username && aiMoves[0].side !== undefined && aiMoves[0].phase),
    aiMoves.length ? `username=${aiMoves[0].username} side=${aiMoves[0].side} phase=${aiMoves[0].phase}` : '-')
  check('AI 发言附带宠物结算 pet-battle', battles.length > 0, `${battles.length} 次`)

  // ── 长跑：全链路（可选） ───────────────────────────────────
  if (WATCH_MS > 0) {
    console.log(`\n[4] 长跑 ${Math.round(WATCH_MS / 1000)}s，观察自动推进全链路`)
    const seen = new Set(phases.map(p => p.phase))
    const start = Date.now()
    while (Date.now() - start < WATCH_MS) {
      await sleep(5000)
      const st = await api('GET', `/api/pk/${roomId}`)
      const ph = st.data?.room?.current_phase
      seen.add(ph)
      console.log(`   t+${Math.round((Date.now() - start) / 1000)}s  phase=${ph}  moves=${moves.length}`)
      if (ph === 'finished') break
    }
    const final = await api('GET', `/api/pk/${roomId}`)
    check('全链路走到 finished', final.data?.room?.current_phase === 'finished', `phase=${final.data?.room?.current_phase}`)
    check('自动裁判已落库（judgeResult）', !!final.data?.judgeResult,
      final.data?.judgeResult ? `winner=${final.data?.judgeResult?.winner_id ? String(final.data.judgeResult.winner_id).slice(0, 8) + '…' : '未分'}` : '无')
    check('整场发言已沉淀', (final.data?.moves?.length ?? 0) > 3, `moves=${final.data?.moves?.length}`)
    check('经验过的阶段数 ≥5', seen.size >= 5, `[${[...seen].join(', ')}]`)
  }

  // ── 退房 → 定时器清理 ──────────────────────────────────────
  console.log('\n[5] 退房后确认不再自动推进')
  const beforeLeave = (await api('GET', `/api/pk/${roomId}`)).data?.room?.current_phase
  const lv = await api('POST', `/api/pk/${roomId}/leave`, { userId: user.id })
  check('退房成功', lv.ok, `status=${lv.status}`)
  await sleep(3000)
  const after1 = await api('GET', `/api/pk/${roomId}`)
  const afterPhase = after1.data?.room?.current_phase
  // 未结束的对局退房会重置回 waiting；已 finished 的保持 finished；空房可能被删（404）
  check('退房后不再继续自动推进',
    after1.status === 404 || afterPhase === 'waiting' || afterPhase === beforeLeave || afterPhase === 'finished',
    `退房前=${beforeLeave} → 退房后=${afterPhase ?? '(已删除)'}`)
} catch (e) {
  fail++; fails.push('脚本异常: ' + e.message)
  console.log(`\n  ❌ 脚本异常: ${e.message}`)
} finally {
  try { sock?.disconnect() } catch {}
}

console.log('\n═══════════════════════════════════════════════════════════')
console.log(`  结果: ${pass} 通过 / ${fail} 失败`)
if (fails.length) console.log(`  失败项: ${fails.join(' | ')}`)
console.log(`  清理用 → 用户: ${created.users.join(', ')}  房间: ${created.rooms.filter(Boolean).join(', ')}`)
console.log('═══════════════════════════════════════════════════════════')
process.exit(fail ? 1 : 0)
