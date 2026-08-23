import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDB } from '../db.js'

export const petRoutes = Router()

// v40：导出供 pk-rooms.js 复用（战斗快照 / 结算）
export { DEFAULT_PET_SPRITES, SELECTABLE_PETS }

// ============================================================
// 像素宠物系统
// 包含：宠物管理、战斗属性、积分商城、物品系统
// ============================================================

const DEFAULT_PET_SPRITES = {
  // ── 原始 4 只 ──
  cat: {
    name: '像素猫', emoji: '🐱',
    description: '一只活泼的像素猫咪，善于快速反驳',
    baseStats: { hp: 100, atk: 12, def: 8, spd: 15 },
  },
  dog: {
    name: '像素狗', emoji: '🐶',
    description: '忠诚的像素狗，直觉敏锐善于抓漏洞',
    baseStats: { hp: 110, atk: 11, def: 10, spd: 12 },
  },
  bird: {
    name: '像素鸟', emoji: '🐦',
    description: '灵动的像素鸟，视野开阔反应极快',
    baseStats: { hp: 80, atk: 10, def: 6, spd: 18 },
  },
  slime: {
    name: '像素史莱姆', emoji: '🟢',
    description: 'Q弹的像素史莱姆，顽强不息越战越勇',
    baseStats: { hp: 130, atk: 8, def: 14, spd: 6 },
  },
  // ── 扩展 4 只 ──
  dragon: {
    name: '像素龙', emoji: '🐉',
    description: '威猛的像素龙，观点震撼力压全场',
    baseStats: { hp: 120, atk: 15, def: 10, spd: 8 },
  },
  bunny: {
    name: '像素兔', emoji: '🐰',
    description: '敏捷的像素兔，反应迅速善于闪避',
    baseStats: { hp: 85, atk: 9, def: 6, spd: 17 },
  },
  fox: {
    name: '像素狐', emoji: '🦊',
    description: '狡猾的像素狐狸，逻辑缜密步步为营',
    baseStats: { hp: 90, atk: 14, def: 6, spd: 13 },
  },
  penguin: {
    name: '像素企鹅', emoji: '🐧',
    description: '稳重的像素企鹅，攻防兼备不畏严寒',
    baseStats: { hp: 105, atk: 10, def: 13, spd: 9 },
  },
  // ── 旧宠物（向后兼容，不展示在新选宠列表） ──
  owl: {
    name: '像素猫头鹰', emoji: '🦉',
    description: '博学的像素猫头鹰，知识渊博',
    baseStats: { hp: 85, atk: 10, def: 12, spd: 10 },
  },
  rabbit: {
    name: '像素兔（旧）', emoji: '🐰',
    description: '敏捷的像素兔子，反应迅速',
    baseStats: { hp: 80, atk: 8, def: 5, spd: 18 },
  },
  wolf: {
    name: '像素狼', emoji: '🐺',
    description: '团结的像素狼，团队辩论之王',
    baseStats: { hp: 110, atk: 13, def: 9, spd: 11 },
  },
}

// 新选宠列表（仅展示 8 只主力宠物，不含旧版 owl/rabbit/wolf）
const SELECTABLE_PETS = ['cat', 'dog', 'bird', 'slime', 'dragon', 'bunny', 'fox', 'penguin']

// ------------------------------------------------------------
// v40 公共 helper（供 pk-rooms 战斗系统复用）
// ------------------------------------------------------------

/**
 * 计算用户装备加成（atk/def/spd）
 * @param {import('better-sqlite3').Database} db
 * @param {string} userId
 * @returns {{atk:number, def:number, spd:number}}
 */
export function getEquippedBonus(db, userId) {
  const equipped = db.prepare('SELECT * FROM pet_equipped WHERE user_id = ?').all(userId)
  const bonus = { atk: 0, def: 0, spd: 0 }
  equipped.forEach(eq => {
    const item = SHOP_ITEMS.find(i => i.id === eq.item_id)
    if (item) {
      bonus.atk += item.atkBonus || 0
      bonus.def += item.defBonus || 0
      bonus.spd += item.spdBonus || 0
    }
  })
  return bonus
}

/**
 * 获取用户宠物（含装备加成 totalStats），无宠物返回 null
 * @returns {null | {pet: object, bonus: {atk:number,def:number,spd:number}}}
 */
export function getPetWithBonus(db, userId) {
  const pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(userId)
  if (!pet) return null
  return { pet, bonus: getEquippedBonus(db, userId) }
}

/**
 * 战斗结算（辩论结束后调用）—— v40 从 POST /battle-result 抽取为公共函数，
 * 供 PK 房间 judge 流程直接在服务端结算（不再依赖前端调用）。
 * @param {import('better-sqlite3').Database} db
 * @param {{userId:string, won:boolean, damageDealt?:number, damageTaken?:number, debateScore?:number}} args
 * @returns {null | {pet:object, expGain:number, pointsGain:number, levelUp:boolean, newLevel?:number, newHp:number}}
 */
