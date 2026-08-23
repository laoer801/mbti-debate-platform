import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDB } from '../db.js'
import { DEFAULT_PET_SPRITES, getPetWithBonus, settlePetBattle } from './pets.js'

export const pkRoomRoutes = Router()

// ============================================================
// 辩论PK房间系统
// 阶段：waiting → preparation → opening → free_debate → closing → judging → finished
// ============================================================

const ROOM_PHASES = ['waiting', 'preparation', 'opening', 'free_debate', 'closing', 'judging', 'finished']

const PHASE_DURATIONS = {
  preparation: 60,   // 准备 60s
  opening: 120,      // 立论 120s
  free_debate: 300,  // 自由辩论 300s
  closing: 90,       // 总结 90s
  judging: 30,       // 裁判评分 30s
}

// ============================================================
// v40 服务器权威宠物战斗系统
// 擂台快照：preparation 阶段锁定双方属性（含装备加成）
// 伤害计算：发言内容 → 服务器算伤害 → 广播 → 两端动画一致
// 结算：judge 时统一发放经验/积分/胜负
// ============================================================

const TEMP_PET = { name: '辩灵', spriteType: 'slime', emoji: '🟢', stats: { hp: 100, atk: 10, def: 8, spd: 10 } }

/**
 * preparation 阶段初始化双方战斗快照（幂等：先清旧状态再写入）
 * 无宠物的玩家获得临时「辩灵」，保证擂台始终可战
 */
function initBattleState(db, roomId) {
  const participants = db.prepare(`
    SELECT p.user_id FROM pk_participants p WHERE p.room_id = ?
  `).all(roomId)

  db.prepare('DELETE FROM pk_battle_state WHERE room_id = ?').run(roomId)

  const now = Date.now()
  const insert = db.prepare(`
    INSERT INTO pk_battle_state (room_id, user_id, name, sprite_type, emoji, hp, max_hp, atk, def, spd, damage_dealt, damage_taken, is_temp, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
  `)

  for (const p of participants) {
    const owned = getPetWithBonus(db, p.user_id)
    if (owned) {
      // 快照 HP 用满血 max_hp：擂台是「本场战斗」的独立血条，不沿用野外残血
      const atk = owned.pet.atk + owned.bonus.atk
      const def = owned.pet.def + owned.bonus.def
      const spd = owned.pet.spd + owned.bonus.spd
      insert.run(roomId, p.user_id, owned.pet.name, owned.pet.sprite_type, owned.pet.emoji, owned.pet.max_hp, owned.pet.max_hp, atk, def, spd, 0, now)
    } else {
      // 无宠物 → 临时辩灵参战（不落库到 pets 表，judge 结算时自动跳过）
      insert.run(roomId, p.user_id, TEMP_PET.name, TEMP_PET.spriteType, TEMP_PET.emoji, TEMP_PET.stats.hp, TEMP_PET.stats.hp, TEMP_PET.stats.atk, TEMP_PET.stats.def, TEMP_PET.stats.spd, 1, now)
    }
  }

  return getBattleStates(db, roomId)
}

/** 读取房间战斗快照（驼峰格式，直接给前端用） */
function getBattleStates(db, roomId) {
  return db.prepare('SELECT * FROM pk_battle_state WHERE room_id = ?').all(roomId).map(s => ({
    roomId: s.room_id,
    userId: s.user_id,
    name: s.name,
    spriteType: s.sprite_type,
    emoji: s.emoji,
    hp: s.hp,
    maxHp: s.max_hp,
    atk: s.atk,
    def: s.def,
    spd: s.spd,
    damageDealt: s.damage_dealt,
    damageTaken: s.damage_taken,
    isTemp: !!s.is_temp,
  }))
}

/**
 * 发言伤害计算（服务器权威，两端一致）
 * 公式：base = max(1, atk − def/2)；质量乘数 = 0.7 + min(0.8, 字数/150) + 反驳词(≤0.3) + 论据词(≤0.2)
 * 随机 0.85~1.15；暴击率 = spd/200 → ×1.5
 */
const REBUTTAL_RE = /不对|错误|反驳|否认|未必|并非|相反|但是|然而|不同意|wrong|not true|however|but|disagree|refute|objection/i
const EVIDENCE_RE = /根据|数据|研究表明|例如|举例|案例|统计|调查|实验|证据|事实|research|study|data|evidence|example|according to/i

