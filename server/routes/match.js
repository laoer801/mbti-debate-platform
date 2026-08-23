import { Router } from 'express'
import { getDB } from '../db.js'
import { authMiddleware } from './auth.js'

const router = Router()

// MBTI 兼容性矩阵：分数越高越匹配（0-100）
const compatibilityMatrix = {
  INTJ: { ENFP: 95, ENTP: 90, INFJ: 85, ENTJ: 80, INTP: 75, ISTJ: 60, ESTJ: 55, INFP: 45, ENFJ: 40, ISFJ: 35, ISTP: 30, ESFJ: 25, ESTP: 20, ISFP: 15, ESFP: 10 },
  INTP: { ENTJ: 95, ENTP: 90, ESTJ: 85, INTJ: 80, ISTJ: 70, INFP: 60, INFJ: 55, ENFJ: 45, ESFJ: 35, ESTP: 30, ISFJ: 25, ISTP: 20, ENFP: 15, ISFP: 10, ESFP: 5 },
  ENTJ: { INTP: 95, INTJ: 85, ENTP: 80, ESTJ: 75, ISTP: 70, INFJ: 65, ISTJ: 55, INFP: 45, ENFJ: 40, ESFJ: 30, ESTP: 25, ENFP: 20, ISFJ: 15, ISFP: 10, ESFP: 5 },
  ENTP: { INTJ: 90, INFJ: 90, INTP: 85, ENFP: 80, ENTJ: 75, INFP: 70, ENFJ: 65, ESTP: 55, ISTJ: 40, ESFP: 35, ISTP: 30, ESFJ: 25, ESTJ: 15, ISFJ: 10, ISFP: 5 },
  INFJ: { ENTP: 95, ENFP: 90, INTJ: 85, INFP: 80, ENTJ: 70, INTP: 65, ENFJ: 60, ISFJ: 50, ISTJ: 40, ESFJ: 30, ISFP: 25, ESTJ: 15, ISTP: 10, ESTP: 5, ESFP: 5 },
  INFP: { ENFJ: 95, ENFP: 90, INFJ: 80, ESFJ: 75, ENTP: 70, INTP: 60, ISFP: 55, ENTJ: 45, INTJ: 45, ISFJ: 40, ESFP: 35, ESTJ: 20, ISTJ: 15, ISTP: 10, ESTP: 5 },
  ENFJ: { INFP: 95, INFJ: 85, ENFP: 80, ISFP: 75, ENTP: 65, ESFJ: 55, ENTJ: 45, INTJ: 40, INTP: 40, ESFP: 35, ESTJ: 25, ISTJ: 20, ISFJ: 15, ISTP: 10, ESTP: 5 },
  ENFP: { INTJ: 95, INFJ: 90, INFP: 90, ENFJ: 80, ENTP: 75, ENTJ: 55, ESFP: 50, ISFP: 45, ESFJ: 40, ISTJ: 30, INTP: 25, ESTJ: 20, ISFJ: 15, ISTP: 10, ESTP: 5 },
  ISTJ: { ESFP: 90, ESTP: 85, ESFJ: 80, ISFJ: 75, ESTJ: 70, INTJ: 65, ENTJ: 60, ISTP: 55, INFJ: 45, ENTP: 40, INTP: 35, ENFJ: 30, INFP: 25, ENFP: 20, ISFP: 15 },
  ISFJ: { ESFP: 95, ESTP: 85, ESFJ: 80, ISTJ: 75, ESTJ: 60, ISFP: 55, INFJ: 50, ISTP: 45, ENFJ: 40, ENFP: 35, ENTJ: 25, INTP: 20, INTJ: 15, INFP: 10, ENTP: 5 },
  ESTJ: { ISTP: 95, INTP: 90, ISTJ: 75, ISFJ: 65, ENTJ: 75, ESTP: 60, ESFJ: 55, INTJ: 50, INFJ: 35, ENTP: 30, ENFJ: 25, ESFP: 20, INFP: 15, ENFP: 10, ISFP: 5 },
  ESFJ: { ISFP: 95, INFP: 80, ISTJ: 75, ISFJ: 75, ESTJ: 60, ENFJ: 55, ESFP: 50, ENFP: 45, ESTP: 40, INTP: 30, ENTJ: 25, ENTP: 20, INTJ: 15, INFJ: 10, ISTP: 5 },
  ISTP: { ESTJ: 95, ENTJ: 80, ESTP: 80, ISTJ: 60, ESFP: 55, ESFJ: 45, ISFP: 40, INTJ: 30, ENTP: 25, INTP: 20, INFJ: 15, ENFJ: 15, ISFJ: 10, ENFP: 5, INFP: 5 },
  ISFP: { ESFJ: 95, ENFJ: 80, ESFP: 80, ISFJ: 60, ESTP: 55, ENFP: 50, INFJ: 40, INFP: 35, ISTP: 30, ESTJ: 25, ENTJ: 15, ENTP: 10, ISTJ: 10, INTJ: 5, INTP: 5 },
  ESTP: { ISTJ: 85, ISFJ: 85, ISTP: 75, ESTJ: 65, ESFP: 60, ESFJ: 45, ENTJ: 30, ENTP: 25, INTP: 20, INTJ: 15, INFJ: 10, ENFJ: 10, ISFP: 10, INFP: 5, ENFP: 5 },
  ESFP: { ISTJ: 90, ISFJ: 90, ISFP: 80, ESTJ: 70, ESTP: 65, ESFJ: 60, ENFP: 45, INFP: 35, ENFJ: 30, ENTJ: 15, ISTP: 15, ENTP: 10, INFJ: 10, INTP: 5, INTJ: 5 },
}