export function settlePetBattle(db, { userId, won, damageDealt, damageTaken, debateScore }) {
  const pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(userId)
  if (!pet) return null

  const currency = db.prepare('SELECT * FROM pet_currencies WHERE user_id = ?').get(userId)
  const now = Date.now()

  // 更新HP：结算时把战斗中掉的 HP 应用到真实宠物（下限1，不让宠物死掉）
  let newHp = pet.hp - (damageTaken || 0)
  if (won) newHp = Math.min(pet.max_hp, newHp + 20)  // 获胜回血
  newHp = Math.max(1, Math.min(pet.max_hp, newHp))

  // 经验值
  const expGain = Math.round((debateScore || 50) * (won ? 1.5 : 0.6))
  const newExp = pet.exp + expGain
  const newLevel = Math.floor(newExp / 100) + 1
  const levelUp = newLevel > pet.level

  // 积分
  const pointsGain = won ? 30 : 10
  const newPoints = (currency?.points || 0) + pointsGain

  // 先降级再升级（处理跨级情况）
  if (levelUp) {
    const levelDiff = newLevel - pet.level
    const hpBonus = levelDiff * 10
    const atkBonus = levelDiff * 2
    const defBonus = levelDiff * 1
    const spdBonus = levelDiff * 1

    db.prepare(`
      UPDATE pets SET hp = ?, max_hp = max_hp + ?, atk = atk + ?, def = def + ?, spd = spd + ?, level = ?, exp = ?
      WHERE user_id = ?
    `).run(newHp, hpBonus, atkBonus, defBonus, spdBonus, newLevel, newExp, userId)
  } else {
    db.prepare('UPDATE pets SET hp = ?, exp = ? WHERE user_id = ?').run(newHp, newExp, userId)
  }

  // 更新胜败和积分
  if (won) {
    db.prepare('UPDATE pet_currencies SET points = ?, wins = wins + 1, updated_at = ? WHERE user_id = ?')
      .run(newPoints, now, userId)
  } else {
    db.prepare('UPDATE pet_currencies SET points = ?, losses = losses + 1, updated_at = ? WHERE user_id = ?')
      .run(newPoints, now, userId)
  }

  const updatedPet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(userId)

  return {
    pet: updatedPet,
    expGain,
    pointsGain,
    levelUp,
    newLevel: levelUp ? newLevel : undefined,
    newHp,
  }
}

const SHOP_ITEMS = [
  // 服装
  { id: 'hat_wizard', name: '巫师帽', type: 'costume', price: 50, atkBonus: 2, description: '增加辩论中的智慧感', emoji: '🎩' },
  { id: 'mask_warrior', name: '战士面具', type: 'costume', price: 60, atkBonus: 3, description: '增加攻击力', emoji: '👹' },
  { id: 'cape_royal', name: '皇家披风', type: 'costume', price: 80, defBonus: 3, description: '增加防御力', emoji: '🧥' },
  { id: 'crown_crystal', name: '水晶皇冠', type: 'costume', price: 100, atkBonus: 2, defBonus: 2, description: '攻防兼备', emoji: '👑' },
  { id: 'glasses_scholar', name: '学者眼镜', type: 'costume', price: 40, defBonus: 1, spdBonus: 1, description: '提升逻辑与速度', emoji: '👓' },
  // 武器
  { id: 'sword_logic', name: '逻辑之剑', type: 'weapon', price: 70, atkBonus: 5, description: '逻辑论证如利剑', emoji: '⚔️' },
  { id: 'staff_rhetoric', name: '修辞法杖', type: 'weapon', price: 65, atkBonus: 3, spdBonus: 2, description: '华丽辞藻的法杖', emoji: '🪄' },
  { id: 'hammer_fact', name: '事实之锤', type: 'weapon', price: 90, atkBonus: 6, description: '用事实砸碎谬论', emoji: '🔨' },
  { id: 'bow_wit', name: '机智之弓', type: 'weapon', price: 55, atkBonus: 2, spdBonus: 3, description: '快速精准的反驳', emoji: '🏹' },
  // 技能
  { id: 'skill_echo', name: '回声技能', type: 'skill', price: 40, spdBonus: 2, description: '每次发言额外+5%逻辑分', emoji: '🌀' },
  { id: 'skill_shield', name: '护盾技能', type: 'skill', price: 45, defBonus: 3, description: '减少对方攻击20%效果', emoji: '🛡️' },
  { id: 'skill_charge', name: '充能技能', type: 'skill', price: 35, atkBonus: 1, spdBonus: 1, description: '每轮开始自动回血5点', emoji: '⚡' },
  { id: 'skill_persuade', name: '说服光环', type: 'skill', price: 50, atkBonus: 2, defBonus: 1, description: '增强说服力', emoji: '💫' },
  // 药品/食物
  { id: 'potion_heal', name: '回复药水', type: 'consumable', price: 20, hpRestore: 30, description: '回复30点HP', emoji: '🧪' },
  { id: 'food_brain', name: '脑力零食', type: 'consumable', price: 15, hpRestore: 15, description: '回复15点HP', emoji: '🍫' },
  { id: 'elixir_power', name: '力量灵药', type: 'consumable', price: 35, hpRestore: 50, atkTemp: 5, description: '回复50HP+临时攻击+5', emoji: '✨' },
  { id: 'berry_wisdom', name: '智慧果', type: 'consumable', price: 25, hpRestore: 20, spdTemp: 3, description: '回复20HP+临时速度+3', emoji: '🫐' },
]

