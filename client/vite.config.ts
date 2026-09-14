import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // v40.5：让 .ts 后缀的文件也能解析 JSX（debateMasterClient.ts 等内含 React 节点）
  esbuild: {
    loader: 'tsx',
    include: /src\/.*\.(ts|tsx)$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.ts': 'tsx' },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      // socket.io 实时通信（WebSocket 升级）
      '/socket.io': { target: 'http://localhost:3001', ws: true }
    }
  }
})

