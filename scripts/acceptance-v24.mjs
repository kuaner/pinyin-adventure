/* v2.4 施工验收（打样六屏复现 + 壳/横向翻页/声音礼仪机械断言）
   npm run preview -- --port 4173 后运行：node scripts/acceptance-v24.mjs
   覆盖：tab×3 壳 / 打样六屏截图（3 tab + 题内两页 + 声音礼仪）+ 口诀广播
   / 每屏零纵向滚动（scrollHeight<=clientHeight）/ 题内三同步（rail·dots·chip）
   / 闪卡滑动 / 声音礼仪 grep（过场音=0，speechSynthesis=0）/ v2.3 动态探针回归 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) }
catch { ({ chromium } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = new URL('../.acceptance-v24/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log((pass ? '✓' : '✗') + ' ' + name + (detail ? ' — ' + detail : ''))
}
async function fresh(opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    ...opts,
  })
  return ctx.newPage()
}
const shot = (page, name) => page.screenshot({ path: OUT + name + '.png' })

/* 每屏零纵向滚动探针：当前激活 .view 的 scrollHeight 不得超过 clientHeight（1px 容差） */
async function zeroScroll(page) {
  return page.evaluate(() => {
    const v = document.querySelector('.view.on')
    if (!v) return { ok: false, why: 'no view' }
    return { ok: v.scrollHeight <= v.clientHeight + 1, sh: v.scrollHeight, ch: v.clientHeight, id: v.id }
  })
}
/* 逐屏（含横向容器）横向页宽=390 断言 */
async function noHScroll(page) {
  return page.evaluate(() => ({ w: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }))
}

/* ---------- 1. 学习 tab（打样屏1） ---------- */
{
  const page = await fresh()
  await page.addInitScript(() => {
    localStorage.setItem('pinyin_learn', JSON.stringify({ u: 2, stars: { 1: 3 }, best: {}, step: { 2: 2 } }))
  })
  await page.goto(BASE)
  await page.waitForSelector('#v-learntab', { timeout: 5000 })
  await page.waitForTimeout(700)
  const z = await zeroScroll(page)
  ok('学习 tab 零纵向滚动', z.ok, JSON.stringify(z))
  const learn = await page.evaluate(() => ({
    tabbar: !!document.querySelector('[data-tabbar]'),
    tabs: document.querySelectorAll('#tabbar .tab').length,
    on: document.querySelector('#tabbar .tab.on')?.getAttribute('data-tab'),
    hero: !!document.querySelector('#hero'),
    letters: document.querySelectorAll('#hero .letter').length,
    cta: document.querySelector('#cta')?.textContent?.trim(),
    caps: document.querySelectorAll('#caps .cap').length,
    curCap: document.querySelector('#caps .cap.cur')?.textContent,
    radio: !!document.querySelector('#radio'),
    rt: document.querySelectorAll('#v-learntab rt').length,
    grid4: !!document.querySelector('#hero .grid4'),
  }))
  ok('壳=底部 tab×3（学习态激活）', learn.tabbar && learn.tabs === 3 && learn.on === 'learn', JSON.stringify(learn))
  ok('课程大卡（四线三格+字模+CTA 断点续学）', learn.hero && learn.grid4 && /继续学习/.test(learn.cta || '') && /写法/.test(learn.cta || ''), learn.cta || '')
  ok('课程地图 12 胶囊 + 当前课高亮', learn.caps === 12 && /第 2 课/.test(learn.curCap || ''), JSON.stringify({ caps: learn.caps, curCap: learn.curCap }))
  ok('口诀小广播入口在屏', learn.radio)
  ok('学习 tab ruby 注音 ≥ 8 处', learn.rt >= 8, 'rt=' + learn.rt)
  await shot(page, '1-learn')
  await page.context().close()
}

