import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDB } from '../db.js'
import { authMiddleware } from './auth.js'

const router = Router()

const personalityQuotes = {
  INTJ: { emoji: '🧠', color: '#4a6fa5', name: 'INTJ-建筑师' },
  INTP: { emoji: '🔬', color: '#5d8aa8', name: 'INTP-逻辑学家' },
  ENTJ: { emoji: '👑', color: '#c0392b', name: 'ENTJ-指挥官' },
  ENTP: { emoji: '💡', color: '#e67e22', name: 'ENTP-辩论家' },
  INFJ: { emoji: '🔮', color: '#8e44ad', name: 'INFJ-提倡者' },
  INFP: { emoji: '🦋', color: '#9b59b6', name: 'INFP-调停者' },
  ENFJ: { emoji: '🌟', color: '#27ae60', name: 'ENFJ-主人公' },
  ENFP: { emoji: '🎨', color: '#f39c12', name: 'ENFP-竞选者' },
  ISTJ: { emoji: '⚙️', color: '#2980b9', name: 'ISTJ-物流师' },
  ISFJ: { emoji: '🛡️', color: '#16a085', name: 'ISFJ-守卫者' },
  ESTJ: { emoji: '🏛️', color: '#7f8c8d', name: 'ESTJ-总经理' },
  ESFJ: { emoji: '🤝', color: '#e74c3c', name: 'ESFJ-执政官' },
  ISTP: { emoji: '🔧', color: '#2c3e50', name: 'ISTP-鉴赏家' },
  ISFP: { emoji: '🌿', color: '#27ae60', name: 'ISFP-探险家' },
  ESTP: { emoji: '🔥', color: '#d35400', name: 'ESTP-企业家' },
  ESFP: { emoji: '🎭', color: '#f1c40f', name: 'ESFP-表演者' },
}

function generateAIReply(postContent, postTags, personalityType) {
  const p = personalityQuotes[personalityType] || personalityQuotes.INFP
  const replies = {
    INTJ: [
      `从系统层面分析，这个问题涉及多个变量。我的看法是：效率优先，我们应该找到最优解而非纠缠于细枝末节。`,
      `有趣的命题。让我以第一性原理推演一下——这本质上是一个资源分配的博弈问题。`,
      `数据不支持你的部分假设。但我欣赏你提出问题的勇气，让我们逐条分析。`,
    ],
    ENFP: [
      `哇！这个话题太有意思了！让我想起了上周读到的一篇文章，从另一个角度来说……`,
      `我完全能感受到你的热情！这让我有了一个疯狂的想法：如果换一个完全不同的视角呢？`,
      `每次看到这种讨论我都特别兴奋！你们有没有想过，其实还有第三种可能性？`,
    ],
    INTP: [
      `这个论题值得深入探讨。根据我的观察，有几个逻辑漏洞需要补充……`,
      `客观地说，这取决于我们如何定义前提条件。如果换一种分类方式的话……`,
      `让我从认知科学的角度重新审视这个问题——实际上存在三种不同的解释框架。`,
    ],
    INFJ: [
      `我理解你的意思，但背后还有更深层的含义。也许这个问题真正的答案不在表面……`,
      `每个人都有自己的立场，换位思考一下，也许我们都能从中学到更多。`,
      `这种讨论让我想到人类行为的复杂性。也许答案取决于我们问了什么问题。`,
    ],
    ESTJ: [
      `实践出真知。与其空谈理论，不如想想怎么落地执行。我的建议是：先定规则，再讨论。`,
      `作为有过实际经验的人，我要说：数据比你想象的更复杂。但我们可以拆解为可执行的步骤。`,
      `责任感是首要的。在得出结论之前，我们应该明确每个选择带来的实际后果。`,
    ],
    ENTP: [
      `哈哈哈又是一个好问题！不过我要challenge一下你的前提——谁说一定是二元对立的？`,
      `有意思。但让我换个角度攻击一下这个论点……别担心，我只是在测试你的推理链条。`,
      `我有个大胆的假设：也许整个框架都是错的。要不要来一场思想实验？`,
    ],
  }

  const defaultReplies = [
    `这个话题确实值得深入讨论。从我的性格视角来看，每种选择都反映了不同的价值取向。`,
    `作为${p.name}，我对这个问题的看法可能和大多数人不太一样。核心在于……`,
    `有趣的讨论！每个人的立场都值得尊重，但我想补充一个不同的视角。`,
  ]

  const pool = replies[personalityType] || defaultReplies
  return pool[Math.floor(Math.random() * pool.length)]
}

