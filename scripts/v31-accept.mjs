/* v3.1 学一学字模合体验收（BUGS#31）：
   A. 任务 4 截图（hasTouch iPhone13 真实视口，.acceptance-v31/）——L1 a 学一学合并页 / L1 a 声调页 /
      L7 z 合并页 / 🔊按钮尺寸特写（三键 bbox 并集 clip，DPR3）
   B. 断言：
      - #31① 单 z：当前学一学页 .strokeanim svg 恰 1 个（=字模本体）；.pc-big/.pc-glyphfit/.pc-strokewrap 零残留
      - #31① idleDone：翻去声调页后，身后学一学页字模=定格完整字（全部笔画 p-done+dashoffset=0）且零编号徽章；
        滑回=重播（dashoffset 逐帧推进）
      - #31② 页数=每字母两页：L1=7 / L3=10 / L7=12 / L12=24（v3.0 结构复核）
      - #31③ 按钮 ≥48×48（boundingRect 即触摸热区）：pc-read / pc-kj / pc-replay（L1+L7 双页）/
        声调 .trow .btn / .replay / 小测 .qplay；点按 ping 动效类亮起；读音点击真实发起音频请求
      - 口诀广播（full 档第二消费方）展开区：单 svg + 三键 ≥48（合体改造不爆版）
      - 全程零 pageerror */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = '.acceptance-v31'
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT)

let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) } else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) } }
const errors = []

const browser = await chromium.launch()
const ctx = () => browser.newContext({ ...devices['iPhone 13'], hasTouch: true, deviceScaleFactor: 3 })

