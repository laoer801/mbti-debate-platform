import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { getServerUrl } from '../config'
import { getToken } from './useAuth'

export interface OnlineUser {
  username: string
  mbtiType: string | null
  joinedAt: number
}

const SOCKET_URL = getServerUrl()

/**
 * v35 在线 presence hook
 * 连接 socket.io → identify 关联账号 → 订阅 presence 在线列表
 * 返回：{ onlineUsers, onlineCount, connected }
 */
export function usePresence() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    let disposed = false
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      if (disposed) return
      setConnected(true)
      // 携带 token 关联账号（游客则匿名在线）
      const token = getToken()
      socket.emit('identify', { token: token || '' })
    })

    socket.on('presence', (list: OnlineUser[]) => {
      if (!disposed) setOnlineUsers(Array.isArray(list) ? list : [])
    })

    socket.on('disconnect', () => {
      if (!disposed) {
        setConnected(false)
        setOnlineUsers([])
      }
    })

    return () => {
      disposed = true
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const send = useCallback((event: string, ...args: unknown[]) => {
    socketRef.current?.emit(event, ...args)
  }, [])

  return { onlineUsers, onlineCount: onlineUsers.length, connected, send }
}