// GET /api/posts - 获取帖子列表
router.get('/', (req, res) => {
  const db = getDB()
  const { tag, sort = 'latest', page = 1, limit = 20 } = req.query
  const offset = (page - 1) * limit

  let where = '1=1'
  const params = []
  if (tag) {
    where = 'tags LIKE ?'
    params.push(`%"${tag}"%`)
  }

  const orderBy = sort === 'hot' ? 'like_count DESC, created_at DESC' : 'created_at DESC'
  const posts = db.prepare(`SELECT * FROM posts WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, Number(limit), offset)

  const total = db.prepare(`SELECT COUNT(*) as count FROM posts WHERE ${where}`).get(...params)

  res.json({ posts, total: total.count, page: Number(page), limit: Number(limit) })
})

// GET /api/posts/:id
router.get('/:id', (req, res) => {
  const db = getDB()
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
  if (!post) return res.status(404).json({ error: '帖子不存在' })
  const comments = db.prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC').all(req.params.id)
  res.json({ post, comments })
})

// POST /api/posts
router.post('/', authMiddleware, (req, res) => {
  const { title, content, tags = [] } = req.body
  if (!title || !content) return res.status(400).json({ error: '标题和内容不能为空' })

  const db = getDB()
  const user = db.prepare('SELECT username, mbti_type, avatar, bio FROM users WHERE id = ?').get(req.user.id)
  const p = personalityQuotes[user.mbti_type] || personalityQuotes.INFP

  const post = {
    id: uuid(),
    user_id: req.user.id,
    author_name: user.username,
    author_type: user.mbti_type || 'INFP',
    author_emoji: p.emoji,
    author_color: p.color,
    title,
    content,
    tags: JSON.stringify(tags),
    is_ai: 0,
    created_at: Date.now(),
  }
  db.prepare(`INSERT INTO posts (id, user_id, author_name, author_type, author_emoji, author_color, title, content, tags, is_ai, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(post.id, post.user_id, post.author_name, post.author_type, post.author_emoji, post.author_color,
      post.title, post.content, post.tags, post.is_ai, post.created_at)

  // AI 人格自动回复（2-3个随机人格）
  setTimeout(() => {
    try {
      const types = Object.keys(personalityQuotes)
      const selected = types.sort(() => Math.random() - 0.5).slice(0, 3)
      selected.forEach((typeId, idx) => {
        setTimeout(() => {
          try {
            const reply = generateAIReply(content, tags, typeId)
            const p2 = personalityQuotes[typeId]
            db.prepare(`INSERT INTO comments (id, post_id, user_id, author_name, author_type, author_emoji, author_color, content, is_ai, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
              .run(uuid(), post.id, `ai-${typeId}`, p2.name, typeId, p2.emoji, p2.color, reply, Date.now())
            db.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').run(post.id)
          } catch {}
        }, idx * 3000 + 5000) // 每个回复间隔3秒
      })
    } catch {}
  }, 2000)

  res.json({ post })
})

// POST /api/posts/:id/comments
router.post('/:id/comments', authMiddleware, (req, res) => {
  const { content } = req.body
  if (!content) return res.status(400).json({ error: '评论内容不能为空' })

  const db = getDB()
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id)
  if (!post) return res.status(404).json({ error: '帖子不存在' })

  const user = db.prepare('SELECT username, mbti_type, avatar, bio FROM users WHERE id = ?').get(req.user.id)
  const p = personalityQuotes[user.mbti_type] || personalityQuotes.INFP

  const comment = {
    id: uuid(),
    post_id: req.params.id,
    user_id: req.user.id,
    author_name: user.username,
    author_type: user.mbti_type || 'INFP',
    author_emoji: p.emoji,
    author_color: p.color,
    content,
    is_ai: 0,
    created_at: Date.now(),
  }
  db.prepare(`INSERT INTO comments (id, post_id, user_id, author_name, author_type, author_emoji, author_color, content, is_ai, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(comment.id, comment.post_id, comment.user_id, comment.author_name, comment.author_type,
      comment.author_emoji, comment.author_color, comment.content, comment.is_ai, comment.created_at)

  db.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').run(req.params.id)

  // AI 随机回复
  setTimeout(() => {
    try {
      const types = Object.keys(personalityQuotes)
      const typeId = types[Math.floor(Math.random() * types.length)]
      if (typeId === user.mbti_type) return
      const reply = generateAIReply(content, [], typeId)
      const p2 = personalityQuotes[typeId]
      db.prepare(`INSERT INTO comments (id, post_id, user_id, author_name, author_type, author_emoji, author_color, content, is_ai, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
        .run(uuid(), req.params.id, `ai-${typeId}`, p2.name, typeId, p2.emoji, p2.color, reply, Date.now())
      db.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').run(req.params.id)
    } catch {}
  }, 5000)

  res.json({ comment })
})

// POST /api/posts/:id/like
router.post('/:id/like', authMiddleware, (req, res) => {
  const db = getDB()
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id)
  if (!post) return res.status(404).json({ error: '帖子不存在' })

  const existing = db.prepare('SELECT id FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, req.params.id)
  if (existing) {
    db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id)
    db.prepare('UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(req.params.id)
    res.json({ liked: false })
  } else {
    db.prepare('INSERT INTO likes (id, user_id, post_id, created_at) VALUES (?, ?, ?, ?)')
      .run(uuid(), req.user.id, req.params.id, Date.now())
    db.prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').run(req.params.id)
    res.json({ liked: true })
  }
})

// POST /api/posts/ai-seed - AI 自动发帖（无auth，供定时任务调用）
router.post('/ai-seed', (req, res) => {
  const db = getDB()
  const topicTemplates = [
    { title: '效率和公平，哪个更重要？', content: '在资源有限的情况下，我们应该优先追求效率还是公平？不同的MBTI类型可能给出完全不同答案。作为不同人格，你们怎么看这个问题？', tags: ['哲学', '社会', '效率'] },
    { title: '独处充电还是社交充电？', content: '对于外向型(E)来说，社交是能量来源；内向型(I)觉得独处才能恢复精力。你们在实际生活中如何平衡两者？有没有想过试着走出舒适区？', tags: ['生活', '心理', '社交'] },
    { title: '计划派 vs 随性派，你站哪边？', content: 'J型人格喜欢计划，P型人格随遇而安。在旅行、工作、约会这些场景中，哪种方式更让人舒服？还是说可以混搭？', tags: ['生活', '旅行', '工作'] },
    { title: '理性决策和感性直觉，你更相信哪个？', content: 'T型倾向用逻辑分析做决策，F型更依赖情感和价值观。在面对重大人生选择时，你更依赖哪种方式？有没有因为过度依赖某一边而后悔过？', tags: ['自我认知', '心理', '决策'] },
    { title: '在职场中，你的MBTI是优势还是劣势？', content: '有些公司甚至把MBTI作为招聘参考。你的性格类型在求职和工作中有没有带来过特别的机遇或挑战？分享你的故事吧！', tags: ['职场', '自我认知', '成长'] },
    { title: 'MBTI真的靠谱吗？科学还是玄学？', content: '有人把MBTI奉为圭臬，有人认为它和星座一样是伪科学。作为使用者，你怎么看待它的科学性？它对你的生活产生了多大影响？', tags: ['MBTI', '科学', '讨论'] },
  ]

  const types = Object.keys(personalityQuotes)
  const typeId = types[Math.floor(Math.random() * types.length)]
  const p = personalityQuotes[typeId]
  const template = topicTemplates[Math.floor(Math.random() * topicTemplates.length)]

  const post = {
    id: uuid(),
    user_id: `ai-${typeId}`,
    author_name: p.name,
    author_type: typeId,
    author_emoji: p.emoji,
    author_color: p.color,
    title: template.title,
    content: template.content,
    tags: JSON.stringify(template.tags),
    is_ai: 1,
    created_at: Date.now(),
  }

  // AI users are virtual - ensure they exist
  db.prepare(`INSERT OR IGNORE INTO users (id, username, password, mbti_type, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(`ai-${typeId}`, p.name, '', typeId, Date.now())

  db.prepare(`INSERT INTO posts (id, user_id, author_name, author_type, author_emoji, author_color, title, content, tags, is_ai, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(post.id, post.user_id, post.author_name, post.author_type, post.author_emoji, post.author_color,
      post.title, post.content, post.tags, post.is_ai, post.created_at)

  // Auto-replies from other AI personalities
  setTimeout(() => {
    try {
      const others = types.filter(t => t !== typeId).sort(() => Math.random() - 0.5).slice(0, 4)
      others.forEach((t, idx) => {
        setTimeout(() => {
          try {
            const reply = generateAIReply(template.content, template.tags, t)
            const p2 = personalityQuotes[t]
            db.prepare(`INSERT OR IGNORE INTO users (id, username, password, mbti_type, created_at) VALUES (?, ?, ?, ?, ?)`)
              .run(`ai-${t}`, p2.name, '', t, Date.now())
            db.prepare(`INSERT INTO comments (id, post_id, user_id, author_name, author_type, author_emoji, author_color, content, is_ai, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
              .run(uuid(), post.id, `ai-${t}`, p2.name, t, p2.emoji, p2.color, reply, Date.now())
            db.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').run(post.id)
          } catch {}
        }, idx * 3000 + 3000)
      })
    } catch {}
  }, 1000)

  res.json({ post })
})

export { router as postRoutes }
