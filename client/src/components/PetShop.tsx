import { useState, useEffect, useCallback } from 'react'
import { Store, Coins, ShoppingCart, Check, Package, Sword, Shield, Zap, Heart } from 'lucide-react'
import clsx from 'clsx'
import { ShopItem, InventoryItem, Pet } from '../types'
import { useAuth } from '../hooks/useAuth'
import { PixelPet } from './PixelPet'
import { API_BASE } from '../config'

const API = API_BASE + '/api'

const TYPE_ICONS: Record<string, any> = {
  costume: Shield, weapon: Sword, skill: Zap, consumable: Heart,
}

export function PetShop() {
  const { user, isLoggedIn } = useAuth()
  const [items, setItems] = useState<ShopItem[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [equipped, setEquipped] = useState<InventoryItem[]>([])
  const [points, setPoints] = useState(0)
  const [pet, setPet] = useState<Pet | null>(null)
  const [activeTab, setActiveTab] = useState<'shop' | 'inventory' | 'pet'>('pet')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  // 后端返回的可选宠物列表 + 属性定义
  const [sprites, setSprites] = useState<Record<string, any>>({})
  const [selectablePets, setSelectablePets] = useState<string[]>([])

  const fetchData = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    try {
      const [shopRes, petRes] = await Promise.all([
        fetch(`${API}/pets/shop`),
        fetch(`${API}/pets/my/${user.id}`),
      ])

      if (shopRes.ok) setItems(await shopRes.json())

      if (petRes.ok) {
        const data = await petRes.json()
        // 更新可选宠物列表（即使没有宠物也返回 sprites + selectablePets）
        if (data.sprites) setSprites(data.sprites)
        if (data.selectablePets) setSelectablePets(data.selectablePets)
        if (data.hasPet) {
          setPet(data.pet)
          setInventory(data.inventory || [])
          setEquipped(data.equipped || [])
          setPoints(data.points || 0)
        }
      }
    } catch (e) {
      console.error('加载商城数据失败', e)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleBuy = async (item: ShopItem) => {
    if (!isLoggedIn) { setMessage('请先登录'); return }
    if (points < item.price) { setMessage('积分不足'); return }

    try {
      const res = await fetch(`${API}/pets/shop/buy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, itemId: item.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`已购买 ${item.emoji} ${item.name}`)
        setPoints(data.points)
        fetchData()
      } else {
        setMessage(data.error)
      }
    } catch {
      setMessage('购买失败')
    }
  }

  const handleEquip = async (itemId: string) => {
    if (!user?.id) return
    try {
      const res = await fetch(`${API}/pets/equip`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, itemId }),
      })
      if (res.ok) {
        setMessage('装备成功')
        fetchData()
      }
    } catch {
      setMessage('装备失败')
    }
  }

  const handleUnequip = async (itemId: string) => {
    if (!user?.id) return
    try {
      await fetch(`${API}/pets/unequip`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, itemId }),
      })
      setMessage('已卸下')
      fetchData()
    } catch {
      setMessage('操作失败')
    }
  }

  // 使用消耗品（药品/食物）→ 调用治疗接口回血
  const handleUseItem = async (itemId: string) => {
    if (!user?.id) return
    try {
      const res = await fetch(`${API}/pets/heal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, useItemId: itemId }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`💊 回复 ${data.healed} HP（当前 ${data.hp}/${data.maxHp}）`)
      } else {
        setMessage(data.error || '使用失败')
      }
      fetchData()
    } catch {
      setMessage('使用失败')
    }
  }

  const isEquipped = (itemId: string) => equipped.some(e => e.item_id === itemId)
  const getInventoryCount = (itemId: string) => {
    const inv = inventory.find(i => i.item_id === itemId)
    return inv?.quantity || 0
  }

  // 检查用户是否有宠物
  const handleSelectPet = async (spriteType: string) => {
    if (!user?.id || !isLoggedIn) { setMessage('请先登录'); return }
    try {
      const res = await fetch(`${API}/pets/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, spriteType }),
      })
      const data = await res.json()
      if (res.ok) {
        setPet(data.pet)
        setMessage(`${data.message}`)
      } else {
        setMessage(data.error)
      }
    } catch {
      setMessage('创建失败')
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="animate-spin w-8 h-8 border-2 rounded-full border-t-transparent" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <Store size={22} style={{ color: '#d9b871' }} />
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>像素宠物·商城</h1>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>辩论赢积分，给你的宠物买装备！</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #d9b87122, #e57e7e22)', color: '#d9b871' }}>
          <Coins size={14} /> {points}
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="宠物商城面板" className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
        {(['pet', 'shop', 'inventory'] as const).map(tab => (
          <button
            key={tab}
            role="tab"
            id={`tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`panel-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={clsx('flex-1 py-2.5 text-sm font-medium transition-all',
              activeTab === tab ? 'border-b-2' : 'opacity-50'
            )}
            style={{
              color: activeTab === tab ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              borderColor: activeTab === tab ? 'var(--color-accent)' : 'transparent',
            }}>
            {tab === 'pet' ? '我的宠物' : tab === 'shop' ? '商城' : '背包'}
          </button>
        ))}
      </div>

      {message && (
        <div role="status" aria-live="polite" className="mx-4 mt-2 p-2 rounded-lg text-xs text-center" style={{ background: 'var(--color-accent-10)', color: 'var(--color-accent)' }}>
          {message}
        </div>
      )}

      {/* Pet Selection / Display */}
      {activeTab === 'pet' && (
        <div role="tabpanel" id="panel-pet" aria-labelledby="tab-pet" className="flex-1 overflow-y-auto p-4">
          {pet ? (
            <div className="text-center">
              <div className="inline-block p-6 rounded-2xl mb-4" style={{ background: 'var(--color-bg-secondary)' }}>
                <PixelPet pet={pet} size={100} />
              </div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{pet.name}</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>Lv.{pet.level}</p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-6 max-w-xs mx-auto">
                {[
                  { label: '❤️ HP', val: `${pet.hp}/${pet.max_hp}`, color: '#e57e7e' },
                  { label: '⚔️ 攻击', val: pet.atk + (pet.bonusStats?.atk || 0), color: '#e8976f', bonus: pet.bonusStats?.atk },
                  { label: '🛡️ 防御', val: pet.def + (pet.bonusStats?.def || 0), color: '#6fa3f5', bonus: pet.bonusStats?.def },
                  { label: '💨 速度', val: pet.spd + (pet.bonusStats?.spd || 0), color: '#2fc9a3', bonus: pet.bonusStats?.spd },
                ].map(stat => (
                  <div key={stat.label} className="p-3 rounded-xl text-left" style={{ background: 'var(--color-bg-secondary)' }}>
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{stat.label}</span>
                    <p className="font-bold" style={{ color: 'var(--color-text)' }}>
                      {stat.val}
                      {stat.bonus && stat.bonus > 0 ? (
                        <span className="text-xs" style={{ color: '#d9b871' }}> (+{stat.bonus})</span>
                      ) : null}
                    </p>
                  </div>
                ))}
              </div>

              {/* EXP bar */}
              <div className="max-w-xs mx-auto mb-4">
                <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  <span>EXP</span>
                  <span>{pet.exp} / {pet.level * 100}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${(pet.exp / (pet.level * 100)) * 100}%`,
                    background: 'linear-gradient(90deg, #8f7ff5, #6fa3f5)',
                  }} />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-center text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                🐾 选择你的初始宠物伙伴
              </p>
              <p className="text-center text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                每只宠物拥有不同属性，选一个开始你的辩论之旅吧！
              </p>
              {selectablePets.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {!isLoggedIn ? '请先登录后选择宠物' : '加载宠物列表中...'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {selectablePets.map(spriteKey => {
                    const sprite = sprites[spriteKey]
                    if (!sprite) return null
                    return (
                      <button
                        key={spriteKey}
                        onClick={() => handleSelectPet(spriteKey)}
                        aria-label={`选择${sprite.name}，生命${sprite.baseStats.hp}，攻击${sprite.baseStats.atk}，防御${sprite.baseStats.def}，速度${sprite.baseStats.spd}`}
                        className="p-3 rounded-xl text-center transition-all hover:scale-105 border group"
                        style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
                      >
                        {/* 像素画预览 */}
                        <div className="flex justify-center mb-1" aria-hidden="true">
                          <PixelPet pet={{ sprite_type: spriteKey } as Pet} size={56} animated={true} />
                        </div>
                        <p className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
                          {sprite.name}
                        </p>
                        <p className="text-[10px] mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                          {sprite.description}
                        </p>
                        {/* 属性条 */}
                        <div className="flex justify-center gap-1.5 text-[9px]" style={{ color: 'var(--color-text-tertiary)' }}>
                          <span>❤️{sprite.baseStats.hp}</span>
                          <span>⚔️{sprite.baseStats.atk}</span>
                          <span>🛡️{sprite.baseStats.def}</span>
                          <span>💨{sprite.baseStats.spd}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Shop */}
      {activeTab === 'shop' && (
        <div role="tabpanel" id="panel-shop" aria-labelledby="tab-shop" className="flex-1 overflow-y-auto p-4">
          {(['weapon', 'costume', 'skill', 'consumable'] as const).map(category => {
            const catItems = items.filter(i => i.type === category)
            if (catItems.length === 0) return null
            const IconComp = TYPE_ICONS[category]
            return (
              <div key={category} className="mb-6">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                  <IconComp size={14} />
                  {{ weapon: '武器', costume: '服装', skill: '技能', consumable: '药品/食物' }[category]}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {catItems.map(item => {
                    const owned = getInventoryCount(item.id)
                    return (
                      <div key={item.id} className="p-3 rounded-xl border" style={{
                        background: 'var(--color-bg-secondary)',
                        borderColor: points >= item.price ? 'var(--color-border)' : '#e57e7e33',
                        opacity: points >= item.price ? 1 : 0.6,
                      }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{item.emoji}</span>
                          <div>
                            <p className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>{item.name}</p>
                            <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{item.description}</p>
                          </div>
                        </div>
                        {item.atkBonus && (
                          <span className="text-[10px] mr-1 px-1 py-0.5 rounded" style={{ background: '#e8976f22', color: '#e8976f' }}>+{item.atkBonus}攻</span>
                        )}
                        {item.defBonus && (
                          <span className="text-[10px] mr-1 px-1 py-0.5 rounded" style={{ background: '#6fa3f522', color: '#6fa3f5' }}>+{item.defBonus}防</span>
                        )}
                        {item.spdBonus && (
                          <span className="text-[10px] mr-1 px-1 py-0.5 rounded" style={{ background: '#2fc9a322', color: '#2fc9a3' }}>+{item.spdBonus}速</span>
                        )}
                        {item.hpRestore && (
                          <span className="text-[10px] mr-1 px-1 py-0.5 rounded" style={{ background: '#e57e7e22', color: '#e57e7e' }}>+{item.hpRestore}HP</span>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="flex items-center gap-1 text-xs font-bold" style={{ color: '#d9b871' }}>
                            <Coins size={10} /> {item.price}
                          </span>
                          <button
                            onClick={() => handleBuy(item)}
                            disabled={points < item.price}
                            aria-label={`购买${item.name}，价格${item.price}积分`}
                            className="text-xs px-2 py-1 rounded-lg text-white disabled:opacity-30 transition-all hover:scale-105"
                            style={{ background: 'var(--color-accent)' }}>
                            {owned > 0 ? `x${owned}` : '购买'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Inventory */}
      {activeTab === 'inventory' && (
        <div role="tabpanel" id="panel-inventory" aria-labelledby="tab-inventory" className="flex-1 overflow-y-auto p-4">
          {inventory.length === 0 ? (
            <div className="text-center py-16">
              <Package size={48} className="mx-auto mb-4 opacity-30" style={{ color: 'var(--color-text-secondary)' }} />
              <p style={{ color: 'var(--color-text-secondary)' }}>背包空空，去商城逛逛吧！</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {inventory.map(inv => {
                const item = items.find(i => i.id === inv.item_id)
                if (!item) return null
                const equipped = isEquipped(item.id)
                return (
                  <div key={inv.id} className={clsx('p-3 rounded-xl border transition-all',
                    equipped ? 'border-yellow-400/50' : ''
                  )}
                    style={{
                      background: equipped ? 'linear-gradient(135deg, #d9b87111, #6fa3f511)' : 'var(--color-bg-secondary)',
                      borderColor: equipped ? '#d9b87155' : 'var(--color-border)',
                    }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{item.emoji}</span>
                      <div>
                        <p className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>{item.name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>x{inv.quantity}</p>
                      </div>
                    </div>
                    {equipped ? (
                      <button
                        onClick={() => handleUnequip(item.id)}
                        className="w-full text-xs py-1 rounded-lg" style={{ background: '#d9b87122', color: '#d9b871' }}>
                        已装备
                      </button>
                    ) : item.type === 'consumable' ? (
                      <button
                        onClick={() => handleUseItem(item.id)}
                        className="w-full text-xs py-1 rounded-lg text-white transition-all hover:opacity-80"
                        style={{ background: 'linear-gradient(135deg, #e57e7e, #e8976f)' }}>
                        使用（回血）
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEquip(item.id)}
                        className="w-full text-xs py-1 rounded-lg text-white transition-all hover:opacity-80"
                        style={{ background: 'var(--color-accent)' }}>
                        装备
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
