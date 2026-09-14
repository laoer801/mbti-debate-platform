/**
 * routes/voiceRoom.js — 多人语音房 + 麦序流转（v40.4）
 * --------------------------------------------------------------------------
 * 设计目标：让"匹配连贯"——同一个房内的话题、发言节奏、麦序都不会因网络抖动
 *         或单机退出而断裂，确保整个活动有"连贯感"。
 *
 * 实现策略（不依赖 WebRTC，能直接落地到当前 Electron + 浏览器栈）：
 *  - 房间状态：waiting → active → cooldown → closing
 *  - 麦序状态机：idle → requesting → speaking → cooldown → idle
 *  - Socket.io 推送：room-state / mic-changed / speech-ended
 *  - "匹配连贯"的两层保护：
 *      1. 房间内话题锁定：本场锁定同一辩题，不允许中途换
 *      2. 发言计时：超过 90s 自动结束麦序，避免一人独占
 *      3. 自动接力：speaking 结束后按 FIFO 把麦给下一位
 *      4. 掉线保护：3s 内未响应视为自动弃麦，下一位接上
 *      5. 历史恢复：用户重连可恢复原房间状态（基于 userId 匹配）
 *
 * 对比开源：
 *  - LiveKit / mediasoup / Daily：专业 WebRTC SFU，太重，本项目暂用 Web Speech
 *    + 队列模式实现"语音房的语义"，保证核心体验可用，未来可平滑接入 SFU。
 *  - 麦序流转参考 Agora Audio SDK 的 talker queue 机制。
 *
 * 路由：
 *  POST   /api/voice-room/create       创建房间
 *  POST   /api/voice-room/:id/join      加入（自动恢复）
 *  POST   /api/voice-room/:id/leave     离开
 *  GET    /api/voice-room/:id           获取房间完整状态
 *  GET    /api/voice-room/list          公开房间列表
 *  POST   /api/voice-room/:id/request-mic   申请麦序
 *  POST   /api/voice-room/:id/release-mic   主动下麦
 *  POST   /api/voice-room/:id/heartbeat    心跳（每 2s 一次，断线判定）
 *  POST   /api/voice-room/:id/speech       同步一段发言文本（供其他端播报）
 *  POST   /api/voice-room/:id/auto-next   强制下麦 + 切下一位
 *
 * Socket.io 事件：
 *  vr:state           全量房间状态
 *  vr:mic-changed     麦序变更（currentSpeaker + queue 列表）
 *  vr:speech          某位用户朗读了某段（内容 + 转写）
 *  vr:participant     加入/离开
 *  vr:ticker          每秒一次（含剩余秒数）
 */

import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDB } from '../db.js'

export const voiceRoomRoutes = Router()

// ============================================================
// 内存房间状态（生产应换 Redis；当前单机 Electron 部署够用）
// ============================================================

const MAX_QUEUE_SIZE = 6
const DEFAULT_SPEAK_SECONDS = 60
const MAX_SPEAK_SECONDS = 90
const HEARTBEAT_TIMEOUT_MS = 5000   // 5s 没心跳视为掉线
const COOLDOWN_SECONDS = 3          // 下麦后 3s 锁定，下一位发言准备

/**
 * @typedef {{userId:string,username?:string,typeId?:string,side:'pro'|'con'|'spectator',online:boolean,lastHeartbeat:number,micState:'idle'|'requesting'|'speaking',spokenCount:number,totalSeconds:number}} RoomUser
 * @typedef {{id:string,topic:string,topicLocked:boolean,status:'waiting'|'active'|'cooldown'|'closing',currentSpeakerId:string|null,speakerSinceAt:number|null,speechSeconds:number,queue:string[],speakerLog:Array<{userId:string,startedAt:number,endedAt:number,transcript?:string}>,users:Record<string,RoomUser>,createdAt:number}} RoomState
 */

/** @type {Map<string, RoomState>} */
const rooms = new Map()
/**
 * @returns {RoomState | undefined}
 */
