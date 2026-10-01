/* v4.0 游戏岛视觉验收截图：hub + 每日挑战(进行/结算) + 4 游戏×3 态(倒计时/进行中/结算) = 14 张
   前置：preview 在 4173。种子=已学 L1-L4（镜像对 b/d/p/q 在池内） */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = '.shots-v40'
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
async function mk() {
  const page = await browser.newPage({ ...devices['iPhone 13'], hasTouch: true })
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('pinyin_v2', JSON.stringify({
      weights: {}, stars: { 1: 3, 2: 3, 3: 2 }, cards: {}, hist: [],
      mute: true, bolt: { acc: 0, d: '', tacc: 0, td: '' }, days: {},
    }))
    localStorage.setItem('pinyin_learn', JSON.stringify({ u: 4, stars: { 1: 3, 2: 3, 3: 3, 4: 2 }, best: { 1: 5, 2: 5, 3: 5, 4: 4 }, step: {} }))
    localStorage.setItem('pinyin_growth_v1', JSON.stringify({ v: 1, stars: 40, badges: ['first'], seenStage: 1, det: 3, tone: 2, boltPerf: false }))
  })
  return page
}

const shots = []

/* ---------- ① 游戏岛 hub ---------- */
{
  const p = await mk()
  await p.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await p.waitForSelector('#v-island', { timeout: 8000 })
  await p.waitForTimeout(600)
  await p.screenshot({ path: `${OUT}/01-island-hub.png` })
  shots.push('01-island-hub')
  await p.context().close()
}

/* ---------- ② 每日挑战：进行中（听写） ---------- */
{
  const p = await mk()
  await p.goto(`${BASE}/?open=daily`, { waitUntil: 'networkidle' })
  await p.waitForSelector('#dqcard', { timeout: 8000 })
  await p.waitForTimeout(500)
  await p.screenshot({ path: `${OUT}/02-daily-play.png` })
  shots.push('02-daily-play')
  await p.context().close()
}

/* ---------- ③ 每日挑战：结算 ---------- */
{
  const p = await mk()
  await p.goto(`${BASE}/?open=daily`, { waitUntil: 'networkidle' })
  await p.waitForSelector('#dqcard', { timeout: 8000 })
  /* 连答 10 题（读 __PJ 状态，真点击 DOM） */
  for (let i = 0; i < 40; i++) {
    const done = await p.evaluate(() => window.__PJ.DC().done)
    if (done) break
    await p.waitForTimeout(350)
    await p.evaluate(() => {
      const dc = window.__PJ.DC()
      if (dc.reveal) return
      const ans = dc.qs[dc.i].ans
      const opts = Array.from(document.querySelectorAll('#dqcard [data-opts] .opt'))
      opts[ans]?.click()
    })
    await p.waitForTimeout(300)
  }
  await p.waitForSelector('#dresult', { timeout: 6000 })
  await p.evaluate(() => document.getElementById('celebrate')?.click())
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${OUT}/03-daily-result.png` })
  shots.push('03-daily-result')
  await p.context().close()
}

/* ---------- ④-⑥ 四游戏 × 倒计时/进行/结算 ---------- */
const GAMES = [['balloon', 'balloon'], ['mole', 'mole'], ['duel', 'duel'], ['fish', 'fish']]
let n = 4
for (const [g, name] of GAMES) {
  const p = await mk()
  /* 倒计时（冻结在 3） */
  await p.goto(`${BASE}/?open=game&g=${g}&st=count`, { waitUntil: 'networkidle' })
  await p.waitForSelector('#gcount', { timeout: 8000 })
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/${String(n).padStart(2, '0')}-${name}-count.png` })
  shots.push(`${String(n).padStart(2, '0')}-${name}-count`)
  n++
  /* 进行中（冻结计时，等实体出现） */
  await p.goto(`${BASE}/?open=game&g=${g}&st=play`, { waitUntil: 'networkidle' })
  await p.waitForSelector('#gstage', { timeout: 8000 })
  await p.waitForTimeout(1500)
  /* 真听一遍 + 答对一次（气球/地鼠/钓鱼按 data-target 点 data-letter；拔河点正确选项） */
  await p.evaluate(() => {
    document.querySelector('[data-listen]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  })
  await p.waitForTimeout(300)
  if (g === 'duel') {
    await p.evaluate(() => {
      const t = window.__PJ.GS().target
      const letters = Array.from(document.querySelectorAll('[data-opts] .duelopt'))
      const hit = letters.find((e) => e.getAttribute('data-letter') === t) || letters[0]
      hit?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    await p.waitForTimeout(700)
  } else {
    /* 等目标实体上屏（气球/地鼠/钓鱼），点它 */
    await p.waitForSelector(`#gstage [data-letter="${await p.evaluate(() => window.__PJ.GS().target)}"]`, { timeout: 6000 })
    await p.evaluate(() => {
      const t = window.__PJ.GS().target
      const items = Array.from(document.querySelectorAll('#gstage [data-letter]'))
      const hit = items.find((e) => e.getAttribute('data-letter') === t)
      hit?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    await p.waitForTimeout(1600)
  }
  await p.screenshot({ path: `${OUT}/${String(n).padStart(2, '0')}-${name}-play.png` })
  shots.push(`${String(n).padStart(2, '0')}-${name}-play`)
  n++
  /* 结算 */
  await p.goto(`${BASE}/?open=game&g=${g}&st=result`, { waitUntil: 'networkidle' })
  await p.waitForSelector('#gresult', { timeout: 8000 })
  await p.waitForTimeout(600)
  await p.screenshot({ path: `${OUT}/${String(n).padStart(2, '0')}-${name}-result.png` })
  shots.push(`${String(n).padStart(2, '0')}-${name}-result`)
  n++
  await p.context().close()
}

await browser.close()
console.log('shots:', shots.join(' '))