/* ---------- 2. 练习 tab（打样屏2） ---------- */
{
  const page = await fresh()
  await page.addInitScript(() => {
    localStorage.setItem('pinyin_v2', JSON.stringify({
      weights: { 'M:b': { w: 2, streak: 12 }, 'b|d': { w: 2, streak: 0 } },
      stars: { 1: 3, 2: 2, 3: 1 }, cards: {}, hist: [], mute: false,
      bolt: { acc: 96, d: '', tacc: 0, td: '' }, days: {},
    }))
  })
  await page.goto(BASE + '?open=practice')
  await page.waitForSelector('#v-pracetab', { timeout: 5000 })
  await page.waitForTimeout(600)
  const z = await zeroScroll(page)
  ok('练习 tab 零纵向滚动', z.ok, JSON.stringify(z))
  const pr = await page.evaluate(() => ({
    modes: document.querySelectorAll('#pgrid .mode').length,
    badges: [...document.querySelectorAll('#pgrid .mbadge')].map((b) => b.textContent.trim()),
    go: ['levels', 'bolt', 'zi', 'detect', 'pairs', 'free'].filter((g) => !!document.querySelector(`[data-go="${g}"]`)).length,
  }))
  ok('六模式卡阵 + 六入口', pr.modes === 6 && pr.go === 6, JSON.stringify(pr))
  ok('角标=真实进度（第3关/最佳96%/连对12/1组待加强）',
    /第 3 关/.test(pr.badges[0]) && /96%/.test(pr.badges[1]) && /连对/.test(pr.badges[3]) && /1 组/.test(pr.badges[4]) || /待加强/.test(pr.badges[4] || ''),
    JSON.stringify(pr.badges))
  await shot(page, '2-practice')
  await page.context().close()
}

/* ---------- 3. 我的 tab（打样屏3） ---------- */
{
  const page = await fresh()
  await page.addInitScript(() => {
    const days = {}
    const now = new Date()
    const dow = now.getDay() === 0 ? 7 : now.getDay()
    for (let i = 0; i < 5; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() - (dow - 1) + i)   /* 本周一~周五 */
      days[d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')] = 1
    }
    const cards = {}
    const keys = ['a','o','e','i','u','ü','b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w','ai','ei','ui','ao','ou','iu','ie','an','ang','en','eng','in','ing','un','ün','zhi','chi','shi','ri','zi','ci','si','ye','yue','yuan','yin','yun','ying']
    keys.forEach((k) => { if (k !== 'a') cards[k] = { box: 3, due: '2999-12-31' } })  /* 只留 a 到期 → 1 张 */
    localStorage.setItem('pinyin_v2', JSON.stringify({
      weights: {}, stars: { 1: 3, 2: 3, 3: 3 }, cards, hist: [], mute: false,
      bolt: { acc: 0, d: '', tacc: 0, td: '' }, days,
    }))
    localStorage.setItem('pinyin_learn', JSON.stringify({ u: 1, stars: {}, best: {}, step: {} }))
  })
  await page.goto(BASE + '?open=mine')
  await page.waitForSelector('#v-minetab', { timeout: 5000 })
  await page.waitForTimeout(600)
  const z = await zeroScroll(page)
  ok('我的 tab 零纵向滚动', z.ok, JSON.stringify(z))
  const mine = await page.evaluate(() => ({
    chick: !!document.querySelector('#chick'),
    streak: document.querySelector('.rowhead .chip')?.textContent?.trim(),
    level: document.querySelector('#mname')?.textContent?.trim(),
    chips: [...document.querySelectorAll('#mmeta .chip')].map((c) => c.textContent.trim()),
    flash: !!document.querySelector('#flash-entry'),
    due: document.querySelector('#flash-entry .due')?.textContent?.trim(),
    wdays: document.querySelectorAll('#wrow .wday').length,
    hits: document.querySelectorAll('#wrow .wday.hit').length,
    prows: [...document.querySelectorAll('#parent .prow b')].map((b) => b.textContent.trim()),
    newBadge: !!document.querySelector('#parent .new'),
  }))
  ok('小鸡形象区（SVG+等级+星星+通关）', mine.chick && /级/.test(mine.level || '') && mine.chips.length === 2, JSON.stringify(mine))
  ok('连续天数 chip（本周一~今 = 3 天连击）', /3/.test(mine.streak || ''), mine.streak || '')
  ok('闪卡入口（到期数）', mine.flash && /1 张/.test(mine.due || ''), mine.due || '')
  ok('周历 7 格 + 5 天已学', mine.wdays === 7 && mine.hits === 5, JSON.stringify({ wdays: mine.wdays, hits: mine.hits }))
  ok('家长区三行（历史/声音礼仪 v2.4 新/设置）', mine.prows.join(',') === '学习历史,声音礼仪,设置' && mine.newBadge, JSON.stringify(mine.prows))
  await shot(page, '3-mine')
  await page.context().close()
}

