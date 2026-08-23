// v35 在线 presence — socket.io 连接级在线用户管理
// onlineUsers: Map<socketId, { username, mbtiType, joinedAt }>
// 前端连接后发 identify（带 token）把匿名连接关联到账号；disconnect 自动移除

export const onlineUsers = new Map()

export function serializeOnline() {
  return [...onlineUsers.values()].map(u => ({
    username: u.username || '游客',
    mbtiType: u.mbtiType || null,
    joinedAt: u.joinedAt,
  }))
}

export function broadcastPresence(io) {
  const list = serializeOnline()
  io.emit('presence', list)
}
