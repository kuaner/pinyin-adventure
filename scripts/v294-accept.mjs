/* v2.9.4 零换行根治验收（BUGS#25+#27）：
   立法断言=短标签元素 computed white-space===nowrap（构造级保证不换行）；
   截断断言=nowrap 元素 scrollWidth≤clientWidth（一行放得下，零横裁）；
   滚动断言=v2.9.3 同款四层零滚动（真实切换流：学习tab→进课→返回→换课 ×12 课×全步骤×3 tab×3 视口）；
   全量截图落盘 Read 逐张目验（Tab 文字一行完整/零截断/零重叠/零纵向滚动）。
   跑法：npm run build && npm run preview（4173）→ node scripts/v294-accept.mjs */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = '.acceptance/v294'
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
let fails = 0
const failsAt = []
const ok = (cond, name, detail = '') => {
  console.log(`${cond ? '✓' : '✗ FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!cond) { fails++; failsAt.push(name) }
}

/* 四层零滚动断言（v2.9.3 同款） */
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
    if (!/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) continue
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

/* 零换行立法断言：computed nowrap + 零横裁（scrollWidth≤clientWidth）
   sels: [[选择器, 屏内说明]]——逐一检查当前 DOM 上全部命中元素 */
const nowrapAudit = (page, sels, tag) => page.evaluate((list) => {
  const bad = []
  for (const [sel] of list) {
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el)
      const t = (el.textContent || '').trim().slice(0, 14)
      if (cs.whiteSpace !== 'nowrap') bad.push(`${sel}「${t}」ws=${cs.whiteSpace}`)
      else if (el.scrollWidth > el.clientWidth + 1) bad.push(`${sel}「${t}」clip sw=${el.scrollWidth} cw=${el.clientWidth}`)
    }
  }
  return bad
}, sels).then((bad) => {
  ok(bad.length === 0, `${tag} nowrap+零截断`, bad.slice(0, 6).join(' | '))
})

/* 学习 tab 屏 nowrap 对象（课程地图 cap/hero chip/CTA/广播条/底部 tab） */
const LEARN_NOWRAP = [
  ['#caps .cap b', ''], ['#caps .cap i', ''], ['#hero .lchip', ''], ['#cta', ''],
  ['.sec-label b', ''], ['.sec-label span', ''], ['#radio .rtx b', ''], ['#radio .rtx span', ''],
  ['#tabbar .tab .tl', ''], ['#starchip', ''],
]
/* 课页 nowrap 对象（步骤条/顶栏/进度/chip/按钮/提示/页内步骤标签） */
const LESSON_NOWRAP = [
  ['#v-lesson .ltt', ''], ['#v-lesson .lprog', ''], ['#rail .rstep .rname', ''], ['#v-lesson .ptag', ''],
  ['.lchips .lchip', ''], ['.rebtn', ''], ['.bootbtn', ''], ['#swipehint', ''], ['.quizboot', ''],
]

const browser = await chromium.launch()

async function sweep(H, { shots }) {
  console.log(`\n########## 视口 390×${H} ##########`)
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: H }, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(() => { try { localStorage.setItem('pinyin_learn', JSON.stringify({ u: 12, stars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 }, best: {}, step: {} })) } catch {} })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForSelector('#tab-view-root', { timeout: 9000 })
  await page.waitForTimeout(500)

  /* ---------- 三 tab 屏 ---------- */
  for (const [view, sel] of [['learn', '[data-screen="learn"]'], ['practice', '[data-screen="practice"]'], ['mine', '[data-screen="mine"]']]) {
    await page.tap(`#tabbar [data-tab="${view}"], [data-tab="${view}"]`).catch(async () => {})
    await page.waitForTimeout(450)
    const pass = await zeroScroll(page, '#tab-view-root')
    if (shots) await page.screenshot({ path: `${OUT}/H${H}-tab-${view}.png` })
    ok(pass, `H${H} tab「${view}」零滚动`)
    if (view === 'learn') await nowrapAudit(page, LEARN_NOWRAP, `H${H} 学习tab`)
  }

  /* ---------- 12 课逐课真实切换 ---------- */
  for (let n = 1; n <= 12; n++) {
    await page.waitForSelector('#tab-view-root', { timeout: 9000 })
    await page.tap('#tabbar [data-tab="learn"]')
    await page.waitForSelector('#caps', { timeout: 9000 })
    await page.waitForTimeout(300)
    await page.tap(`[data-lesson="${n}"]`)
    await page.waitForSelector('#lesson-root', { timeout: 9000 })
    await page.waitForTimeout(550)
    const steps = await page.$$eval('#rail .rstep', (els) => els.map((e) => e.dataset.step))
    let lpass = await zeroScroll(page, '#lesson-root')
    if (shots) await page.screenshot({ path: `${OUT}/H${H}-L${n}-s1.png` })
    ok(lpass, `H${H} 第${n}课 进课零滚动（${steps.length} 步）`)
    /* 步骤标签一行完整（rail 上 4/5 个 .rname 全 nowrap 零截断） */
    await nowrapAudit(page, LESSON_NOWRAP, `H${H} 第${n}课 步骤1`)
    for (const s of steps) {
      if (String(s) !== '1') {
        await page.tap(`#rail .rstep[data-step="${s}"]`)
        await page.waitForTimeout(420)
        lpass = await zeroScroll(page, '#lesson-root')
        if (shots) await page.screenshot({ path: `${OUT}/H${H}-L${n}-s${s}.png` })
        ok(lpass, `H${H} 第${n}课 步骤${s} 零滚动`)
      }
    }
    /* 小测态再断言一轮（bootbtn/quizboot 在此步） */
    await nowrapAudit(page, LESSON_NOWRAP, `H${H} 第${n}课 末步`)
    /* 字母切换 */
    await page.tap('#rail .rstep[data-step="1"]')
    await page.waitForTimeout(350)
    const lers = await page.$$eval('.lchips .lchip', (els) => els.map((e) => e.dataset.ler)).catch(() => null)
    if (!lers) { ok(false, `H${H} 第${n}课 chip 条未现身`) }
    else if (lers.length > 1) {
      await page.tap(`.lchips .lchip[data-ler="${lers[lers.length - 1]}"]`)
      await page.waitForTimeout(380)
      lpass = await zeroScroll(page, '#lesson-root')
      ok(lpass, `H${H} 第${n}课 切字母→${lers[lers.length - 1]} 零滚动`)
    } else ok(true, `H${H} 第${n}课 单字母课无切换可测`)
    await page.tap('[data-back="learn"]')
    await page.waitForTimeout(350)
  }
  ok(errors.length === 0, `H${H} 全程零 pageerror`, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

await sweep(844, { shots: true })
await sweep(719, { shots: false })
await sweep(664, { shots: false })
await browser.close()

console.log(`\n断言结果：${fails === 0 ? '★★★ 零换行立法+零截断+四层零滚动 全绿' : '✗ ' + fails + ' 处失败：' + failsAt.slice(0, 12).join('、')}`)
process.exit(fails ? 1 : 0)