/* ---------- 4. 题内横向翻页（打样屏4/5）+ 三方同步 ---------- */
{
  const page = await fresh()
  await page.addInitScript(() => localStorage.setItem('pinyin_learn', JSON.stringify({ u: 3, stars: { 1: 3, 2: 3 }, best: {}, step: {} })))
  await page.goto(BASE + '?learn=1&step=2')
  await page.waitForSelector('#v-lesson', { timeout: 5000 })
  await page.waitForTimeout(900)
  const z = await zeroScroll(page)
  ok('题内零纵向滚动', z.ok, JSON.stringify(z))
  const sync1 = await page.evaluate(() => ({
    chip: document.querySelector('#lprog')?.textContent,
    rail: [...document.querySelectorAll('#rail .rstep')].findIndex((r) => r.classList.contains('cur')),
    dot: [...document.querySelectorAll('#dots i')].findIndex((d) => d.classList.contains('on')),
    tabbarHidden: !document.querySelector('[data-tabbar]'),
  }))
  ok('题内=全屏专注态（tab 隐藏）', sync1.tabbarHidden)
  ok('初始 2/5 三方同步（rail=1·dot=1·chip=2/5）', sync1.chip === '2/5' && sync1.rail === 1 && sync1.dot === 1, JSON.stringify(sync1))
  await shot(page, '4-lesson')
  /* 左滑翻页 → 3/5（打样屏5）。v2.4.1 起 HSteps 触屏走 touch 事件（pointer 仅收 mouse/pen），
     合成 PointerEvent 的 pointerType='' 被正确忽略——这里发真机同构的 touch 序列 */
  await page.evaluate(() => {
    const stage = document.querySelector('#v-lesson .hstage')
    const r = stage.getBoundingClientRect()
    const y = r.top + r.height / 2
    const el = document.elementFromPoint(r.left + 300, y) || stage
    const mk = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y })
    const tev = (type, x, touches) => new TouchEvent(type, { touches, changedTouches: [mk(x)], bubbles: true, cancelable: true })
    el.dispatchEvent(tev('touchstart', r.left + 300, [mk(r.left + 300)]))
    for (let i = 1; i <= 10; i++) el.dispatchEvent(tev('touchmove', r.left + 300 - (100 / 10) * i, [mk(r.left + 300 - (100 / 10) * i)]))
    el.dispatchEvent(tev('touchend', r.left + 200, []))
  })
  await page.waitForTimeout(600)
  const sync2 = await page.evaluate(() => ({
    chip: document.querySelector('#lprog')?.textContent,
    rail: [...document.querySelectorAll('#rail .rstep')].findIndex((r) => r.classList.contains('cur')),
    dot: [...document.querySelectorAll('#dots i')].findIndex((d) => d.classList.contains('on')),
  }))
  ok('左滑翻页 3/5 + 三方同步', sync2.chip === '3/5' && sync2.rail === 2 && sync2.dot === 2, JSON.stringify(sync2))
  await shot(page, '5-lesson-swiped')
  /* 步骤条点选跳页 */
  await page.evaluate(() => document.querySelectorAll('#rail .rstep')[4].click())
  await page.waitForTimeout(700)
  const sync3 = await page.evaluate(() => document.querySelector('#lprog')?.textContent)
  ok('步骤条点选直达小测（5/5）', sync3 === '5/5', 'chip=' + sync3)
  const hs = await noHScroll(page)
  ok('零横向页滚动（页宽=视口）', hs.w <= hs.vw, JSON.stringify(hs))
  await page.context().close()
}

