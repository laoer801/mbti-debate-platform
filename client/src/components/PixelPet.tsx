import { useEffect, useRef } from 'react'
import { Pet } from '../types'

interface PixelPetProps {
  pet: Pet | null
  size?: number
  animated?: boolean
  attacking?: boolean
  takingDamage?: boolean
  className?: string
}

// 像素宠物形态与颜色描述（用于无障碍替代文本）
const SPRITE_DESC: Record<string, string> = {
  cat: '橙色猫咪',
  fox: '橙色狐狸，白色尾巴尖',
  dragon: '绿色喷火龙，橙色翅膀',
  owl: '紫色猫头鹰，大眼睛',
  rabbit: '灰色兔子，长耳朵',
  bunny: '粉色小兔，竖耳朵',
  dog: '棕色小狗，垂耳朵',
  bird: '蓝色小鸟，黄色喙',
  slime: '绿色史莱姆，弹跳身体',
  penguin: '黑白企鹅，橙色喙',
  wolf: '灰色狼，白色腹部',
}

// Pixel art for each sprite type
const PIXEL_DRAWINGS: Record<string, (ctx: CanvasRenderingContext2D, size: number, frame: number) => void> = {  cat: (ctx, s, frame) => {
    const px = s / 16
    const bounce = Math.sin(frame * 0.15) * 2
    // Body
    ctx.fillStyle = '#ff9800'
    ctx.fillRect(px * 4, px * 7 + bounce, px * 8, px * 6)
    // Head
    ctx.fillStyle = '#ff9800'
    ctx.fillRect(px * 5, px * 3 + bounce, px * 6, px * 5)
    // Ears
    ctx.fillRect(px * 5, px * 1 + bounce, px * 2, px * 3)
    ctx.fillRect(px * 9, px * 1 + bounce, px * 2, px * 3)
    // Eyes
    ctx.fillStyle = '#000'
    ctx.fillRect(px * 6, px * 4 + bounce, px * 1, px * 2)
    ctx.fillRect(px * 9, px * 4 + bounce, px * 1, px * 2)
    // Mouth
    ctx.fillStyle = '#ff5722'
    ctx.fillRect(px * 7, px * 6 + bounce, px * 2, px * 1)
    // Tail
    ctx.fillStyle = '#ff9800'
    ctx.fillRect(px * 11, px * 10 + bounce, px * 2, px * 2)
    ctx.fillRect(px * 12, px * 9 + bounce, px * 2, px * 2)
    // Legs
    ctx.fillStyle = '#e65100'
    ctx.fillRect(px * 5, px * 13 + bounce, px * 2, px * 2)
    ctx.fillRect(px * 9, px * 13 + bounce, px * 2, px * 2)
  },

  fox: (ctx, s, frame) => {
    const px = s / 16
    const bounce = Math.sin(frame * 0.12) * 1.5
    // Body
    ctx.fillStyle = '#ff5722'
    ctx.fillRect(px * 4, px * 8 + bounce, px * 8, px * 5)
    // Head
    ctx.fillStyle = '#ff5722'
    ctx.fillRect(px * 5, px * 4 + bounce, px * 5, px * 5)
    // Ears
    ctx.fillStyle = '#ff5722'
    ctx.fillRect(px * 6, px * 1 + bounce, px * 2, px * 4)
    ctx.fillRect(px * 8, px * 1 + bounce, px * 2, px * 4)
    ctx.fillStyle = '#fff'
    ctx.fillRect(px * 7, px * 2 + bounce, px * 1, px * 2)
    ctx.fillRect(px * 9, px * 2 + bounce, px * 1, px * 2)
    // Eyes
    ctx.fillStyle = '#000'
    ctx.fillRect(px * 6, px * 6 + bounce, px * 1, px * 1)
    ctx.fillRect(px * 8, px * 6 + bounce, px * 1, px * 1)
    // Snout
    ctx.fillStyle = '#fff'
    ctx.fillRect(px * 5, px * 7 + bounce, px * 5, px * 2)
    ctx.fillStyle = '#000'
    ctx.fillRect(px * 7, px * 7 + bounce, px * 1, px * 1)
    // Tail
    ctx.fillStyle = '#ff5722'
    ctx.fillRect(px * 12, px * 10 + bounce, px * 3, px * 2)
    ctx.fillStyle = '#fff'
    ctx.fillRect(px * 14, px * 10 + bounce, px * 1, px * 2)
  },

  dragon: (ctx, s, frame) => {
    const px = s / 16
    const bob = Math.sin(frame * 0.1) * 2
    // Body
    ctx.fillStyle = '#4caf50'
    ctx.fillRect(px * 3, px * 6 + bob, px * 10, px * 6)
    // Scales
    ctx.fillStyle = '#388e3c'
    ctx.fillRect(px * 4, px * 7 + bob, px * 2, px * 1)
    ctx.fillRect(px * 7, px * 7 + bob, px * 2, px * 1)
    ctx.fillRect(px * 10, px * 7 + bob, px * 2, px * 1)
    // Head
    ctx.fillStyle = '#4caf50'
    ctx.fillRect(px * 5, px * 2 + bob, px * 6, px * 5)
    // Horns
    ctx.fillStyle = '#ffeb3b'
    ctx.fillRect(px * 5, px * 0 + bob, px * 1, px * 3)
    ctx.fillRect(px * 10, px * 0 + bob, px * 1, px * 3)
    // Eyes
    ctx.fillStyle = '#fff'
    ctx.fillRect(px * 6, px * 3 + bob, px * 2, px * 2)
    ctx.fillRect(px * 9, px * 3 + bob, px * 2, px * 2)
    ctx.fillStyle = '#000'
    ctx.fillRect(px * 7, px * 3 + bob, px * 1, px * 1)
    ctx.fillRect(px * 10, px * 3 + bob, px * 1, px * 1)
    // Nostrils (animated)
    ctx.fillStyle = frame % 12 < 6 ? '#ff5722' : '#388e3c'
    ctx.fillRect(px * 7, px * 6 + bob, px * 1, px * 1)
    ctx.fillRect(px * 9, px * 6 + bob, px * 1, px * 1)
    // Wings
    const wingAngle = Math.sin(frame * 0.2) * 2
    ctx.fillStyle = '#81c784'
    ctx.fillRect(px * 1, px * 5 + bob + wingAngle, px * 3, px * 3)
    ctx.fillRect(px * 12, px * 5 + bob + wingAngle, px * 3, px * 3)
    // Tail
    ctx.fillStyle = '#4caf50'
    ctx.fillRect(px * 13, px * 11 + bob, px * 2, px * 2)
    ctx.fillRect(px * 14, px * 13 + bob, px * 1, px * 2)
    // Tail spike
    ctx.fillStyle = '#ffeb3b'
    ctx.fillRect(px * 14, px * 15 + bob, px * 1, px * 1)
  },

  owl: (ctx, s, frame) => {
    const px = s / 16
    const tilt = Math.sin(frame * 0.08) * 2
    // Body
    ctx.fillStyle = '#607d8b'
    ctx.fillRect(px * 4, px * 6, px * 8, px * 7)
    // Belly
    ctx.fillStyle = '#cfd8dc'
    ctx.fillRect(px * 5, px * 8, px * 6, px * 4)
    ctx.fillStyle = '#90a4ae'
    ctx.fillRect(px * 6, px * 8, px * 2, px * 1)
    ctx.fillRect(px * 8, px * 8, px * 2, px * 1)
    ctx.fillRect(px * 7, px * 10, px * 2, px * 1)
    // Head
    ctx.fillStyle = '#607d8b'
    ctx.fillRect(px * 4, px * 2, px * 8, px * 5)
    // Eye circles
    ctx.fillStyle = '#fff'
    ctx.fillRect(px * 5, px * 3, px * 3, px * 3)
    ctx.fillRect(px * 8, px * 3, px * 3, px * 3)
    ctx.fillStyle = '#ffeb3b'
    ctx.fillRect(px * 6, px * 4, px * 1, px * 1)
    ctx.fillRect(px * 9, px * 4, px * 1, px * 1)
    ctx.fillStyle = '#000'
    ctx.fillRect(px * 6, px * 4, px * 1, px * 1)
    ctx.fillRect(px * 9, px * 4, px * 1, px * 1)
    // Beak
    ctx.fillStyle = '#ff9800'
    ctx.fillRect(px * 7, px * 5, px * 2, px * 1)
    // Eyebrows (glasses look)
    ctx.fillStyle = '#37474f'
    ctx.fillRect(px * 5, px * 2, px * 6, px * 1)
    // Wings
    ctx.fillStyle = '#455a64'
    ctx.fillRect(px * 3, px * 7, px * 1, px * 5)
    ctx.fillRect(px * 12, px * 7, px * 1, px * 5)
    // Claws
    ctx.fillStyle = '#ff9800'
    ctx.fillRect(px * 5, px * 13, px * 2, px * 2)
    ctx.fillRect(px * 9, px * 13, px * 2, px * 2)
  },

  rabbit: (ctx, s, frame) => {
    // Legacy purple rabbit — kept for backward compat with old pets
    const px = s / 16
    const hop = frame % 40 < 20 ? Math.sin(frame * 0.3) * 4 : 0
    ctx.fillStyle = '#e1bee7'
    ctx.fillRect(px * 4, px * 7 + hop, px * 7, px * 5)
    ctx.fillRect(px * 5, px * 2 + hop, px * 5, px * 6)
    ctx.fillRect(px * 6, px * -2 + hop, px * 1, px * 5)
    ctx.fillRect(px * 8, px * -2 + hop, px * 1, px * 5)
    ctx.fillStyle = '#f8bbd0'
    ctx.fillRect(px * 6, px * -1 + hop, px * 1, px * 3)
    ctx.fillRect(px * 8, px * -1 + hop, px * 1, px * 3)
    ctx.fillStyle = '#000'
    ctx.fillRect(px * 6, px * 4 + hop, px * 1, px * 1)
    ctx.fillRect(px * 8, px * 4 + hop, px * 1, px * 1)
    ctx.fillStyle = '#f48fb1'
    ctx.fillRect(px * 7, px * 5 + hop, px * 1, px * 1)
    ctx.fillStyle = '#fff'
    ctx.fillRect(px * 11, px * 8 + hop, px * 2, px * 2)
    ctx.fillStyle = '#e1bee7'
    ctx.fillRect(px * 5, px * 12 + hop, px * 2, px * 2)
    ctx.fillRect(px * 8, px * 12 + hop, px * 2, px * 2)
  },

  // ── 新增 4 只像素宠物（来自复古像素图标系统） ──

  bunny: (ctx, s, frame) => {
    const px = s / 16
    const hop = frame % 40 < 20 ? Math.sin(frame * 0.3) * 4 : 0
    // 白色身体
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(px * 4, px * 7 + hop, px * 7, px * 5)
    // 白色头
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(px * 5, px * 2 + hop, px * 5, px * 6)
    // 长耳朵（白外，粉内）
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(px * 6, px * -2 + hop, px * 1, px * 5)
    ctx.fillRect(px * 8, px * -2 + hop, px * 1, px * 5)
    ctx.fillStyle = '#F8BBD0'
    ctx.fillRect(px * 6, px * -1 + hop, px * 1, px * 3)
    ctx.fillRect(px * 8, px * -1 + hop, px * 1, px * 3)
    // 眼睛
    ctx.fillStyle = '#000'
    ctx.fillRect(px * 6, px * 4 + hop, px * 1, px * 1)
    ctx.fillRect(px * 8, px * 4 + hop, px * 1, px * 1)
    // 粉色鼻子
    ctx.fillStyle = '#F48FB1'
    ctx.fillRect(px * 7, px * 5 + hop, px * 1, px * 1)
    // 白色尾巴
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(px * 11, px * 8 + hop, px * 2, px * 2)
    // 粉色脚
    ctx.fillStyle = '#F8BBD0'
    ctx.fillRect(px * 5, px * 12 + hop, px * 2, px * 2)
    ctx.fillRect(px * 8, px * 12 + hop, px * 2, px * 2)
  },

  dog: (ctx, s, frame) => {
    const px = s / 16
    const wag = Math.sin(frame * 0.15) * 2
    // 棕色身体
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(px * 4, px * 8, px * 8, px * 5)
    // 棕色头
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(px * 5, px * 3, px * 6, px * 5)
    // 深棕色垂耳
    ctx.fillStyle = '#654321'
    ctx.fillRect(px * 4, px * 4, px * 2, px * 5)
    ctx.fillRect(px * 10, px * 4, px * 2, px * 5)
    // 眼睛
    ctx.fillStyle = '#000'
    ctx.fillRect(px * 6, px * 5, px * 1, px * 1)
    ctx.fillRect(px * 9, px * 5, px * 1, px * 1)
    // 鼻子
    ctx.fillStyle = '#000'
    ctx.fillRect(px * 7, px * 6, px * 2, px * 1)
    // 嘴
    ctx.fillStyle = '#654321'
    ctx.fillRect(px * 7, px * 7, px * 2, px * 1)
    // 摇尾巴
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(px * 12 + wag, px * 9, px * 2, px * 2)
    ctx.fillRect(px * 13 + wag, px * 8, px * 1, px * 2)
    // 深棕色腿
    ctx.fillStyle = '#654321'
    ctx.fillRect(px * 5, px * 13, px * 2, px * 2)
    ctx.fillRect(px * 9, px * 13, px * 2, px * 2)
  },

  bird: (ctx, s, frame) => {
    const px = s / 16
    const flap = Math.sin(frame * 0.2) * 2
    // 蓝色身体
    ctx.fillStyle = '#2196F3'
    ctx.fillRect(px * 5, px * 6, px * 6, px * 6)
    // 蓝色头
    ctx.fillStyle = '#2196F3'
    ctx.fillRect(px * 5, px * 3, px * 5, px * 4)
    // 白色腹部
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(px * 6, px * 8, px * 4, px * 3)
    // 黄色喙
    ctx.fillStyle = '#FFC107'
    ctx.fillRect(px * 10, px * 5, px * 2, px * 1)
    ctx.fillRect(px * 11, px * 6, px * 1, px * 1)
    // 眼睛
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(px * 6, px * 4, px * 2, px * 2)
    ctx.fillStyle = '#000'
    ctx.fillRect(px * 7, px * 4, px * 1, px * 1)
    // 翅膀扇动
    ctx.fillStyle = '#1976D2'
    ctx.fillRect(px * 3, px * 7 + flap, px * 2, px * 3)
    ctx.fillRect(px * 11, px * 7 - flap, px * 2, px * 3)
    // 尾羽
    ctx.fillStyle = '#1976D2'
    ctx.fillRect(px * 11, px * 10, px * 3, px * 2)
    ctx.fillStyle = '#FFC107'
    ctx.fillRect(px * 13, px * 11, px * 1, px * 1)
    // 黄色脚
    ctx.fillStyle = '#FFC107'
    ctx.fillRect(px * 6, px * 12, px * 1, px * 2)
    ctx.fillRect(px * 8, px * 12, px * 1, px * 2)
  },

  slime: (ctx, s, frame) => {
    const px = s / 16
    const bounce = Math.sin(frame * 0.1) * 2
    // 绿色史莱姆主体（圆角方形）
    ctx.fillStyle = '#22C55E'
    ctx.fillRect(px * 4, px * 6 + bounce, px * 8, px * 7)
    ctx.fillRect(px * 5, px * 5 + bounce, px * 6, px * 1)
    ctx.fillRect(px * 3, px * 7 + bounce, px * 1, px * 5)
    ctx.fillRect(px * 12, px * 7 + bounce, px * 1, px * 5)
    ctx.fillRect(px * 5, px * 13 + bounce, px * 6, px * 1)
    // 高光
    ctx.fillStyle = '#4ADE80'
    ctx.fillRect(px * 5, px * 7 + bounce, px * 2, px * 1)
    ctx.fillRect(px * 5, px * 8 + bounce, px * 1, px * 1)
    // 眼睛
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(px * 6, px * 9 + bounce, px * 2, px * 2)
    ctx.fillRect(px * 9, px * 9 + bounce, px * 2, px * 2)
    ctx.fillStyle = '#000'
    ctx.fillRect(px * 7, px * 9 + bounce, px * 1, px * 2)
    ctx.fillRect(px * 10, px * 9 + bounce, px * 1, px * 2)
    // 微笑
    ctx.fillStyle = '#000'
    ctx.fillRect(px * 7, px * 11 + bounce, px * 1, px * 1)
    ctx.fillRect(px * 8, px * 12 + bounce, px * 1, px * 1)
    ctx.fillRect(px * 9, px * 11 + bounce, px * 1, px * 1)
  },

  penguin: (ctx, s, frame) => {
    const px = s / 16
    const waddle = Math.sin(frame * 0.1) * 1.5
    // 深蓝色身体
    ctx.fillStyle = '#1E3A8A'
    ctx.fillRect(px * 5, px * 4 + waddle, px * 6, px * 9)
    // 白色腹部
    ctx.fillStyle = '#E2E8F0'
    ctx.fillRect(px * 6, px * 6 + waddle, px * 4, px * 6)
    // 深蓝色头
    ctx.fillStyle = '#1E3A8A'
    ctx.fillRect(px * 5, px * 3 + waddle, px * 6, px * 3)
    // 眼睛
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(px * 6, px * 4 + waddle, px * 1, px * 1)
    ctx.fillRect(px * 9, px * 4 + waddle, px * 1, px * 1)
    ctx.fillStyle = '#000'
    ctx.fillRect(px * 6, px * 4 + waddle, px * 1, px * 1)
    ctx.fillRect(px * 9, px * 4 + waddle, px * 1, px * 1)
    // 橙色喙
    ctx.fillStyle = '#F59E0B'
    ctx.fillRect(px * 7, px * 5 + waddle, px * 2, px * 1)
    // 翅膀
    ctx.fillStyle = '#1E40AF'
    ctx.fillRect(px * 3, px * 6 + waddle, px * 2, px * 4)
    ctx.fillRect(px * 11, px * 6 + waddle, px * 2, px * 4)
    // 橙色脚
    ctx.fillStyle = '#F59E0B'
    ctx.fillRect(px * 5, px * 13 + waddle, px * 2, px * 1)
    ctx.fillRect(px * 9, px * 13 + waddle, px * 2, px * 1)
  },

  wolf: (ctx, s, frame) => {
    const px = s / 16
    const growl = Math.sin(frame * 0.1) * 1.5
    // Body
    ctx.fillStyle = '#78909c'
    ctx.fillRect(px * 3, px * 7, px * 10, px * 6)
    // Fur texture
    ctx.fillStyle = '#546e7a'
    ctx.fillRect(px * 4, px * 8, px * 2, px * 1)
    ctx.fillRect(px * 7, px * 8, px * 2, px * 1)
    ctx.fillRect(px * 10, px * 8, px * 2, px * 1)
    // Head
    ctx.fillStyle = '#78909c'
    ctx.fillRect(px * 4, px * 2, px * 7, px * 6)
    // Ears
    ctx.fillStyle = '#78909c'
    ctx.fillRect(px * 4, px * 0, px * 2, px * 3)
    ctx.fillRect(px * 9, px * 0, px * 2, px * 3)
    ctx.fillStyle = '#546e7a'
    ctx.fillRect(px * 5, px * 1, px * 1, px * 1)
    ctx.fillRect(px * 10, px * 1, px * 1, px * 1)
    // Eyes
    ctx.fillStyle = '#ffeb3b'
    ctx.fillRect(px * 5, px * 3, px * 2, px * 1)
    ctx.fillRect(px * 8, px * 3, px * 2, px * 1)
    ctx.fillStyle = '#000'
    ctx.fillRect(px * 6, px * 3, px * 1, px * 1)
    ctx.fillRect(px * 9, px * 3, px * 1, px * 1)
    // Snout
    ctx.fillStyle = '#cfd8dc'
    ctx.fillRect(px * 5, px * 5 + growl, px * 5, px * 2)
    ctx.fillStyle = '#000'
    ctx.fillRect(px * 7, px * 6, px * 1, px * 1)
    // Tail
    ctx.fillStyle = '#78909c'
    ctx.fillRect(px * 13, px * 7, px * 2, px * 3)
    ctx.fillStyle = '#546e7a'
    ctx.fillRect(px * 15, px * 8, px * 1, px * 1)
    // Legs
    ctx.fillStyle = '#546e7a'
    ctx.fillRect(px * 4, px * 13, px * 2, px * 2)
    ctx.fillRect(px * 9, px * 13, px * 2, px * 2)
  }
}