function computeDamage(attacker, defender, content) {
  const base = Math.max(1, attacker.atk - Math.floor(defender.def / 2))
  let quality = 0.7 + Math.min(0.8, content.length / 150)
  if (REBUTTAL_RE.test(content)) quality += 0.3
  if (EVIDENCE_RE.test(content)) quality += 0.2
  const rand = 0.85 + Math.random() * 0.3
  let dmg = Math.round(base * quality * rand)
  const crit = Math.random() < Math.min(0.4, attacker.spd / 200)
  if (crit) dmg = Math.round(dmg * 1.5)
  return { damage: Math.max(1, dmg), crit }
}

/**
 * 发言后结算一次宠物攻击：打对方快照、更新累计伤害、返回广播负载
 * 只有一方有快照时跳过（防御性，正常 initBattleState 后双方都有）
 */
function applyPetAttack(db, roomId, attackerId, content) {
  const attacker = db.prepare('SELECT * FROM pk_battle_state WHERE room_id = ? AND user_id = ?').get(roomId, attackerId)
  if (!attacker) return null

  const defender = db.prepare(
    'SELECT * FROM pk_battle_state WHERE room_id = ? AND user_id != ? LIMIT 1'
  ).get(roomId, attackerId)
  if (!defender) return null

  const { damage, crit } = computeDamage(attacker, defender, content)

  const newDefHp = Math.max(0, defender.hp - damage)
  db.prepare('UPDATE pk_battle_state SET damage_dealt = damage_dealt + ? WHERE room_id = ? AND user_id = ?')
    .run(damage, roomId, attackerId)
  db.prepare('UPDATE pk_battle_state SET hp = ?, damage_taken = damage_taken + ? WHERE room_id = ? AND user_id = ?')
    .run(newDefHp, damage, roomId, defender.user_id)

  return {
    roomId,
    attackerId,
    defenderId: defender.user_id,
    damage,
    crit,
    attackerHp: attacker.hp,
    defenderHp: newDefHp,
    knockOut: newDefHp === 0,
  }
}

// 创建辩论房间
pkRoomRoutes.post('/create', (req, res) => {
  const db = getDB()
  const { topic, position, isPublic, maxParticipants, creatorId } = req.body

  if (!topic) {
    return res.status(400).json({ error: '请输入辩题' })
  }

  const roomId = uuidv4().slice(0, 8).toUpperCase()
  const now = Date.now()

  db.prepare(`
    INSERT INTO pk_rooms (id, topic, position, current_phase, is_public, max_participants, creator_id, created_at, started_at, phase_started_at)
    VALUES (?, ?, ?, 'waiting', ?, ?, ?, ?, NULL, NULL)
  `).run(roomId, topic, position || '正方', isPublic !== false ? 1 : 0, maxParticipants || 2, creatorId, now)

  // 创建者自动成为第一位参与者（避免创建后自己是旁观者）
  if (creatorId) {
    db.prepare(`
      INSERT INTO pk_participants (id, room_id, user_id, side, status, joined_at)
      VALUES (?, ?, ?, ?, 'joined', ?)
    `).run(uuidv4(), roomId, creatorId, (position || '正方') === '反方' ? 'con' : 'pro', now)
  }

  const room = db.prepare('SELECT * FROM pk_rooms WHERE id = ?').get(roomId)
  const io = req.app.get('io')
  if (io) io.to('pk-lobby').emit('room-created', room)

  res.json({ room, message: '房间创建成功' })
})

