import { useEffect, useState } from 'react'
import { Star, Loader2 } from 'lucide-react'
import { getToken, useAuth } from '../hooks/useAuth'
import { checkFavorite, addFavorite, removeFavorite, type FavoriteItemType } from '../utils/favoritesClient'

/**
 * v40.7 收藏按钮：放在内容卡片右上角，点一下 toggle 收藏
 *
 * @param itemType 'answer' | 'article' | 'question' | 'post'
 * @param itemId   知乎 ID / 本地 post ID
 * @param title    收藏时的标题
 * @param summary  收藏时的摘要
 * @param url      收藏时的链接
 * @param thumbnail 缩略图
 * @param author   作者
 * @param source   'zhihu' | 'local'
 */
export function FavoriteButton({
  itemType,
  itemId,
  title,
  summary,
  url,
  thumbnail,
  author,
  source = 'zhihu',
  size = 16,
  className = '',
}: {
  itemType: FavoriteItemType
  itemId: string
  title: string
  summary?: string
  url?: string
  thumbnail?: string
  author?: string
  source?: 'zhihu' | 'local'
  size?: number
  className?: string
}) {
  const { isLoggedIn } = useAuth()
  const [favorited, setFavorited] = useState(false)
  const [favoriteId, setFavoriteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) {
      setFavorited(false)
      setFavoriteId(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const r = await checkFavorite(getToken(), itemType, itemId)
        if (!cancelled) {
          setFavorited(r.favorited)
          setFavoriteId(r.favoriteId)
        }
      } catch {
        // 静默失败：未登录或网络错误
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isLoggedIn, itemType, itemId])

  if (!isLoggedIn) return null

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (loading) return
    setLoading(true)
    try {
      if (favorited && favoriteId) {
        await removeFavorite(getToken(), favoriteId)
        setFavorited(false)
        setFavoriteId(null)
      } else {
        const fav = await addFavorite(getToken(), {
          item_type: itemType,
          item_id: itemId,
          title,
          summary,
          url,
          thumbnail,
          author,
          source,
        })
        setFavorited(true)
        setFavoriteId(fav.id)
      }
    } catch (e) {
      // 静默：右上角小按钮不打扰用户
      console.warn('收藏 toggle 失败', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={loading}
      title={favorited ? '取消收藏' : '收藏'}
      aria-label={favorited ? '取消收藏' : '收藏'}
      className={
        'inline-flex items-center justify-center rounded-full p-1 transition-all disabled:opacity-50 ' +
        className
      }
      style={{
        background: favorited || hovered ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
        color: favorited ? '#fbbf24' : 'var(--color-text-secondary)',
      }}
    >
      {loading ? (
        <Loader2 size={size} className="animate-spin" />
      ) : (
        <Star
          size={size}
          fill={favorited ? 'currentColor' : 'none'}
          strokeWidth={2}
        />
      )}
    </button>
  )
}