/* 定向补拍：确定性答错 → Feedback PinyinCard mini 层 */
import { createRequire } from 'node:module'
import { mkdirSync } from 'fs'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) }
catch { ({ chromium } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199'
const OUT = process.argv[2] || '/tmp/pj-r2'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.addInitScript(() => {
  localStorage.setItem('pinyin_v2', JSON.stringify({ weights: {}, stars: { 1: 3 }, hist: [], mute: true, bolt: {} }))
})
await page.goto(`${BASE}/?open=quiz`, { waitUntil: 'load' })
await page.waitForTimeout(1100)

/* 逐个点选项直到答错（4 选项必有错）；每轮后若答对则点继续下一题 */
for (let round = 0; round < 12; round++) {
  const bad = await page.evaluate((r) => {
    const fb = document.getElementById('fb')
    if (fb && fb.classList.contains('bad')) return true
    const opts = [...document.querySelectorAll('#optbox .opt')]
    if (!opts.length) return false
    opts[r % opts.length].click()
    return false
  }, round)
  if (bad) break
  await page.waitForTimeout(400)
  const skipped = await page.evaluate(() => {
    const fb = document.getElementById('fb')
    if (fb && fb.classList.contains('bad')) return 'bad'
    const skip = document.getElementById('fbskip')
    if (fb && skip) { skip.click(); return 'skipped' }
    return ''
  })
  await page.waitForTimeout(skipped === 'skipped' ? 1200 : 400)
}
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/R6b-fb-mini-wrong.png` })
const mini = await page.evaluate(() => !!document.querySelector('[data-pcdetail]'))
console.log('DONE mini=' + mini)
await browser.close()
