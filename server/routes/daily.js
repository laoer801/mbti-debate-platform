// 每日话题 + 成就系统 API
import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'

export const dailyRoutes = Router()

// ====== 每日话题库（20条轮换） ======
const TOPIC_POOL = [
  // 哲学与伦理
  { tag: '哲学', tags: ['哲学', '伦理'], question: '自由意志是否存在？还是我们的一切行为都已被决定？', personality_tags: ['INTP', 'INFJ', 'INTJ'] },
  { tag: '哲学', tags: ['哲学', '科技'], question: 'AI的发展最终会让人类更自由还是更受控制？', personality_tags: ['INTP', 'ENTP', 'INTJ'] },
  { tag: '伦理', tags: ['社会', '伦理'], question: '为了大多数人的利益牺牲少数人，在道德上可接受吗？', personality_tags: ['INFJ', 'INFP', 'ENTJ'] },
  // 科技与社会
  { tag: '科技', tags: ['科技', '社会'], question: '社交媒体让人更连接还是更孤独？', personality_tags: ['ENFJ', 'INFP', 'INTJ'] },
  { tag: '科技', tags: ['科技', '职场'], question: '远程办公是提高效率还是削弱团队凝聚力？', personality_tags: ['ENTJ', 'ISTJ', 'ENFP'] },
  { tag: '科技', tags: ['科技', '教育'], question: '未来学校还需要老师吗？AI能否替代人类教育者？', personality_tags: ['INTP', 'ENFJ', 'ISTJ'] },
  // 人际关系
  { tag: '情感', tags: ['情感', '关系'], question: '爱情的本质是化学反应还是灵魂的共鸣？', personality_tags: ['INFP', 'ENFJ', 'INTJ'] },
  { tag: '情感', tags: ['关系', '成长'], question: '分手后还能做朋友吗？真实答案是什么？', personality_tags: ['ESFJ', 'INFP', 'ENTP'] },
  { tag: '关系', tags: ['关系', '家庭'], question: '原生家庭对一个人的影响有多大？真的无法摆脱吗？', personality_tags: ['INFJ', 'INFP', 'ENTJ'] },
  // 职业与成长
  { tag: '职场', tags: ['职场', '成长'], question: '选择热爱的工作还是高薪的工作？这是伪命题吗？', personality_tags: ['INFP', 'ENTJ', 'ISTJ'] },
  { tag: '职场', tags: ['职场', '领导力'], question: '好的领导者是天生的还是后天培养的？', personality_tags: ['ENTJ', 'ENFJ', 'INTJ'] },
  { tag: '成长', tags: ['成长', '心理'], question: '内向性格在职场中是劣势还是被低估的优势？', personality_tags: ['INTJ', 'INFJ', 'ISTJ'] },
  // 生活态度
  { tag: '生活', tags: ['生活', '价值观'], question: '活在当下和规划未来——哪个才是更聪明的生活方式？', personality_tags: ['ESFP', 'INTJ', 'ISFP'] },
  { tag: '生活', tags: ['生活', '消费'], question: '极简主义是否被过度美化了？物质丰富有什么错？', personality_tags: ['ISTJ', 'ESFP', 'INTP'] },
  { tag: '价值观', tags: ['价值观', '成功'], question: '怎样定义"成功的人生"？财富、影响力还是内心的平静？', personality_tags: ['INTJ', 'INFJ', 'ESFP'] },
  // 创意与艺术
  { tag: '创意', tags: ['创意', '艺术'], question: 'AI生成的艺术算"艺术"吗？谁才配被称为艺术家？', personality_tags: ['INFP', 'ENTP', 'ISTP'] },
  { tag: '创意', tags: ['创意', '原创'], question: '所有的创意都只是已有元素的重新组合——你同意吗？', personality_tags: ['INTP', 'ENFP', 'INTJ'] },
  // 社会议题
  { tag: '社会', tags: ['社会', '公平'], question: '机会平等和结果平等——哪个才是真正的公平？', personality_tags: ['INTJ', 'ENFJ', 'ISTJ'] },
  { tag: '社会', tags: ['社会', '文化'], question: '文化多样性正在消失——全球化是好事还是坏事？', personality_tags: ['INFJ', 'ENTP', 'ISFP'] },
  { tag: '社会', tags: ['社会', '自由'], question: '言论自由应该有边界吗？如果有，边界在哪里？', personality_tags: ['ENTP', 'ISTJ', 'INFP'] },
]

function getDateIndex(offset = 0) {
  const now = new Date()
  now.setDate(now.getDate() + offset)
  // 使用年月日组合作为确定性种子
  const seed = now.getFullYear() * 400 + now.getMonth() * 31 + now.getDate()
  return seed % TOPIC_POOL.length
}

