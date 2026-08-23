/**
 * v40 PK 宠物战斗系统 E2E 测试
 * 验证链路：preparation 快照初始化 → move 服务器伤害计算 → HP 扣减 → judge 宠物结算
 */
const BASE = 'http://localhost:3001/api'
const now = Date.now()
const suffix = String(now).slice(-8)

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function register(name) {
  const r = await api('POST', '/auth/register', {
    username: name, password: 'test123456', mbtiType: 'INTJ',
  })
  // 已存在则直接登录
  if (r.status !== 200 && r.status !== 201) {
    const l = await api('POST', '/auth/login', { username: name, password: 'test123456' })
    return l.data
  }
  return r.data
}

function assert(cond, msg) {
  if (cond) console.log(`  ✅ ${msg}`)
  else { console.error(`  ❌ ${msg}`); process.exitCode = 1 }
}

const main = async () => {
  console.log('== v40 PK 宠物战斗 E2E ==')

  // 1. 注册两个测试账号（用户名 ≤ 20 字符）
  const A = await register(`pka${suffix}`)
  const B = await register(`pkb${suffix}`)
  const aId = A.user?.id || A.id
  const bId = B.user?.id || B.id
  assert(aId && bId, `两个测试账号注册成功（A=${aId?.slice(0, 6)}... B=${bId?.slice(0, 6)}...）`)

  // 2. A 创建宠物（cat），B 不创建（走临时辩灵路径）
  const petA = await api('POST', '/pets/create', { userId: aId, spriteType: 'cat' })
  assert(petA.status === 200 && petA.data.pet, `A 创建像素猫成功（hp=${petA.data?.pet?.hp} atk=${petA.data?.pet?.atk}）`)

  // 3. A 创建 PK 房间
  const room = await api('POST', '/pk/create', { topic: 'v40战斗系统测试', position: '正方', creatorId: aId })
  const roomId = room.data.room?.id
  assert(!!roomId, `房间创建成功（${roomId}）`)

  // 4. B 加入
  const join = await api('POST', `/pk/${roomId}/join`, { userId: bId })
  assert(join.status === 200 && join.data.participants?.length === 2, 'B 加入房间，2 人满员')

  // 5. 切换到 preparation → 应初始化战斗快照
  const phase = await api('POST', `/pk/${roomId}/phase`, { phase: 'preparation', userId: aId })
  assert(phase.status === 200, '阶段切换到 preparation')
  const states = phase.data.battleStates || []
  assert(states.length === 2, `战斗快照初始化 2 份（实际 ${states.length}）`)
  const stateA = states.find(s => s.userId === aId)
  const stateB = states.find(s => s.userId === bId)
  assert(stateA && stateA.spriteType === 'cat' && stateA.hp === stateA.maxHp, `A 快照为像素猫满血（hp=${stateA?.hp}/${stateA?.maxHp} atk=${stateA?.atk}）`)
  assert(stateB && stateB.isTemp === true && stateB.name === '辩灵', `B 无宠物 → 临时辩灵（name=${stateB?.name} isTemp=${stateB?.isTemp}）`)

  // 6. 切到 opening，A 发言 → 服务器计算伤害
  await api('POST', `/pk/${roomId}/phase`, { phase: 'opening', userId: aId })
  const move1 = await api('POST', `/pk/${roomId}/move`, {
    userId: aId, content: '首先，根据统计数据研究表明，远程办公显著提升了工作效率，因为通勤时间的节省直接转化为工作产出', moveType: 'speech',
  })
  const ev1 = move1.data.battleEvent
  assert(move1.status === 200, 'A 立论发言提交成功')
  assert(!!ev1 && ev1.damage >= 1, `服务器计算伤害：damage=${ev1?.damage} crit=${ev1?.crit} defenderHp=${ev1?.defenderHp}`)
  assert(ev1.defenderHp === stateB.maxHp - ev1.damage, '伤害公式扣血正确（defenderHp = maxHp - damage）')

  // 7. B 反驳发言（反驳词加成）
  const move2 = await api('POST', `/pk/${roomId}/move`, {
    userId: bId, content: '不对，然而你的数据存在偏差，相反的事实是大量研究案例表明远程办公削弱了团队协作', moveType: 'speech',
  })
  const ev2 = move2.data.battleEvent
  assert(!!ev2 && ev2.attackerId === bId, `B 反驳攻击生效（damage=${ev2?.damage} crit=${ev2?.crit}）`)

  // 8. 重连接口
  const battle = await api('GET', `/pk/${roomId}/battle`)
  const reconnectStates = battle.data.battleStates || []
  assert(reconnectStates.find(s => s.userId === bId)?.hp < stateB.maxHp, `重连接口返回扣减后 HP（B hp=${reconnectStates.find(s => s.userId === bId)?.hp}/${stateB.maxHp}）`)
  assert(reconnectStates.find(s => s.userId === aId)?.damageTaken === ev2.damage, `累计承伤正确（A damageTaken=${reconnectStates.find(s => s.userId === aId)?.damageTaken}）`)

  // 9. judge → 宠物结算 + 战报
  const judge = await api('POST', `/pk/${roomId}/judge`, { userId: aId })
  assert(judge.status === 200 && judge.data.scores, `评分完成（winner=${judge.data.winner?.slice(0, 6)}...）`)
  assert(judge.data.feedback.includes('宠物战报'), 'feedback 包含宠物战报')
  assert(judge.data.feedback.includes('经验'), '战报含经验结算')

  // 10. 验证 A 的宠物确实结算了（exp > 0）
  const petAfter = await api('GET', `/pets/my/${aId}`)
  assert(petAfter.data.pet && petAfter.data.pet.exp > 0, `A 宠物经验入账（exp=${petAfter.data?.pet?.exp} level=${petAfter.data?.pet?.level}）`)

  // 11. 幂等：重复 judge 不再重复发经验
  const expBefore = petAfter.data.pet.exp
  await api('POST', `/pk/${roomId}/judge`, { userId: aId })
  const petAfter2 = await api('GET', `/pets/my/${aId}`)
  assert(petAfter2.data.pet.exp === expBefore, `judge 幂等（exp 保持 ${expBefore}）`)

  // 清理测试数据
  console.log('\n== 测试完成 ==')
  if (process.exitCode) console.error('存在失败项！')
  else console.log('全部通过 ✅')
}

main().catch(e => { console.error('E2E 异常:', e); process.exit(1) })
