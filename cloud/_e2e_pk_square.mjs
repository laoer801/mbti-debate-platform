/**
 * 云端端到端并发验证：真人匹配 PK + 社区广场
 *
 * 覆盖：
 *   1. 两个账号同时注册/登录 → 两个 socket 同时在线（云端多人并发）
 *   2. presence：/api/stats/online 能看到 2 人
 *   3. 真人匹配：quick-match 返回的房间必须是「新鲜房」（回归 v40.7.1 废弃房吸人 bug）
 *   4. 确定性双人同房：A 建房 → B 加入 → 房间里 2 名真人
 *   5. 实时对战：A 发言 → B 通过 socket 收到 new-move / pet-battle；反向同理
 *   6. 社区广场：A 发帖 → B 列表可见 → B 点赞+评论 → A 详情可见
 *   7. 清理：退房
 *
 * 用法（复用 client 里的 socket.io-client，无需额外安装）：
 *   node cloud/_e2e_pk_square.mjs
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ESM 的 import 不认 NODE_PATH，用 createRequire 从 client/ 解析依赖
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_DIR = process.env.CLIENT_DIR || path.resolve(__dirname, '..', 'client')
const require = createRequire(path.join(CLIENT_DIR, 'noop.js'))
const { io } = require('socket.io-client')

const BASE = process.env.BASE || 'http://47.114.35.97:3001'
const TAG = process.env.TAG || String(Date.now()).slice(-6)
const UA = `ztestA${TAG}`
const UB = `ztestB${TAG}`
const PW = 'ztest1234'
const MATCH_TTL_MS = 15 * 60 * 1000

let pass = 0, fail = 0
const fails = []
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; fails.push(name); console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method, headers, body: body == null ? undefined : JSON.stringify(body),
  })
  const ct = res.headers.get('content-type') || ''
  const data = ct.includes('json') ? await res.json().catch(() => null) : await res.text()
  return { status: res.status, ok: res.ok, data, ct }
}

async function registerOrLogin(username) {
  const r = await api('POST', '/api/auth/register', { username, password: PW, mbtiType: 'INTJ' })
  if (r.ok) return { ...r.data, fresh: true }
  const l = await api('POST', '/api/auth/login', { username, password: PW })
  if (l.ok) return { ...l.data, fresh: false }
  throw new Error(`账号 ${username} 注册/登录失败: ${l.status} ${JSON.stringify(l.data)}`)
}

function connect(token, label) {
  return new Promise((resolve, reject) => {
    const s = io(BASE, { transports: ['websocket'], reconnection: true, timeout: 15000 })
    const timer = setTimeout(() => reject(new Error(`${label} socket 连接超时`)), 20000)
    s.on('connect', () => {
      clearTimeout(timer)
      s.emit('identify', { token })
      s.emit('join-lobby')
      s.emit('join-square')
      console.log(`  · ${label} socket 已连接 id=${s.id}`)
      resolve(s)
    })
    s.on('connect_error', (e) => { clearTimeout(timer); reject(new Error(`${label} connect_error: ${e.message}`)) })
  })
}

/** 等某个 socket 事件，超时返回 null */
function waitEvent(sock, evt, ms = 4000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { sock.off(evt, h); resolve(null) }, ms)
    const h = (payload) => { clearTimeout(t); sock.off(evt, h); resolve(payload) }
    sock.on(evt, h)
  })
}

console.log('═══════════════════════════════════════════════════════════')
console.log(`  云端并发验证  BASE=${BASE}`)
console.log(`  测试账号: ${UA} / ${UB}`)
console.log('═══════════════════════════════════════════════════════════')

const created = { users: [], postId: null, rooms: [] }
let sockA, sockB

