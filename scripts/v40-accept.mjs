/* v4.0 游戏岛功能验收：真实输入序列试玩四游戏 + 每日挑战 + 连击/错误账本/星星/成长体系接线断言。
   前置：preview 在 4173。种子=已学 L1-L4。作答=读 data-target/状态 → 真实点击 DOM 元素。 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = '.acceptance-v40'
fs.mkdirSync(OUT, { recursive: true })

let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) } else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) } }

const browser = await chromium.launch()
async function mk() {
  const page = await browser.newPage({ ...devices['iPhone 13'], hasTouch: true })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('pinyin_v2', JSON.stringify({
      weights: {}, stars: { 1: 3, 2: 3, 3: 2 }, cards: {}, hist: [],
      mute: true, bolt: { acc: 0, d: '', tacc: 0, td: '' }, days: {},
    }))
    localStorage.setItem('pinyin_learn', JSON.stringify({ u: 4, stars: { 1: 3, 2: 3, 3: 3, 4: 2 }, best: { 1: 5, 2: 5, 3: 5, 4: 4 }, step: {} }))
    localStorage.setItem('pinyin_growth_v1', JSON.stringify({ v: 1, stars: 40, badges: [], seenStage: 1, det: 3, tone: 2, boltPerf: false }))
  })
  return { page, errs }
}
const pd = (page, sel) => page.evaluate((s) => {
  document.querySelector(s)?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
}, sel)
const ck = (page, sel) => page.evaluate((s) => {
  document.querySelector(s)?.click()
}, sel)
/* 连击计分：c1,c2=x1；c3-c5=x2；c6+=x3 → n 连对的累计分 */
const streakScore = (n) => { let s = 0; for (let c = 1; c <= n; c++) s += 10 * (c >= 6 ? 3 : c >= 3 ? 2 : 1); return s }

/* ---------- ① hub：结构断言 ---------- */
{
  const { page, errs } = await mk()
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  await page.waitForTimeout(500)
  const hub = await page.evaluate(() => ({
    daily: !!document.getElementById('dailycard'),
    stalls: Array.from(document.querySelectorAll('#stalls [data-stall]')).map((e) => e.getAttribute('data-stall')),
    coming: Array.from(document.querySelectorAll('#stalls [data-coming]')).map((e) => e.getAttribute('data-coming')),
    more: Array.from(document.querySelectorAll('#morerow [data-go]')).map((e) => e.getAttribute('data-go')),
    artVisible: Array.from(document.querySelectorAll('#stalls .art')).every((e) => e.getBoundingClientRect().width > 40),
    scrollV: document.getElementById('tab-view-root').scrollHeight <= document.getElementById('tab-view-root').clientHeight,
  }))
  ok(hub.daily, 'hub：每日挑战卡在')
  ok(hub.stalls.join(',') === 'balloon,mole,duel,fish', 'hub：4 游戏摊位实装', hub.stalls.join(','))
  ok(hub.coming.join(',') === 'egg,tone,race,memory', 'hub：占位摊位（v4.2 起 4 张：蛋/声调/赛跑/翻牌）', hub.coming.join(','))
  ok(hub.more.join(',') === 'levels,free', 'hub：闯关/自由练习保留入口', hub.more.join(','))
  ok(hub.artVisible, 'hub：摊位插画可辨识（宽>40px）')
  ok(hub.scrollV, 'hub：零纵向滚动（容器级）')
  /* 占位卡不可误触 */
  const comingTap = await page.evaluate(() => {
    const c = document.querySelector('[data-coming="egg"]')
    const btn = c.querySelector('button')
    return !btn
  })
  ok(comingTap, 'hub：敬请期待灰卡无按钮不误触')
  /* 点气球摊位 → 进游戏倒计时 */
  await ck(page, '[data-stall="balloon"]')
  await page.waitForSelector('#gcount', { timeout: 6000 })
  ok(true, 'hub：点摊位 → 倒计时开局')
  ok(errs.length === 0, 'hub：零 pageerror', errs[0] || '')
  await page.context().close()
}