// 获取房间列表（只显示公开且未满的房间）
pkRoomRoutes.get('/list', (req, res) => {
  const db = getDB()
  const rooms = db.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM pk_participants WHERE room_id = r.id) as participant_count
    FROM pk_rooms r
    WHERE r.current_phase != 'finished'
      AND r.is_public = 1
      AND (SELECT COUNT(*) FROM pk_participants WHERE room_id = r.id) < r.max_participants
    ORDER BY r.created_at DESC
    LIMIT 50
  `).all()

  res.json(rooms)
})

// 获取房间详情
pkRoomRoutes.get('/:roomId', (req, res) => {
  const db = getDB()
  const room = db.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM pk_participants WHERE room_id = r.id) as participant_count
    FROM pk_rooms r WHERE r.id = ?
  `).get(req.params.roomId)

  if (!room) return res.status(404).json({ error: '房间不存在' })

  const participants = db.prepare(`
    SELECT p.*, u.username, u.mbti_type, u.avatar
    FROM pk_participants p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.room_id = ?
  `).all(req.params.roomId)

  // 转换为前端驼峰格式（与 /move 实时推送格式保持一致，否则历史消息渲染错乱）
  const moves = db.prepare(`
    SELECT m.*, u.username, u.avatar, u.mbti_type AS mbti_type, pp.side
    FROM pk_moves m
    LEFT JOIN users u ON m.user_id = u.id
    LEFT JOIN pk_participants pp ON pp.room_id = m.room_id AND pp.user_id = m.user_id
    WHERE m.room_id = ?
    ORDER BY m.created_at ASC
  `).all(req.params.roomId).map(m => ({
    id: m.id,
    roomId: m.room_id,
    userId: m.user_id,
    username: m.username,
    avatar: m.avatar,
    mbtiType: m.mbti_type,
    content: m.content,
    moveType: m.move_type,
    side: m.side,
    phase: m.phase,
    createdAt: m.created_at,
  }))

  const judgeResult = db.prepare('SELECT * FROM pk_judge_results WHERE room_id = ?').get(req.params.roomId)

  res.json({ room, participants, moves, judgeResult })
})

// 加入房间
pkRoomRoutes.post('/:roomId/join', (req, res) => {
  const db = getDB()
  const { userId, side } = req.body
  const { roomId } = req.params

  const room = db.prepare('SELECT * FROM pk_rooms WHERE id = ?').get(roomId)
  if (!room) return res.status(404).json({ error: '房间不存在' })
  if (room.current_phase !== 'waiting') {
    return res.status(400).json({ error: '辩论已开始，无法加入' })
  }

  const count = db.prepare('SELECT COUNT(*) as cnt FROM pk_participants WHERE room_id = ?').get(roomId)
  if (count.cnt >= room.max_participants) {
    return res.status(400).json({ error: '房间已满' })
  }

  const existing = db.prepare('SELECT * FROM pk_participants WHERE room_id = ? AND user_id = ?').get(roomId, userId)
  if (existing) return res.status(400).json({ error: '你已在此房间中' })

  const now = Date.now()
  const participantId = uuidv4()

  db.prepare(`
    INSERT INTO pk_participants (id, room_id, user_id, side, status, joined_at)
    VALUES (?, ?, ?, ?, 'joined', ?)
  `).run(participantId, roomId, userId, side || (count.cnt === 0 ? 'pro' : 'con'), now)

  const participants = db.prepare(`
    SELECT p.*, u.username, u.mbti_type, u.avatar
    FROM pk_participants p LEFT JOIN users u ON p.user_id = u.id WHERE p.room_id = ?
  `).all(roomId)

  const io = req.app.get('io')
  if (io) {
    io.to(`pk-room-${roomId}`).emit('participant-joined', participants)
    io.to('pk-lobby').emit('room-updated', roomId)
  }

  res.json({ participantId, participants })
})

// 离开房间
pkRoomRoutes.post('/:roomId/leave', (req, res) => {
  const db = getDB()
  const { userId } = req.body
  const room = db.prepare('SELECT * FROM pk_rooms WHERE id = ?').get(req.params.roomId)

  db.prepare('DELETE FROM pk_participants WHERE room_id = ? AND user_id = ?').run(req.params.roomId, userId)

  const io = req.app.get('io')
  const remaining = db.prepare('SELECT COUNT(*) as cnt FROM pk_participants WHERE room_id = ?').get(req.params.roomId)

  if (room) {
    if (remaining.cnt < 2 && room.current_phase !== 'finished') {
      // 参与者不足2人 → 重置回等待阶段，防止对局卡死
      db.prepare(`UPDATE pk_rooms SET current_phase = 'waiting', phase_started_at = NULL, phase_duration = 0 WHERE id = ?`)
        .run(req.params.roomId)
      if (io) {
        io.to(`pk-room-${req.params.roomId}`).emit('phase-changed', {
          phase: 'waiting', startedAt: Date.now(), duration: 0
        })
      }
    }

    // 等待阶段且空房间 → 直接删除，避免僵尸房间堆积
    if (remaining.cnt === 0 && room.current_phase === 'waiting') {
      db.prepare('DELETE FROM pk_moves WHERE room_id = ?').run(req.params.roomId)
      db.prepare('DELETE FROM pk_rooms WHERE id = ?').run(req.params.roomId)
      if (io) io.to('pk-lobby').emit('room-removed', req.params.roomId)
      return res.json({ success: true, roomDeleted: true })
    }
  }

  if (io) {
    const participants = db.prepare(`
      SELECT p.*, u.username, u.mbti_type, u.avatar
      FROM pk_participants p LEFT JOIN users u ON p.user_id = u.id WHERE p.room_id = ?
    `).all(req.params.roomId)
    io.to(`pk-room-${req.params.roomId}`).emit('participant-joined', participants)
  }

  res.json({ success: true })
})

