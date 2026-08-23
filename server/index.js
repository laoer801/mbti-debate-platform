import express from 'express'
import cors from 'cors'
import http from 'http'
import https from 'https'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { Server as SocketIOServer } from 'socket.io'
import { initDB, getDB } from './db.js'
import { debateRoutes } from './routes/debate.js'
import { sessionRoutes } from './routes/sessions.js'
import { authRoutes } from './routes/auth.js'
import { postRoutes } from './routes/posts.js'
import { matchRoutes } from './routes/match.js'
import { kbRoutes } from './routes/kb.js'
import { dailyRoutes } from './routes/daily.js'
import { pkRoomRoutes } from './routes/pk-rooms.js'
import { petRoutes } from './routes/pets.js'
import { userDataRoutes } from './routes/user-data.js'
import { adminRoutes } from './routes/admin.js'
import { newsRoutes } from './routes/news.js'
import { JWT_SECRET } from './secret.js'
import { onlineUsers, broadcastPresence } from './presence.js'
import jwt from 'jsonwebtoken'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const server = http.createServer(app)
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

const PORT = process.env.PORT || 3001
const HTTPS_PORT = process.env.HTTPS_PORT || 3443

// ------------------------------------------------------------
// v40 HTTPS 自签证书（3443 端口）
// 背景：Web Speech API 只在 localhost 或 HTTPS（安全上下文）下可用，
// 手机通过 http://局域网IP 访问时麦克风被静默封锁。
// 方案：启动时若无证书则用 openssl 自签一张（10年），
// 手机改用 https://局域网IP:3443 访问并在浏览器信任证书后即可语音输入。
// ------------------------------------------------------------

/**
 * 确保 HTTPS 自签证书存在（server/certs/server.key + server.crt）
 * @returns {{key: Buffer, cert: Buffer} | null} 生成/读取失败返回 null（跳过 HTTPS）
 */
function ensureSelfSignedCert() {
  const certDir = path.join(__dirname, 'certs')
  const keyPath = path.join(certDir, 'server.key')
  const crtPath = path.join(certDir, 'server.crt')

  if (fs.existsSync(keyPath) && fs.existsSync(crtPath)) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(crtPath) }
  }

  try {
    fs.mkdirSync(certDir, { recursive: true })
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048',
      '-keyout', keyPath, '-out', crtPath,
      '-days', '3650', '-nodes',
      '-subj', '/CN=DebateSphere',
      '-addext', 'subjectAltName=DNS:localhost,IP:0.0.0.0',
    ], { stdio: 'pipe' })
    console.log('HTTPS 自签证书已生成:', certDir)
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(crtPath) }
  } catch (e) {
    console.log('⚠️ HTTPS 自签证书生成失败（未找到 openssl），跳过 3443 端口:', e.message)
    return null
  }
}

app.use(cors())
app.use(express.json())

// Socket.IO — make io accessible in routes
app.set('io', io)

