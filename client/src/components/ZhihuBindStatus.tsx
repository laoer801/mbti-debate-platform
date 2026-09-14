import { useEffect, useState } from 'react'
import { getToken } from '../hooks/useAuth'
import {
  getZhihuBinding,
  bindZhihu,
  unbindZhihu,
  type ZhihuBinding,
} from '../utils/zhihuAuthClient'
import { Check, Link2, RefreshCw, Trash2 } from 'lucide-react'

/**
 * v40.6 知乎账号绑定状态 + 换绑/解绑面板
 * 放在 SettingsPage 里，让已登录用户管理知乎账号关联
 */
export function ZhihuBindStatus() {
  const [binding, setBinding] = useState<ZhihuBinding | null>(null)
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [z_c0, setZc0] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const refresh = async () => {
    setLoading(true)
    try {
      const b = await getZhihuBinding(getToken())
      setBinding(b)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleBind = async () => {
    if (z_c0.trim().length < 60) {
      setError('z_c0 长度过短，请粘贴完整的 cookie value')
      return
    }
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await bindZhihu(getToken(), z_c0.trim())
      setSuccess('已绑定知乎账号')
      setZc0('')
      setEditMode(false)
      await refresh()
    } catch (e: any) {
      setError(e.message || '绑定失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUnbind = async () => {
    if (!confirm('确定解绑知乎账号？解绑后无法再同步到知乎收藏夹。')) return
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await unbindZhihu(getToken())
      setSuccess('已解绑')
      await refresh()
    } catch (e: any) {
      setError(e.message || '解绑失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Link2 size={16} style={{ color: 'var(--color-accent)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          知乎账号绑定
        </h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="ml-auto p-1 rounded hover:opacity-70 disabled:opacity-40"
          style={{ color: 'var(--color-text-secondary)' }}
          title="刷新"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div
          className="mb-3 p-2 rounded text-xs"
          style={{ background: 'rgba(231,76,60,0.15)', color: '#e74c3c' }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="mb-3 p-2 rounded text-xs"
          style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
        >
          {success}
        </div>
      )}

      {binding?.bound ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--color-surface)' }}>
            {binding.zhihuAvatar && (
              <img
                src={binding.zhihuAvatar}
                alt={binding.zhihuUsername}
                className="w-10 h-10 rounded-full object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                {binding.zhihuUsername || '知乎用户'}
              </div>
              <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                ID: {binding.zhihuUserId}
                {binding.status === 'active' ? (
                  <span className="flex items-center gap-0.5 text-green-500">
                    <Check size={10} /> 已激活
                  </span>
                ) : binding.status === 'expired' ? (
                  <span className="text-orange-500">⚠ Cookie 已失效</span>
                ) : (
                  <span className="text-red-500">已撤销</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setEditMode(!editMode)}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              {editMode ? '取消换绑' : '换绑 / 续期'}
            </button>
            <button
              onClick={handleUnbind}
              disabled={loading}
              className="px-3 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
              style={{ background: 'rgba(231,76,60,0.1)', color: '#e74c3c' }}
            >
              <Trash2 size={12} className="inline mr-1" />解绑
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditMode(true)}
          className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.01]"
          style={{ background: 'linear-gradient(135deg, #0084ff, #0066cc)' }}
        >
          绑定知乎账号
        </button>
      )}

      {editMode && (
        <div className="mt-3 space-y-2">
          <p className="text-xs leading-relaxed opacity-75" style={{ color: 'var(--color-text-secondary)' }}>
            从知乎 DevTools → Application → Cookies → www.zhihu.com → 复制 <code>z_c0</code> 的 Value。
          </p>
          <textarea
            value={z_c0}
            onChange={(e) => setZc0(e.target.value)}
            rows={3}
            placeholder="粘贴 z_c0 的值"
            className="w-full px-3 py-2 rounded-lg text-xs outline-none font-mono focus:ring-2"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              wordBreak: 'break-all',
            }}
          />
          <button
            onClick={handleBind}
            disabled={loading || z_c0.trim().length < 60}
            className="w-full py-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #0084ff, #0066cc)' }}
          >
            {loading ? '验证中...' : binding?.bound ? '换绑' : '绑定'}
          </button>
        </div>
      )}
    </div>
  )
}