/* ---------- ② 气球大作战：真实点爆 + 账本 + 连击清零 ---------- */
{
  const { page, errs } = await mk()
  await page.goto(`${BASE}/?open=game&g=balloon&st=play`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#gstage', { timeout: 8000 })
  await pd(page, '[data-listen]')
  await page.waitForTimeout(300)
  /* 等目标球出现，点爆它 ×3（真实 pointerdown 序列） */
  for (let i = 0; i < 3; i++) {
    const t = await page.evaluate(() => window.__PJ.GS().target)
    await page.waitForSelector(`#gstage .balloon[data-letter="${t}"]`, { timeout: 6000 })
    await page.evaluate((letter) => {
      const hit = Array.from(document.querySelectorAll('#gstage .balloon')).find((e) => e.getAttribute('data-letter') === letter)
      hit?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }, t)
    await page.waitForTimeout(900)
  }
  const s1 = await page.evaluate(() => ({ score: window.__PJ.GS().score, combo: window.__PJ.GS().combo }))
  ok(s1.score === streakScore(3) && s1.score === 40, '气球：连点 3 球 得分=40（c3 起 x2）', 'score=' + s1.score)
  ok(s1.combo === 3, '气球：连击=3')
  /* 连击倍率：再点 3 球到连击 6 → x3 倍率，得分跳变 */
  for (let i = 0; i < 3; i++) {
    const t = await page.evaluate(() => window.__PJ.GS().target)
    await page.waitForSelector(`#gstage .balloon[data-letter="${t}"]`, { timeout: 6000 })
    await page.evaluate((letter) => {
      const hit = Array.from(document.querySelectorAll('#gstage .balloon')).find((e) => e.getAttribute('data-letter') === letter)
      hit?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }, t)
    await page.waitForTimeout(900)
  }
  const s2 = await page.evaluate(() => ({ score: window.__PJ.GS().score, combo: window.__PJ.GS().combo, mult: document.getElementById('gmult')?.getAttribute('data-mult') }))
  ok(s2.score === streakScore(6), '气球：x2/x3 倍率计分（6 连=110）', 'score=' + s2.score)
  ok(String(s2.mult) === '3', '气球：连击≥6 出现 ×3 倍率章', 'mult=' + s2.mult)
  /* 点错球 → 清连击（等一只非目标球上屏再点） */
  const wrongK = await page.waitForFunction(() => {
    const t = window.__PJ.GS().target
    const b = Array.from(document.querySelectorAll('#gstage .balloon')).find((e) => e.getAttribute('data-letter') !== t)
    return b ? b.getAttribute('data-letter') : null
  }, null, { timeout: 8000 }).then((h) => h.jsonValue()).catch(() => null)
  if (wrongK) {
    await page.evaluate((letter) => {
      const b = Array.from(document.querySelectorAll('#gstage .balloon')).find((e) => e.getAttribute('data-letter') === letter)
      b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }, wrongK)
    await page.waitForTimeout(400)
  }
  const s3 = await page.evaluate(() => window.__PJ.GS().combo)
  ok(s3 === 0, '气球：点错清连击', 'wrong=' + wrongK)
  /* 错误账本：错球记账 + 目标球 ok 记账 */
  const led = await page.evaluate(() => JSON.parse(localStorage.getItem('pinyin_game_v1') || '{}').letters || {})
  const okSum = Object.values(led).reduce((a, r) => a + (r.ok || 0), 0)
  const errSum = Object.values(led).reduce((a, r) => a + (r.err || 0), 0)
  ok(okSum >= 6, '气球：错误账本 ok 记账≥6', 'okSum=' + okSum)
  ok(errSum >= 1, '气球：错误账本 err 记账（点错球）', 'errSum=' + errSum)
  /* 退出无惩罚回岛 */
  await ck(page, '[data-back="gamequit"]')
  await page.waitForTimeout(400)
  ok(await page.evaluate(() => !!document.getElementById('v-island')), '气球：退出常在无惩罚回岛')
  ok(errs.length === 0, '气球：零 pageerror', errs[0] || '')
  await page.context().close()
}

/* ---------- ③ 打地鼠：敲对 + 镜像陷阱在场 ---------- */
{
  const { page, errs } = await mk()
  /* 种 b 弱项 → 目标高频=b → 镜像陷阱 d 必现 */
  await page.addInitScript(() => {
    const led = JSON.parse(localStorage.getItem('pinyin_game_v1') || '{"v":1,"letters":{},"games":{},"daily":{"day":"","best":0,"done":false}}')
    led.letters.b = { ok: 0, err: 5, last: Math.floor(Date.now() / 86400000) }
    localStorage.setItem('pinyin_game_v1', JSON.stringify(led))
  })
  await page.goto(`${BASE}/?open=game&g=mole&st=play`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#gstage', { timeout: 8000 })
  await pd(page, '[data-listen]')
  await page.waitForTimeout(800)
  let hitOk = 0, trapSeen = false
  let lastScore = 0
  for (let i = 0; i < 12 && !(hitOk >= 3 && trapSeen); i++) {
    const t = await page.evaluate(() => window.__PJ.GS().target)
    /* 等地鼠探头 */
    const appeared = await page.waitForSelector(`#gstage .mole[data-letter="${t}"].up`, { timeout: 5000 }).then(() => true).catch(() => false)
    if (!appeared) continue
    const round = await page.evaluate(() => Array.from(document.querySelectorAll('#gstage .mole.up')).map((e) => e.getAttribute('data-letter')))
    const mirror = { b: 'd', d: 'b', p: 'q', q: 'p' }[t]
    if (mirror && round.includes(mirror)) trapSeen = true
    const hit = await page.evaluate((letter) => {
      const m = Array.from(document.querySelectorAll('#gstage .mole.up')).find((e) => e.getAttribute('data-letter') === letter)
      if (!m) return false
      m.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      return true
    }, t)
    if (hit) hitOk++
    await page.waitForTimeout(700)
    lastScore = await page.evaluate(() => window.__PJ.GS().score)
  }
  const ms = await page.evaluate(() => ({ score: window.__PJ.GS().score, combo: window.__PJ.GS().combo }))
  ok(hitOk >= 3 && ms.score >= 30, '地鼠：敲中≥3 只 得分入账', `hits=${hitOk} score=${ms.score}`)
  ok(trapSeen, '地鼠：镜像对陷阱在场（搭档同轮探头）')
  ok(errs.length === 0, '地鼠：零 pageerror', errs[0] || '')
  await page.context().close()
}

/* ---------- ④ 镜像大对决：答对推绳 + 答错被推 + 错误账本加权出题 ---------- */
{
  const { page, errs } = await mk()
  /* 种点错误账本：b 错 3 次 → 出题应偏向 b */
  await page.addInitScript(() => {
    const led = JSON.parse(localStorage.getItem('pinyin_game_v1') || '{"v":1,"letters":{},"games":{},"daily":{"day":"","best":0,"done":false}}')
    led.letters.b = { ok: 0, err: 3, last: Math.floor(Date.now() / 86400000) }
    led.letters.d = { ok: 9, err: 0, last: Math.floor(Date.now() / 86400000) }
    localStorage.setItem('pinyin_game_v1', JSON.stringify(led))
  })
  await page.goto(`${BASE}/?open=game&g=duel&st=play`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#gstage', { timeout: 8000 })
  /* 先答对 2 题（绳 50→约 65，远离敌方线避免中途获胜），再验答错被推，最后连推验证 */
  const pos0 = await page.evaluate(() => parseFloat(document.querySelector('[data-rope]').style.left))
  let ansOk = 0
  for (let i = 0; i < 2; i++) {
    const done = await page.evaluate(() => {
      const qel = document.querySelector('[data-q]')
      if (!qel) return false
      const t = qel.getAttribute('data-target')
      const letters = Array.from(document.querySelectorAll('[data-opts] .duelopt'))
      const hit = letters.find((e) => e.getAttribute('data-letter') === t)
      hit?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      return !!hit
    })
    if (!done) break
    ansOk++
    await page.waitForTimeout(650)
  }
  const pos1 = await page.evaluate(() => parseFloat(document.querySelector('[data-rope]').style.left))
  const ds = await page.evaluate(() => ({ score: window.__PJ.GS().score, combo: window.__PJ.GS().combo }))
  ok(ansOk === 2 && ds.score === 20, '拔河：答对推绳得分', `ansOk=${ansOk} score=${ds.score}`)
  ok(pos1 > pos0 + 8, '拔河：绳子推向敌方', `${pos0}%→${pos1}%`)
  /* 答错 2 次：绳被推回我方 + 错误账本记账 */
  const p2 = await page.evaluate(() => parseFloat(document.querySelector('[data-rope]').style.left))
  const ledBefore = await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('pinyin_game_v1')).letters; return Object.values(l).reduce((a, r) => a + (r.err || 0), 0) })
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => {
      const qel = document.querySelector('[data-q]')
      const t = qel ? qel.getAttribute('data-target') : ''
      const letters = Array.from(document.querySelectorAll('[data-opts] .duelopt'))
      const hit = letters.find((e) => e.getAttribute('data-letter') !== t)
      hit?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    await page.waitForTimeout(1400)
  }
  const p3 = await page.evaluate(() => parseFloat(document.querySelector('[data-rope]').style.left))
  ok(p3 < p2 - 5, '拔河：答错被推向我方（绳回撤）', `${p2}%→${p3}%`)
  const ledAfter = await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('pinyin_game_v1')).letters; return Object.values(l).reduce((a, r) => a + (r.err || 0), 0) })
  ok(ledAfter >= ledBefore + 2, '拔河：答错写入错误账本', `${ledBefore}→${ledAfter}`)
  ok(errs.length === 0, '拔河：零 pageerror', errs[0] || '')
  await page.context().close()
}

