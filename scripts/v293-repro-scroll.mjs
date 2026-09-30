/* v2.9.3 复现探针（BUGS#24 第三次复发）：
   不只量 scrollHeight——实际做触摸滑动手势，记录"哪个元素真的滚动了"。
   逐元素对照 scrollHeight>clientHeight + computed overflow-y + 手势前后 scrollTop 变化。
   跑法：npm run preview（4173）→ node scripts/v293-repro-scroll.mjs */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = '.acceptance/v293-repro'
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, hasTouch: true })
const page = await ctx.newPage()

/* 逐元素审计：谁声明了可滚 + 谁内容超框 */
const audit = () => page.evaluate(() => {
  const out = { docSE: null, docScrollH: 0, innerH: innerHeight, scrollers: [], overflowers: [] }
  const se = document.scrollingElement
  out.docSE = `${se.tagName}.${se.className}::${se.id}`
  out.docScrollH = se.scrollHeight
  out.docClientH = se.clientHeight
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el)
    const oy = cs.overflowY, ox = cs.overflowX
    if (/(auto|scroll)/.test(oy + ox)) out.scrollers.push(`${el.tagName}#${el.id}.${String(el.className).slice(0, 40)} oy=${oy} ox=${ox} sh=${el.scrollHeight} ch=${el.clientHeight}`)
    if (el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0) out.overflowers.push(`${el.tagName}#${el.id}.${String(el.className).slice(0, 40)} oy=${oy} sh=${el.scrollHeight} ch=${el.clientHeight}`)
  }
  return out
})

const snapshot = (label) => page.evaluate(() => ({
  docTop: document.scrollingElement.scrollTop,
  bodyScrollH: document.body.scrollHeight,
  htmlScrollH: document.documentElement.scrollHeight,
  winInnerH: innerHeight,
  tops: Array.from(document.querySelectorAll('#wrap,#shell,.view,#stagewrap,.hswrap,.hstage,.lchips,.pcard'))
    .map(el => `${el.id || el.className}::top=${el.scrollTop}::sh=${el.scrollHeight}::ch=${el.clientHeight}`),
}))

async function touchSwipeUp() {
  /* 从屏幕中下部向上滑（试图滚动内容） */
  await page.touchscreen.tap(195, 400).catch(() => {})
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 600, xDistance: 0, yDistance: -300, speed: 2000 })
}

for (const L of [7, 1]) {
  console.log(`\n===== Lesson ${L} =====`)
  await page.goto(`${BASE}?learn=${L}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const a0 = await audit()
  console.log('scrollers(overflow auto/scroll):', a0.scrollers.length ? a0.scrollers : '无')
  console.log('overflowers(content>taller):', a0.overflowers.length ? a0.overflowers.slice(0, 10) : '无')
  console.log(`doc: scrollH=${a0.docScrollH} clientH=${a0.docClientH} innerH=${a0.innerH} SE=${a0.docSE}`)
  const s0 = await snapshot('before')
  console.log('before:', JSON.stringify(s0))
  await page.screenshot({ path: `${OUT}/L${L}-before.png` })
  await touchSwipeUp()
  await page.waitForTimeout(600)
  const s1 = await snapshot('after')
  console.log('after :', JSON.stringify(s1))
  await page.screenshot({ path: `${OUT}/L${L}-after.png` })
  const moved = s1.docTop !== s0.docTop || JSON.stringify(s1.tops) !== JSON.stringify(s0.tops)
  console.log(moved ? '>>> 滚动复现：有元素 scrollTop 变化' : '>>> 本环境（Chromium 桌面模拟）未滚动')
}
await browser.close()
