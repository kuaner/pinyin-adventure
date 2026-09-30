/* BUGS#30 复现：L7（z c s y w）选第 4/5 个字母时"页面左移异常"。
   假说 A：chip 条 scrollIntoView({inline:center}) 连带滚动 overflow:hidden 祖先（#lesson-root，
   其可滚溢出被 HSteps track 撑出 (N-1)*W）→ 整页左移。
   量测：点 chip 前后 #lesson-root/#v-lesson/#stagewrap/.hswrap 的 scrollLeft + HSteps transform + chip 条自身 scrollLeft。 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))

const snap = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const root = q('#lesson-root'), sec = q('#v-lesson'), stage = q('#stagewrap'), wrap = q('.hswrap'), chips = q('[data-lchips]')
  const track = q('.hstage')
  const cs = (el) => el ? getComputedStyle(el).overflowX + '/' + getComputedStyle(el).overflowY : '-'
  return {
    root: root ? [root.scrollLeft, root.scrollWidth, root.clientWidth, cs(root)] : null,
    sec: sec ? [sec.scrollLeft, sec.scrollWidth, sec.clientWidth, cs(sec)] : null,
    stage: stage ? [stage.scrollLeft, stage.scrollWidth, stage.clientWidth, cs(stage)] : null,
    wrap: wrap ? [wrap.scrollLeft, wrap.scrollWidth, wrap.clientWidth, cs(wrap)] : null,
    chips: chips ? [chips.scrollLeft, chips.scrollWidth, chips.clientWidth, cs(chips)] : null,
    transform: track ? track.style.transform : '',
  }
})

for (const lesson of [7, 1]) {
  await page.goto(`${BASE}/?open=lesson&learn=${lesson}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const nL = await page.evaluate(() => document.querySelectorAll('[data-lchips] .lchip').length)
  console.log(`\n=== L${lesson} chips=${nL} initial ===`)
  console.log(JSON.stringify(await snap()))
  for (const i of [1, 2, 3, Math.min(3, nL - 1), Math.min(4, nL - 1)]) {
    await page.evaluate((idx) => {
      const c = document.querySelectorAll('[data-lchips] .lchip')[idx]
      c.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }, i)
    await page.waitForTimeout(500)
    const s = await snap()
    console.log(`tap chip[${i}]: root=${s.root[0]} sec=${s.sec[0]} stage=${s.stage[0]} wrap=${s.wrap[0]} chips=${s.chips[0]} transform=${s.transform}`)
  }
}
await browser.close()
