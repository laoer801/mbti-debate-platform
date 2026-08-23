export interface MBTIType {
  id: string
  name: string
  alias: string
  category: 'analyst' | 'diplomat' | 'sentinel' | 'explorer'
  color: string
  emoji: string
  description: string
  traits: string[]
  strengths: string[]
  weaknesses: string[]
  debateStyle: string
  catchphrases: string[]
  dimensions?: { E_I: number; S_N: number; T_F: number; J_P: number }
}

export interface ReflectionEntry {
  typeId: string
  typeName: string
  typeEmoji: string
  typeColor: string
  content: string
  revisedStance?: string
  timestamp: number
}

export type Category = 'all' | 'analyst' | 'diplomat' | 'sentinel' | 'explorer'

export type TabId = 'hall' | 'debate' | 'scene' | 'square' | 'match' | 'history' | 'stats' | 'pk' | 'pets' | 'chat' | 'library' | 'settings' | 'admin'

export type DebateMode = 'free' | 'roundRobin' | 'adversarial' | 'socratic' | 'duel' | 'dialogue'

export type PKPhase = 'waiting' | 'preparation' | 'opening' | 'free_debate' | 'closing' | 'judging' | 'finished'

export type ThemeMode = 'light' | 'dark' | 'high-contrast'

export type FontSize = 'normal' | 'large' | 'xlarge'