// 获取用户宠物
petRoutes.get('/my/:userId', (req, res) => {
  const db = getDB()
  const pet = db.prepare(`
    SELECT p.*, pc.points, pc.wins, pc.losses
    FROM pets p
    LEFT JOIN pet_currencies pc ON p.user_id = pc.user_id
    WHERE p.user_id = ?
  `).get(req.params.userId)

  if (!pet) {
    return res.json({ hasPet: false, sprites: DEFAULT_PET_SPRITES, selectablePets: SELECTABLE_PETS })
  }

  const inventory = db.prepare('SELECT * FROM pet_inventory WHERE user_id = ?').all(req.params.userId)
  const equipped = db.prepare('SELECT * FROM pet_equipped WHERE user_id = ?').all(req.params.userId)

  // 计算加成
  let bonusStats = { atk: 0, def: 0, spd: 0 }
  equipped.forEach(eq => {
    const item = SHOP_ITEMS.find(i => i.id === eq.item_id)
    if (item) {
      bonusStats.atk += item.atkBonus || 0
      bonusStats.def += item.defBonus || 0
      bonusStats.spd += item.spdBonus || 0
    }
  })

  res.json({
    hasPet: true,
    pet: { ...pet, bonusStats },
    inventory,
    equipped,
    points: pet.points || 0,
    wins: pet.wins || 0,
    losses: pet.losses || 0,
    sprites: DEFAULT_PET_SPRITES,
    selectablePets: SELECTABLE_PETS,
  })
})

// 创建/选择宠物
petRoutes.post('/create', (req, res) => {
  const db = getDB()
  const { userId, spriteType } = req.body

  if (!DEFAULT_PET_SPRITES[spriteType]) {
    return res.status(400).json({ error: '无效的宠物类型' })
  }

  const sprite = DEFAULT_PET_SPRITES[spriteType]
  const petId = uuidv4()
  const now = Date.now()

  // 删除旧宠物
  db.prepare('DELETE FROM pets WHERE user_id = ?').run(userId)

  db.prepare(`
    INSERT INTO pets (id, user_id, name, sprite_type, emoji, hp, max_hp, atk, def, spd, level, exp, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
  `).run(
    petId, userId, sprite.name, spriteType, sprite.emoji,
    sprite.baseStats.hp, sprite.baseStats.hp,
    sprite.baseStats.atk, sprite.baseStats.def, sprite.baseStats.spd, now
  )

  // 初始化积分
  db.prepare(`
    INSERT INTO pet_currencies (user_id, points, wins, losses, created_at, updated_at)
    VALUES (?, 0, 0, 0, ?, ?)
    ON CONFLICT(user_id) DO NOTHING
  `).run(userId, now, now)

  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(petId)

  res.json({ pet, message: `${sprite.name} 已成为你的辩论伙伴！` })
})

// 战斗结算（辩论结束后调用）—— v40 逻辑已抽取到 settlePetBattle（与 PK 房间共用）
petRoutes.post('/battle-result', (req, res) => {
  const db = getDB()
  const { userId, won, damageDealt, damageTaken, debateScore } = req.body

  const pet = db.prepare('SELECT id FROM pets WHERE user_id = ?').get(userId)
  if (!pet) return res.status(404).json({ error: '你还没有宠物' })

  const result = settlePetBattle(db, { userId, won, damageDealt, damageTaken, debateScore })
  if (!result) return res.status(404).json({ error: '你还没有宠物' })

  res.json(result)
})

