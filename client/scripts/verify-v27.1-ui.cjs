/* v27.1 UI 验证：HallPage 人格卡 📚 弹药库 + PersonaChat 设置页「思想弹药库」区块 */
const { chromium } = require('C:/Users/老2/.workbuddy/binaries/node/workspace/node_modules/playwright')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', e => errors.push('pageerror: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

  // 1. 大厅页（默认）— 先跳过新手引导
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.setItem('mbti_onboarded_v1', '1'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  // 检查人格卡上的 📚 弹药库行
  const sourceLines = await page.evaluate(() => {
    const cards = document.querySelectorAll('.persona-card')
    const out = []
    cards.forEach(c => {
      const t = c.querySelector('[title]')
      const txt = c.textContent || ''
      if (txt.includes('📚')) {
        const line = txt.split('\n').find(l => l.includes('📚'))
        if (line) out.push(line.trim())
      }
    })
    return out.slice(0, 8)
  })
  console.log('大厅人格卡 📚 行样例：')
  sourceLines.forEach(l => console.log('  ' + l))
  console.log('大厅 📚 卡片总数：' + (await page.evaluate(() => document.querySelectorAll('.persona-card').length)))

  await page.screenshot({ path: 'D:/mbti-debate-platform/verify-v27.1-hall.png', fullPage: false })

  // 2. 进入 1v1 对话（点击 TabBar 的「1v1对话」）
  await page.getByRole('tab', { name: '1v1对话' }).first().click()
  await page.waitForTimeout(2000)

  // 选择 INTJ 人格卡（setup 阶段展示弹药库）
  const intjCard = page.locator('button', { hasText: 'INTJ' }).first()
  await intjCard.click()
  await page.waitForTimeout(1500)

  const setupText = await page.evaluate(() => document.body.innerText)
  const hasAmmo = setupText.includes('思想弹药库')
  console.log('PersonaChat 设置页含「思想弹药库」区块：' + hasAmmo)
  if (hasAmmo) {
    const idx = setupText.indexOf('思想弹药库')
    console.log('区块内容预览：' + setupText.slice(idx, idx + 160).replace(/\n/g, ' | '))
  }
  await page.screenshot({ path: 'D:/mbti-debate-platform/verify-v27.1-personachat-setup.png', fullPage: false })

  console.log('JS 错误数：' + errors.length)
  errors.slice(0, 5).forEach(e => console.log('  ' + e))
  await browser.close()
})()
