/* v2.9.3 真实流程复现探针（BUGS#24）：
   模拟 kuaner 操作流：学习tab → 点第1课 → 逐步骤 → 返回 → 点第7课 → 逐步骤
   × 三档视口高度（844 PWA / 719 / 664 Safari带地址栏）
   每个状态断言：html/body scrollHeight ≤ innerHeight + 全元素 scrollH>clientH 审计 + 实际滑动手势
   跑法：npm run preview（4173）→ node scripts/v293-flow-probe.mjs */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = '.acceptance/v293-flow'
fs.mkdirSync(OUT, { recursive: true })
let fails = 0
const bad = (msg) => { console.log('  ✗ ' + msg); fails++ }

const browser = await chromium.launch()

const measure = (page) => page.evaluate(() => {
  const se = document.scrollingElement
  const r = { docSH: se.scrollHeight, innerH: innerHeight, bodySH: document.body.scrollHeight, movers: [] }
  for (const el of document.querySelectorAll('*')) {
    if (el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0)
      r.movers.push(`${el.tagName}#${el.id}.${String(el.className).split(' ').slice(0,2).join('.')} sh=${el.scrollHeight} ch=${el.clientHeight} oy=${getComputedStyle(el).overflowY}`)
  }
  return r
})

async function swipe(page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 550, xDistance: 0, yDistance: -260, speed: 1800 })
  await page.waitForTimeout(350)
}

async function runFlow(H) {
  console.log(`\n########## viewport 390×${H} ##########`)
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: H }, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)

  const check = async (label, shot) => {
    const m = await measure(page)
    const over = m.docSH > m.innerH
    if (shot) await page.screenshot({ path: `${OUT}/${shot}.png` })
    if (over || m.movers.length) bad(`${label}: docSH=${m.docSH} innerH=${m.innerH} movers=[${m.movers.slice(0, 6).join(' | ')}]`)
    else console.log(`  ✓ ${label} docSH=${m.docSH}==innerH=${m.innerH} 无超框元素`)
    await swipe(page)
    const m2 = await measure(page)
    if (m2.docSH !== m.docSH || m2.movers.length > m.movers.length)
      bad(`${label}: 滑动手势后变化 docSH ${m.docSH}→${m2.docSH} movers ${m.movers.length}→${m2.movers.length}`)
    return !over
  }

  /* 学习 tab 初始 */
  await check('学习tab', `L${H}-learntab`)

  /* 进第 1 课，逐步骤 */
  await page.tap('[data-lesson="1"]')
  await page.waitForTimeout(600)
  const steps1 = await page.$$eval('#rail .rstep', els => els.map(e => e.dataset.step))
  for (const s of steps1) {
    await page.tap(`#rail .rstep[data-step="${s}"]`)
    await page.waitForTimeout(450)
    await check(`L1-步骤${s}`, `L${H}-l1-s${s}`)
  }
  /* 返回学习 tab */
  await page.tap('[data-back="learn"]')
  await page.waitForTimeout(500)
  /* 切换到第 7 课（5 字母课程） */
  await page.tap('[data-lesson="7"]')
  await page.waitForTimeout(600)
  const steps7 = await page.$$eval('#rail .rstep', els => els.map(e => e.dataset.step))
  for (const s of steps7) {
    await page.tap(`#rail .rstep[data-step="${s}"]`)
    await page.waitForTimeout(450)
    await check(`L7-步骤${s}`, `L${H}-l7-s${s}`)
  }
  /* 切字母（L7 有 5 个字母 chip） */
  const lers = await page.$$eval('.lchips .lchip', els => els.map(e => e.dataset.ler)).catch(() => [])
  if (lers.length) {
    await page.tap(`.lchips .lchip[data-ler="${lers[lers.length - 1]}"]`)
    await page.waitForTimeout(400)
    await check(`L7-切字母${lers[lers.length - 1]}`, `L${H}-l7-letter`)
  }
  await ctx.close()
}

for (const H of [844, 719, 664]) await runFlow(H)
await browser.close()
console.log(`\n${fails === 0 ? '★★★ 全状态零超框' : `✗✗✗ ${fails} 处异常`}`)
process.exit(fails ? 1 : 0)
