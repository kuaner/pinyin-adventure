/* v2.6.1 热修验收：Bug#12 学习岛切字母（每字母独立 step 记忆）+ Bug#13 iPhone 安全区
   跑法：npm run build && npm run preview（4173）→ BASE_URL=http://localhost:4173/ node scripts/v261-accept.mjs
   输入全部走 mouse.click 真实序列（BUGS 6b 教训：JS el.click() 测不出事件死锁） */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) }
catch { ({ chromium } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = '.acceptance/v261'
fs.mkdirSync(OUT, { recursive: true })
let fails = 0
const ok = (cond, name, detail = '') => {
  console.log(`${cond ? '✓' : '✗ FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!cond) fails++
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
/* 页级 JS 错误门槛（Bug#14 白屏回归的教训：构建不报 ReferenceError，验收必须断言零 pageerror） */
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })
const lprog = () => page.$eval('#lprog', (el) => el.textContent.trim())
const chipOn = (k) => page.$eval(`[data-ler="${k}"]`, (el) => el.classList.contains('on')).catch(() => false)
const trackX = () => page.$eval('.hstage', (el) => new DOMMatrix(getComputedStyle(el).transform).m41)

/* ---------- Bug#12：切 b→m→b（mission 验收：b@3 → m@1 → b@3） ---------- */
/* L3=b p m f；深链 b@step3（u:3 解锁第三课，step 存 4 用于另一断言，深链应覆盖） */
await page.goto(`${BASE}?learn=3&step=3&li=0`, { waitUntil: 'load' })
await page.waitForSelector('#v-lesson', { timeout: 8000 })
await page.waitForTimeout(600)
ok((await lprog()) === '3/5', '#12 深链 b@step3', `lprog=${await lprog()}`)
ok(await chipOn('b'), '#12 chip b 选中态')
ok(Math.abs(await trackX() + 2 * 358) < 2, '#12 HSteps 页3 同步', `translateX=${await trackX()}`)

/* chip 常驻：任何步骤可见（stage 上方独立条） */
const chips = await page.$eval('[data-lchips]', (el) => { const r = el.getBoundingClientRect(); return { y: r.y, h: r.height, n: el.querySelectorAll('.lchip').length } })
const stage = await page.$eval('#stagewrap', (el) => el.getBoundingClientRect().y)
ok(chips.n === 4 && chips.y > 0 && chips.y + chips.h <= stage, '#12 chip 条常驻 stage 上方', `y=${chips.y.toFixed(0)} h=${chips.h} n=${chips.n}`)

/* 切 m → 应落 m 的记忆步（首次=认识页 1） */
await page.click('[data-ler="m"]')
await page.waitForTimeout(450)
ok((await lprog()) === '1/5', '#12 切 m → 步骤1', `lprog=${await lprog()}`)
ok(await chipOn('m') && !(await chipOn('b')), '#12 chip m 选中态切换')
await shot('12a-m-at-step1')

/* 切回 b → 应回到 b 的记忆步 3 */
await page.click('[data-ler="b"]')
await page.waitForTimeout(450)
ok((await lprog()) === '3/5', '#12 切回 b → 记忆步3', `lprog=${await lprog()}`)
await shot('12b-back-to-b-step3')

/* 走到 5 再切 m 再回 b：b 应在 5（记忆步推进） */
await page.click('[data-step="5"]')
await page.waitForTimeout(450)
ok((await lprog()) === '5/5', '#12 rail 跳步 5（HSteps 同步）', `lprog=${await lprog()}`)
await page.click('[data-ler="m"]')
await page.waitForTimeout(400)
await page.click('[data-ler="b"]')
await page.waitForTimeout(450)
ok((await lprog()) === '5/5', '#12 b 记忆步推进到 5', `lprog=${await lprog()}`)

/* 零纵向滚动守门（chip 条新增后 lesson 屏不溢出） */
const ovf = await page.$eval('#v-lesson', (el) => el.scrollHeight - el.clientHeight)
ok(ovf <= 0, '#12 lesson 零纵向滚动', `overflow=${ovf}`)

/* ---------- 进门兑现断点 + hero 字母带入（CTA 承诺的步/字母） ---------- */
await page.goto(`${BASE}`, { waitUntil: 'load' })
await page.evaluate(() => { localStorage.setItem('pinyin_learn', JSON.stringify({ u: 3, stars: { 1: 3, 2: 3 }, best: {}, step: { 3: 4 } })) })
await page.goto(`${BASE}`, { waitUntil: 'load' })
await page.waitForSelector('#v-learntab', { timeout: 8000 })
await page.waitForTimeout(400)
/* hero 选第二个字母 p → CTA 应带入课内 */
await page.click('#hero [data-ler="p"]')
await page.waitForTimeout(200)
await page.click('[data-cta]')
await page.waitForSelector('#v-lesson', { timeout: 8000 })
await page.waitForTimeout(500)
ok((await lprog()) === '4/5', '#12 进门兑现断点（CTA 声调=步4）', `lprog=${await lprog()}`)
ok(await chipOn('p'), '#12 hero 字母 p 带入课内')

/* ---------- Bug#13：safe-area（desktop env=0 基线 vs 注入 34/47px 模拟 iPhone standalone） ---------- */
await page.goto(`${BASE}`, { waitUntil: 'load' })
await page.waitForSelector('#v-learntab', { timeout: 8000 })
await page.waitForTimeout(400)

const geo = () => page.evaluate(() => {
  const bar = document.querySelector('#tabbar').getBoundingClientRect()
  const tic = document.querySelector('.tab .tic').getBoundingClientRect()
  const shell = document.querySelector('#shell').getBoundingClientRect()
  return { barH: bar.height, barTop: bar.top, ticTop: tic.top - bar.top, shellBottomGap: window.innerHeight - shell.bottom }
})
const base = await geo()
ok(Math.abs(base.barH - 84) < 1, '#13 基线（env=0）tabbar=84', `h=${base.barH}`)

/* 模拟 iPhone：--sab:34px --sat:47px（viewport-fit=cover 下 standalone 的真实值量级） */
await page.addStyleTag({ content: ':root{--sab:34px !important; --sat:47px !important;}' })
await page.waitForTimeout(300)
const sim = await geo()
ok(Math.abs(sim.barH - 118) < 1, '#13 模拟后 tabbar=84+34=118（向下加厚）', `h=${sim.barH}`)
ok(Math.abs(sim.ticTop - base.ticTop) < 1, '#13 图标距条顶位置不变（不再被挤压）', `ticTop base=${base.ticTop.toFixed(1)} sim=${sim.ticTop.toFixed(1)}`)
ok(Math.abs(sim.shellBottomGap - 118) < 1, '#13 shell 底让位加高后的条', `gap=${sim.shellBottomGap}`)
await shot('13a-learntab-safearea-sim')

/* 专注态：lesson 屏底 padding 含 sab（内容让开 home indicator） */
await page.goto(`${BASE}?learn=1&step=1`, { waitUntil: 'load' })
await page.waitForSelector('#v-lesson', { timeout: 8000 })
await page.addStyleTag({ content: ':root{--sab:34px !important; --sat:47px !important;}' })
await page.waitForTimeout(300)
const padB = await page.$eval('#v-lesson', (el) => getComputedStyle(el).paddingBottom)
ok(padB === '46px', '#13 专注态 view 底 padding=sab+12', padB)
await shot('13b-lesson-safearea-sim')

/* 390×844 原生（无注入）对照帧 */
await page.goto(`${BASE}`, { waitUntil: 'load' })
await page.waitForSelector('#v-learntab', { timeout: 8000 })
await page.waitForTimeout(400)
await shot('13c-learntab-baseline')

await browser.close()
ok(pageErrors.length === 0, '全程零 pageerror', pageErrors.slice(0, 3).join(' | '))
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