// GET /api/daily/today — 今日话题
dailyRoutes.get('/today', (_req, res) => {
  const idx = getDateIndex()
  const topic = TOPIC_POOL[idx]
  const date = new Date().toISOString().split('T')[0]
  res.json({
    date,
    topic: { ...topic, id: idx },
    total: TOPIC_POOL.length,
  })
})

// GET /api/daily/upcoming — 未来7天话题预览
dailyRoutes.get('/upcoming', (_req, res) => {
  const upcoming = Array.from({ length: 7 }, (_, i) => {
    const idx = getDateIndex(i + 1)
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    return {
      date: d.toISOString().split('T')[0],
      topic: { ...TOPIC_POOL[idx], id: idx },
    }
  })
  res.json({ upcoming })
})

// ====== 成就系统 ======
const ACHIEVEMENTS = [
  { id: 'first_debate', name: '初出茅庐', emoji: '🎤', desc: '完成第一场辩论', iconBg: '#eef2ff' },
  { id: 'ten_debates', name: '辩论达人', emoji: '🏆', desc: '完成10场辩论', iconBg: '#fef3c7' },
  { id: 'fifty_debates', name: '辩论大师', emoji: '👑', desc: '完成50场辩论', iconBg: '#fce7f3' },
  { id: 'perfect_score', name: '冠军时刻', emoji: '💎', desc: '单场获得满分评分', iconBg: '#d1fae5' },
  { id: 'first_post', name: '初入江湖', emoji: '📝', desc: '发表第一篇帖子', iconBg: '#e0e7ff' },
  { id: 'ten_posts', name: '社区明星', emoji: '⭐', desc: '发表10篇帖子', iconBg: '#fef3c7' },
  { id: 'hundred_likes', name: '人气王', emoji: '❤️', desc: '累计获得100个赞', iconBg: '#fce7f3' },
  { id: 'all_types', name: '人格收藏家', emoji: '🌈', desc: '与所有16种人格完成辩论', iconBg: '#ede9fe' },
  { id: 'daily_streak_3', name: '三日之战', emoji: '🔥', desc: '连续3天参与辩论', iconBg: '#ffedd5' },
  { id: 'daily_streak_7', name: '七日之王', emoji: '⚡', desc: '连续7天参与辩论', iconBg: '#fef3c7' },
  { id: 'quick_reply', name: '快枪手', emoji: '⚡', desc: '在30秒内完成一次回复', iconBg: '#dbeafe' },
  { id: 'long_messages', name: '深度思考者', emoji: '🧠', desc: '单条消息超过200字', iconBg: '#e0e7ff' },
]

// GET /api/achievements — 所有成就列表
dailyRoutes.get('/achievements', (_req, res) => {
  res.json({ achievements: ACHIEVEMENTS })
})

// GET /api/achievements/:userId — 用户已解锁成就
dailyRoutes.get('/achievements/:userId', (req, res) => {
  const db = req.app.get('db')
  const { userId } = req.params

  // 统计用户数据判定成就
  const debateCount = db.prepare(
    `SELECT COUNT(*) as cnt FROM messages WHERE type_id = ?`
  ).get(userId)?.cnt || 0

  const postCount = db.prepare(
    `SELECT COUNT(*) as cnt FROM posts WHERE user_id = ?`
  ).get(userId)?.cnt || 0

  const likesReceived = db.prepare(
    `SELECT COUNT(*) as cnt FROM likes l JOIN posts p ON l.post_id = p.id WHERE p.user_id = ?`
  ).get(userId)?.cnt || 0

  const typeRows = db.prepare(
      `SELECT DISTINCT p1.type_id FROM messages m 
       JOIN messages p1 ON m.session_id = p1.session_id 
       WHERE m.type_id = ? AND p1.type_id != ?`
    ).all(userId, userId)
  const typeSet = new Set(typeRows.map(r => r.type_id))

  // 判定成就
  const unlocked = []
  if (debateCount >= 1) unlocked.push('first_debate')
  if (debateCount >= 10) unlocked.push('ten_debates')
  if (debateCount >= 50) unlocked.push('fifty_debates')
  if (postCount >= 1) unlocked.push('first_post')
  if (postCount >= 10) unlocked.push('ten_posts')
  if (likesReceived >= 100) unlocked.push('hundred_likes')
  if (typeSet.size >= 16) unlocked.push('all_types')

  const result = ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked: unlocked.includes(a.id),
  }))

  res.json({ achievements: result, stats: { debateCount, postCount, likesReceived, typesDebated: typeSet.size } })
})