// Routes
app.use('/api/debate', debateRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/match', matchRoutes)
app.use('/api/kb', kbRoutes)
app.use('/api/daily', dailyRoutes)
app.use('/api/pk', pkRoomRoutes)
app.use('/api/pets', petRoutes)
app.use('/api/user', userDataRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/news', newsRoutes)

// v35 内容管理公开读取（前端启动时拉取覆盖本地；写入走 /api/admin 需要管理员）
app.get('/api/content/topics', (req, res) => {
  const db = getDB()
  const topics = db.prepare('SELECT id, title, description, sides, active, created_at FROM debate_topics WHERE active = 1 ORDER BY created_at DESC').all()
  res.json({ topics })
})

app.get('/api/content/overrides', (req, res) => {
  const db = getDB()
  const overrides = db.prepare('SELECT type_id, system_prompt_override, path_advice_override, updated_at FROM persona_overrides').all()
  res.json({ overrides })
})

// v35 在线统计（socket presence 实时数据）
app.get('/api/stats/online', (req, res) => {
  res.json({ count: onlineUsers.size, users: [...onlineUsers.values()] })
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve static frontend (for Electron)
// 支持多级回退：开发模式 client/dist、Electron 打包模式 build/
const staticCandidates = [
  path.join(__dirname, '..', 'client', 'dist'),
  path.join(__dirname, '..', 'build'),
]
const staticDir = staticCandidates.find((d) => fs.existsSync(path.join(d, 'index.html'))) || staticCandidates[0]
app.use(express.static(staticDir))
app.get('*', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'))
})

// WebSocket events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  // v35：客户端携带 token 关联账号 → 纳入在线列表并广播
  socket.on('identify', (payload) => {
    const token = payload && (payload.token || payload)
    if (typeof token !== 'string') return
    try {
      const d = jwt.verify(token, JWT_SECRET)
      onlineUsers.set(socket.id, {
        username: d.username,
        mbtiType: d.mbtiType || null,
        joinedAt: Date.now(),
      })
      console.log('Presence:', d.username, '在线')
    } catch {
      // token 无效则保持匿名在线
      onlineUsers.set(socket.id, { username: null, mbtiType: null, joinedAt: Date.now() })
    }
    broadcastPresence(io)
  })

  socket.on('join-square', () => {
    socket.join('square')
  })

  socket.on('leave-square', () => {
    socket.leave('square')
  })

  // PK 房间事件
  socket.on('join-lobby', () => {
    socket.join('pk-lobby')
  })

  socket.on('leave-lobby', () => {
    socket.leave('pk-lobby')
  })

  socket.on('join-room', (roomId) => {
    socket.join(`pk-room-${roomId}`)
    console.log(`${socket.id} joined room ${roomId}`)
  })

  socket.on('leave-room', (roomId) => {
    socket.leave(`pk-room-${roomId}`)
    console.log(`${socket.id} left room ${roomId}`)
  })

  // 实时语音转文字广播
  socket.on('voice-text', ({ roomId, text, userId, username }) => {
    socket.to(`pk-room-${roomId}`).emit('voice-text', { text, userId, username })
  })

  // 宠物战斗动画同步
  socket.on('pet-attack', ({ roomId, attackerId, targetId, damage, animation }) => {
    io.to(`pk-room-${roomId}`).emit('pet-attack-anim', {
      attackerId, targetId, damage, animation
    })
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
    // v35：移除在线列表并广播
    onlineUsers.delete(socket.id)
    broadcastPresence(io)
  })
})

// Initialize database and start server
initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`MBTI Debate Server running on http://localhost:${PORT}`)
    console.log(`WebSocket ready`)
    console.log(`Database: ${process.env.MBTI_DATA_DIR ? path.join(process.env.MBTI_DATA_DIR, 'debate.db') : path.join(__dirname, 'data', 'debate.db')}`)

    // v40：HTTPS 服务（同一 app + 同一 io 实例，http/https 用户同房间互通）
    const cert = ensureSelfSignedCert()
    const httpsAddresses = []
    if (cert) {
      try {
        const httpsServer = https.createServer({ ...cert }, app)
        io.attach(httpsServer) // 复用同一个 socket.io 实例，房间/在线状态不分裂
        httpsServer.listen(HTTPS_PORT, () => {
          console.log(`🔒 HTTPS (语音识别解锁) running on https://localhost:${HTTPS_PORT}`)
        })
      } catch (e) {
        console.log('⚠️ HTTPS 服务启动失败:', e.message)
      }
    }

    // 打印局域网地址，供手机 App 连接
    const nets = os.networkInterfaces()
    const addresses = []
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push(`http://${net.address}:${PORT}`)
          if (cert) httpsAddresses.push(`https://${net.address}:${HTTPS_PORT}`)
        }
      }
    }
    if (addresses.length > 0) {
      console.log('📱 手机连接地址（同一WiFi）:')
      addresses.forEach(a => console.log(`   ${a}`))
      if (httpsAddresses.length > 0) {
        console.log('🎤 手机语音输入地址（首次访问需信任自签证书:「高级→继续前往」）:')
        httpsAddresses.forEach(a => console.log(`   ${a}`))
      }
    } else {
      console.log('📱 未检测到局域网地址，手机端需手动配置服务器地址')
    }
  })
}).catch(err => {
  console.error('Failed to initialize database:', err)
  process.exit(1)
})