export interface Scene {
  id: string
  title: string
  description: string
  topic: string
  recommendedTypes: string[]
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface SceneTemplate {
  id: string
  title: string
  emoji: string
  description: string
  background: string
  roles: { typeId: string; roleName: string; description: string }[]
  specialRules: string[]
  initialRelations: Record<string, 'hostile' | 'friendly' | 'neutral'>
  timeline: string
}

export interface Message {
  id: string
  typeId: string
  typeName: string
  typeEmoji: string
  typeColor: string
  content: string
  timestamp: number
  confidence?: number
  isUser?: boolean
  isHighlight?: boolean
  /** 辩手立场：正方 / 反方（用户发言无此字段） */
  side?: 'pro' | 'con'
  /** v28 思考链：LLM 发言前的【思考】部分，浅色/折叠展示 */
  thinking?: string
  /** v32 知识库引用来源：1v1 深度交流回答所依据的资料片段 */
  sources?: KnowledgeSource[]
  /** v33 专业建议·困境拆解：当用户表达困境/决策类问题时，LLM 给出的三条路径 + 风险 + 下一步 */
  advice?: PathAdvice
}

/** v33 专业建议·困境拆解：一条可选行动路径（对标 Cognix Problem Mode） */
export interface PathOption {
  /** 路径名称（如「稳妥过渡」） */
  name: string
  /** 适合什么样的处境/性格 */
  fitFor: string
  /** 好处 */
  pros: string
  /** 代价 */
  cons: string
}

/** v33 专业建议·困境拆解结果：三条路径 + 共同风险 + 建议下一步 */
export interface PathAdvice {
  paths: PathOption[]
  /** 共同风险或需要警惕的点 */
  risks: string
  /** 一个可立即执行的小动作 */
  nextStep: string
}

/** v32 知识库引用来源（RAG 检索结果，随消息持久化） */
export interface KnowledgeSource {
  title: string
  fileName: string
  text: string
  domainId: string
  domainName: string
  domainEmoji: string
  domainColor: string
}

export interface DebateSession {
  id: string
  topic: string
  mode: DebateMode
  sceneId?: string
  participants: string[]
  messages: Message[]
  highlights: string[]
  summary?: DebateSummary
  createdAt: number
}

export interface DebateSummary {
  corePoints: string[]
  stanceComparison: { typeId: string; stance: string; reasoning: string }[]
  disagreements: string[]
  consensus: string[]
  actionAdvice: string
}

export interface ConfidenceScore {
  typeId: string
  name: string
  emoji: string
  score: number
  color: string
  persuasion?: number
  logic?: number
  fun?: number
}

/** 裁判五维评分 */
export interface JudgeScore {
  typeId: string
  name: string
  emoji: string
  color: string
  /** 逻辑性 — 推理是否有漏洞、论证是否连贯 */
  logic: number
  /** 论据质量 — 有无干货、实例、数据支撑 */
  evidence: number
  /** 反驳有效性 — 是否怼到对方点子上 */
  rebuttal: number
  /** 表达清晰度 — 能否让人听懂 */
  clarity: number
  /** 风度 — 是否尊重对方、不急眼骂人 */
  demeanor: number
  /** 综合得分 */
  total: number
  /** 一句话评语 */
  comment: string
}

export interface Opinion {
  id: string
  title: string
  tags: string[]
  sideA: string
  sideB: string
  createdAt: number
  votesA: number
  votesB: number
  hot: number
  personalityStances: { typeId: string; side: 'A' | 'B'; reason: string; changedMind?: boolean }[]
}

export interface MBTIQuestion {
  id: number
  text: string
  dimension: 'EI' | 'SN' | 'TF' | 'JP'
  options: { text: string; value: 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P' }[]
}

export interface PersonalitySnapshot {
  id: string
  name: string
  avatar: string
  traits: string[]
  style: string
  knowledge: string[]
  mbtiTendency?: string
  dialogCount: number
  level: number
  isPublic: boolean
  createdAt: number
}

export interface ArgumentNode {
  id: string
  typeId: string
  content: string
  parentId?: string
  relation: 'supports' | 'opposes' | 'complements'
  timestamp: number
}

// === Social Platform Types ===
export interface User {
  id: string
  username: string
  mbtiType: string | null
  avatar: string
  bio: string
  role?: 'admin' | 'user'
  banned?: number
  created_at?: number
  login_at?: number
}

export interface AuthState {
  user: User | null
  token: string | null
  isLoggedIn: boolean
}

export interface Post {
  id: string
  user_id: string
  author_name: string
  author_type: string
  author_emoji: string
  author_color: string
  title: string
  content: string
  tags: string
  like_count: number
  comment_count: number
  is_ai: number
  created_at: number
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  author_name: string
  author_type: string
  author_emoji: string
  author_color: string
  content: string
  is_ai: number
  created_at: number
}

export interface MatchRecommendation {
  id: string
  username: string
  mbti_type: string
  bio: string
  avatar: string
  compatibility: number
  matchReason: string
}

// === PK Debate Room Types ===

export interface PKRoom {
  id: string
  topic: string
  position: string
  current_phase: PKPhase
  is_public: number
  max_participants: number
  creator_id: string
  winner_id?: string
  phase_started_at?: number
  phase_duration?: number
  started_at?: number
  created_at: number
  participant_count?: number
}

export interface PKParticipant {
  id: string
  room_id: string
  user_id: string
  side: 'pro' | 'con'
  status: string
  username?: string
  mbti_type?: string
  avatar?: string
}

export interface PKMove {
  id: string
  roomId: string
  userId: string
  username?: string
  avatar?: string
  mbtiType?: string
  content: string
  moveType: string
  side: string
  phase: string
  createdAt: number
}

export interface PKJudgeResult {
  players: JudgePlayerScore[]
  winner: string
  feedback: string
  winnerName?: string
  results: JudgePlayerScore[]
}

export interface JudgePlayerScore {
  userId: string
  username: string
  side: string
  scores: { logic: number; evidence: number; eloquence: number; rebuttal: number; etiquette: number }
  total: number
}

// === Pet System Types ===

export interface Pet {
  id: string
  user_id: string
  name: string
  sprite_type: string
  emoji: string
  hp: number
  max_hp: number
  atk: number
  def: number
  spd: number
  level: number
  exp: number
  bonusStats?: { atk: number; def: number; spd: number }
}

// v40 服务器权威宠物战斗：擂台快照（preparation 阶段由服务端锁定）
export interface BattleState {
  roomId: string
  userId: string
  name: string
  spriteType: string
  emoji: string
  hp: number
  maxHp: number
  atk: number
  def: number
  spd: number
  damageDealt: number
  damageTaken: number
  isTemp: boolean
}

// v40 每次发言触发的宠物攻击事件（服务端计算伤害后广播）
export interface PetBattleEvent {
  seq: number
  roomId: string
  attackerId: string
  defenderId: string
  damage: number
  crit: boolean
  attackerHp: number
  defenderHp: number
  knockOut: boolean
}

export interface PetSprite {
  name: string
  emoji: string
  description: string
  baseStats: { hp: number; atk: number; def: number; spd: number }
}

export interface ShopItem {
  id: string
  name: string
  type: 'costume' | 'weapon' | 'skill' | 'consumable'
  price: number
  atkBonus?: number
  defBonus?: number
  spdBonus?: number
  hpRestore?: number
  description: string
  emoji: string
}

export interface InventoryItem {
  id: string
  user_id: string
  item_id: string
  item_type: string
  quantity: number
  created_at: number
}

export interface PetCurrency {
  user_id: string
  points: number
  wins: number
  losses: number
}
