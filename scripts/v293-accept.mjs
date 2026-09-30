/* v2.9.3 架构根治验收（BUGS#24 纵向滚动第三次复发）：
   零滚动断言不再只查初始状态——12 课逐课真实切换（学习tab→进课→返回→下一课）×
   每课全部步骤（4/5 动态）× 每课字母切换 × 三 tab 屏 × 三档视口高度（844/719/664），
   每个状态断言 #lesson-root/#tab-view-root/#v-lesson/document 四层 scrollHeight≤clientHeight。
   全量截图落盘供目验（overflow:hidden 可能裁内容——断言过了还要眼看）。
   跑法：npm run build && npm run preview（4173）→ node scripts/v293-accept.mjs */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = '.acceptance/v293'
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
let fails = 0
const failsAt = []
const ok = (cond, name, detail = '') => {
  console.log(`${cond ? '✓' : '✗ FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!cond) { fails++; failsAt.push(name) }
}

/* 四层零滚动断言：容器硬锁壳 / view / 文档 / 全元素超框审计 */
const zeroScroll = (page, rootSel) => page.evaluate((sel) => {
  const r = { root: null, view: null, doc: null, spillers: [] }
  const root = document.querySelector(sel)
  if (!root) return { missing: sel }
  r.root = { sh: root.scrollHeight, ch: root.clientHeight }
  const view = root.querySelector('.view') || (root.classList.contains('view') ? root : null)
  if (view) r.view = { sh: view.scrollHeight, ch: view.clientHeight }
  const se = document.scrollingElement
  r.doc = { sh: se.scrollHeight, ih: innerHeight }
  for (const el of document.querySelectorAll('#shell *')) {
    const cs = getComputedStyle(el)
    if (!/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) continue   /* visible=画内溢出非滚动源（目验兜底）；hidden=裁切由目验兜底 */
    if (el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0)
      r.spillers.push(`${el.tagName}#${el.id}.${String(el.className).split(' ')[0]} oy=${cs.overflowY} sh=${el.scrollHeight} ch=${el.clientHeight}`)
  }
  return r
}, rootSel).then((r) => {
  if (r.missing) return false
  const a = r.root.sh <= r.root.ch
  const b = !r.view || r.view.sh <= r.view.ch
  const c = r.doc.sh <= r.doc.ih
  const d = r.spillers.length === 0
  if (!(a && b && c && d))
    console.log(`   [${rootSel}] root ${r.root.sh}/${r.root.ch} view ${r.view ? r.view.sh + '/' + r.view.ch : '-'} doc ${r.doc.sh}/${r.doc.ih} spill=[${r.spillers.slice(0, 4).join(' | ')}]`)
  return a && b && c && d
})

const browser = await chromium.launch()

async function sweep(H, { shots }) {
  console.log(`\n########## 视口 390×${H} ##########`)
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: H }, hasTouch: true })
  const page = await ctx.newPage()
  /* 种进度：12 课全解锁（pinyin_learn.u=12），模拟 kuaner 手机上已推进的真实状态 */
  await page.addInitScript(() => { try { localStorage.setItem('pinyin_learn', JSON.stringify({ u: 12, stars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 }, best: {}, step: {} })) } catch {} })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForSelector('#tab-view-root', { timeout: 9000 })
  await page.waitForTimeout(500)

  /* ---------- ② 三 tab 屏 ---------- */
  for (const [view, sel] of [['learn', '[data-screen="learn"]'], ['practice', '[data-screen="practice"]'], ['mine', '[data-screen="mine"]']]) {
    await page.tap(`#tabbar [data-tab="${view}"], [data-tab="${view}"]`).catch(async () => {})
    await page.waitForTimeout(450)
    const pass = await zeroScroll(page, '#tab-view-root')
    if (shots) await page.screenshot({ path: `${OUT}/H${H}-tab-${view}.png` })
    ok(pass, `H${H} tab「${view}」零滚动`)
  }

  /* ---------- ① 12 课逐课真实切换 + ③ 每课步骤全扫 + 字母切换 ---------- */
  for (let n = 1; n <= 12; n++) {
    await page.waitForSelector('#tab-view-root', { timeout: 9000 })
    await page.tap('#tabbar [data-tab="learn"]')      /* 回学习 tab（真实切换流） */
    await page.waitForSelector('#caps', { timeout: 9000 })
    await page.waitForTimeout(300)
    await page.tap(`[data-lesson="${n}"]`)
    await page.waitForSelector('#lesson-root', { timeout: 9000 })
    await page.waitForTimeout(550)
    const steps = await page.$$eval('#rail .rstep', (els) => els.map((e) => e.dataset.step))
    let lpass = await zeroScroll(page, '#lesson-root')
    if (shots) await page.screenshot({ path: `${OUT}/H${H}-L${n}-s1.png` })
    ok(lpass, `H${H} 第${n}课 进课零滚动（${steps.length} 步）`)
    for (const s of steps) {
      if (String(s) !== '1') {
        await page.tap(`#rail .rstep[data-step="${s}"]`)
        await page.waitForTimeout(420)
        lpass = await zeroScroll(page, '#lesson-root')
        if (shots) await page.screenshot({ path: `${OUT}/H${H}-L${n}-s${s}.png` })
        ok(lpass, `H${H} 第${n}课 步骤${s} 零滚动`)
      }
    }
    /* 字母切换（拼读/小测步 chip 隐藏——先跳回步骤 1 让 chip 现身再切，禁止静默跳过） */
    await page.tap('#rail .rstep[data-step="1"]')
    await page.waitForTimeout(350)
    const lers = await page.$$eval('.lchips .lchip', (els) => els.map((e) => e.dataset.ler)).catch(() => null)
    if (!lers) { ok(false, `H${H} 第${n}课 chip 条未现身（字母切换断言无法执行）`) }
    else if (lers.length > 1) {
      await page.tap(`.lchips .lchip[data-ler="${lers[lers.length - 1]}"]`)
      await page.waitForTimeout(380)
      lpass = await zeroScroll(page, '#lesson-root')
      ok(lpass, `H${H} 第${n}课 切字母→${lers[lers.length - 1]} 零滚动`)
    } else ok(true, `H${H} 第${n}课 单字母课无切换可测`)
    /* 返回学习 tab（真实切换流：下一课从 tab 进） */
    await page.tap('[data-back="learn"]')
    await page.waitForTimeout(350)
  }
  await ctx.close()
}

await sweep(844, { shots: true })     /* 主档：全量截图（目验用） */
await sweep(719, { shots: false })    /* 压力档：Safari 半屏 */
await sweep(664, { shots: false })    /* 压力档：Safari 全地址栏 */
await browser.close()

console.log(`\n断言结果：${fails === 0 ? '★★★ 全状态四层零滚动' : '✗ ' + fails + ' 处失败：' + failsAt.slice(0, 12).join('、')}`)
process.exit(fails ? 1 : 0)
