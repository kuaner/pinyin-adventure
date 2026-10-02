/* 命名回归样例 Bug#40「拼音蛋声母一行展示看不清点不准」（v4.5 修复回归门）。
   病灶双根：①decoyKeys 首分支缺截断——已学声母多时整池上屏（一行 7-8 块）②布局非网格：
   块 31px 宽/字模 26px/间距 8px（kuaner："看都看不清，点都不好点"）。
   修法：干扰数硬上限 n=3（块数 ≤4+4）+ 两行网格（声母/韵母各一档）+块 ≥56px 见方+
   字模 ≥30px+间距 ≥10px+热区整块。
   本样例=390 窄屏（iPhone13 视口 390×664）几何硬断言：块数上限/见方/无重叠/中心距/
   字模/间距/两行结构。前置：preview 4173（或 BASE_URL）。
   独立可跑：node tests/e2e/regression-bug40-egg-grid.mjs */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) } else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) } }

const browser = await chromium.launch()
const LEARN0 = { u: 8, stars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 }, best: {}, step: {} }
/* 已学 8 课（含 g k h / j q x / z c s y w）=大已学池——复现"干扰整池上屏"的病灶条件 */
const page = await browser.newPage({ ...devices['iPhone 13'], hasTouch: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.addInitScript(`
  localStorage.clear()
  localStorage.setItem('pinyin_v2', JSON.stringify({ weights: {}, stars: { 1: 3, 2: 3, 3: 2 }, cards: {}, hist: [], mute: false, bolt: { acc: 0, d: '', tacc: 0, td: '' }, days: {} }))
  localStorage.setItem('pinyin_learn', JSON.stringify(${JSON.stringify(LEARN0)}))
  localStorage.setItem('pinyin_growth_v1', JSON.stringify({ v: 1, stars: 40, badges: [], seenStage: 1, det: 3, tone: 2, boltPerf: false }))
`)

await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
await page.waitForSelector('#v-island', { timeout: 8000 })
await page.tap('[data-stall="egg"]')
await page.waitForSelector('#gcount', { timeout: 5000 })
await page.waitForSelector('#gcount', { state: 'detached', timeout: 9000 })
await page.waitForSelector('#gstage [data-half]', { timeout: 8000 })
await new Promise((r) => setTimeout(r, 400))

/* 连测 3 轮（随机阵容），逐轮几何断言 */
for (let round = 0; round < 3; round++) {
  const geo = await page.evaluate(() => {
    const halves = [...document.querySelectorAll('#gstage [data-half]')]
    const rs = halves.map((b) => {
      const r = b.getBoundingClientRect()
      return { k: b.getAttribute('data-key'), kind: b.getAttribute('data-kind'), x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }
    })
    const rows = [...document.querySelectorAll('#gstage .hrow')]
    const fontHk = getComputedStyle(document.querySelector('#gstage .hk')).fontSize
    /* 间距：同行相邻块左缘差−块宽 */
    const gaps = []
    for (const row of rows) {
      const bs = [...row.querySelectorAll('[data-half]')].map((b) => b.getBoundingClientRect()).sort((a, b) => a.x - b.x)
      for (let i = 1; i < bs.length; i++) gaps.push(+(bs[i].x - (bs[i - 1].x + bs[i - 1].width)).toFixed(1))
    }
    /* 重叠与中心距：全对两两 */
    let overlap = false, minCenter = 1e9
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j]
      if (a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) overlap = true
      const d = Math.hypot(a.cx - b.cx, a.cy - b.cy)
      if (d < minCenter) minCenter = d
    }
    return { n: rs.length, ini: rs.filter((r) => r.kind === 'ini').length, fin: rs.filter((r) => r.kind === 'fin').length,
      minW: Math.min(...rs.map((r) => r.w)), minH: Math.min(...rs.map((r) => r.h)), fontHk,
      minGap: gaps.length ? Math.min(...gaps) : -1, overlap, minCenter: Math.round(minCenter), rows: rows.length }
  })
  const tag = `R${round + 1}`
  ok(geo.n <= 8 && geo.ini <= 4 && geo.fin <= 4, `${tag} 块数上限 ≤4+4（干扰截断，禁整池上屏）`, `ini=${geo.ini} fin=${geo.fin} total=${geo.n}`)
  ok(geo.minW >= 56 && geo.minH >= 56, `${tag} 每块 ≥56px 见方`, `min=${Math.round(geo.minW)}×${Math.round(geo.minH)}`)
  ok(parseFloat(geo.fontHk) >= 30, `${tag} 字模 ≥30px`, geo.fontHk)
  ok(geo.minGap >= 10, `${tag} 间距 ≥10px`, `minGap=${geo.minGap}`)
  ok(!geo.overlap, `${tag} 无重叠`, geo.overlap ? 'OVERLAP!' : '')
  ok(geo.minCenter >= 8, `${tag} 可点区中心距 ≥8px`, `minCenter=${geo.minCenter}`)
  ok(geo.rows === 2, `${tag} 两行网格（声母/韵母各一档）`, `rows=${geo.rows}`)

  /* 玩过本轮进下一轮：点对（目标声母+目标韵母）触发合并动画链 */
  await page.evaluate(() => {
    const ini = document.querySelector('[data-prompt]').getAttribute('data-ini')
    const fin = document.querySelector('[data-prompt]').getAttribute('data-fin')
    for (const k of [ini, fin]) {
      const b = [...document.querySelectorAll('#gstage [data-half]')].find((e) => e.getAttribute('data-key') === k)
      b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }
  })
  await page.waitForFunction(() => (document.querySelector('#v-egg')?.getAttribute('data-stage') || '') === 'chick', null, { timeout: 6000 }).catch(() => {})
  await page.waitForSelector('#gstage [data-half]', { timeout: 9000 })
  await new Promise((r) => setTimeout(r, 450))
}

ok(errs.length === 0, '零 pageerror', errs.join(';'))
await page.close()
await browser.close()
console.log(`\nBug#40 回归样例：${pass} 过 / ${fail} 败`)
process.exit(fail ? 1 : 0)