export function PixelPet({ pet, size = 120, animated = true, attacking = false, takingDamage = false, className = '' }: PixelPetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = size * 2
    canvas.height = size * 2
    ctx.imageSmoothingEnabled = false

    const drawFn = pet ? PIXEL_DRAWINGS[pet.sprite_type] : null
    if (!drawFn) {
      // Default: show "no pet" placeholder
      ctx.fillStyle = '#333'
      ctx.fillRect(0, 0, size * 2, size * 2)
      ctx.fillStyle = '#666'
      ctx.font = `${size / 2}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('?', size, size * 1.2)
      return
    }

    const animate = () => {
      ctx.clearRect(0, 0, size * 2, size * 2)

      // Background glow when attacking
      if (attacking) {
        ctx.fillStyle = 'rgba(255, 100, 50, 0.1)'
        ctx.fillRect(0, 0, size * 2, size * 2)
      }
      if (takingDamage) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)'
        ctx.fillRect(0, 0, size * 2, size * 2)
      }

      // Apply shake
      let shakeX = 0, shakeY = 0
      if (takingDamage) {
        shakeX = Math.sin(frameRef.current * 2) * 4
        shakeY = Math.cos(frameRef.current * 2) * 3
      }
      if (attacking) {
        shakeX = Math.sin(frameRef.current * 1.5) * 2
      }

      ctx.save()
      ctx.translate(size / 2 + shakeX, size / 2 + shakeY)

      // Scale to fit
      const scale = size / 120
      ctx.scale(scale, scale)

      drawFn(ctx, 120, frameRef.current)

      ctx.restore()

      // HP bar
      if (pet) {
        const barY = size * 2 - 20
        const barW = size * 1.6
        const barH = 8
        const barX = (size * 2 - barW) / 2

        // Background
        ctx.fillStyle = '#333'
        ctx.fillRect(barX, barY, barW, barH)
        // HP fill
        const hpRatio = pet.hp / pet.max_hp
        const hpColor = hpRatio > 0.5 ? '#2fc9a3' : hpRatio > 0.25 ? '#d9b871' : '#e57e7e'
        ctx.fillStyle = hpColor
        ctx.fillRect(barX, barY, barW * hpRatio, barH)
        // Text
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 10px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`Lv.${pet.level} ${pet.name}`, size, barY - 4)
        ctx.fillText(`${pet.hp}/${pet.max_hp}`, size, barY + barH + 12)
      }

      frameRef.current++
      if (animated) {
        animRef.current = requestAnimationFrame(animate)
      }
    }

    if (animated) {
      animRef.current = requestAnimationFrame(animate)
    } else {
      animate()
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [pet, size, animated, attacking, takingDamage])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role={pet ? 'img' : undefined}
      aria-hidden={pet ? undefined : true}
      aria-label={pet?.name
        ? `${pet.name}（${SPRITE_DESC[pet.sprite_type] || '像素宠物'}，当前等级 ${pet.level ?? 1}）`
        : pet ? '像素宠物' : undefined}
      style={{
        width: size,
        height: size * 2,
        imageRendering: 'pixelated',
      }}
    />
  )
}
