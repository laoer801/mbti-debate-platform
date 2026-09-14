// AES-256-GCM 加密 / 解密工具
// 用于加密存储知乎 z_c0 cookie；密钥来自环境变量 ZHIHU_COOKIE_KEY
// 输出：base64 编码的 ciphertext / iv / tag，存数据库时三个字段分开存

import crypto from 'crypto'

const ALG = 'aes-256-gcm'
const IV_BYTES = 12 // GCM 推荐 12 字节

function getKey() {
  const raw = process.env.ZHIHU_COOKIE_KEY || ''
  if (!raw || raw.length < 32) {
    throw new Error('ZHIHU_COOKIE_KEY 未配置或长度不足 32 字符（用于 AES-256-GCM 加密知乎 cookie）')
  }
  // 取 SHA-256 哈希作为 32 字节密钥（避免 base64 解码问题）
  return crypto.createHash('sha256').update(raw, 'utf8').digest()
}

/**
 * 加密明文
 * @param {string} plaintext
 * @returns {{ ciphertext: string, iv: string, tag: string }}
 */
export function encrypt(plaintext) {
  if (typeof plaintext !== 'string') throw new Error('plaintext 必须是字符串')
  const key = getKey()
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALG, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
}

/**
 * 解密
 * @param {{ ciphertext: string, iv: string, tag: string }} payload
 * @returns {string}
 */
export function decrypt(payload) {
  if (!payload || !payload.ciphertext || !payload.iv || !payload.tag) {
    throw new Error('解密参数不完整')
  }
  const key = getKey()
  const iv = Buffer.from(payload.iv, 'base64')
  const tag = Buffer.from(payload.tag, 'base64')
  const ciphertext = Buffer.from(payload.ciphertext, 'base64')
  const decipher = crypto.createDecipheriv(ALG, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/**
 * 生成 32 字节随机密钥（用于生成 .env 配置）
 */
export function generateKey() {
  return crypto.randomBytes(32).toString('hex').slice(0, 48)
}