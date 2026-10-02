/* v3.0 学习流程结构反转验收（BUGS#28+#29+#30）：
   A. 任务截图（hasTouch iPhone13 真实视口，.acceptance-v30/）——L1 a 合并页+声调页 / L7 z 合并页+
      选第4个y+选第5个w / 小测 boot+答题 / 小测结算 / L3 拼读页
   B. 流程断言：
      - #30：L7 点第4/5个 chip → 祖先 scrollLeft 恒 0、HSteps transform 落在正确页（v2.9 左移 48/96px 已根治）
      - #28：页面序列 = 每字母(学一学→声调)→拼读?→小测；L1=7 / L3=10 / L7=12 / L12=24 页（L12 无调字母单页）
      - 声调「读完了」→ chip ✓ + 自动推进下一字母（真实点击序列走完 ToneDrill）
      - chip 条横滑只滚 chip 条不翻页；触摸左滑翻页回归；零纵向滚动（12课×全chip×3视口）；全程零 pageerror
   C. 小测：boot→答题→结算渲染链（look 题确定性作答） */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = '.acceptance-v30'
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT)

let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) } else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) } }
const errors = []

const browser = await chromium.launch()
const ctx = () => browser.newContext({ ...devices['iPhone 13'], hasTouch: true })

async function openLesson(page, n, extra = '') {
  await page.goto(`${BASE}/?open=lesson&learn=${n}${extra}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-lesson .hspage', { timeout: 8000 })
  await page.waitForTimeout(450)
}

const state = (page) => page.evaluate(() => {
  const sec = document.querySelector('#v-lesson')
  const root = document.querySelector('#lesson-root')
  const track = document.querySelector('.hstage')
  const chips = document.querySelector('[data-lchips]')
  const chipOn = chips?.querySelector('.lchip.on')
  const chipDone = [...(chips?.querySelectorAll('.lchip.done') || [])].map((e) => e.getAttribute('data-ler'))
  return {
    secLeft: sec?.scrollLeft ?? -1, rootLeft: root?.scrollLeft ?? -1,
    transform: track ? parseFloat((/translateX\((-?[\d.]+)px\)/.exec(track.style.transform) || [])[1] || '0') : -9999,
    chipOn: chipOn?.getAttribute('data-ler') || chipOn?.getAttribute('data-punit') || '',
    chipDone,
    npages: document.querySelectorAll('#v-lesson .hspage').length,
    docScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }
})

/* 真实触摸左滑（CDP touch 序列，hasTouch 真机同路径） */
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

/* 当前页作用域（全页常驻挂载，组件选择器必须限定到可见页） */
async function curScope(page) {
  const idx = await page.evaluate(() => {
    const tr = document.querySelector('.hstage').style.transform
    const x = parseFloat((/translateX\((-?[\d.]+)px\)/.exec(tr) || [])[1] || '0')
    return Math.round(-x / document.querySelector('.hswrap').clientWidth)
  })
  return `#v-lesson .hstage > .hspage:nth-child(${idx + 1})`
}

/* ---------- A1+A2 · L1 字母 a 合并页 + 声调页 + 自动推进 ---------- */
{
  console.log('\n== L1 · a 合并页 + 声调页 + 声调完成自动推进 ==')
  const page = await (await ctx()).newPage()
  page.on('pageerror', (e) => errors.push('L1:' + e.message))
  await openLesson(page, 1)
  let s = await state(page)
  ok(s.npages === 7, `L1 页数=7（3字母×2+小测）`, `实得 ${s.npages}`)
  ok(s.transform === 0 && s.chipOn === 'a', `初始=字母a合并页`, `chip=${s.chipOn}`)
  await page.screenshot({ path: `${OUT}/01-L1-a-learn.png` })
  /* BUGS#33 互动证据制：✓=证据制（旗A 读音点播+旗B 声调点读）——本流程先集齐 a 的两旗再走声调小练 */
  let sc0 = await curScope(page)
  await page.locator(`${sc0} [data-pcread]`).click()
  await page.waitForTimeout(300)
  await swipeLeft(page)
  s = await state(page)
  ok(s.transform === -358 && s.chipOn === 'a', `触摸左滑→a声调页`, `transform=${s.transform} chip=${s.chipOn}`)
  await page.screenshot({ path: `${OUT}/02-L1-a-tone.png` })
  /* 声调小练真实走通 → 读完了 → 自动推进 o + chip a ✓（ruby 在文本里，用 class 定位；作用域=当前页）。
     点读 3 个声调行先集旗B（BUGS#33：≥3 个不同声调） */
  let sc = await curScope(page)
  for (let i = 0; i < 3; i++) {
    await page.locator(`${sc} .tonedrill .tonerow`).nth(i).click()
    await page.waitForTimeout(250)
  }
  await page.locator(`${sc} .tonedrill .trow .btn.green`).click()
  await page.waitForTimeout(400)
  /* v4.2c 两段式适配（验收腿，只改脚本）：声调小练首点=试听高亮不判分，再点同项才作答——4 题×双击 */
  for (let i = 0; i < 4; i++) {
    await page.locator(`${sc} .tonedrill .topt`).first().click()
    await page.waitForTimeout(350)
    await page.locator(`${sc} .tonedrill .topt`).first().click()
    await page.waitForTimeout(2000)
  }
  await page.locator(`${sc} .qresult .trow .btn.green`).click()
  await page.waitForTimeout(700)
  s = await state(page)
  ok(s.transform === -716 && s.chipOn === 'o', `读完了→自动推进o合并页`, `transform=${s.transform} chip=${s.chipOn}`)
  ok(s.chipDone.includes('a'), `chip a 标记✓`, `done=${JSON.stringify(s.chipDone)}`)
  await page.close()
}

/* ---------- A3-A5 · L7 z 合并页 + 选第4个y/第5个w 零异常 ---------- */
{
  console.log('\n== L7 · z 合并页 + chip 第4/5个零异常 ==')
  const page = await (await ctx()).newPage()
  page.on('pageerror', (e) => errors.push('L7:' + e.message))
  await openLesson(page, 7)
  let s = await state(page)
  ok(s.npages === 12, `L7 页数=12（5字母×2+拼读+小测）`, `实得 ${s.npages}`)
  ok(s.chipOn === 'z', `初始=字母z`, `chip=${s.chipOn}`)
  await page.screenshot({ path: `${OUT}/03-L7-z-learn.png` })
  await page.locator('[data-lchips] .lchip[data-ler="y"]').click()
  await page.waitForTimeout(650)
  s = await state(page)
  ok(s.secLeft === 0 && s.rootLeft === 0, `点第4个chip(y) 零祖先左移`, `sec=${s.secLeft} root=${s.rootLeft}（v2.9=48）`)
  ok(s.transform === Math.round(-358 * 6), `y 合并页 transform`, `=${s.transform}`)
  ok(s.chipOn === 'y', `chip y on=${s.chipOn}`)
  await page.screenshot({ path: `${OUT}/04-L7-chip-y.png` })
  await page.locator('[data-lchips] .lchip[data-ler="w"]').click()
  await page.waitForTimeout(650)
  s = await state(page)
  ok(s.secLeft === 0 && s.rootLeft === 0, `点第5个chip(w) 零祖先左移`, `sec=${s.secLeft} root=${s.rootLeft}（v2.9=96）`)
  ok(s.transform === Math.round(-358 * 8), `w 合并页 transform`, `=${s.transform}`)
  await page.screenshot({ path: `${OUT}/05-L7-chip-w.png` })
  /* chip 条横滑只滚 chip 条不翻页 */
  const cdp = await page.context().newCDPSession(page)
  const cb = await page.locator('[data-lchips]').boundingBox()
  const tx = (type, px, py) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py }] })
  await tx('touchStart', cb.x + cb.width - 20, cb.y + cb.height / 2)
  for (let i = 1; i <= 6; i++) await tx('touchMove', cb.x + cb.width - 20 - i * 12, cb.y + cb.height / 2)
  await tx('touchEnd', cb.x + cb.width - 92, cb.y + cb.height / 2)
  await page.waitForTimeout(550)
  s = await state(page)
  ok(s.transform === Math.round(-358 * 8), `chip条横滑不翻页`, `transform=${s.transform}`)
  await page.close()
}