/* ---------- 5. 口诀小广播 ---------- */
{
  const page = await fresh()
  await page.goto(BASE + '?open=radio')
  await page.waitForSelector('#v-radio', { timeout: 5000 })
  await page.waitForTimeout(700)
  const z = await zeroScroll(page)
  ok('口诀广播零纵向滚动', z.ok, JSON.stringify(z))
  const r = await page.evaluate(() => ({
    n: document.querySelectorAll('#v-radio .pcard').length,
    cur: document.querySelector('#v-radio .ptag')?.textContent,
    caps: document.querySelectorAll('#rcaps .cap').length,
    chain: document.querySelector('#chainbtn')?.textContent.trim(),
    loop: document.querySelector('#loopbtn')?.textContent.trim(),
  }))
  ok('口诀全集收录（63 条，声母+韵母+整体认读全覆盖）', r.n >= 47 && r.caps === r.n, JSON.stringify({ n: r.n, caps: r.caps }))
  ok('连播/循环控件在屏', /连播/.test(r.chain || '') && /循环/.test(r.loop || ''), r.chain + '/' + r.loop)
  /* 点播：音频元素真实起播（v2.5 起点播主字模 = PinyinCard [data-pcmain]） */
  await page.evaluate(() => document.querySelector('#v-radio [data-pcmain]').click())
  await page.waitForTimeout(500)
  const playing = await page.evaluate(() => {
    const a = Object.values(window.__PJ?.AUDIO || {}).find((x) => (x.src || '').includes('kj_'))
    return a ? { src: a.src.split('/').pop(), paused: a.paused, t: a.currentTime } : null
  })
  ok('逐条点播出声（kj_*.mp3 起播）', playing && !playing.paused && playing.t > 0, JSON.stringify(playing))
  /* 连播：开启后自动接播下一条 */
  await page.evaluate(() => document.querySelector('#chainbtn').click())
  await page.waitForTimeout(300)
  const chain1 = await page.evaluate(() => document.querySelector('#v-radio .lprog')?.textContent)
  await page.evaluate(() => { const a = Object.values(window.__PJ.AUDIO).find((x) => (x.src || '').includes('kj_')); if (a) a.currentTime = 99 })
  await page.waitForTimeout(1200)
  const chain2 = await page.evaluate(() => document.querySelector('#v-radio .lprog')?.textContent)
  ok('连播接续下一条', chain1 !== chain2, chain1 + ' → ' + chain2)
  await shot(page, '6-radio')
  await page.context().close()
}

/* ---------- 6. 声音礼仪页（打样屏6）+ 礼仪 grep ---------- */
{
  const page = await fresh()
  await page.goto(BASE + '?open=sound')
  await page.waitForSelector('#v-sound', { timeout: 5000 })
  await page.waitForTimeout(500)
  const z = await zeroScroll(page)
  ok('声音礼仪页零纵向滚动', z.ok, JSON.stringify(z))
  const sm = await page.evaluate(() => ({
    rules: document.querySelectorAll('#v-sound .srule').length,
    rows: document.querySelectorAll('#v-sound .smaprow').length,
    silent: document.querySelector('#v-sound .smaprow .tag.silent')?.textContent,
  }))
  ok('三规则 + 声音地图五行（首行=静）', sm.rules === 3 && sm.rows === 5 && sm.silent === '静', JSON.stringify(sm))
  await shot(page, '7-sound')
  await page.context().close()
  /* 礼仪 grep：构建产物内过场音调用=0 */
  const js = fs.readdirSync('dist/assets').filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync('dist/assets/' + f, 'utf8')).join('')
  const bad = ['lessons/open_', 'lessons/step_', '"go"', "'go'", 'levelup', 'timeout', 'byebye'].map((p) => js.includes('audio/' + p) || js.includes("'" + p + "'") && /playAudio|preload/.test(js.slice(js.indexOf(p) - 60, js.indexOf(p) + 20))).filter(Boolean).length
  ok('构建产物过场音清零', bad === 0, 'hits=' + bad)
}

