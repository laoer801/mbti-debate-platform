import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { getServerUrl } from '../config'

// 连接地址：设置页配置的服务器地址（手机端连电脑局域网 IP 时用绝对地址，
// 桌面端默认 localhost，开发环境经 Vite proxy 同源）。
const SOCKET_URL = getServerUrl()

/**
 * socket.io 连接管理 hook
 * 后端是 socket.io 服务端，必须用 socket.io-client 协议连接（原生 WebSocket 不兼容）
 */
export function useSocket(): React.MutableRefObject<Socket | null> {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  return socketRef
}
