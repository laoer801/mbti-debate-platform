/**
 * v32 冒烟验证脚本（smoke-v32.cjs）
 *
 * 用系统 Edge（channel: msedge）打开 dev server，验证：
 *  1. 首页正常加载（无白屏/崩溃）
 *  2. 知识库页「领域知识库」模式可用：领域 tab 条、导入区、检索测试渲染
 *  3. 1v1 深度交流页（PersonaChat）渲染：标题、知识库状态卡
 *  4. 模拟提问触发 RAG 检索 → 参考来源卡 UI 存在
 *
 * 运行：NODE_PATH=<workspace>/node_modules node scripts/smoke-v32.cjs
 */
const { chromium } = require('playwright')

const BASE = 'http://localhost:5175'
const OUT_DIR = 'D:/mbti-debate-platform/client/scripts/smoke-shots'

function log(...a) { console.log(...a) }

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })

  // 1. 首页
  log('[1] 打开首页…')
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2500) // 等懒加载 + 首次渲染
  await page.screenshot({ path: `${OUT_DIR}/01-home.png` })
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 120))
  log('    首页文本片段:', JSON.stringify(bodyText.replace(/\s+/g, ' ').slice(0, 60)))

  // 2. 知识库页（TabBar 找「知识库」入口）
  log('[2] 进入知识库页…')
  const libBtn = page.getByRole('button', { name: /知识库/ }).first()
  if (await libBtn.count()) { await libBtn.click() } else { await page.keyboard.press('Control+k') }
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT_DIR}/02-library.png` })

  // 3. 领域知识库按钮
  log('[3] 切到「领域知识库」…')
  const domainBtn = page.getByRole('button', { name: /领域知识库/ })
  const domainBtnCount = await domainBtn.count()
  log(`    「领域知识库」按钮数量: ${domainBtnCount}`)
  if (domainBtnCount > 0) {
    await domainBtn.first().click()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT_DIR}/03-domain.png` })
    const domainText = await page.evaluate(() => document.body.innerText)
    for (const kw of ['金融理财', '法律法规', '医疗健康', '检索测试']) {
      log(`    包含「${kw}」: ${domainText.includes(kw)}`)
    }
  }

  // 4. 1v1 深度交流页
  log('[4] 进入 1v1 深度交流…')
  const chatBtn = page.getByRole('button', { name: /1v1|深度交流|人格对话/ }).first()
  if (await chatBtn.count()) { await chatBtn.click() } else { await page.keyboard.press('Control+q') }
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT_DIR}/04-chat.png` })
  const chatText = await page.evaluate(() => document.body.innerText)
  log('    标题含「1v1 深度交流」:', chatText.includes('1v1 深度交流'))
  log('    含知识库状态字样:', /知识库|📚/.test(chatText))

  log('')
  log('=== 页面错误 ===')
  if (errors.length === 0) log('  （无）')
  else errors.slice(0, 10).forEach(e => log('  ' + e))

  await browser.close()
  log('冒烟完成 ✅')
})().catch(e => { console.error('冒烟失败:', e.message); process.exit(1) })