/* ---------- 7. 闪卡卡堆 + 滑动 ---------- */
{
  const page = await fresh()
  await page.goto(BASE + '?open=flash')
  await page.waitForSelector('#v-flash', { timeout: 5000 })
  await page.waitForTimeout(700)
  const z = await zeroScroll(page)
  ok('闪卡零纵向滚动', z.ok, JSON.stringify(z))
  const f1 = await page.evaluate(() => ({ glyph: document.querySelector('#flashcard .pcc-glyph')?.textContent, ghosts: document.querySelectorAll('.ghostcard').length }))
  await page.evaluate(() => {
    const card = document.getElementById('flashcard')
    const r = card.getBoundingClientRect()
    const y = r.top + r.height / 2
    card.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + 300, clientY: y, bubbles: true, pointerId: 1 }))
    card.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + 180, clientY: y, bubbles: true, pointerId: 1 }))
    card.dispatchEvent(new PointerEvent('pointerup', { clientX: r.left + 180, y: y, clientY: y, bubbles: true, pointerId: 1 }))
  })
  await page.waitForTimeout(500)
  const f2 = await page.evaluate(() => document.querySelector('#flashcard .pcc-glyph')?.textContent)
  ok('闪卡卡堆视觉（后卡两张）', f1.ghosts === 2, 'ghosts=' + f1.ghosts)
  ok('左滑换张', f1.glyph !== f2, f1.glyph + ' → ' + f2)
  await shot(page, '8-flash')
  await page.context().close()
}

/* ---------- 8. 其余屏零滚动（levels/pairs/history/bolt/quiz/lesson 认识页）+ 探针回归 ---------- */
for (const [name, url, sel] of [
  ['levels', '?open=levels', '#v-levels'],
  ['pairs', '?open=pairs', '#v-pairs'],
  ['history', '?open=history', '#v-history'],
  ['bolt', '?open=bolt', '#v-bolt'],
  ['quiz', '?open=quiz', '#v-quiz'],
  ['mine→history 链', '?open=history', '#v-history'],
]) {
  const page = await fresh()
  await page.goto(BASE + url)
  await page.waitForSelector(sel, { timeout: 5000 })
  await page.waitForTimeout(700)
  const z = await zeroScroll(page)
  ok(name + ' 零纵向滚动', z.ok, JSON.stringify(z))
  if (name === 'quiz') await shot(page, '9-quiz')
  if (name === 'levels') await shot(page, '10-levels')
  if (name === 'pairs') await shot(page, '11-pairs')
  if (name === 'history') await shot(page, '12-history')
  await page.context().close()
}
{
  /* 认识页（打样页A）截图：大字模+例词 */
  const page = await fresh()
  await page.goto(BASE + '?open=lesson&learn=1&step=1')
  await page.waitForSelector('#v-lesson', { timeout: 5000 })
  await page.waitForTimeout(800)
  const z = await zeroScroll(page)
  ok('认识页零纵向滚动', z.ok, JSON.stringify(z))
  /* v2.5 起认识页五要素由 PinyinCard 承载：字模 = [data-pcmain] .pc-big，口诀行 = [data-pckj] */
  const big = await page.evaluate(() => ({
    big: document.querySelector('#v-lesson [data-pcmain] .pc-big')?.textContent,
    size: document.querySelector('#v-lesson [data-pcmain] .pc-big') ? getComputedStyle(document.querySelector('#v-lesson [data-pcmain] .pc-big')).fontSize : '',
    kj: !!document.querySelector('#v-lesson [data-pckj]'),
  }))
  ok('认识页大字模（≥120px）+ 口诀行', parseInt(big.size) >= 120 && big.kj, JSON.stringify(big))
  await shot(page, '13-lesson-renshi')
  await page.context().close()
}

