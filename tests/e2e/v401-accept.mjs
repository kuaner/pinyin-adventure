/* v4.0.1 BUGS#33 学拼音「滑动即学会」改互动证据制 验收：
   A. 反例路径：进课纯滑动走完全部字母（零点击）→ 全部 chip 无 ✓ → 进小测被拦截卡拦住
      → 「跳回去学」落到第一个未学字母的学一学页
   B. 部分证据路径：点读音+只点 2 个声调（<3）→ 滑完仍无 ✓ → 拦截卡 → 「我还要试试」放行（家长通道不锁死）
   C. 正例路径：每字母点读音 1 次+声调页点 3 个声调 → 滑完 chip ✓（过字母即记账）→ 全部集旗 → 小测放行自动建题答题
   D. 重学路径：已过关课（预置 pinyin_learn 记星）→ 零参与直进小测 → 不拦（自由复习）
   E. 拦截卡截图目验（吉祥物+文案+注音+两按钮布局）+ 拦截态零纵向滚动；全程零 pageerror */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = '.acceptance-v401'
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
  const track = document.querySelector('.hstage')
  const chips = document.querySelector('[data-lchips]')
  const chipDone = [...(chips?.querySelectorAll('.lchip.done') || [])].map((e) => e.getAttribute('data-ler'))
  return {
    transform: track ? parseFloat((/translateX\((-?[\d.]+)px\)/.exec(track.style.transform) || [])[1] || '0') : -9999,
    chipDone,
    docScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
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

/* 当前页作用域（全页常驻挂载，组件选择器必须限定到可见页） */
async function curScope(page) {
  const idx = await page.evaluate(() => {
    const tr = document.querySelector('.hstage').style.transform
    const x = parseFloat((/translateX\((-?[\d.]+)px\)/.exec(tr) || [])[1] || '0')
    return Math.round(-x / document.querySelector('.hswrap').clientWidth)
  })
  return `#v-lesson .hstage > .hspage:nth-child(${idx + 1})`
}

/* 庆祝 overlay 点击即跳过（证据结算的迷你庆祝会短暂全屏拦截点击） */
async function skipCelebrate(page) {
  await page.evaluate(() => document.getElementById('celebrate')?.click())
  await page.waitForTimeout(350)
}

/* ---------- A · 反例路径：零点击纯滑动 → 全 chip 无 ✓ → 拦截卡 → 跳回去学 ---------- */
{
  console.log('\n== 反例：零点击纯滑动 → 拦截卡 → 跳回去学 ==')
  const page = await (await ctx()).newPage()
  page.on('pageerror', (e) => errors.push('neg:' + e.message))
  await openLesson(page, 1)
  for (let i = 0; i < 6; i++) await swipeLeft(page)   /* L1=7 页：滑完全部字母直达小测，零点击 */
  let s = await state(page)
  ok(s.chipDone.length === 0, '纯滑动零点击 → 全部 chip 无 ✓（待学态）', `done=${JSON.stringify(s.chipDone)}`)
  ok(!!await page.$('[data-gate]'), '进小测步被拦截卡拦住（data-gate 渲染）')
  const gate = await page.evaluate(() => {
    const g = document.querySelector('[data-gate]')
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
  ok(gate.mascot, '拦截卡吉祥物渲染（小鸡 SVG）')
  ok(gate.msg.includes('没学完') && gate.msg.includes('三'), '文案=还有 三 个拼音没学完（儿童语气+中文数字）', gate.msg.trim())
  ok(gate.ruby, '拦截卡文案带 ruby 注音')
  ok(gate.goback.includes('跳回去学') && gate.force.includes('我还要试试'), '双按钮=跳回去学 + 我还要试试', `${gate.goback.trim()} / ${gate.force.trim()}`)
  ok(gate.noBoot, '拦截态不出「开始小测」boot 键')
  ok(s.docScroll === 0, '拦截态零纵向滚动')
  await page.screenshot({ path: `${OUT}/01-gate-card.png` })
  await page.locator('[data-goback]').click()
  await page.waitForTimeout(700)
  s = await state(page)
  ok(s.transform === 0, '「跳回去学」落到第一个未学字母（a 学一学页）', `transform=${s.transform}`)
  ok(s.chipDone.length === 0, '跳回后 chip 仍全部待学（无 ✓）')
  await page.screenshot({ path: `${OUT}/02-negative-chips.png` })
  await page.close()
}

/* ---------- B · 部分证据路径：读音+2 声调（<3）→ 仍无 ✓ → 拦截 → 我还要试试放行 ---------- */
{
  console.log('\n== 部分证据：读音+2声调 → 无✓ → 我还要试试放行 ==')
  const page = await (await ctx()).newPage()
  page.on('pageerror', (e) => errors.push('part:' + e.message))
  await openLesson(page, 1)
  let sc = await curScope(page)
  await page.locator(`${sc} [data-pcread]`).click()   /* 旗A a */
  await page.waitForTimeout(250)
  await swipeLeft(page)
  sc = await curScope(page)
  await page.locator(`${sc} .tonedrill .tonerow`).nth(0).click()
  await page.waitForTimeout(200)
  await page.locator(`${sc} .tonedrill .tonerow`).nth(1).click()   /* 旗B 只 2 个声调（<3） */
  await page.waitForTimeout(200)
  for (let i = 0; i < 5; i++) await swipeLeft(page)
  let s = await state(page)
  ok(s.chipDone.length === 0, '读音+2声调（不达标）→ chip a 仍无 ✓', `done=${JSON.stringify(s.chipDone)}`)
  ok(!!await page.$('[data-gate]'), '证据不足进小测仍被拦')
  await page.screenshot({ path: `${OUT}/03-gate-partial.png` })
  await page.locator('[data-forcequiz]').click()   /* 家长通道式放行 */
  await page.waitForTimeout(700)
  ok(!!await page.$('#v-lesson .qbody'), '「我还要试试」放行 → 小测建题答题（不锁死）')
  s = await state(page)
  ok(s.docScroll === 0, '放行答题态零纵向滚动')
  await page.close()
}

/* ---------- C · 正例路径：每字母读音+3声调 → chip ✓ → 小测放行 ---------- */
{
  console.log('\n== 正例：每字母点读音+3声调 → chip ✓ → 小测放行 ==')
  const page = await (await ctx()).newPage()
  page.on('pageerror', (e) => errors.push('pos:' + e.message))
  await openLesson(page, 1)
  for (const li of [0, 1, 2]) {   /* a / o / e：学一学点 🔊 + 声调页点 3 个声调 */
    let sc = await curScope(page)
    await page.locator(`${sc} [data-pcread]`).click()
    await page.waitForTimeout(250)
    await swipeLeft(page)
    sc = await curScope(page)
    for (let i = 0; i < 3; i++) {
      await page.locator(`${sc} .tonedrill .tonerow`).nth(i).click()
      await page.waitForTimeout(200)
    }
    await swipeLeft(page)   /* 跨出本字母 → 证据结算 chip ✓ + 迷你庆祝 */
    await skipCelebrate(page)
    if (li === 0) {
      const s0 = await state(page)
      ok(s0.chipDone.includes('a'), 'a 集齐两旗 → 跨出即 chip ✓', `done=${JSON.stringify(s0.chipDone)}`)
      await page.screenshot({ path: `${OUT}/04-positive-a-done.png` })
    }
  }
  let s = await state(page)
  ok(JSON.stringify(s.chipDone) === JSON.stringify(['a', 'o', 'e']), '全部字母集旗 → chip 全 ✓', `done=${JSON.stringify(s.chipDone)}`)
  /* 已到小测页（第 7 页）——放行：自动建题出答题页（无拦截卡） */
  ok(!!await page.$('#v-lesson .qbody'), '旗齐进小测放行 → 自动建题开始答题')
  ok(!await page.$('[data-gate]'), '无拦截卡')
  s = await state(page)
  ok(s.docScroll === 0, '答题态零纵向滚动')
  await page.screenshot({ path: `${OUT}/05-positive-quiz.png` })
  await page.close()
}

/* ---------- D · 重学路径：已过关课零参与直进小测不拦 ---------- */
{
  console.log('\n== 重学：已过关课（quizPassed）零参与进小测不拦 ==')
  const c = await ctx()
  await c.addInitScript(() => localStorage.setItem('pinyin_learn', JSON.stringify({ u: 2, stars: { 1: 3 }, best: { 1: 5 }, step: {} })))
  const page = await c.newPage()
  page.on('pageerror', (e) => errors.push('relearn:' + e.message))
  await openLesson(page, 1)
  await page.locator('[data-punit="quiz"]').click()   /* 零参与 chip 直跳小测 */
  await page.waitForTimeout(700)
  let s = await state(page)
  ok(!await page.$('[data-gate]'), '已过关课重学 → 无拦截卡（自由复习）')
  ok(!!await page.$('#v-lesson .qbody'), '重学直进小测自动建题')
  ok(s.chipDone.length === 0, '重学本会话 chip 未记 ✓（证据只管拦截不管历史）', `done=${JSON.stringify(s.chipDone)}`)
  await page.screenshot({ path: `${OUT}/06-relearn-quiz.png` })
  await page.close()
}

console.log(`\n===== v401-accept：${pass} 通过，${fail} 失败 =====`)
if (errors.length) { console.log('PAGEERROR:', [...new Set(errors)].join(' | ')) }
await browser.close()
process.exit(fail === 0 && errors.length === 0 ? 0 : 1)
