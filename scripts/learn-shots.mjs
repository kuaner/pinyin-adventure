/* 学习岛验收截图（390×844 六张）：星图 / L1认识 / 写法动画中帧 / 声调 / 拼读 / 小测 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) }
catch { ({ chromium } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = '.acceptance/learn'
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.addInitScript(() => localStorage.setItem('pinyin_learn', JSON.stringify({ u: 12, stars: { 1: 3 }, best: {} })))
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })

async function openLesson(step, extra = '') {
  await page.goto(`${BASE}?learn=1&step=${step}${extra}`, { waitUntil: 'load' })
  try { await page.click('#ulgo', { timeout: 1500 }) } catch { /* 无解锁层 */ }
  await page.waitForSelector('#v-lesson', { timeout: 8000 })
}

/* 1. 学习岛星图 */
await page.goto(BASE, { waitUntil: 'load' })
try { await page.click('#ulgo', { timeout: 1500 }) } catch { /* 无解锁层 */ }
await page.click('[data-go="learn"]')
await page.waitForSelector('#v-learn')
await page.waitForTimeout(600)
await shot('1-island')
console.log('✓ 1-island')

/* 2. L1 认识 */
await openLesson(1)
await page.waitForTimeout(500)
await shot('2-renshi')
console.log('✓ 2-renshi')

/* 3. 写法动画中帧（真实动画播放中截图） */
await openLesson(2, '&li=0')
await page.waitForTimeout(430)    // a 两笔：第一笔（左半圆）书写中
await shot('3-xiefa-mid')
console.log('✓ 3-xiefa-mid')

/* 4. 声调 */
await openLesson(3)
await page.waitForTimeout(500)
await shot('4-tone')
console.log('✓ 4-tone')

/* 5. 拼读（L3 有拼读表） */
await page.goto(`${BASE}?learn=3&step=4`, { waitUntil: 'load' })
try { await page.click('#ulgo', { timeout: 1500 }) } catch { /* 无解锁层 */ }
await page.waitForSelector('#v-lesson', { timeout: 8000 })
await page.click('.blenddrill .btn.teal')   // 拼一拼 → 合成动画
await page.waitForTimeout(1100)
await shot('5-blend')
console.log('✓ 5-blend')

/* 6. 小测 */
await page.goto(`${BASE}?learn=1&step=5`, { waitUntil: 'load' })
try { await page.click('#ulgo', { timeout: 1500 }) } catch { /* 无解锁层 */ }
await page.waitForSelector('#v-lesson', { timeout: 8000 })
await page.waitForTimeout(600)
await shot('6-quiz')
console.log('✓ 6-quiz')

await browser.close()
console.log('6 张完成 →', OUT)