/* ---------- A6+A7+A8 · 小测 boot/答题/结算 + L3 拼读页 ---------- */
{
  console.log('\n== L7 · 小测链 + L3 拼读页 ==')
  const c = await ctx()
  /* BUGS#33：chip 进小测自动建题的断言走「已过关课重学不拦」路径（预置 L7 记星）——
     未学过的拦截路径归 v401-accept 正/反例 */
  await c.addInitScript(() => localStorage.setItem('pinyin_learn', JSON.stringify({ u: 8, stars: { 7: 3 }, best: {}, step: {} })))
  const page = await c.newPage()
  page.on('pageerror', (e) => errors.push('quiz:' + e.message))
  await openLesson(page, 7, '&qkey=1')   /* qkey 门：look 题选项带 data-qkey，确定性作答 */
  await page.locator('[data-punit="quiz"]').click()
  await page.waitForTimeout(650)
  let s = await state(page)
  ok(s.transform === Math.round(-358 * 11), `小测页 transform`, `=${s.transform}`)
  /* v3.0：gotoPage 进小测页即自动建题（boot 键仅在异常兜底态出现）→ 直接是答题页 */
  await page.waitForSelector('#v-lesson .qbody', { timeout: 5000 })
  ok(!!await page.$('.qbody'), 'chip 进小测自动建题（qbody 渲染）')
  await page.screenshot({ path: `${OUT}/06-L7-quiz-q.png` })
  await page.locator('[data-bootquiz]').click({ timeout: 1200 }).catch(() => {})   /* 兜底键若在则点掉 */
  await page.waitForTimeout(300)
  /* 作答到结算：look 题（optear）答案=data-qglyph 字模（qkey 门确定性答对）；
     listen/tone 首选项兜底（随机对错——两种结算都渲染，链路即证据）。
     快超时（3s）防选择器空等拖爆总时长 */
  for (let i = 0; i < 7; i++) {
    if (await page.$('.res')) break
    let sel = null
    if (await page.$('.optear')) {
      const glyph = await page.$eval('[data-qglyph]', (el) => el.textContent.trim())
      sel = (await page.$(`.opts .optear[data-qkey="${glyph}"]`)) ? `.opts .optear[data-qkey="${glyph}"]` : '.opts .optear'
    } else if (await page.$('.opts .topt')) {
      sel = '.opts .topt'
    } else {
      await page.click('[data-qplay]', { timeout: 2000 }).catch(() => {})
      await page.waitForTimeout(250)
      sel = '.opts .opt:not(.topt):not(.optear)'
    }
    /* v4.2c 两段式适配（验收腿，只改脚本）：首点=试听高亮不判分，再点同项才作答 */
    await page.click(sel, { timeout: 3000 })
    await page.waitForTimeout(400)
    await page.click(sel, { timeout: 3000 })
    await page.waitForTimeout(3200)
  }
  await page.waitForTimeout(400)
  const resBtns = await page.$$eval('.res .resbtns button', (els) => els.map((e) => e.getAttribute('data-restudy') !== null ? 'restudy' : 'back'))
  ok(!!await page.$('.res') && resBtns.length === 2 && resBtns[0] !== resBtns[1], '小测结算渲染+双按钮', JSON.stringify(resBtns))
  await page.screenshot({ path: `${OUT}/08-L7-quiz-res.png` })
  await page.close()

  const page3 = await (await ctx()).newPage()
  page3.on('pageerror', (e) => errors.push('L3:' + e.message))
  await openLesson(page3, 3)
  const s0 = await state(page3)
  ok(s0.npages === 10, `L3 页数=10（4字母×2+拼读+小测）`, `实得 ${s0.npages}`)
  await page3.locator('[data-punit="blend"]').click()
  await page3.waitForTimeout(650)
  const s3 = await state(page3)
  ok(s3.chipOn === 'blend', `拼读 chip on=${s3.chipOn}`)
  await page3.screenshot({ path: `${OUT}/09-L3-blend.png` })
  /* L12 结构：16字母中 6 个有声调页 → 16+6+拼读+小测=24 */
  const page12 = await (await ctx()).newPage()
  page12.on('pageerror', (e) => errors.push('L12:' + e.message))
  await openLesson(page12, 12)
  const s12 = await state(page12)
  ok(s12.npages === 24, `L12 页数=24（16字母+6声调+拼读+小测，无调字母单页）`, `实得 ${s12.npages}`)
  await page12.close()
  await page3.close()
}

