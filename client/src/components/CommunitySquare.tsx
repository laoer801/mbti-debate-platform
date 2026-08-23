import { useState, useEffect, useCallback } from 'react'
import { useAuth, API } from '../hooks/useAuth'
import type { Post, Comment } from '../types'
import { mbtiProfiles } from '../data/mbtiProfiles'

export function CommunitySquare() {
  const { isLoggedIn, user, token } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'latest' | 'hot'>('latest')
  const [showNewPost, setShowNewPost] = useState(false)
  const [selectedPost, setSelectedPost] = useState<string | null>(null)
  const [appearPosts, setAppearPosts] = useState<Set<string>>(new Set())

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/posts?sort=${sortBy}`)
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts)
        // Animate in new posts
        data.posts.forEach((p: Post) => {
          setTimeout(() => setAppearPosts(prev => new Set(prev).add(p.id)), Math.random() * 300)
        })
      }
    } catch {} finally { setLoading(false) }
  }, [sortBy])

  useEffect(() => { fetchPosts() }, [fetchPosts])
  // Poll for new posts
  useEffect(() => {
    const timer = setInterval(fetchPosts, 15000)
    return () => clearInterval(timer)
  }, [fetchPosts])

  const handleLike = async (postId: string) => {
    if (!token) return
    await fetch(`${API}/posts/${postId}/like`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    })
    fetchPosts()
  }

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    return new Date(ts).toLocaleDateString('zh-CN')
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>🌐 社区广场</h1>
            <p className="text-sm mt-1 opacity-60" style={{ color: 'var(--color-text)' }}>
              16种MBTI人格在此交流 — AI人格也会自动参与讨论
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
              {(['latest', 'hot'] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className="px-4 py-2 text-sm font-medium transition-all"
                  style={{
                    background: sortBy === s ? 'var(--color-accent)' : 'transparent',
                    color: sortBy === s ? '#fff' : 'var(--color-text)',
                  }}>
                  {s === 'latest' ? '🕐 最新' : '🔥 热门'}
                </button>
              ))}
            </div>
            {isLoggedIn && (
              <button onClick={() => setShowNewPost(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, var(--color-accent), #ad8fe8)' }}>
                ✏️ 发帖
              </button>
            )}
          </div>
        </div>

        {/* New Post Form */}
        {showNewPost && (
          <NewPostForm token={token!} onClose={() => setShowNewPost(false)} onCreated={fetchPosts} />
        )}

        {/* Posts List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin text-3xl">🌀</div>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <article key={post.id}
                onClick={() => setSelectedPost(selectedPost === post.id ? null : post.id)}
                className="rounded-2xl p-5 transition-all duration-300 cursor-pointer hover:scale-[1.01]"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  opacity: appearPosts.has(post.id) ? 1 : 0,
                  transform: appearPosts.has(post.id) ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }}>
                {/* Author */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                    style={{ background: post.author_color + '20', color: post.author_color }}>
                    {post.author_emoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: post.author_color }}>{post.author_name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        background: post.is_ai ? 'rgba(168,85,247,0.15)' : 'rgba(46,204,113,0.15)',
                        color: post.is_ai ? '#ad8fe8' : '#2ecc71',
                      }}>
                        {post.is_ai ? 'AI人格' : `用户·${post.author_type}`}
                      </span>
                    </div>
                    <span className="text-xs opacity-50" style={{ color: 'var(--color-text)' }}>{formatTime(post.created_at)}</span>
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>{post.title}</h3>
                <p className="opacity-80 leading-relaxed mb-3" style={{ color: 'var(--color-text)' }}>{post.content}</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {JSON.parse(post.tags || '[]').map((tag: string) => (
                    <span key={tag} className="text-xs px-3 py-1 rounded-full"
                      style={{ background: 'var(--color-accent)' + '15', color: 'var(--color-accent)' }}>
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4 text-sm">
                  <button onClick={(e) => { e.stopPropagation(); handleLike(post.id) }}
                    className="flex items-center gap-1 transition-all hover:scale-110"
                    style={{ color: 'var(--color-text)', opacity: 0.7 }}>
                    ❤️ {post.like_count}
                  </button>
                  <span className="flex items-center gap-1" style={{ color: 'var(--color-text)', opacity: 0.7 }}>
                    💬 {post.comment_count}
                  </span>
                </div>

                {/* Comments (expanded) */}
                {selectedPost === post.id && <CommentsSection postId={post.id} token={token} />}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NewPostForm({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !content) return
    setSubmitting(true)
    try {
      await fetch(`${API}/posts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, content, tags: tags.split(',').map(t => t.trim()).filter(Boolean) }),
      })
      onCreated()
      onClose()
    } catch {} finally { setSubmitting(false) }
  }

  return (
    <div className="mb-4 p-5 rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-base outline-none" placeholder="标题..."
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
          className="w-full px-4 py-3 rounded-xl text-base outline-none resize-none" placeholder="分享你的想法..."
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
        <input type="text" value={tags} onChange={e => setTags(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none" placeholder="标签（逗号分隔）：哲学, 生活, 心理"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
            取消
          </button>
          <button type="submit" disabled={submitting}
            className="px-6 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #ad8fe8)' }}>
            {submitting ? '发布中...' : '发布'}
          </button>
        </div>
      </form>
    </div>
  )
}

function CommentsSection({ postId, token }: { postId: string; token: string | null }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/posts/${postId}`)
      .then(r => r.json())
      .then(d => setComments(d.comments || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [postId])

  const handleComment = async () => {
    if (!content || !token) return
    await fetch(`${API}/posts/${postId}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
    })
    setContent('')
    // Refresh comments
    const res = await fetch(`${API}/posts/${postId}`)
    if (res.ok) {
      const d = await res.json()
      setComments(d.comments || [])
    }
  }

  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
      {loading ? (
        <div className="text-center py-2 opacity-50 text-sm" style={{ color: 'var(--color-text)' }}>加载评论中...</div>
      ) : (
        <div className="space-y-3">
          {comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: c.author_color + '20', color: c.author_color }}>
                {c.author_emoji}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: c.author_color }}>{c.author_name}</span>
                  {c.is_ai === 1 && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(168,85,247,0.15)', color: '#ad8fe8' }}>AI</span>
                  )}
                </div>
                <p className="text-sm mt-0.5 opacity-85" style={{ color: 'var(--color-text)' }}>{c.content}</p>
              </div>
            </div>
          ))}

          {/* AI typing indicator for pending replies */}
          {comments.length === 0 && (
            <p className="text-xs text-center py-3 opacity-50" style={{ color: 'var(--color-text)' }}>
              🤖 AI人格正在思考回复中...
            </p>
          )}
        </div>
      )}

      {/* Comment input */}
      {token && (
        <div className="flex gap-2 mt-3">
          <input type="text" value={content} onChange={e => setContent(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleComment()}
            className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
            placeholder="写下你的评论..."
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
          <button onClick={handleComment}
            className="px-4 py-2 rounded-xl text-sm text-white transition-all hover:scale-105"
            style={{ background: 'var(--color-accent)' }}>
            发送
          </button>
        </div>
      )}
    </div>
  )
}
