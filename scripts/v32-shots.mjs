/* v3.2 升级体系截图（kuaner 五要素验收）：我的tab(小鸡+签到+徽章)/收集册/过关庆祝/迷你庆祝/毕业典礼/五阶段。
   localStorage 种子=一致的已学状态（learn/growth 双写），?open= 走线上同路径触发真实组件。 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = '.acceptance-v32'
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT)

const ALL = ['first', 'grad', 'allcards', 'coll30', 'tone', 'det', 'boltperfect']
const lstarsAll = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), 3]))

function dayStr(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  const m = d.getMonth() + 1, dd = d.getDate()
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd
}
const lastDays = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [dayStr(i), 1]))

const browser = await chromium.launch()

async function shot(name, open, seed, ms = 900) {
  const page = await browser.newPage({ ...devices['iPhone 13'], hasTouch: true, deviceScaleFactor: 2 })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.addInitScript((o) => {
    localStorage.clear()
    localStorage.setItem('pinyin_v2', JSON.stringify({
      weights: {}, stars: o.pstars || {}, cards: {}, hist: [],
      mute: true, bolt: { acc: 0, d: '', tacc: 0, td: '' }, days: o.days || {},
    }))
    localStorage.setItem('pinyin_learn', JSON.stringify({ u: o.u || 1, stars: o.lstars || {}, best: o.lbest || {}, step: {} }))
    localStorage.setItem('pinyin_growth_v1', JSON.stringify({
      v: 1, stars: o.gstars || 0, badges: o.badges || [], seenStage: o.seenStage ?? -1,
      det: o.det || 0, tone: o.tone || 0, boltPerf: !!o.boltPerf,
    }))
  }, seed)
  await page.goto(`${BASE}/?open=${open}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(ms)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  if (errs.length) console.log(`  ✗ ${name}: pageerror ${errs[0]}`)
  else console.log(`  ✓ ${name}.png`)
  await page.close()
}

/* ① 我的 tab：小鸡老鹰(520★) + 签到连击 + 徽章墙（7得3未得）+ 卡片入口 */
await shot('1-mine-rich', 'mine', {
  gstars: 520, badges: ALL, seenStage: 4, det: 40, tone: 40, boltPerf: true,
  lstars: lstarsAll, u: 12, days: lastDays(5),
}, 1100)

/* ② 收集册全览：L1-L2 通过 → 首页 6 金卡 + 3 灰卡同框（金卡=已学，灰=?剪影） */
await shot('2-album', 'album', {
  gstars: 30, badges: ['first'], seenStage: 0,
  lstars: { 1: 3, 2: 3 }, u: 3,
}, 1100)

/* ③ 小测过关庆祝帧（confetti 飘落+星星飞行中段） */
await shot('3-celeb-quiz', 'celebquiz', { gstars: 12, seenStage: 0, days: lastDays(1) }, 1250)

/* ④ 字母学完迷你庆祝（半屏） */
await shot('4-celeb-letter', 'celebletter', { gstars: 20, seenStage: 0, days: lastDays(1) }, 900)

/* ⑤ 毕业典礼（12 课全通模拟：大量彩带+星星汇聚+最终形态+毕业帽；1.0s=星星汇聚中段） */
await shot('5-celeb-grad', 'celebgrad', { gstars: 60, badges: ['first'], seenStage: 1, lstars: lstarsAll, u: 12 }, 1000)

/* ⑥ 小鸡五阶段（0/50/150/300/500 阈值档各一帧，供逐阶段辨识） */
const stages = [[10, 0], [80, 1], [200, 2], [380, 3], [520, 4]]
for (const [stars, st] of stages) {
  await shot(`6-stage-${st}`, 'mine', { gstars: stars, seenStage: st, badges: st >= 1 ? ['first'] : [] }, 1000)
}

await browser.close()
console.log('v32 shots done →', OUT)
