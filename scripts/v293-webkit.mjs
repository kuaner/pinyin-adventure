/* v2.9.3 WebKit 引擎回归（iOS Safari 同源）：L1/L7/L12 + 三 tab 零滚动抽检 @844 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let webkit, devices
try { ({ webkit, devices } = require('playwright')) }
catch { ({ webkit, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
let fails = 0
const ok = (c, n, d = '') => { console.log(`${c ? '✓' : '✗ FAIL'} ${n}${d ? ' — ' + d : ''}`); if (!c) fails++ }

const browser = await webkit.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, hasTouch: true })
const page = await ctx.newPage()
await page.addInitScript(() => { try { localStorage.setItem('pinyin_learn', JSON.stringify({ u: 12, stars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 }, best: {}, step: {} })) } catch {} })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)

const zs = () => page.evaluate(() => {
  const r = document.querySelector('#lesson-root, #tab-view-root')
  const se = document.scrollingElement
  return { root: r ? r.scrollHeight - r.clientHeight : -1, doc: se.scrollHeight - innerHeight }
})

for (const [v, sel] of [['learn', null], ['practice', null], ['mine', null]]) {
  await page.tap(`#tabbar [data-tab="${v}"]`).catch(() => {})
  await page.waitForTimeout(400)
  const m = await zs()
  ok(m.root <= 0 && m.doc <= 0, `WK tab ${v} 零滚动`, `root+${m.root} doc+${m.doc}`)
}
for (const n of [1, 7, 12]) {
  await page.tap('#tabbar [data-tab="learn"]')
  await page.waitForTimeout(300)
  await page.tap(`[data-lesson="${n}"]`)
  await page.waitForSelector('#lesson-root', { timeout: 9000 })
  await page.waitForTimeout(500)
  const steps = await page.$$eval('#rail .rstep', (els) => els.map((e) => e.dataset.step))
  for (const s of steps) {
    if (String(s) !== '1') { await page.tap(`#rail .rstep[data-step="${s}"]`); await page.waitForTimeout(350) }
    const m = await zs()
    ok(m.root <= 0 && m.doc <= 0, `WK 第${n}课 步骤${s} 零滚动`, `root+${m.root} doc+${m.doc}`)
  }
  await page.tap('[data-back="learn"]')
  await page.waitForTimeout(300)
}
await browser.close()
console.log(fails === 0 ? '★★★ WebKit 抽检全过' : `✗ ${fails} 失败`)
process.exit(fails ? 1 : 0)
