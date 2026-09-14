/**
 * voiceRoomClient.ts — 多人语音房前端客户端（v40.4）
 *
 * 对应：server/routes/voice-room.js（HTTP + Socket.io）
 *
 * 用法示例：
 *   const client = new VoiceRoomClient({ roomId, userId, username, typeId })
 *   client.connect()
 *   client.on('state', s => updateUI(s))
 *   await client.requestMic()
 *   client.releaseMic()
 *   client.disconnect()
 */

import { io, type Socket } from 'socket.io-client'

export interface VoiceRoomUser {
  userId: string
  username?: string
  typeId?: string
  side: 'pro' | 'con' | 'spectator'
  online: boolean
  micState: 'idle' | 'requesting' | 'speaking'
  spokenCount: number
  totalSeconds: number
}

export interface VoiceRoomState {
  id: string
  topic: string
  topicLocked: boolean
  status: 'waiting' | 'active' | 'cooldown' | 'closing'
  currentSpeakerId: string | null
  speakerSinceAt: number | null
  queue: string[]
  users: Record<string, VoiceRoomUser>
  createdAt: number
}

export interface VoiceRoomClientOptions {
  roomId: string
  userId: string
  username?: string
  typeId?: string
  side?: 'pro' | 'con' | 'spectator'
  /** Socket 服务器 URL，默认当前页 origin */
  serverUrl?: string
}

type Listener = (...args: any[]) => void

export class VoiceRoomClient {
  private socket: Socket | null = null
  private state: VoiceRoomState | null = null
  private listeners = new Map<string, Listener[]>()
  /** 心跳定时器 */
  private heartbeatTimer: number | null = null
  /** 当前倒计时（来自服务端 ticker） */
  private remaining = 0

  constructor(public readonly opts: VoiceRoomClientOptions) {}

  // ===========================================================
  // 事件订阅
  // ===========================================================
  on(event: 'state' | 'mic' | 'speech' | 'participant' | 'ticker', cb: Listener): () => void {
    const arr = this.listeners.get(event) || []
    arr.push(cb)
    this.listeners.set(event, arr)
    return () => {
      const list = this.listeners.get(event) || []
      this.listeners.set(event, list.filter(l => l !== cb))
    }
  }

  private emit(event: string, ...args: any[]) {
    for (const cb of this.listeners.get(event) || []) cb(...args)
  }

  // ===========================================================
  // 连接 / 加入
  // ===========================================================
  async connect(): Promise<void> {
    if (this.socket) return
    this.socket = io(this.opts.serverUrl || '', { transports: ['websocket', 'polling'] })
    await new Promise<void>(resolve => {
      this.socket!.on('connect', () => resolve())
    })
    this.socket.emit('join-voice-room', this.opts.roomId)
    // 1. 调用 join HTTP 接口
    await fetch(`/api/voice-room/${this.opts.roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: this.opts.userId,
        username: this.opts.username,
        typeId: this.opts.typeId,
        side: this.opts.side || 'spectator',
      }),
    })
    // 2. 启动心跳（每 2 秒）
    this.startHeartbeat()
    // 3. 订阅 socket 事件
    this.socket.on('vr:state', (s: VoiceRoomState) => { this.state = s; this.emit('state', s) })
    this.socket.on('vr:mic-changed', (m: any) => { this.patchMic(m); this.emit('mic', m) })
    this.socket.on('vr:speech', (s: any) => this.emit('speech', s))
    this.socket.on('vr:participant', (p: any) => this.patchParticipant(p); this.emit('participant', p))
    this.socket.on('vr:ticker', (t: { remaining: number }) => {
      this.remaining = t.remaining
      this.emit('ticker', t.remaining)
    })
    // 4. 拉一次初值
    const r = await fetch(`/api/voice-room/${this.opts.roomId}`)
    if (r.ok) {
      const json = await r.json()
      this.state = json.room
      this.emit('state', json.room)
    }
  }

  async disconnect() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.socket) {
      this.socket.emit('leave-voice-room', this.opts.roomId)
      await fetch(`/api/voice-room/${this.opts.roomId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.opts.userId }),
      })
      this.socket.disconnect()
    }
    this.socket = null
  }

  private startHeartbeat() {
    this.heartbeatTimer = window.setInterval(() => {
      fetch(`/api/voice-room/${this.opts.roomId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.opts.userId }),
      }).catch(() => undefined)
    }, 2000)
  }

  // ===========================================================
  // 麦序 API
  // ===========================================================
  async requestMic(): Promise<{ isSpeaker: boolean; queuePosition: number } | { error: string }> {
    const r = await fetch(`/api/voice-room/${this.opts.roomId}/request-mic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: this.opts.userId }),
    })
    return r.json()
  }

  async releaseMic(): Promise<{ ok: boolean } | { error: string }> {
    const r = await fetch(`/api/voice-room/${this.opts.roomId}/release-mic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: this.opts.userId }),
    })
    return r.json()
  }

  /** 上报一段发言文本（其他端通过 socket 收到，可触发 TTS） */
  async reportSpeech(transcript: string): Promise<void> {
    await fetch(`/api/voice-room/${this.opts.roomId}/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: this.opts.userId, transcript }),
    })
  }

  /** 强制当前 speaker 下麦（房主或超时） */
  async autoNext(): Promise<{ ok: boolean }> {
    const r = await fetch(`/api/voice-room/${this.opts.roomId}/auto-next`, { method: 'POST' })
    return r.json()
  }

  // ===========================================================
  // 辅助
  // ===========================================================
  getState() { return this.state }
  getRemainingSeconds() { return this.remaining }
  isSpeaker() { return this.state?.currentSpeakerId === this.opts.userId }
  getOnlineUsers() {
    return this.state ? Object.values(this.state.users).filter(u => u.online) : []
  }

  private patchMic(m: { currentSpeakerId: string | null; queue: string[]; speakerSinceAt: number | null }) {
    if (this.state) {
      this.state.currentSpeakerId = m.currentSpeakerId
      this.state.queue = m.queue
      this.state.speakerSinceAt = m.speakerSinceAt
    }
  }

  private patchParticipant(p: { userId: string; online: boolean }) {
    if (this.state?.users?.[p.userId]) {
      this.state.users[p.userId].online = p.online
    }
  }
}

/** 创建语音房（任意用户） */
export async function createVoiceRoom(topic: string, createdBy?: string, maxParticipants = 8) {
  const r = await fetch('/api/voice-room/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, createdBy, maxParticipants }),
  })
  return r.json()
}

/** 列出所有公开房间 */
export async function listVoiceRooms(): Promise<{ id: string; topic: string; status: string; created_at: number }[]> {
  const r = await fetch('/api/voice-room/list')
  if (!r.ok) return []
  return r.json()
}
