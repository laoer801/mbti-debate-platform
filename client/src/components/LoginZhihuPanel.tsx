import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { ExternalLink, Cookie } from 'lucide-react'

/**
 * v40.6 用知乎 z_c0 cookie 登录/注册的折叠面板
 * 挂在 LoginForm 底部，支持"未注册自动建账号"
 */
export function LoginZhihuPanel({ onClose }: { onClose: () => void }) {
  const { zhihuLogin } = useAuth()
  const [z_c0, setZc0] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await zhihuLogin(z_c0.trim(), rememberMe)
      onClose()
    } catch (err: any) {
      setError(err.message || '知乎登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 pt-4" style={{ borderTop: '1px dashed var(--color-border)' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-sm font-medium py-1 hover:opacity-80 transition-opacity"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <span className="flex items-center gap-2">
          <Cookie size={14} /> 用知乎账号登录
        </span>
        <span className="text-xs opacity-60">{open ? '收起 ▲' : '展开 ▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs leading-relaxed opacity-75" style={{ color: 'var(--color-text-secondary)' }}>
            知乎 2026 年已关闭公开 OAuth 注册通道。请用浏览器登录
            <a
              href="https://www.zhihu.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-1 font-semibold hover:underline"
              style={{ color: 'var(--color-accent)' }}
            >
              知乎 <ExternalLink size={10} className="inline" />
            </a>
            后按 F12 打开 DevTools → Application → Cookies → www.zhihu.com → 复制 <code className="px-1 rounded" style={{ background: 'var(--color-bg)' }}>z_c0</code> 的 Value 粘到下方。
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                知乎 z_c0 Cookie
              </label>
              <textarea
                value={z_c0}
                onChange={(e) => setZc0(e.target.value)}
                rows={3}
                required
                placeholder="粘贴 z_c0 的值（约 80-200 字符）"
                className="w-full px-3 py-2 rounded-lg text-xs outline-none font-mono focus:ring-2"
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  wordBreak: 'break-all',
                }}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded"
                style={{ accentColor: 'var(--color-accent)' }}
              />
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                记住我（首次使用会自动注册本地账号）
              </span>
            </label>

            {error && (
              <div
                className="p-2 rounded text-xs"
                style={{ background: 'rgba(231,76,60,0.15)', color: '#e74c3c' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || z_c0.trim().length < 60}
              className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 hover:scale-[1.01]"
              style={{ background: 'linear-gradient(135deg, #0084ff, #0066cc)' }}
            >
              {loading ? '验证知乎中...' : '用此 Cookie 登录'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}