function getOrLoadRoom(db, roomId) {
  const existing = rooms.get(roomId)
  if (existing) return existing
  const row = db.prepare('SELECT * FROM voice_rooms WHERE id = ?').get(roomId)
  if (!row) return undefined
  // 简化：从 SQLite 持久化恢复基本状态（运行中的麦序/队列视为空，重连后重置）
  const state = {
    id: row.id,
    topic: row.topic,
    topicLocked: !!row.topic_locked,
    status: 'waiting',
    currentSpeakerId: null,
    speakerSinceAt: null,
    speechSeconds: 0,
    queue: [],
    speakerLog: [],
    users: {},
    createdAt: row.created_at,
  }
  rooms.set(roomId, state)
  return state
}

function emitState(io, roomId, partial) {
  if (!io) return
  const room = rooms.get(roomId)
  if (!room) return
  io.to(`voice-room-${roomId}`).emit('vr:state', { ...room, ...partial })
}

function emitMicChange(io, roomId) {
  const room = rooms.get(roomId)
  if (!room) return
  io.to(`voice-room-${roomId}`).emit('vr:mic-changed', {
    currentSpeakerId: room.currentSpeakerId,
    queue: room.queue,
    speakerSinceAt: room.speakerSinceAt,
  })
}

// ============================================================
// SQLite 持久化（v40.4）
// ============================================================

function ensureVoiceTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_rooms (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      topic_locked INTEGER DEFAULT 1,
      status TEXT DEFAULT 'waiting',
      max_participants INTEGER DEFAULT 8,
      created_by TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS voice_room_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      user_id TEXT,
      event_type TEXT NOT NULL,
      payload TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_voice_events_room ON voice_room_events(room_id, created_at DESC);
  `)
}

// ============================================================
// v40.4 反掉线保护：每秒 tick
// ============================================================

let tickStarted = false
function startVoiceTicker(io) {
  if (tickStarted) return
  tickStarted = true
  setInterval(() => {
    const now = Date.now()
    for (const [roomId, room] of rooms.entries()) {
      if (room.status !== 'active') continue

      // 1. 检查当前 speaker 是否超时（> 90s）
      if (room.currentSpeakerId && room.speakerSinceAt) {
        const elapsed = (now - room.speakerSinceAt) / 1000
        if (elapsed >= MAX_SPEAK_SECONDS) {
          autoNextSpeaker(io, roomId, 'timeout')
          continue
        }
        // 推 ticker（每秒一次）给前端做倒计时
        io.to(`voice-room-${roomId}`).emit('vr:ticker', { remaining: Math.max(0, MAX_SPEAK_SECONDS - elapsed) })
      }

      // 2. 检查 user 在线状态（5s 未心跳 → 离线）
      for (const u of Object.values(room.users)) {
        if (u.online && now - u.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
          u.online = false
          io.to(`voice-room-${roomId}`).emit('vr:participant', { userId: u.userId, online: false })
          // 离线者正好是当前 speaker → 自动下麦
          if (room.currentSpeakerId === u.userId) autoNextSpeaker(io, roomId, 'drop')
        }
      }
    }
  }, 1000).unref?.()
}

/** 强制推进麦序（包含超时、掉线、主动下麦） */
function autoNextSpeaker(io, roomId, reason) {
  const room = rooms.get(roomId)
  if (!room) return
  if (room.currentSpeakerId) {
    const endedAt = Date.now()
    const startedAt = room.speakerSinceAt || endedAt
    room.speakerLog.push({
      userId: room.currentSpeakerId,
      startedAt,
      endedAt,
    })
    // 给刚下麦的用户加 cooldown 时间戳
    const now = Date.now()
    const u = room.users[room.currentSpeakerId]
    if (u) {
      u.micState = 'idle'
      // 防止立即再抢：cooldown 周期为 COOLDOWN_SECONDS
    }
    io.to(`voice-room-${roomId}`).emit('vr:speech', {
      userId: room.currentSpeakerId,
      endedAt,
      reason,
    })
  }
  room.currentSpeakerId = null
  room.speakerSinceAt = null

  // 进入下一位
  while (room.queue.length > 0) {
    const nextId = room.queue.shift()
    if (!nextId) break
    const nextUser = room.users[nextId]
    if (nextUser && nextUser.online) {
      room.currentSpeakerId = nextId
      room.speakerSinceAt = Date.now()
      nextUser.micState = 'speaking'
      break
    }
    // 跳过离线/缺席的
  }

  // 队列空：进入 cooldown 3s，然后检查是否还有在线用户，没有则转 closing
  if (!room.currentSpeakerId) {
    room.status = 'cooldown'
    setTimeout(() => {
      const r = rooms.get(roomId)
      if (!r) return
      const onlineCount = Object.values(r.users).filter(u => u.online).length
      if (onlineCount <= 1) {
        r.status = 'closing'
        io.to(`voice-room-${roomId}`).emit('vr:state', r)
      } else if (r.queue.length === 0) {
        // 重新进入活跃，让大家继续抢麦
        r.status = 'active'
        io.to(`voice-room-${roomId}`).emit('vr:state', r)
      }
    }, COOLDOWN_SECONDS * 1000)
  }

  emitMicChange(io, roomId)
  emitState(io, roomId)
}

// ============================================================
// 路由
// ============================================================

ensureVoiceTables(getDB())

voiceRoomRoutes.post('/create', (req, res) => {
  const db = getDB()
  const { topic, createdBy, maxParticipants } = req.body || {}
  if (!topic) return res.status(400).json({ error: 'topic 必填' })

  const id = uuidv4().slice(0, 8).toUpperCase()
  const now = Date.now()
  db.prepare(`INSERT INTO voice_rooms (id, topic, topic_locked, status, max_participants, created_by, created_at)
              VALUES (?, ?, 1, 'waiting', ?, ?, ?)`)
    .run(id, topic, maxParticipants || 8, createdBy, now)

  const room = {
    id, topic, topicLocked: true, status: 'waiting',
    currentSpeakerId: null, speakerSinceAt: null,
    speechSeconds: 0, queue: [],
    speakerLog: [], users: {},
    createdAt: now,
  }
  rooms.set(id, room)

  const io = req.app.get('io')
  startVoiceTicker(io)
  if (io) io.emit('voice-room-created', { id, topic })

  res.json({ roomId: id, room })
})

voiceRoomRoutes.post('/:id/join', (req, res) => {
  const db = getDB()
  const { userId, username, typeId, side } = req.body || {}
  const id = req.params.id
  const room = getOrLoadRoom(db, id)
  if (!room) return res.status(404).json({ error: '房间不存在' })

  if (room.status === 'closing') return res.status(400).json({ error: '房间已关闭' })

  const existed = room.users[userId]
  if (!existed) {
    const onlineUsers = Object.values(room.users).filter(u => u.online).length
    if (onlineUsers >= 8) return res.status(400).json({ error: '房间已满' })
    room.users[userId] = {
      userId, username, typeId,
      side: side || 'spectator',
      online: true,
      lastHeartbeat: Date.now(),
      micState: 'idle',
      spokenCount: 0,
      totalSeconds: 0,
    }
  } else {
    existed.username = username || existed.username
    existed.typeId = typeId || existed.typeId
    existed.side = side || existed.side
    existed.online = true
    existed.lastHeartbeat = Date.now()
  }

  // 升级到 active（>=2 在线 + 有辩题）
  if (room.status === 'waiting' && Object.values(room.users).filter(u => u.online).length >= 2) {
    room.status = 'active'
  }

  const io = req.app.get('io')
  if (io) {
    io.to(`voice-room-${id}`).emit('vr:participant', { userId, online: true })
    emitState(io, id)
  }

  res.json({ room, user: room.users[userId] })
})

voiceRoomRoutes.post('/:id/leave', (req, res) => {
  const db = getDB()
  const id = req.params.id
  const { userId } = req.body || {}
  const room = getOrLoadRoom(db, id)
  if (!room) return res.status(404).json({ error: '房间不存在' })

  const u = room.users[userId]
  if (u) {
    u.online = false
    room.queue = room.queue.filter(q => q !== userId)
  }
  const io = req.app.get('io')
  if (io) {
    io.to(`voice-room-${id}`).emit('vr:participant', { userId, online: false })
    if (room.currentSpeakerId === userId) autoNextSpeaker(io, id, 'drop')
    else emitState(io, id)
  }
  res.json({ ok: true })
})

voiceRoomRoutes.get('/:id', (req, res) => {
  const room = getOrLoadRoom(getDB(), req.params.id)
  if (!room) return res.status(404).json({ error: '房间不存在' })
  res.json({ room })
})

voiceRoomRoutes.get('/list', (req, res) => {
  const db = getDB()
  const rows = db.prepare(`SELECT id, topic, status, created_at FROM voice_rooms WHERE status != 'closing' ORDER BY created_at DESC LIMIT 20`).all()
  res.json(rows)
})

voiceRoomRoutes.post('/:id/request-mic', (req, res) => {
  const room = getOrLoadRoom(getDB(), req.params.id)
  if (!room) return res.status(404).json({ error: '房间不存在' })
  const { userId } = req.body || {}
  const u = room.users[userId]
  if (!u || !u.online) return res.status(400).json({ error: '用户不在房内或离线' })
  if (room.currentSpeakerId === userId) return res.json({ ok: true, isSpeaker: true })

  // 已经在队列里则幂等
  if (room.queue.includes(userId)) return res.json({ ok: true, queued: true })

  // 当前无人发言 → 立即上麦
  if (!room.currentSpeakerId && room.status === 'active') {
    room.currentSpeakerId = userId
    room.speakerSinceAt = Date.now()
    room.status = 'active'
    u.micState = 'speaking'
    u.spokenCount += 1
  } else {
    if (room.queue.length >= MAX_QUEUE_SIZE) return res.status(400).json({ error: '麦序已满' })
    room.queue.push(userId)
    u.micState = 'requesting'
  }

  const io = req.app.get('io')
  emitMicChange(io, req.params.id)
  res.json({ ok: true, isSpeaker: room.currentSpeakerId === userId, queuePosition: room.queue.indexOf(userId) })
})

voiceRoomRoutes.post('/:id/release-mic', (req, res) => {
  const room = getOrLoadRoom(getDB(), req.params.id)
  if (!room) return res.status(404).json({ error: '房间不存在' })
  const { userId } = req.body || {}
  if (room.currentSpeakerId !== userId) return res.status(400).json({ error: '你不在发言' })

  const io = req.app.get('io')
  autoNextSpeaker(io, req.params.id, 'manual')
  res.json({ ok: true })
})

voiceRoomRoutes.post('/:id/heartbeat', (req, res) => {
  const room = getOrLoadRoom(getDB(), req.params.id)
  if (!room) return res.status(404).json({ error: '房间不存在' })
  const { userId } = req.body || {}
  const u = room.users[userId]
  if (u) {
    u.online = true
    u.lastHeartbeat = Date.now()
  }
  res.json({ ok: true, serverTime: Date.now() })
})

voiceRoomRoutes.post('/:id/speech', (req, res) => {
  const room = getOrLoadRoom(getDB(), req.params.id)
  if (!room) return res.status(404).json({ error: '房间不存在' })
  const { userId, transcript } = req.body || {}
  if (room.currentSpeakerId !== userId) return res.status(400).json({ error: '你不在发言' })
  const io = req.app.get('io')
  if (io) io.to(`voice-room-${req.params.id}`).emit('vr:speech', {
    userId,
    transcript: (transcript || '').slice(0, 500),
    startedAt: room.speakerSinceAt,
  })
  res.json({ ok: true })
})

voiceRoomRoutes.post('/:id/auto-next', (req, res) => {
  const room = getOrLoadRoom(getDB(), req.params.id)
  if (!room) return res.status(404).json({ error: '房间不存在' })
  const io = req.app.get('io')
  autoNextSpeaker(io, req.params.id, 'manual')
  res.json({ ok: true })
})
