/* v2.9 补充截图：08 有声母 5 步课全景（task 验收 8 张之一）+ 09 L1 听调题特写（新题型目验） */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = '.acceptance/v290'
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, hasTouch: true })
const page = await ctx.newPage()
await page.addInitScript(() => {
  const p = Audio.prototype.play
  Audio.prototype.play = function (...args) {
    try { window.__lastAudioSrc = this.currentSrc || this.src || '' } catch (e) { /* ignore */ }
    return p.apply(this, args)
  }
})

/* 08：有声母 5 步课全景（全新 context，零进度污染：u=1 直开 L3） */
await page.goto(`${BASE}?learn=3&step=1&li=0`, { waitUntil: 'load' })
await page.waitForSelector('#v-lesson', { timeout: 8000 })
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/08-L3-有声母五步课.png` })

/* 09：L1 听调题特写（走到 tone 题再截） */
await page.goto(`${BASE}?learn=1&step=4&qkey=1`, { waitUntil: 'load' })
await page.waitForSelector('#v-lesson', { timeout: 8000 })
await page.waitForTimeout(500)
for (let i = 0; i < 5; i++) {
  if (await page.$('.topt')) break
  if (await page.$('.optear')) {
    const glyph = await page.$eval('[data-qglyph]', (el) => el.textContent.trim())
    await page.click(`.opts .optear[data-qkey="${glyph}"]`)
  } else {
    await page.click('[data-qplay]')
    await page.waitForTimeout(450)
    const k = await page.evaluate(() => String(window.__lastAudioSrc || '').match(/([A-Za-z0-9]+)\.mp3/)?.[1] || '')
    await page.click(`.opts [data-qkey="${k}"]`).catch(async () => page.click('.opts .opt:first-child'))
  }
  await page.waitForTimeout(2500)
}
if (await page.$('.topt')) await page.screenshot({ path: `${OUT}/09-L1-听调题.png` })
else console.log('WARN: 本轮 5 题未遇 tone（重跑一次）')

await browser.close()
console.log('extra shots done')