/* ---------- B0 · 真实导航流（v293 遗产）：学习tab→CTA进课→chip跳→返回→胶囊换课 ---------- */
{
  console.log('\n== 真实导航流：tab→进课→返回→换课 ==')
  const page = await (await ctx()).newPage()
  page.on('pageerror', (e) => errors.push('nav:' + e.message))
  await page.addInitScript(() => localStorage.setItem('pinyin_learn', JSON.stringify({ u: 7, stars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 }, best: {} })))
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.locator('[data-cta]').click()
  await page.waitForTimeout(600)
  let s = await state(page)
  ok(!!await page.$('#v-lesson'), 'CTA 进课')
  ok(s.chipOn.length > 0, `进课落在断点字母 chip=${s.chipOn}`)
  await page.locator('[data-lchips] .lchip[data-ler]').nth(1).click()
  await page.waitForTimeout(500)
  s = await state(page)
  ok(s.secLeft === 0 && s.docScroll === 0, '课内 chip 跳转零左移零滚动')
  await page.locator('[data-back="learn"]').click()
  await page.waitForTimeout(500)
  ok(!!await page.$('#v-learntab'), '返回学习 tab')
  await page.locator('#caps .cap[data-lesson="7"]').click()
  await page.waitForTimeout(600)
  s = await state(page)
  /* 断点续学（v3.0 页断点）：本会话刚才在 L7 离开时停在字母 c（chip 跳转过）→ 重进恢复到 c */
  ok(!!await page.$('#v-lesson') && s.chipOn === 'c', `胶囊换课→断点恢复字母c`, `chip=${s.chipOn}`)
  ok(s.docScroll === 0 && s.secLeft === 0, '换课后零滚动零左移')
  await page.close()
}

