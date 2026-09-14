/**
 * LLM 调用点鉴权头守卫
 *
 * 背景：知乎直答要求 `X-Request-Timestamp` 做防重放，缺了会返回
 *       401 `invalid_api_key`（报错误导性极强，看着像密钥错，实际是缺头）。
 *       历史上 pk-auto-mode 的总结就漏过这个头，导致总结永远走本地兜底。
 *
 * 本脚本扫描所有「直连知乎鉴权」的代码位置，断言它们都带了时间戳头，
 * 或改用了统一入口 zhihuChat / zhihuFetch（那两个封装内部已带）。
 * 建议纳入发版前检查，杜绝同类问题复发。
 *
 * 用法：node cloud/_check_llm_headers.mjs      （违规时退出码 1）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER = path.resolve(__dirname, '..', 'server')

/** 递归收集 .js（跳过 node_modules） */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.js')) out.push(p)
  }
  return out
}

const CHAT_URL = 'https://developer.zhihu.com/v1/chat/completions'
const files = walk(SERVER)
const problems = []
const okSites = []
const wrapperSites = []

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const rel = path.relative(path.resolve(__dirname, '..'), f).replace(/\\/g, '/')

  // 类别 A：经统一入口（zhihuChat / zhihuFetch）—— 封装内部已带时间戳，天然安全
  const usesWrapper = /zhihuChat\s*\(|zhihuFetch\s*\(/.test(src) && !src.includes('Bearer ')
  if (usesWrapper) { wrapperSites.push(rel); continue }

  // 类别 B：自己直连知乎并带 Bearer 鉴权 —— 必须自己带时间戳头
  if (!src.includes('Bearer ')) continue
  const isZhihu = src.includes('developer.zhihu.com') || src.includes('ZH_BASE_') || src.includes('ZHIHU_ACCESS_SECRET')
  if (!isZhihu) continue

  const hasTs = src.includes('X-Request-Timestamp')
  const lines = src.split('\n')
  const authCount = lines.filter(l => /Bearer \$\{?ZHIHU_ACCESS_SECRET/.test(l) || /Authorization:\s*`Bearer/.test(l)).length

  if (hasTs) {
    okSites.push(`${rel} (${authCount} 处鉴权，已带时间戳头)`)
  } else {
    problems.push(`${rel} — 有 Bearer 鉴权但缺 X-Request-Timestamp，且未使用统一入口`)
  }
}

// 额外断言：统一入口自身必须带时间戳
const entry = path.join(SERVER, 'zhihu.js')
const entrySrc = fs.readFileSync(entry, 'utf8')
if (!entrySrc.includes('X-Request-Timestamp')) problems.push('server/zhihu.js — 统一入口缺 X-Request-Timestamp')

console.log('════ LLM 调用点鉴权头守卫 ════')
console.log(`扫描 ${files.length} 个服务端文件\n`)
console.log('✅ 经统一入口 zhihuChat/zhihuFetch（封装内已带头）：')
wrapperSites.forEach(s => console.log('   ' + s))
console.log('\n✅ 自行直连且已带时间戳头：')
okSites.forEach(s => console.log('   ' + s))
if (problems.length) {
  console.log('\n❌ 违规（会导致 401 invalid_api_key）：')
  problems.forEach(p => console.log('   ' + p))
  console.log(`\n共 ${problems.length} 处违规`)
  process.exit(1)
}
console.log('\n✅ 全部合规：所有知乎鉴权调用都已带防重放时间戳头（或走统一入口）')
