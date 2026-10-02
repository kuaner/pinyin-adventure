/* gotoLesson flow：学习岛（课页 HSteps 横翻结构）的导航与操作——只写一次。
   课页全页常驻挂载：组件选择器必须限定到当前可见页（curScope）。
   触摸序列走 CDP（hasTouch 真机同路径），与既有 v30/v31/v401 脚本同款。 */
import { BASE_URL } from './bootApp.mjs'
import { sleep } from './assert.mjs'

export async function openLesson(page, n, extra = '') {
  await page.goto(`${BASE_URL()}/?open=lesson&learn=${n}${extra}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-lesson .hspage', { timeout: 10000 })
  await page.waitForTimeout(450)
}

/* 课页全局状态快照（零左移/零滚动/翻页 transform/chip 态） */
export const lessonState = (page) => page.evaluate(() => {
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
    nchips: document.querySelectorAll('[data-lchips] .lchip').length,
    docScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }
})

/* 真实触摸左滑（CDP touch 序列） */
export async function swipeLeft(page) {
  const w = await page.evaluate(() => { const r = document.querySelector('.hswrap').getBoundingClientRect(); return { x: r.x, y: r.y, wd: r.width, h: r.height } })
  const cdp = await page.context().newCDPSession(page)
  const t = (type, px, py) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py }] })
  const x0 = w.x + w.wd - 25, y0 = w.y + w.h / 2, x1 = w.x + 25
  await t('touchStart', x0, y0)
  for (let i = 1; i <= 8; i++) await t('touchMove', x0 + ((x1 - x0) * i) / 8, y0)
  await t('touchEnd', x1, y0)
  await page.waitForTimeout(650)
}

/* 当前可见页作用域（全页常驻挂载，选择器限定到 hspage:nth-child） */
export async function curScope(page) {
  const idx = await page.evaluate(() => {
    const tr = document.querySelector('.hstage').style.transform
    const x = parseFloat((/translateX\((-?[\d.]+)px\)/.exec(tr) || [])[1] || '0')
    return Math.round(-x / document.querySelector('.hswrap').clientWidth)
  })
  return `#v-lesson .hstage > .hspage:nth-child(${idx + 1})`
}

/* 页内字模状态（单 z 断言/idleDone 定格/徽章清零） */
export const glyphState = (page, scope) => page.evaluate((sc) => {
  const root = document.querySelector(sc)
  if (!root) return null
  const svgs = root.querySelectorAll('svg.strokeanim')
  const inks = [...root.querySelectorAll('path:not(.ghost):not(.glink)')]
  const visible = inks.filter((p) => parseFloat(getComputedStyle(p).strokeDashoffset || '2000') === 0 || p.style.strokeDashoffset === '0')
  return {
    svgs: svgs.length, inks: inks.length, visible: visible.length,
    badges: root.querySelectorAll('.numbg').length,
    big: root.querySelectorAll('.pc-big').length,
    glyphfit: root.querySelectorAll('.pc-glyphfit').length,
    strokewrap: root.querySelectorAll('.pc-strokewrap').length,
    mainbtn: root.querySelectorAll('.pc-mainbtn').length,
  }
}, scope)

/* 按钮 ≥48×48 几何（儿童触控门槛） */
export const btnBox = (page, scope, sel) => page.evaluate(({ sc, s }) => {
  const el = document.querySelector(`${sc} ${s}`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }
}, { sc: scope, s: sel })
export const ge48 = (b) => !!b && b.w >= 48 && b.h >= 48

/* chip 跳转（真实点击） */
export async function tapChip(page, ler) {
  await page.locator(`[data-lchips] .lchip[data-ler="${ler}"]`).click()
  await page.waitForTimeout(650)
}
/* 单元 chip（quiz/blend 等无字母 chip） */
export async function tapUnit(page, punit) {
  await page.locator(`[data-punit="${punit}"]`).click()
  await page.waitForTimeout(650)
}

/* —— 参与证据（BUGS#33 互动证据制）—— */
/* 旗A：学一学页点读音 */
export async function flagRead(page, scope) {
  await page.locator(`${scope} [data-pcread]`).click()
  await page.waitForTimeout(300)
}
/* 旗B：声调页点读 ≥3 个不同声调 */
export async function flagTones(page, scope, n = 3) {
  for (let i = 0; i < n; i++) {
    await page.locator(`${scope} .tonedrill .tonerow`).nth(i).click()
    await page.waitForTimeout(250)
  }
}
/* 声调页「读完了」+ 听调小练 4 题×两段式走通 → 自动推进下一字母 */
export async function finishToneDrill(page, scope) {
  await page.locator(`${scope} .tonedrill .trow .btn.green`).click()
  await page.waitForTimeout(400)
  for (let i = 0; i < 4; i++) {
    await page.locator(`${scope} .tonedrill .topt`).first().click()
    await page.waitForTimeout(350)
    await page.locator(`${scope} .tonedrill .topt`).first().click()
    await page.waitForTimeout(2000)
  }
  await page.locator(`${scope} .qresult .trow .btn.green`).click()
  await page.waitForTimeout(700)
}

/* 拦截卡信息（BUGS#33：吉祥物/文案/双按钮/ruby/无 boot 键） */
export const gateInfo = (page) => page.evaluate(() => {
  const g = document.querySelector('[data-gate]')
  if (!g) return null
  const plain = (sel) => { const c = g.querySelector(sel).cloneNode(true); c.querySelectorAll('rt').forEach((e) => e.remove()); return c.textContent || '' }
  return {
    mascot: !!g.querySelector('.gatemascot svg'),
    msg: plain('.gatemsg'),
    goback: plain('[data-goback]'),
    force: plain('[data-forcequiz]'),
    noBoot: !document.querySelector('[data-bootquiz]'),
    ruby: !!g.querySelector('.gatemsg rt'),
  }
})

/* 庆祝 overlay 点击即跳过（证据结算/游戏结算会短暂全屏拦截） */
export async function skipCelebrate(page) {
  await page.evaluate(() => document.getElementById('celebrate')?.click())
  await page.waitForTimeout(350)
}

/* 题面纯文本（剥 ruby rt 注音——rt 是合法注音通道，泄漏判定用） */
export const faceText = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el) return null
  const c = el.cloneNode(true)
  c.querySelectorAll('rt').forEach((r) => r.remove())
  return c.textContent || ''
}, sel)
