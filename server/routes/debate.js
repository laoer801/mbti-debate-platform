import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDB } from '../db.js'
import { mbtiProfiles, generateDebateResponse } from '../mbti-profiles.js'

export const debateRoutes = Router()

// Start a new debate round - generate responses from all participants
debateRoutes.post('/round', (req, res) => {
  const { topic, participants, history } = req.body

  if (!topic || !participants || participants.length < 2) {
    return res.status(400).json({ error: '需要话题和至少2位参与者' })
  }

  const debateHistory = (history || []).map(h => ({
    typeId: h.type_id || h.typeId,
    content: h.content,
    isUser: h.is_user || h.isUser,
  }))

  const responses = participants.map((typeId, index) => {
    const profile = mbtiProfiles.find(p => p.id === typeId)
    if (!profile) return null

    const { content, confidence } = generateDebateResponse(
      typeId,
      topic,
      debateHistory
    )

    const message = {
      id: uuidv4(),
      typeId,
      typeName: profile.name,
      typeEmoji: profile.emoji,
      typeColor: profile.color,
      content,
      confidence,
      timestamp: Date.now(),
    }

    // Add to history for next participant
    debateHistory.push({
      typeId,
      content,
      isUser: false,
    })

    return message
  }).filter(Boolean)

  res.json({ responses })
})

// Get MBTI profiles list
debateRoutes.get('/profiles', (req, res) => {
  res.json(mbtiProfiles)
})

// Get debate response for a single personality
debateRoutes.post('/respond', (req, res) => {
  const { typeId, topic, history } = req.body

  if (!typeId || !topic) {
    return res.status(400).json({ error: '需要人格ID和话题' })
  }

  const profile = mbtiProfiles.find(p => p.id === typeId)
  if (!profile) {
    return res.status(404).json({ error: '未找到该MBTI人格' })
  }

  const debateHistory = (history || []).map(h => ({
    typeId: h.type_id || h.typeId,
    content: h.content,
    isUser: h.is_user || h.isUser,
  }))

  const { content, confidence } = generateDebateResponse(
    typeId,
    topic,
    debateHistory
  )

  res.json({
    id: uuidv4(),
    typeId,
    typeName: profile.name,
    typeEmoji: profile.emoji,
    typeColor: profile.color,
    content,
    confidence,
    timestamp: Date.now(),
  })
})