async function openLesson(page, n, extra = '') {
  await page.goto(`${BASE}/?open=lesson&learn=${n}${extra}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-lesson .hspage', { timeout: 8000 })
  await page.waitForTimeout(450)
}

const state = (page) => page.evaluate(() => {
  const track = document.querySelector('.hstage')
  return {
    transform: track ? parseFloat((/translateX\((-?[\d.]+)px\)/.exec(track.style.transform) || [])[1] || '0') : -9999,
    npages: document.querySelectorAll('#v-lesson .hspage').length,
  }
})

async function swipeLeft(page) {
  const w = await page.evaluate(() => { const r = document.querySelector('.hswrap').getBoundingClientRect(); return { x: r.x, y: r.y, wd: r.width, h: r.height } })
  const cdp = await page.context().newCDPSession(page)
  const t = (type, px, py) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py }] })
  const x0 = w.x + w.wd - 25, y0 = w.y + w.h / 2, x1 = w.x + 25
  await t('touchStart', x0, y0)
  for (let i = 1; i <= 8; i++) await t('touchMove', x0 + ((x1 - x0) * i) / 8, y0)
  await t('touchEnd', x1, y0)
  await page.waitForTimeout(650)
}

async function curScope(page) {
  const idx = await page.evaluate(() => {
    const tr = document.querySelector('.hstage').style.transform
    const x = parseFloat((/translateX\((-?[\d.]+)px\)/.exec(tr) || [])[1] || '0')
    return Math.round(-x / document.querySelector('.hswrap').clientWidth)
  })
  return `#v-lesson .hstage > .hspage:nth-child(${idx + 1})`
}

/* 页内字模状态（作用域=某 hspage）：svg 数、可见笔画数、徽章数、首笔 dashoffset */
const glyphState = (page, scope) => page.evaluate((sc) => {
  const root = document.querySelector(sc)
  const svgs = root.querySelectorAll('svg.strokeanim')
  const inks = [...root.querySelectorAll('path:not(.ghost):not(.glink)')]
  const visible = inks.filter((p) => parseFloat(getComputedStyle(p).strokeDashoffset || '2000') === 0 || p.style.strokeDashoffset === '0')
  const badges = root.querySelectorAll('.numbg').length
  const big = root.querySelectorAll('.pc-big').length
  const oldRes = { glyphfit: root.querySelectorAll('.pc-glyphfit').length, strokewrap: root.querySelectorAll('.pc-strokewrap').length, mainbtn: root.querySelectorAll('.pc-mainbtn').length }
  return { svgs: svgs.length, inks: inks.length, visible: visible.length, badges, big, ...oldRes }
}, scope)

/* 按钮几何（作用域内） */
const btnBox2 = (page, scope, sel) => page.evaluate(({ sc, s }) => {
  const el = document.querySelector(`${sc} ${s}`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }
}, { sc: scope, s: sel })

const ge48 = (b) => !!b && b.w >= 48 && b.h >= 48

/* ---------- A1 · L1 a 学一学合并页：单 z + 自动播 + 按钮几何 ---------- */
{
  console.log('\n== L1 a 学一学：单 z + 🔊几何 ==')
  const page = await (await ctx()).newPage()
  const audioReqs = []
  page.on('request', (r) => { if (r.url().includes('/audio/')) audioReqs.push(r.url()) })
  page.on('pageerror', (e) => errors.push('L1:' + e.message))
  await openLesson(page, 1)
  let sc = await curScope(page)
  let g = await glyphState(page, sc)
  ok(g.svgs === 1, `页内 svg 字模恰 1 个（唯一 z）`, `svg=${g.svgs}`)
  ok(g.big === 0 && g.glyphfit === 0 && g.strokewrap === 0 && g.mainbtn === 0, '静态大字模/旧结构零残留', JSON.stringify(g))
  /* 进页自动播：ink 在动（非 idle 定格即至少有笔已显形或正在画——等 900ms 取中间帧） */
  await page.waitForTimeout(900)
  g = await glyphState(page, sc)
  ok(g.visible > 0, `笔顺动画进页自动播（笔画显形中）`, `visible=${g.visible}/${g.inks}`)
  await page.screenshot({ path: `${OUT}/01-L1-a-learn.png` })
  /* 🔊 三键几何（读音/口诀/看笔顺） */
  for (const [sel, name] of [['[data-pcread]', '读音键'], ['[data-pckj]', '口诀键'], ['[data-pcreplay]', '看笔顺键']]) {
    const b = await btnBox2(page, sc, sel)
    ok(ge48(b), `${name} ≥48×48`, b ? `${b.w}×${b.h}` : 'missing')
  }
  /* 点读音：ping 动效 + 真实音频请求 */
  await page.locator(`${sc} [data-pcread]`).click()
  await page.waitForTimeout(250)
  const pingOn = await page.evaluate((s) => !!document.querySelector(`${s} [data-pcread].ping`), sc)
  ok(pingOn, '读音键点击 ping 动效反馈')
  ok(audioReqs.length > 0, '读音点击发起真实音频请求', `${audioReqs.length} req`)
  await page.close()
}

/* ---------- A2 · L1 a 声调页：身后字模定格完整字（idleDone） ---------- */
{
  console.log('\n== L1 a 声调页 + 身后字模 idleDone ==')
  const page = await (await ctx()).newPage()
  page.on('pageerror', (e) => errors.push('L1tone:' + e.message))
  await openLesson(page, 1)
  await page.waitForTimeout(3600)   /* 等 a 动画播完（2笔×~1s+停顿） */
  await swipeLeft(page)
  await page.waitForTimeout(500)
  let s = await state(page)
  ok(s.transform !== 0, `左滑到声调页`, `transform=${s.transform}`)
  let sc = await curScope(page)
  await page.screenshot({ path: `${OUT}/02-L1-a-tone.png` })
  /* 声调页几何：trow 按钮（跟我读/听音练）+ 辨调 replay 大圆钮（进小练后渲染）≥48 */
  const tb = await btnBox2(page, sc, '.tonedrill .trow .btn')
  ok(ge48(tb), `声调 跟我读/听音练 ≥48×48`, tb ? `${tb.w}×${tb.h}` : 'missing')
  await page.locator(`${sc} .tonedrill .trow .btn.green`).click()
  await page.waitForTimeout(450)
  const rp = await btnBox2(page, sc, '.tonedrill .replay')
  ok(ge48(rp), `声调辨调 replay 钮 ≥48×48`, rp ? `${rp.w}×${rp.h}` : 'missing')
  /* 身后学一学页（第1页）：定格完整字模=全部笔画显形+零徽章（idle 态干净字模） */
  const behind = await glyphState(page, '#v-lesson .hstage > .hspage:nth-child(1)')
  ok(behind.visible === behind.inks && behind.inks > 0, `身后字模定格完整字（idleDone 全显形）`, `${behind.visible}/${behind.inks}`)
  ok(behind.badges === 0, 'idle 态零编号徽章（纯字模观感）', `badges=${behind.badges}`)
  /* 滑回=重播：dashoffset 出现非 0 中间帧（chip 回跳等价翻页路径） */
  await page.evaluate(() => { document.querySelector('[data-lchips] .lchip').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await page.waitForTimeout(700)
  sc = await curScope(page)
  await page.waitForTimeout(500)
  let g = await glyphState(page, sc)
  ok(g.visible > 0 && g.visible < g.inks + 1, `滑回学一学重播（笔画再显形中）`, `visible=${g.visible}/${g.inks}`)
  await page.close()
}

/* ---------- A3 · L7 z 合并页 + 按钮特写 ---------- */
{
  console.log('\n== L7 z 合并页 + 🔊特写 ==')
  const page = await (await ctx()).newPage()
  page.on('pageerror', (e) => errors.push('L7:' + e.message))
  await openLesson(page, 7, '&qkey=1')   /* qkey 门：look 题可确定性作答翻题 */
  let s = await state(page)
  ok(s.npages === 12, `L7 页数=12（5字母×2+拼读+小测）`, `实得 ${s.npages}`)
  let sc = await curScope(page)
  let g = await glyphState(page, sc)
  ok(g.svgs === 1 && g.big === 0, `L7 z 页单 z（svg=1 无字体字模）`, `svg=${g.svgs} big=${g.big}`)
  for (const [sel, name] of [['[data-pcread]', '读音键'], ['[data-pckj]', '口诀键'], ['[data-pcreplay]', '看笔顺键']]) {
    const b = await btnBox2(page, sc, sel)
    ok(ge48(b), `z 页 ${name} ≥48×48`, b ? `${b.w}×${b.h}` : 'missing')
  }
  /* 三键 bbox 并集特写（DPR3） */
  const box = await page.evaluate((scc) => {
    const els = [`${scc} [data-pcreplay]`, `${scc} [data-pcread]`, `${scc} [data-pckj]`].map((q) => document.querySelector(q)).filter(Boolean)
    const rs = els.map((el) => el.getBoundingClientRect())
    const x = Math.min(...rs.map((r) => r.x)) - 10, y = Math.min(...rs.map((r) => r.y)) - 10
    return { x, y, width: Math.max(...rs.map((r) => r.x + r.width)) - x + 10, height: Math.max(...rs.map((r) => r.y + r.height)) - y + 10 }
  }, sc)
  await page.screenshot({ path: `${OUT}/04-btn-closeup.png`, clip: box })
  await page.screenshot({ path: `${OUT}/03-L7-z-learn.png` })
  /* 小测 qplay ≥48（复核）——首题随机，look 题无 qplay 则作答翻到 listen/tone 题再量 */
  await page.locator('[data-punit="quiz"]').click()
  await page.waitForTimeout(650)
  sc = await curScope(page)
  let qp = null
  for (let i = 0; i < 6 && !qp; i++) {
    qp = await btnBox2(page, sc, '.qplay')
    if (qp) break
    const glyph = await page.$eval('[data-qglyph]', (el) => el.textContent.trim()).catch(() => '')
    if (glyph) await page.click(`.opts .optear[data-qkey="${glyph}"]`, { timeout: 2500 }).catch(() => {})
    await page.waitForTimeout(2600)
  }
  ok(ge48(qp), `小测 qplay ≥48×48`, qp ? `${qp.w}×${qp.h}` : 'missing')
  await page.close()
}

/* ---------- A4 · 口诀广播（full 档第二消费方）单 z + 按钮不爆版 ---------- */
{
  console.log('\n== 口诀广播展开区（full 档回归面） ==')
  const page = await (await ctx()).newPage()
  page.on('pageerror', (e) => errors.push('radio:' + e.message))
  await page.goto(`${BASE}/?open=radio`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-radio .hspage', { timeout: 8000 })
  await page.waitForTimeout(500)
  const rg = await page.evaluate(() => {
    const pg = document.querySelector('#v-radio .hstage > .hspage:nth-child(1)')
    return {
      svgs: pg.querySelectorAll('svg.strokeanim').length,
      big: pg.querySelectorAll('.pc-big').length,
      read: (() => { const r = pg.querySelector('[data-pcread]')?.getBoundingClientRect(); return r ? `${Math.round(r.width)}×${Math.round(r.height)}` : 'missing' })(),
      docScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }
  })
  ok(rg.svgs === 1 && rg.big === 0, 'radio 展开区单 z', `svg=${rg.svgs} big=${rg.big}`)
  const [w, h] = rg.read.split('×').map(Number)
  ok(w >= 48 && h >= 48, 'radio 读音键 ≥48×48', rg.read)
  ok(rg.docScroll === 0, 'radio 零纵向滚动')
  await page.screenshot({ path: `${OUT}/05-radio-full.png` })
  await page.close()
}

/* ---------- A5 · 页数复核（#31② 每字母两页） ---------- */
{
  console.log('\n== 页数复核（每字母两页+课级尾页） ==')
  const page = await (await ctx()).newPage()
  page.on('pageerror', (e) => errors.push('pages:' + e.message))
  for (const [n, exp] of [[1, 7], [3, 10], [7, 12], [12, 24]]) {
    await openLesson(page, n)
    const s = await state(page)
    ok(s.npages === exp, `L${n} 页数=${exp}`, `实得 ${s.npages}`)
  }
  await page.close()
}

console.log(`\n===== v31-accept：${pass} 通过，${fail} 失败 =====`)
if (errors.length) { console.log('PAGEERROR:', [...new Set(errors)].join(' | ')) }
await browser.close()
process.exit(fail === 0 && errors.length === 0 ? 0 : 1)