try {
  // ── 1. 双账号 ──────────────────────────────────────────────
  console.log('\n[1] 双账号注册/登录')
  const A = await registerOrLogin(UA)
  const B = await registerOrLogin(UB)
  created.users = [A.user.id, B.user.id]
  check(`账号 A 就绪 (${UA})`, !!A.token, `role=${A.user.role}${A.fresh ? ' 新注册' : ' 已存在'}`)
  check(`账号 B 就绪 (${UB})`, !!B.token, `role=${B.user.role}${B.fresh ? ' 新注册' : ' 已存在'}`)

  // ── 2. 双 socket 同时在线 ──────────────────────────────────
  console.log('\n[2] 双 socket 同时在线（云端并发）')
  sockA = await connect(A.token, 'A')
  sockB = await connect(B.token, 'B')
  await sleep(1200)

  const online = await api('GET', '/api/stats/online')
  check('两个连接同时在线', (online.data?.count ?? 0) >= 2, `在线 ${online.data?.count} 人`)
  const names = (online.data?.users || []).map(u => u.username).filter(Boolean)
  check('presence 含两个测试账号', names.includes(UA) && names.includes(UB), `在线名单: ${names.join(', ')}`)

  // ── 3. 真人匹配（含废弃房回归断言） ────────────────────────
  console.log('\n[3] 真人匹配 PK（quick-match）')
  const m1 = await api('POST', '/api/pk/quick-match', { userId: A.user.id })
  const m2 = await api('POST', '/api/pk/quick-match', { userId: B.user.id })
  const r1 = m1.data?.room, r2 = m2.data?.room
  created.rooms.push(r1?.id, r2?.id)
  check('A quick-match 返回房间', m1.ok && !!r1?.id, `room=${r1?.id} 辩题「${r1?.topic}」`)
  check('B quick-match 返回房间', m2.ok && !!r2?.id, `room=${r2?.id} 辩题「${r2?.topic}」`)

  const now = Date.now()
  const ageA = now - (r1?.created_at ?? 0)
  const ageB = now - (r2?.created_at ?? 0)
  check('A 匹配到的是新鲜房（未吸废房）', ageA < MATCH_TTL_MS,
    `房龄 ${Math.round(ageA / 60000)} 分钟`)
  check('B 匹配到的是新鲜房（未吸废房）', ageB < MATCH_TTL_MS,
    `房龄 ${Math.round(ageB / 60000)} 分钟`)
  check('A/B 自动配到同一房', r1?.id === r2?.id, `A=${r1?.id} B=${r2?.id}`)

  // ── 4. 确定性双人同房 ─────────────────────────────────────
  console.log('\n[4] 双人同房（自建房 → 对方加入）')
  const mk = await api('POST', '/api/pk/create', {
    topic: `并发验证辩题 ${TAG}`, position: '正方', isPublic: true, maxParticipants: 2, creatorId: A.user.id,
  })
  const roomId = mk.data?.room?.id
  created.rooms.push(roomId)
  check('A 建房成功（自动入座）', mk.ok && !!roomId, `room=${roomId}`)

  const jn = await api('POST', `/api/pk/${roomId}/join`, { userId: B.user.id })
  check('B 加入成功', jn.ok, `status=${jn.status}${jn.ok ? '' : ' ' + JSON.stringify(jn.data)}`)

  const detail = await api('GET', `/api/pk/${roomId}`)
  const parts = detail.data?.participants || detail.data?.room?.participants || []
  const pnames = parts.map(p => p.username).filter(Boolean)
  check('房间里 2 名真人辩手', parts.length === 2, `participants=[${pnames.join(', ')}]`)
  check('两名真人正是 A 和 B', pnames.includes(UA) && pnames.includes(UB), `[${pnames.join(', ')}]`)

  // ── 5. 实时对战 ───────────────────────────────────────────
  console.log('\n[5] 实时发言同步（socket 广播）')
  sockA.emit('join-room', roomId)
  sockB.emit('join-room', roomId)
  await sleep(600)

  const p1 = await api('POST', `/api/pk/${roomId}/phase`, { phase: 'preparation', userId: A.user.id })
  const p2 = await api('POST', `/api/pk/${roomId}/phase`, { phase: 'opening', userId: A.user.id })
  check('阶段推进 waiting→preparation→opening', p1.ok && p2.ok, `${p1.status}/${p2.status}`)

  // A 发言 → B 应收 new-move + pet-battle
  const bMove = waitEvent(sockB, 'new-move')
  const bBattle = waitEvent(sockB, 'pet-battle')
  const mvA = await api('POST', `/api/pk/${roomId}/move`, {
    userId: A.user.id, content: 'A：AI 可以拥有意识，因为意识是信息处理模式的涌现。', moveType: 'speech',
  })
  const gotB = await bMove
  const gotBattle = await bBattle
  check('A 发言入库成功', mvA.ok, `status=${mvA.status}`)
  check('B 实时收到 A 的发言 (new-move)', !!gotB, gotB ? `内容「${String(gotB.content).slice(0, 18)}…」` : '超时未收到')
  check('服务器权威宠物结算广播 (pet-battle)', !!gotBattle, gotBattle ? `keys=${Object.keys(gotBattle).join('/')}` : '超时未收到')

  // B 发言 → A 应收 new-move
  const aMove = waitEvent(sockA, 'new-move')
  const mvB = await api('POST', `/api/pk/${roomId}/move`, {
    userId: B.user.id, content: 'B：意识需要主观体验，符号操作并不等于意识。', moveType: 'speech',
  })
  const gotA = await aMove
  check('B 发言入库成功', mvB.ok, `status=${mvB.status}`)
  check('A 实时收到 B 的发言 (new-move)', !!gotA, gotA ? `内容「${String(gotA.content).slice(0, 18)}…」` : '超时未收到')

  const battle = await api('GET', `/api/pk/${roomId}/battle`)
  check('对战快照可读 (/:roomId/battle)', battle.ok, `status=${battle.status}`)

  // ── 6. 社区广场 ───────────────────────────────────────────
  console.log('\n[6] 社区广场（发帖 / 列表 / 点赞 / 评论）')
  const title = `并发测试帖 ${TAG}`
  const postRes = await api('POST', '/api/posts', {
    title, content: '这是云端多人并发验证帖。', tags: ['并发测试'],
  }, A.token)
  const postId = postRes.data?.post?.id || postRes.data?.id
  created.postId = postId
  check('A 发帖成功', postRes.ok && !!postId, `postId=${String(postId).slice(0, 8)}…`)

  const list = await api('GET', '/api/posts')
  const posts = list.data?.posts || list.data || []
  check('B 在广场列表看到 A 的帖子', Array.isArray(posts) && posts.some(p => p.id === postId),
    `列表 ${Array.isArray(posts) ? posts.length : '?'} 条`)

  const like = await api('POST', `/api/posts/${postId}/like`, {}, B.token)
  check('B 点赞成功（跨用户并发写）', like.ok, `status=${like.status}`)

  const comment = await api('POST', `/api/posts/${postId}/comments`, { content: 'B 的并发评论' }, B.token)
  check('B 评论成功（跨用户并发写）', comment.ok, `status=${comment.status}`)

  await sleep(600)
  const one = await api('GET', `/api/posts/${postId}`)
  const comments = one.data?.comments || one.data?.post?.comments || []
  check('A 能看到 B 的评论', Array.isArray(comments) && comments.some(c => String(c.content || '').includes('B 的并发评论')),
    `评论 ${comments.length} 条`)
  const likeVal = one.data?.post?.likes ?? one.data?.likes ?? one.data?.post?.like_count
  check('帖子点赞数已更新', likeVal == null ? true : likeVal >= 1, `likes=${likeVal}`)

  // ── 7. 退房 ────────────────────────────────────────────────
  console.log('\n[7] 清理（退房）')
  const lv = await api('POST', `/api/pk/${roomId}/leave`, { userId: B.user.id })
  check('B 退房成功', lv.ok, `status=${lv.status}`)
} catch (e) {
  fail++
  fails.push('脚本异常: ' + e.message)
  console.log(`\n  ❌ 脚本异常: ${e.message}`)
} finally {
  try { sockA?.disconnect() } catch {}
  try { sockB?.disconnect() } catch {}
}

console.log('\n═══════════════════════════════════════════════════════════')
console.log(`  结果: ${pass} 通过 / ${fail} 失败`)
if (fails.length) console.log(`  失败项: ${fails.join(' | ')}`)
console.log(`  清理用 ID → 用户: ${created.users.join(', ')}`)
console.log(`             帖子: ${created.postId}`)
console.log(`             房间: ${created.rooms.filter(Boolean).join(', ')}`)
console.log('═══════════════════════════════════════════════════════════')
process.exit(fail ? 1 : 0)
