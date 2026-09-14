/**
 * ratingClient.ts — 选手实力分前端客户端（v40.4）
 */

export interface MyRating {
  rating: number
  rd: number
  lastUpdated: number
  wins: number
  losses: number
  streak: number
  recentOpponents: string[]
}

export async function initMyRating(userId: string): Promise<MyRating> {
  const r = await fetch('/api/rating/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  return r.json()
}

export async function getMyRating(userId: string): Promise<MyRating> {
  const r = await fetch(`/api/rating/${userId}`)
  return r.json()
}

export async function enterMatchPool(userId: string, sidePref?: 'pro' | 'con', typePref?: string) {
  const r = await fetch('/api/rating/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, sidePref, typePref }),
  })
  return r.json()
}

export async function leaveMatchPool(userId: string) {
  const r = await fetch('/api/rating/dequeue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  return r.json()
}

/** 寻找匹配（轮询式） */
export async function findMatch(userId: string, maxDiff = 300): Promise<
  | { matched: false; message: string }
  | { matched: true; opponentUserId: string; opponentRating: number; quality: number }
> {
  const r = await fetch('/api/rating/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, maxDiff }),
  })
  return r.json()
}

export async function updateRatingAfterMatch(
  userId: string,
  opponentUserId: string,
  score: 1 | 0 | 0.5,
) {
  const r = await fetch('/api/rating/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, opponentUserId, score }),
  })
  return r.json()
}

export interface LeaderboardEntry {
  user_id: string
  rating: number
  rd: number
  wins: number
  losses: number
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const r = await fetch('/api/rating/leaderboard/top')
  return r.json()
}
