import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { mbtiProfiles } from '../data/mbtiProfiles'
import { Eye, EyeOff } from 'lucide-react'

export function LoginForm({ onClose }: { onClose: () => void }) {
  const { login, register } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [mbtiType, setMbtiType] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isRegister) {
        await register(username, password, mbtiType || undefined)
      } else {
        await login(username, password, rememberMe)
      }
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md p-8 rounded-2xl shadow-2xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          {isRegister ? '🚀 加入MBTI社区' : '👋 欢迎回来'}
        </h2>
        <p className="text-sm mb-6 opacity-60" style={{ color: 'var(--color-text)' }}>
          {isRegister ? '创建账号，开始你的MBTI社交之旅' : '登录后参与社区讨论'}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(231,76,60,0.15)', color: '#e74c3c' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>用户名</label>
            <input
              type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-base outline-none transition-all focus:ring-2"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              placeholder="至少2个字符" minLength={2} required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>密码</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-10 rounded-xl text-base outline-none transition-all focus:ring-2"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                placeholder="至少4个字符" minLength={4} required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:opacity-80 transition-opacity"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {!isRegister && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                className="rounded" style={{ accentColor: 'var(--color-accent)' }}
              />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>记住我，下次自动登录</span>
            </label>
          )}

          {isRegister && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>MBTI 类型（可选）</label>
              <select
                value={mbtiType} onChange={e => setMbtiType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-base outline-none transition-all focus:ring-2"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              >
                <option value="">尚未测试 / 暂不选择</option>
                {mbtiProfiles.map(p => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.id} - {p.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #ad8fe8)' }}
          >
            {loading ? '处理中...' : isRegister ? '注册' : '登录'}
          </button>
        </form>

        <p className="mt-4 text-sm text-center" style={{ color: 'var(--color-text)', opacity: 0.7 }}>
          {isRegister ? '已有账号？' : '还没有账号？'}
          <button onClick={() => { setIsRegister(!isRegister); setError('') }}
            className="ml-1 font-semibold hover:underline" style={{ color: 'var(--color-accent)' }}>
            {isRegister ? '去登录' : '去注册'}
          </button>
        </p>
      </div>
    </div>
  )
}
