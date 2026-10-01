/* v4.3 线上探针：BASE=生产站——hub 6 摊位+蛋开局倒计时+专练直达+零 pageerror */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }
const BASE = 'https://kuaner.github.io/pinyin-adventure'
const browser = await chromium.launch()
const page = await browser.newPage({ ...devices['iPhone 13'], hasTouch: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForSelector('#stalls', { timeout: 30000 })
await page.waitForTimeout(800)
const hub = await page.evaluate(() => ({
  stalls: Array.from(document.querySelectorAll('#stalls [data-stall]')).map((e) => e.getAttribute('data-stall')),
  coming: document.querySelectorAll('#stalls [data-coming]').length,
}))
await page.tap('[data-hallbtn="drill"]')
await page.waitForSelector('#drillgrid', { timeout: 15000 })
hub.cards = await page.evaluate(() => document.querySelectorAll('#drillgrid [data-drill]').length)
await page.tap('[data-hallbtn="game"]')
await page.waitForSelector('#stalls', { timeout: 15000 })
console.log('stalls:', hub.stalls.join(','), '| coming:', hub.coming, '| drillcards:', hub.cards)
if (hub.stalls.join(',') !== 'balloon,mole,duel,fish,egg,tone' || hub.coming !== 0 || hub.cards !== 6) { console.log('PROBE-FAIL hub'); process.exit(2) }
await page.tap('[data-stall="egg"]')
await page.waitForSelector('#gcount', { timeout: 15000 })
await page.waitForSelector('#gcount', { state: 'detached', timeout: 20000 })
await page.waitForSelector('#gstage [data-half]', { timeout: 15000 })
const egg = await page.evaluate(() => ({
  target: document.querySelector('[data-prompt]')?.getAttribute('data-target'),
  halves: document.querySelectorAll('#gstage [data-half]').length,
}))
console.log('egg game live:', JSON.stringify(egg))
await page.screenshot({ path: '.acceptance-v43/live-egg.png' })
if (!egg.target || egg.halves < 4) { console.log('PROBE-FAIL egg'); process.exit(2) }
if (errs.length) { console.log('pageerrors:', errs.join('|')); process.exit(2) }
console.log('PROBE-OK ✓ 线上 v4.3.0 存活：hub 6 摊位零占位+蛋合并真实开局+零 pageerror')
await browser.close()