// 宠物治疗
petRoutes.post('/heal', (req, res) => {
  const db = getDB()
  const { userId, useItemId } = req.body

  const pet = db.prepare('SELECT * FROM pets WHERE user_id = ?').get(userId)
  if (!pet) return res.status(404).json({ error: '你还没有宠物' })

  let healAmount = Math.floor(pet.max_hp * 0.3)  // 免费治疗 30%

  if (useItemId) {
    const item = SHOP_ITEMS.find(i => i.id === useItemId)
    if (!item || item.type !== 'consumable') {
      return res.status(400).json({ error: '无效的治疗物品' })
    }

    // 检查背包
    const invItem = db.prepare('SELECT * FROM pet_inventory WHERE user_id = ? AND item_id = ?').get(userId, useItemId)
    if (!invItem || invItem.quantity < 1) {
      return res.status(400).json({ error: '物品不足' })
    }

    healAmount = item.hpRestore || 30

    // 消耗物品
    if (invItem.quantity <= 1) {
      db.prepare('DELETE FROM pet_inventory WHERE user_id = ? AND item_id = ?').run(userId, useItemId)
    } else {
      db.prepare('UPDATE pet_inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?').run(userId, useItemId)
    }
  }

  const newHp = Math.min(pet.max_hp, pet.hp + healAmount)
  db.prepare('UPDATE pets SET hp = ? WHERE user_id = ?').run(newHp, userId)

  res.json({ hp: newHp, maxHp: pet.max_hp, healed: healAmount })
})

// 商城列表
petRoutes.get('/shop', (req, res) => {
  res.json(SHOP_ITEMS)
})

// 购买物品
petRoutes.post('/shop/buy', (req, res) => {
  const db = getDB()
  const { userId, itemId } = req.body

  const item = SHOP_ITEMS.find(i => i.id === itemId)
  if (!item) return res.status(404).json({ error: '物品不存在' })

  const currency = db.prepare('SELECT * FROM pet_currencies WHERE user_id = ?').get(userId)
  if (!currency || currency.points < item.price) {
    return res.status(400).json({ error: `积分不足，需要 ${item.price} 积分` })
  }

  const now = Date.now()

  // 扣积分
  db.prepare('UPDATE pet_currencies SET points = points - ?, updated_at = ? WHERE user_id = ?')
    .run(item.price, now, userId)

  // 加入背包
  const existing = db.prepare('SELECT * FROM pet_inventory WHERE user_id = ? AND item_id = ?').get(userId, itemId)
  if (existing) {
    db.prepare('UPDATE pet_inventory SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?').run(userId, itemId)
  } else {
    db.prepare(`
      INSERT INTO pet_inventory (id, user_id, item_id, item_type, quantity, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(uuidv4(), userId, itemId, item.type, now)
  }

  const newCurrency = db.prepare('SELECT * FROM pet_currencies WHERE user_id = ?').get(userId)

  res.json({
    success: true,
    message: `购买了 ${item.emoji} ${item.name}`,
    item,
    points: newCurrency.points,
  })
})

// 装备物品
petRoutes.post('/equip', (req, res) => {
  const db = getDB()
  const { userId, itemId } = req.body

  const item = SHOP_ITEMS.find(i => i.id === itemId)
  if (!item) return res.status(404).json({ error: '物品不存在' })

  // 检查背包
  const invItem = db.prepare('SELECT * FROM pet_inventory WHERE user_id = ? AND item_id = ?').get(userId, itemId)
  if (!invItem) return res.status(400).json({ error: '背包中没有此物品' })

  // 同类型只能装一个
  const equipped = db.prepare('SELECT * FROM pet_equipped WHERE user_id = ?').all(userId)
  const sameType = equipped.find(e => {
    const eqItem = SHOP_ITEMS.find(i => i.id === e.item_id)
    return eqItem && eqItem.type === item.type
  })

  if (sameType) {
    // 卸下旧的
    db.prepare('DELETE FROM pet_equipped WHERE user_id = ? AND item_id = ?').run(userId, sameType.item_id)
  }

  db.prepare(`
    INSERT INTO pet_equipped (id, user_id, item_id, equipped_at)
    VALUES (?, ?, ?, ?)
  `).run(uuidv4(), userId, itemId, Date.now())

  res.json({ success: true, message: `装备了 ${item.emoji} ${item.name}` })
})

// 卸下装备
petRoutes.post('/unequip', (req, res) => {
  const db = getDB()
  const { userId, itemId } = req.body
  db.prepare('DELETE FROM pet_equipped WHERE user_id = ? AND item_id = ?').run(userId, itemId)
  res.json({ success: true, message: '已卸下装备' })
})

// 排行榜
petRoutes.get('/leaderboard', (req, res) => {
  const db = getDB()
  const board = db.prepare(`
    SELECT p.*, u.username, u.mbti_type, u.avatar,
      COALESCE(pc.wins, 0) as wins, COALESCE(pc.losses, 0) as losses,
      CAST(COALESCE(pc.wins, 0) AS REAL) / MAX(1, COALESCE(pc.wins, 0) + COALESCE(pc.losses, 0)) as win_rate
    FROM pets p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN pet_currencies pc ON p.user_id = pc.user_id
    ORDER BY p.level DESC, win_rate DESC
    LIMIT 20
  `).all()

  res.json(board)
})
