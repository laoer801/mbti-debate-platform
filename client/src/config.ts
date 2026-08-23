/**
 * 运行时后端地址配置
 *
 * 优先级：
 *  1. localStorage 中用��手动设置的地址（设置页可改，手机端连电脑局域网 IP 时用）
 *  2. 构建时注入的 VITE_API_BASE（打包 APK 时指定默认服务器）
 *  3. 兜底 http://localhost:3001（桌面/开发环境）
 */

/**
 * 推导默认 API 地址：
 * - 构建时注入的 VITE_API_BASE（打包 APK 时指定默认服务器）
 * - 浏览器 http/https 访问且非 localhost → 用当前页面 origin
 *   （手机/其他电脑通过局域网 IP 访问后端托管的前端时，API 同源直连）
 * - 兜底 http://localhost:3001（Electron/开发环境）
 */
function resolveDefaultApiBase(): string {
  const injected = (import.meta as any).env?.VITE_API_BASE as string | undefined
  if (injected) return injected
  try {
    if (
      typeof window !== 'undefined' &&
      /^https?:$/.test(window.location.protocol) &&
      window.location.hostname &&
      !['localhost', '127.0.0.1'].includes(window.location.hostname)
    ) {
      return window.location.origin
    }
  } catch {
    /* ignore */
  }
  return 'http://localhost:3001'
}

const DEFAULT_API_BASE: string = resolveDefaultApiBase()

const STORAGE_KEY = 'mbti_server_url'

export function getServerUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_API_BASE
  } catch {
    return DEFAULT_API_BASE
  }
}

export function setServerUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, url)
  } catch {
    /* ignore */
  }
}

/** 模块加载时确定的基准地址（改设置后需刷新页面生效） */
export const API_BASE: string = getServerUrl()

/** socket.io 连接地址：同源时用空串走相对路径，跨源时用绝对地址 */
export const SOCKET_BASE: string = API_BASE
