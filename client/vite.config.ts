import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      // socket.io 实时通信（WebSocket 升级）
      '/socket.io': { target: 'http://localhost:3001', ws: true }
    }
  }
})