// GET /api/match/recommendations
router.get('/recommendations', authMiddleware, (req, res) => {
  const db = getDB()
  const user = db.prepare('SELECT mbti_type FROM users WHERE id = ?').get(req.user.id)
  if (!user?.mbti_type) return res.json({ recommendations: [], message: '请先完成MBTI测试并设置人格类型' })

  const userType = user.mbti_type
  const compat = compatibilityMatrix[userType] || {}

  // Get other real users (not AI)
  const others = db.prepare(`SELECT id, username, mbti_type, bio, avatar FROM users WHERE id != ? AND mbti_type IS NOT NULL AND id NOT LIKE 'ai-%'`)
    .all(req.user.id)

  const recommendations = others
    .map(other => ({
      ...other,
      compatibility: compat[other.mbti_type] || 30,
      matchReason: getMatchReason(userType, other.mbti_type),
    }))
    .sort((a, b) => b.compatibility - a.compatibility)
    .slice(0, 10)

  res.json({ recommendations, userType })
})

// GET /api/match/compatibility/:type1/:type2
router.get('/compatibility/:type1/:type2', (req, res) => {
  const { type1, type2 } = req.params
  const score = (compatibilityMatrix[type1]?.[type2] || compatibilityMatrix[type2]?.[type1] || 50)
  res.json({
    type1,
    type2,
    score,
    reason: getMatchReason(type1, type2),
  })
})

function getMatchReason(type1, type2) {
  const pairs = {
    'INTJ_ENFP': '互补的天作之合——理性与感性的完美平衡',
    'ENFP_INTJ': '互补的天作之合——理性与感性的完美平衡',
    'INTP_ENTJ': '思维碰撞的火花——逻辑与行动力的强强联合',
    'ENTJ_INTP': '思维碰撞的火花——逻辑与行动力的强强联合',
    'INFJ_ENTP': '灵魂深处的共鸣——直觉与创造力的奇妙共振',
    'ENTP_INFJ': '灵魂深处的共鸣——直觉与创造力的奇妙共振',
    'INFP_ENFJ': '价值观的高度契合——理想主义者的浪漫同盟',
    'ENFJ_INFP': '价值观的高度契合——理想主义者的浪漫同盟',
    'ISTJ_ESFP': '生活的互补搭档——稳定与活力的动态平衡',
    'ESFP_ISTJ': '生活的互补搭档——稳定与活力的动态平衡',
    'ISFJ_ESFP': '温暖的守护联盟——细腻关怀与热情活力的融合',
    'ESFP_ISFJ': '温暖的守护联盟——细腻关怀与热情活力的融合',
    'ISTP_ESTJ': '行动派的黄金搭档——务实与高效的完美配合',
    'ESTJ_ISTP': '行动派的黄金搭档——务实与高效的完美配合',
    'ISFP_ESFJ': '美与秩序的和谐——艺术灵魂与组织才能的碰撞',
    'ESFJ_ISFP': '美与秩序的和谐——艺术灵魂与组织才能的碰撞',
  }
  return pairs[`${type1}_${type2}`] || pairs[`${type2}_${type1}`] || '独特的组合——虽然没有天然互补，但差异本身也意味着成长空间'
}

export { router as matchRoutes }