// 切换阶段（房主或系统自动）
pkRoomRoutes.post('/:roomId/phase', (req, res) => {
  const db = getDB()
  const { phase, userId } = req.body
  const room = db.prepare('SELECT * FROM pk_rooms WHERE id = ?').get(req.params.roomId)

  if (!room) return res.status(404).json({ error: '房间不存在' })
  if (!ROOM_PHASES.includes(phase)) return res.status(400).json({ error: '无效阶段' })

  // 阶段顺序校验：只能切换到下一阶段（相同阶段幂等允许），防止双端竞态跳级
  const currentIdx = ROOM_PHASES.indexOf(room.current_phase)
  const nextIdx = ROOM_PHASES.indexOf(phase)
  if (phase !== room.current_phase && nextIdx !== currentIdx + 1) {
    return res.status(400).json({ error: `阶段切换顺序错误：当前 ${room.current_phase}，不能直接切换到 ${phase}` })
  }

  // 如果阶段是 preparation，检查参与者数量
  if (phase === 'preparation') {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM pk_participants WHERE room_id = ?').get(req.params.roomId)
    if (count.cnt < 2) return res.status(400).json({ error: '至少需要2人才能开始' })
  }

  const duration = PHASE_DURATIONS[phase] || 0
  const now = Date.now()

  db.prepare(`
    UPDATE pk_rooms SET current_phase = ?, phase_started_at = ?, phase_duration = ?
    WHERE id = ?
  `).run(phase, now, duration, req.params.roomId)

  if (phase !== 'waiting' && !room.started_at) {
    db.prepare('UPDATE pk_rooms SET started_at = ? WHERE id = ?').run(now, req.params.roomId)
  }

  // v40：进入准备阶段时锁定双方宠物战斗快照并广播（擂台初始化）
  let battleStates = null
  if (phase === 'preparation') {
    battleStates = initBattleState(db, req.params.roomId)
  }

  const io = req.app.get('io')
  if (io) {
    io.to(`pk-room-${req.params.roomId}`).emit('phase-changed', {
      phase, startedAt: now, duration
    })
    if (battleStates) {
      io.to(`pk-room-${req.params.roomId}`).emit('battle-init', battleStates)
    }
  }

  res.json({ phase, startedAt: now, duration, battleStates })
})