/* ---------- B · 12 课 × 全 chip × 3 视口：零左移 + 零纵向滚动 ---------- */
{
  console.log('\n== 12课×全chip×3视口 零左移+零滚动 ==')
  for (const vp of [{ width: 390, height: 844 }, { width: 390, height: 719 }, { width: 390, height: 664 }]) {
    const page = await (await ctx()).newPage()
    await page.setViewportSize(vp)
    page.on('pageerror', (e) => errors.push(`sweep${vp.height}:` + e.message))
    let bad = 0
    for (let n = 1; n <= 12; n++) {
      await openLesson(page, n)
      const units = await page.evaluate(() => document.querySelectorAll('[data-lchips] .lchip').length)
      for (let u = 0; u < units; u++) {
        await page.evaluate((idx) => { document.querySelectorAll('[data-lchips] .lchip')[idx].dispatchEvent(new MouseEvent('click', { bubbles: true })) }, u)
        await page.waitForTimeout(110)
        const s = await state(page)
        if (s.secLeft !== 0 || s.rootLeft !== 0 || s.docScroll !== 0) { bad++; break }
      }
      const s = await state(page)
      if (s.secLeft !== 0 || s.rootLeft !== 0 || s.docScroll !== 0) bad++
    }
    ok(bad === 0, `视口${vp.height}: 12课全chip零左移零滚动`, `bad=${bad}`)
    await page.close()
  }
}

console.log(`\n===== v30-accept：${pass} 通过，${fail} 失败 =====`)
if (errors.length) { console.log('PAGEERROR:', [...new Set(errors)].join(' | ')) }
await browser.close()
process.exit(fail === 0 && errors.length === 0 ? 0 : 1)