/* ---------- ⑤ 小猫钓鱼：钓对 + 钓错溜走 ---------- */
{
  const { page, errs } = await mk()
  await page.goto(`${BASE}/?open=game&g=fish&st=play`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#gstage', { timeout: 8000 })
  await pd(page, '[data-listen]')
  await page.waitForTimeout(300)
  let caught = 0
  for (let i = 0; i < 4; i++) {
    const t = await page.evaluate(() => window.__PJ.GS().target)
    const appeared = await page.waitForSelector(`#gstage .fishwrap[data-letter="${t}"]`, { timeout: 6000 }).then(() => true).catch(() => false)
    if (!appeared) continue
    await page.evaluate((letter) => {
      const f = Array.from(document.querySelectorAll('#gstage .fishwrap')).find((e) => e.getAttribute('data-letter') === letter)
      f?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }, t)
    caught++
    await page.waitForTimeout(900)
  }
  const fs2 = await page.evaluate(() => ({ score: window.__PJ.GS().score, combo: window.__PJ.GS().combo }))
  ok(caught >= 3 && fs2.score >= 30, '钓鱼：钓中≥3 条 得分入账', `caught=${caught} score=${fs2.score}`)
  ok(errs.length === 0, '钓鱼：零 pageerror', errs[0] || '')
  await page.context().close()
}

/* ---------- ⑥ 完整一局（结算接线：endGame → 产星/成长/庆祝/结算层） ---------- */
{
  const { page, errs } = await mk()
  await page.goto(`${BASE}/?open=game&g=balloon&st=play`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#gstage', { timeout: 8000 })
  /* 先攒分（5 连=80 分 → 1 星档） */
  for (let i = 0; i < 5; i++) {
    const t = await page.evaluate(() => window.__PJ.GS().target)
    await page.waitForSelector(`#gstage .balloon[data-letter="${t}"]`, { timeout: 6000 })
    await page.evaluate((letter) => {
      const hit = Array.from(document.querySelectorAll('#gstage .balloon')).find((e) => e.getAttribute('data-letter') === letter)
      hit?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }, t)
    await page.waitForTimeout(900)
  }
  const g0 = await page.evaluate(() => JSON.parse(localStorage.getItem('pinyin_growth_v1')).stars)
  await page.evaluate(() => window.__PJ.endGame())
  const ceSeen = await page.waitForSelector('#celebrate[data-ce="game"]', { timeout: 2500 }).then(() => true).catch(() => false)
  ok(ceSeen, '结算：星星飞入庆祝仪式（game 模式 overlay）')
  await page.waitForSelector('#gresult', { timeout: 6000 })
  const res = await page.evaluate(() => ({
    score: window.__PJ.GS().score,
    stars: window.__PJ.GS().stars,
    best: JSON.parse(localStorage.getItem('pinyin_game_v1')).games.balloon.best,
    starsToday: JSON.parse(localStorage.getItem('pinyin_game_v1')).games.balloon.starsToday,
    growth: JSON.parse(localStorage.getItem('pinyin_growth_v1')).stars,
  }))
  ok(res.score === 80 && res.best >= res.score, '结算：得分入账 + best 刷新', JSON.stringify(res))
  ok(res.stars >= 1 && res.starsToday === res.stars, '结算：产星 + 每日星账（上限10/日）', `stars=${res.stars}`)
  ok(res.growth === g0 + res.stars, '结算：星星飞入小鸡成长体系', `${g0}→${res.growth}`)
  /* 再玩一次按钮 */
  await page.evaluate(() => document.getElementById('celebrate')?.click())
  await page.waitForTimeout(2500)
  await ck(page, '#gagain')
  await page.waitForSelector('#gcount', { timeout: 6000 })
  ok(true, '结算：再玩一次 → 倒计时重开')
  ok(errs.length === 0, '结算：零 pageerror', errs[0] || '')
  await page.context().close()
}

/* ---------- ⑦ 每日挑战：智能混编抽样 + 连击计分 + 每日一换 ---------- */
{
  const { page, errs } = await mk()
  /* 种错误账本：b 弱 → 题面应高频出现 b */
  await page.addInitScript(() => {
    const led = JSON.parse(localStorage.getItem('pinyin_game_v1') || '{"v":1,"letters":{},"games":{},"daily":{"day":"","best":0,"done":false}}')
    led.letters.b = { ok: 0, err: 8, last: Math.floor(Date.now() / 86400000) - 5 }
    localStorage.setItem('pinyin_game_v1', JSON.stringify(led))
  })
  await page.goto(`${BASE}/?open=daily`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#dqcard', { timeout: 8000 })
  const mix = await page.evaluate(() => window.__PJ.DC().qs.map((q) => q.type).join(','))
  const bCount = await page.evaluate(() => window.__PJ.DC().qs.filter((q) => q.A === 'b').length)
  const types = mix.split(',')
  ok(types.length === 10, '每日：10 题混编', mix)
  ok(types.filter((x) => x === 'blisten').length >= 6 && types.filter((x) => x === 'bkj').length >= 1 && types.filter((x) => x === 'zi').length >= 1,
    '每日：题型结构（听写主导+口诀+识字）', mix)
  ok(bCount >= 2, '每日：弱项字母 b 加权高频出现', 'b题数=' + bCount)
  /* 每日一换：同日种子稳定——刷新重 build（未作答扰动）题目逐键一致 */
  const q1 = await page.evaluate(() => window.__PJ.DC().qs.map((q) => q.type + ':' + (q.A || q.z?.h)).join('|'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('#dqcard', { timeout: 8000 })
  const q2 = await page.evaluate(() => window.__PJ.DC().qs.map((q) => q.type + ':' + (q.A || q.z?.h)).join('|'))
  ok(q1 === q2 && q1.split('|').length === 10, '每日：按日期种子，同日题面稳定（每日一换）', q2.slice(0, 60))
  /* 真实作答 3 对 1 错：连击计分 + 账本记账 */
  let answered = 0
  for (let i = 0; i < 10 && answered < 4; i++) {
    const st = await page.evaluate((nth) => {
      const dc = window.__PJ.DC()
      if (dc.done || dc.reveal) return null
      const q = dc.qs[dc.i]
      const wrong = nth === 2   /* 第 3 题故意答错 */
      const ans = wrong ? (q.ans + 1) % q.opts.length : q.ans
      const opts = Array.from(document.querySelectorAll('#dqcard [data-opts] .opt'))
      opts[ans]?.click()
      return { wrong, i: dc.i }
    }, answered)
    if (!st) { await page.waitForTimeout(300); continue }
    answered++
    await page.waitForTimeout(st.wrong ? 1700 : 1000)
  }
  const dcState = await page.evaluate(() => { const d = window.__PJ.DC(); return { score: d.score, combo: d.combo, ok: d.ok } })
  ok(dcState.score === 30, '每日：连击计分（10+10+错清+10=30）', 'score=' + dcState.score)
  ok(dcState.combo === 1 && dcState.ok === 3, '每日：答错清零后重计（末题对→连击=1）', `combo=${dcState.combo} ok=${dcState.ok}`)
  const led2 = await page.evaluate(() => JSON.parse(localStorage.getItem('pinyin_game_v1')).letters)
  ok(Object.keys(led2).length >= 2, '每日：作答写入错误账本', Object.keys(led2).join(','))
  ok(errs.length === 0, '每日：零 pageerror', errs[0] || '')
  await page.context().close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