/* ---------- 9. 动态探针回归（闯关全对通关） ---------- */
{
  const page = await fresh()
  await page.goto(BASE + '?probe=full')
  await page.waitForSelector('#probe', { timeout: 5000 })
  let banner = ''
  for (let t = 0; t < 300; t++) {
    banner = (await page.textContent('#probe').catch(() => '')) || ''
    if (/PROBE-FULL-OK|FAIL/.test(banner)) break
    await page.waitForTimeout(300)
  }
  ok('PROBE-FULL 10 题全对通关（引擎回归）', /PROBE-FULL-OK/.test(banner || ''), (banner || '').slice(0, 80))
  await page.context().close()
}
for (const [name, url, expect] of [
  ['det', '?probe=det', /PROBE-DET-OK/],
  ['bolt', '?probe=bolt', /PROBE-BOLT-OK/],
  ['zi', '?probe=zi', /PROBE-ZI-OK/],
]) {
  const page = await fresh()
  await page.goto(BASE + url)
  await page.waitForSelector('#probe', { timeout: 5000 })
  let banner = ''
  for (let t = 0; t < 40; t++) {
    banner = (await page.textContent('#probe').catch(() => '')) || ''
    if (expect.test(banner) || /FAIL/.test(banner)) break
    await page.waitForTimeout(300)
  }
  ok('PROBE-' + name.toUpperCase(), expect.test(banner || ''), (banner || '').slice(0, 90))
  await page.context().close()
}

/* ---------- 10. 线上探针钩子：?open= 三 tab 切换 + tab 点击回切 ---------- */
{
  const page = await fresh()
  await page.goto(BASE + '?open=mine')
  await page.waitForSelector('#v-minetab', { timeout: 5000 })
  await page.evaluate(() => document.querySelector('[data-tab="learn"]').click())
  await page.waitForTimeout(400)
  const t1 = await page.evaluate(() => document.querySelector('#v-learntab') && document.querySelector('#tabbar .tab.on')?.getAttribute('data-tab'))
  await page.evaluate(() => document.querySelector('[data-tab="practice"]').click())
  await page.waitForTimeout(400)
  const t2 = await page.evaluate(() => document.querySelector('#v-pracetab') && document.querySelector('#tabbar .tab.on')?.getAttribute('data-tab'))
  ok('tab 点击互切（mine→learn→practice）', t1 === 'learn' && t2 === 'practice', JSON.stringify({ t1, t2 }))
  /* 练习 tab 点闯关 → 题内（tab 隐藏）→ 退出回练习 */
  await page.evaluate(() => document.querySelector('[data-go="levels"]').click())
  await page.waitForTimeout(400)
  await page.evaluate(() => document.querySelector('#lv-1')?.click())
  await page.waitForTimeout(600)
  const q = await page.evaluate(() => ({ quiz: !!document.querySelector('#v-quiz'), noTab: !document.querySelector('[data-tabbar]') }))
  ok('练习→闯关进入题内（tab 隐藏）', q.quiz && q.noTab, JSON.stringify(q))
  await page.evaluate(() => document.querySelector('#v-quiz [data-back="quit"]').click())
  await page.waitForTimeout(500)
  const back = await page.evaluate(() => document.querySelector('#v-pracetab') && !!document.querySelector('[data-tabbar]'))
  ok('退出回练习 tab（tab 恢复）', back)
  await page.context().close()
}

await browser.close()
const fail = results.filter((r) => !r.pass)
console.log(`\n===== v2.4 验收：${results.length - fail.length}/${results.length} 通过 =====`)
fs.writeFileSync(OUT + 'results.json', JSON.stringify(results, null, 1))
process.exit(fail.length ? 1 : 0)
