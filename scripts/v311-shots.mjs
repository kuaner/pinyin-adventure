/* v3.1.1 布局截图（BUGS#32）：L1 a / L7 z 学一学页 + 控制键-字模几何断言（浮层不遮字形）。
   断言：pc-ctrls 两钮与 svg.strokeanim 的 bbox 交集为空（水平/垂直分离证据），钮 ≥48。 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = '.acceptance-v311'
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT)

let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) } else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) } }

const browser = await chromium.launch()

async function shot(lesson, letter, name) {
  const page = await browser.newPage({ ...devices['iPhone 13'], hasTouch: true, deviceScaleFactor: 3 })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(`${BASE}/?open=lesson&learn=${lesson}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-lesson .hspage', { timeout: 8000 })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  const geo = await page.evaluate(() => {
    const svg = document.querySelector('#v-lesson .hstage > .hspage:first-child svg.strokeanim')
    const read = document.querySelector('#v-lesson .hstage > .hspage:first-child [data-pcread]')
    const replay = document.querySelector('#v-lesson .hstage > .hspage:first-child [data-pcreplay]')
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, r: b.x + b.width, b: b.y + b.height, w: b.width, h: b.height } }
    return { svg: svg ? r(svg) : null, read: read ? r(read) : null, replay: replay ? r(replay) : null }
  })
  const inter = (a, b) => a && b && !(a.r <= b.x || b.r <= a.x || a.b <= b.y || b.b <= a.y)
  const gapX = geo.svg && geo.read ? Math.round(geo.read.x - geo.svg.r) : -999
  ok(geo.svg && geo.read && !inter(geo.svg, geo.read), `${letter}: 🔊读音钮与字模零交集`, `右缘间隙 ${gapX}px`)
  ok(geo.svg && geo.replay && !inter(geo.svg, geo.replay), `${letter}: ▶重播钮与字模零交集`)
  ok(geo.read && geo.read.w >= 48 && geo.read.h >= 48, `${letter}: 读音钮 ≥48`, `${Math.round(geo.read.w)}×${Math.round(geo.read.h)}`)
  ok(geo.replay && geo.replay.w >= 48 && geo.replay.h >= 48, `${letter}: 重播钮 ≥48`, `${Math.round(geo.replay.w)}×${Math.round(geo.replay.h)}`)
  ok(geo.read && geo.replay && geo.read.x === geo.replay.x && geo.read.b < geo.replay.y, `${letter}: 两钮右对齐纵叠（读音在上）`)
  ok(errs.length === 0, `${letter}: 零 pageerror`)
  /* 钮区特写（字模+浮层一起，看"一体感"） */
  const clip = await page.evaluate(() => {
    const fit = document.querySelector('#v-lesson .hstage > .hspage:first-child .pc-herofit')
    const b = fit.getBoundingClientRect()
    return { x: Math.max(0, b.x - 12), y: Math.max(0, b.y - 12), width: Math.min(390, b.width + 24), height: Math.min(844, b.height + 24) }
  })
  await page.screenshot({ path: `${OUT}/${name}-fit.png`, clip })
  await page.close()
}

await shot(1, 'a', 'L1-a')
await shot(7, 'z', 'L7-z')

console.log(`\n===== v311-shots：${pass} 通过，${fail} 失败 =====`)
await browser.close()
process.exit(fail === 0 ? 0 : 1)
