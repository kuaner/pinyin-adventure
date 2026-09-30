/* v2.5.0 现状/验收截图：我们的 app 各页 390×844 → /tmp/pj-shots/
   用法: node scripts/v250-shots.mjs [outdir] */
import { createRequire } from 'node:module'
import { mkdirSync } from 'fs'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) }
catch { ({ chromium } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199'
const OUT = process.argv[2] || '/tmp/pj-shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
/* 预置进度：全解锁+三星，保证关卡/课程可见 */
await page.addInitScript(() => {
  localStorage.setItem('pinyin_v2', JSON.stringify({ weights: {}, stars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 }, hist: [], mute: true, bolt: {} }))
  localStorage.setItem('pinyin_learn', JSON.stringify({ u: 12, stars: { 1: 3, 2: 3, 3: 3 }, best: {} }))
})
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })

async function go(qs, name, wait = 1200) {
  await page.goto(`${BASE}/?${qs}`, { waitUntil: 'load' })
  await page.waitForTimeout(wait)
  await shot(name)
  console.log('shot', name)
}

await go('open=learn', 'A-learn-tab')
await go('open=practice', 'B-practice-tab')
await go('open=mine', 'C-mine-tab')
await go('open=levels', 'D-levels')
await go('open=quiz', 'E-quiz')
await go('open=pairs', 'F-pairs')
await go('open=result', 'G-result')
await go('open=flash', 'H-flash')
await go('open=radio', 'I-radio')
await go('open=lesson&learn=1', 'J-lesson-know')
await go('open=bolt', 'K-bolt')
await go('open=zi', 'L-zi')

await browser.close()
console.log('DONE', OUT)