// 提交辩论发言
pkRoomRoutes.post('/:roomId/move', (req, res) => {
  const db = getDB()
  const { userId, content, moveType } = req.body

  const room = db.prepare('SELECT * FROM pk_rooms WHERE id = ?').get(req.params.roomId)
  if (!room) return res.status(404).json({ error: '房间不存在' })

  // 只允许在发言阶段提交（准备/评分/等待/结束均不允许）
  const SPEAK_PHASES = ['opening', 'free_debate', 'closing']
  if (!SPEAK_PHASES.includes(room.current_phase)) {
    return res.status(400).json({ error: `当前阶段 ${room.current_phase} 不允许发言` })
  }

  const moveId = uuidv4()
  const now = Date.now()

  db.prepare(`
    INSERT INTO pk_moves (id, room_id, user_id, content, move_type, phase, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(moveId, req.params.roomId, userId, content, moveType || 'speech', room.current_phase, now)

  const user = db.prepare('SELECT username, avatar, mbti_type FROM users WHERE id = ?').get(userId)
  const participant = db.prepare('SELECT side FROM pk_participants WHERE room_id = ? AND user_id = ?').get(req.params.roomId, userId)

  const move = { id: moveId, roomId: req.params.roomId, userId, username: user?.username, avatar: user?.avatar, mbtiType: user?.mbti_type, content, moveType: moveType || 'speech', side: participant?.side, phase: room.current_phase, createdAt: now }

  // v40：服务器权威宠物攻击 —— 发言即攻击，伤害由服务端计算并广播
  const battleEvent = applyPetAttack(db, req.params.roomId, userId, content)

  const io = req.app.get('io')
  if (io) {
    io.to(`pk-room-${req.params.roomId}`).emit('new-move', move)
    if (battleEvent) {
      io.to(`pk-room-${req.params.roomId}`).emit('pet-battle', battleEvent)
    }
  }

  res.json({ move, battleEvent })
})

// AI 裁判评分
pkRoomRoutes.post('/:roomId/judge', async (req, res) => {
  const db = getDB()
  const room = db.prepare('SELECT * FROM pk_rooms WHERE id = ?').get(req.params.roomId)

  if (!room) return res.status(404).json({ error: '房间不存在' })

  // 幂等：已评分完成的房间直接返回已有结果，避免重复评分/重复发放积分
  const existingResult = db.prepare('SELECT scores FROM pk_judge_results WHERE room_id = ?').get(req.params.roomId)
  if (existingResult) {
    try {
      return res.json(JSON.parse(existingResult.scores))
    } catch {
      return res.json({ existingResult })
    }
  }

  const participants = db.prepare(`
    SELECT p.*, u.username, u.mbti_type FROM pk_participants p
    LEFT JOIN users u ON p.user_id = u.id WHERE p.room_id = ?
  `).all(req.params.roomId)

  const moves = db.prepare(`
    SELECT m.*, u.username FROM pk_moves m
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.room_id = ? ORDER BY m.created_at ASC
  `).all(req.params.roomId)

  // AI 评分逻辑
  const scores = judgeDebate(room, participants, moves)

  // v40：宠物战斗结算 —— 服务端统一发放经验/积分/胜负（不再依赖前端调用 /battle-result）
  const battleStates = db.prepare('SELECT * FROM pk_battle_state WHERE room_id = ?').all(req.params.roomId)
  const petReport = []
  if (battleStates.length > 0) {
    for (const bs of battleStates) {
      if (bs.is_temp) {
        petReport.push(`🟢 **${bs.name}**（${bs.emoji}）：临时辩灵飘然而散，无战斗收获`)
        continue
      }
      const playerScore = scores.results?.find(r => r.userId === bs.user_id)?.total || 50
      const result = settlePetBattle(db, {
        userId: bs.user_id,
        won: bs.user_id === scores.winner,
        damageDealt: bs.damage_dealt,
        damageTaken: bs.damage_taken,
        debateScore: playerScore,
      })
      if (result) {
        const line = `🐾 **${bs.name}**（${bs.emoji}）：造成 ${bs.damage_dealt} 伤害 | 承受 ${bs.damage_taken} 伤害 | 经验 +${result.expGain} | 积分 +${result.pointsGain}`
        petReport.push(result.levelUp ? `${line} | ⬆️ 升级到 Lv.${result.newLevel}！` : line)
      }
    }
  }
  if (petReport.length > 0) {
    scores.feedback = scores.feedback + '\n\n## 🐾 宠物战报\n' + petReport.join('\n')
  }

  const now = Date.now()
  const resultId = uuidv4()

  db.prepare(`
    INSERT INTO pk_judge_results (id, room_id, scores, winner_id, feedback, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(resultId, req.params.roomId, JSON.stringify(scores), scores.winner, scores.feedback, now)

  db.prepare('UPDATE pk_rooms SET current_phase = ?, winner_id = ? WHERE id = ?')
    .run('finished', scores.winner, req.params.roomId)

  // 胜者 30 积分已由 settlePetBattle 统一发放（含胜负场次），此处无需重复加积分

  const io = req.app.get('io')
  if (io) {
    io.to(`pk-room-${req.params.roomId}`).emit('judge-result', {
      roomId: req.params.roomId, scores, winner: scores.winner, feedback: scores.feedback
    })
  }

  res.json({ scores, winner: scores.winner, feedback: scores.feedback })
})

// 快速匹配
pkRoomRoutes.post('/quick-match', (req, res) => {
  const db = getDB()
  const { userId, topic } = req.body

  // 查找等待中的公开房间
  let room = db.prepare(`
    SELECT * FROM pk_rooms
    WHERE current_phase = 'waiting' AND is_public = 1 AND max_participants > (SELECT COUNT(*) FROM pk_participants WHERE room_id = pk_rooms.id)
    ORDER BY created_at ASC LIMIT 1
  `).get()

  if (!room) {
    // 无可用房间，创建新房间
    const roomId = uuidv4().slice(0, 8).toUpperCase()
    const now = Date.now()
    const topics = [
      'AI能否拥有真正的意识', 'MBTI测试是否科学', '996工作制是否合理',
      '社交媒体让人更孤独还是更连接', '金钱能否买到幸福', '大学教育是否值得',
      '远程办公vs办公室办公', '素食主义是否更环保'
    ]

    db.prepare(`
      INSERT INTO pk_rooms (id, topic, current_phase, is_public, max_participants, creator_id, created_at)
      VALUES (?, ?, 'waiting', 1, 2, ?, ?)
    `).run(roomId, topic || topics[Math.floor(Math.random() * topics.length)], userId, now)

    room = db.prepare('SELECT * FROM pk_rooms WHERE id = ?').get(roomId)
  }

  // 加入房间
  const side = Math.random() > 0.5 ? 'pro' : 'con'
  const participantId = uuidv4()

  const existing = db.prepare('SELECT * FROM pk_participants WHERE room_id = ? AND user_id = ?').get(room.id, userId)
  if (existing) {
    return res.json({ room, message: '已在等待队列中' })
  }

  db.prepare(`
    INSERT INTO pk_participants (id, room_id, user_id, side, status, joined_at)
    VALUES (?, ?, ?, ?, 'joined', ?)
  `).run(participantId, room.id, userId, side, Date.now())

  const participants = db.prepare(`
    SELECT p.*, u.username, u.mbti_type, u.avatar
    FROM pk_participants p LEFT JOIN users u ON p.user_id = u.id WHERE p.room_id = ?
  `).all(room.id)

  const io = req.app.get('io')
  if (io) {
    io.to(`pk-room-${room.id}`).emit('participant-joined', participants)
  }

  res.json({ room, participants })
})

// ============================================================
// AI 裁判评分引擎
// 维度：逻辑性(30%) + 论据质量(25%) + 语言表达(20%) + 反驳能力(15%) + 礼仪风度(10%)
// ============================================================
function judgeDebate(room, participants, moves) {
  const perPlayer = {}

  participants.forEach(p => {
    perPlayer[p.user_id] = {
      userId: p.user_id,
      username: p.username,
      mbtiType: p.mbti_type,
      side: p.side,
      totalMoves: 0,
      totalChars: 0,
      logic: 0,
      evidence: 0,
      eloquence: 0,
      rebuttal: 0,
      etiquette: 0,
      score: 0,
    }
  })

  // 分析每次发言
  moves.forEach(m => {
    const p = perPlayer[m.user_id]
    if (!p) return
    p.totalMoves++
    p.totalChars += m.content.length

    const content = m.content.toLowerCase()

    // 逻辑性：因果/推理词汇
    const logicKeywords = ['因为', '所以', '因此', '如果', '那么', '首先', '其次', '最后', '结论', '逻辑', '推理', '必然', '导致', '原因', 'therefore', 'because', 'thus', 'hence', 'conclusion']
    logicKeywords.forEach(kw => { if (content.includes(kw)) p.logic += 2 })

    // 论据质量：引用/数据/案例
    const evidenceKeywords = ['根据', '数据', '研究表明', '例如', '举例', '案例', '统计', '调查', '实验', '证据', '事实', 'research', 'study', 'data', 'evidence', 'example', 'according to']
    evidenceKeywords.forEach(kw => { if (content.includes(kw)) p.evidence += 2.5 })

    // 语言表达：修辞/情感词/长度
    const eloquenceKeywords = ['然而', '但是', '不仅', '而且', '令人', '值得', '重要', '关键', '本质', '意义', '价值', 'indeed', 'important', 'significant', 'however', 'furthermore']
    eloquenceKeywords.forEach(kw => { if (content.includes(kw)) p.eloquence += 1.5 })
    p.eloquence += Math.min(10, m.content.length / 20)  // 长度奖励

    // 反驳能力：回应对方观点
    const rebuttalKeywords = ['不对', '错误', '反驳', '否认', '未必', '并非', '相反', '但是', '然而', '不同意', 'wrong', 'not true', 'however', 'but', 'disagree', 'refute', 'objection']
    rebuttalKeywords.forEach(kw => { if (content.includes(kw)) p.rebuttal += 3 })

    // 礼仪风度：礼貌用语 / 攻击性语言扣除
    const politeKeywords = ['谢谢', '感谢', '尊重', '理解', '认可', '赞同', '同意', 'agree', 'thanks', 'appreciate', 'respect']
    politeKeywords.forEach(kw => { if (content.includes(kw)) p.etiquette += 2 })
    const rudeKeywords = ['傻', '蠢', '弱智', '白痴', '垃圾', 'stupid', 'idiot', 'dumb', 'trash']
    rudeKeywords.forEach(kw => { if (content.includes(kw)) p.etiquette -= 5 })
  })

  // 归一化并加权计算总分
  const players = Object.values(perPlayer)
  const maxLogic = Math.max(1, ...players.map(p => p.logic))
  const maxEvidence = Math.max(1, ...players.map(p => p.evidence))
  const maxEloquence = Math.max(1, ...players.map(p => p.eloquence))
  const maxRebuttal = Math.max(1, ...players.map(p => p.rebuttal))
  const maxEtiquette = Math.max(1, ...players.map(p => p.etiquette))

  players.forEach(p => {
    p.logic = Math.min(100, (p.logic / maxLogic) * 100)
    p.evidence = Math.min(100, (p.evidence / maxEvidence) * 100)
    p.eloquence = Math.min(100, (p.eloquence / maxEloquence) * 100)
    p.rebuttal = Math.min(100, (p.rebuttal / maxRebuttal) * 100)
    p.etiquette = Math.min(100, Math.max(0, (p.etiquette / maxEtiquette) * 50 + 50))

    p.score = Math.round(
      p.logic * 0.30 +
      p.evidence * 0.25 +
      p.eloquence * 0.20 +
      p.rebuttal * 0.15 +
      p.etiquette * 0.10
    )
  })

  players.sort((a, b) => b.score - a.score)
  const winner = players[0]

  // 生成裁判反馈
  const feedbackLines = [
    `🏆 辩论结束！获胜方：**${winner.username}**（${winner.mbtiType || '未知'}）— 综合得分 ${winner.score} 分`,
    '',
    '## 📊 评分明细',
    ...players.map(p => {
      const medals = players.indexOf(p) === 0 ? '🥇' : players.indexOf(p) === 1 ? '🥈' : '🥉'
      return `${medals} **${p.username}**(${p.side === 'pro' ? '正方' : '反方'})：[总分 ${p.score}] 逻辑 ${Math.round(p.logic)} | 论据 ${Math.round(p.evidence)} | 表达 ${Math.round(p.eloquence)} | 反驳 ${Math.round(p.rebuttal)} | 风度 ${Math.round(p.etiquette)}`
    }),
    '',
    '## 💡 裁判点评',
    `• 逻辑性：${winner.username}的论证链条更加严密，因果关系清晰`,
    `• 论据支撑：${players.length > 1 ? '双方' : ''}均有一定的事实依据，${winner.username}的例证更加具体`,
    `• 反驳能力：${winner.username}在回应对手观点时表现更为出色`,
    '',
    `🎁 胜者获得 **30积分**，可用于宠物商城！`
  ]

  return {
    players,
    winner: winner.userId,
    feedback: feedbackLines.join('\n'),
    winnerName: winner.username,
    results: players.map(p => ({
      userId: p.userId,
      username: p.username,
      side: p.side,
      scores: { logic: Math.round(p.logic), evidence: Math.round(p.evidence), eloquence: Math.round(p.eloquence), rebuttal: Math.round(p.rebuttal), etiquette: Math.round(p.etiquette) },
      total: p.score,
    }))
  }
}

// v40：获取房间战斗快照（断线重连时恢复擂台 HP）
pkRoomRoutes.get('/:roomId/battle', (req, res) => {
  const db = getDB()
  const room = db.prepare('SELECT id FROM pk_rooms WHERE id = ?').get(req.params.roomId)
  if (!room) return res.status(404).json({ error: '房间不存在' })
  res.json({ battleStates: getBattleStates(db, req.params.roomId) })
})

// 获取用户对战历史
pkRoomRoutes.get('/history/:userId', (req, res) => {
  const db = getDB()
  const history = db.prepare(`
    SELECT r.*, jr.scores, jr.winner_id, jr.feedback,
      (SELECT COUNT(*) FROM pk_moves WHERE room_id = r.id) as total_moves
    FROM pk_rooms r
    JOIN pk_participants p ON p.room_id = r.id AND p.user_id = ?
    LEFT JOIN pk_judge_results jr ON jr.room_id = r.id
    WHERE r.current_phase = 'finished'
    ORDER BY r.created_at DESC
    LIMIT 20
  `).all(req.params.userId)

  res.json(history)
})
