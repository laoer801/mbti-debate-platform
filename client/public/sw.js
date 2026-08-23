// MBTI 辩论平台 — Service Worker (PWA)
// 策略：
//   - 导航请求（index.html）：网络优先 → 部署新版立即生效
//   - 带哈希的静态资源：缓存优先（文件名不可变）
//   - API 请求：网络优先，离线时尝试缓存

const CACHE_NAME = 'mbti-debate-v3'
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
]

// 安装：预缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// 请求拦截
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API 请求：网络优先，离线时尝试缓存
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request))
    return
  }

  // 页面导航（index.html）：网络优先，保证新版本部署后刷新即可生效
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  // 静态资源：缓存优先
  event.respondWith(cacheFirst(request))
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached || new Response(JSON.stringify({ error: '离线模式' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
