/* 命名回归样例 Bug#41「声调音乐会把答案写在播放键旁边」+ 全游戏出题泄漏审计（v4.5 回归门）。
   病灶：目标侧把答案写在题面上——音乐会 🔊 旁显示带调音节 "má"（看标记接音符不用听）；
   审计扩查：对决/每日挑战/闯关/闪电的口诀题面文字整句上屏（含答案字母"右下半圆 b b b"）+
   口诀题音频播整句 kj（含答案读音）。
   修法=目标侧去答：音乐会只显基础音节 "ma"；口诀题面谜面化（文字剥字母+音频 riddle/*）。
   本样例=四面板题面文字零字母（剥离 ruby rt 注音后断言）+音乐会无调号+kj 题音频谜面制。
   前置：preview 4173（或 BASE_URL）。独立可跑：node tests/e2e/regression-bug41-no-leak.mjs */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) } else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const safeName = (k) => (k === 'ü' ? 'v' : k)
/* 泄漏判定：题面文字任何拉丁/带调字母都算答案标记（谜面=纯中文）。
   注意：音乐会基础音节 chip 例外——"ma"/"yi" 这类不带调音节是法规明许的目标侧展示（声调信息只在音频），
   其泄漏判定=带调符号出现 */
const LEAK = /[a-zA-Züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/
const TONE_MARK = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/

const browser = await chromium.launch()
const LEARN0 = { u: 6, stars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 }, best: { 1: 5, 2: 5, 3: 5, 4: 4 }, step: {} }
const mkPage = () => {
  const p = browser.newPage({ ...devices['iPhone 13'], hasTouch: true }).then(async (page) => {
    page.on('pageerror', (e) => errsAll.push(e.message))
    await page.addInitScript(`
      localStorage.clear()
      localStorage.setItem('pinyin_v2', JSON.stringify({ weights: {}, stars: { 1: 3, 2: 3, 3: 2 }, cards: {}, hist: [], mute: false, bolt: { acc: 0, d: '', tacc: 0, td: '' }, days: {} }))
      localStorage.setItem('pinyin_learn', JSON.stringify(${JSON.stringify(LEARN0)}))
      localStorage.setItem('pinyin_growth_v1', JSON.stringify({ v: 1, stars: 40, badges: [], seenStage: 1, det: 3, tone: 2, boltPerf: false }))
      window.__AUDIO_LOG = []
    `)
    return page
  })
  return p
}
const errsAll = []
/* 题面文字读取：剥离 ruby rt 注音（rt=合法拼音注音通道）后取纯文本 */
const faceText = (pg, sel) => pg.evaluate((sel) => {
  const el = document.querySelector(sel)
  if (!el) return null
  const c = el.cloneNode(true)
  c.querySelectorAll('rt').forEach((r) => r.remove())
  return c.textContent || ''
}, sel)

/* ① 声调音乐会：🔊 旁只显示不带调基础音节 */
{
  console.log('\n— ① 声调音乐会 目标侧去答 —')
  const page = await mkPage()
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  await page.tap('[data-stall="tone"]')
  await page.waitForSelector('#gcount', { timeout: 5000 })
  await page.waitForSelector('#gcount', { state: 'detached', timeout: 9000 })
  await page.waitForSelector('#gstage [data-tchip]', { timeout: 8000 })
  for (let r = 0; r < 3; r++) {
    const chip = await page.evaluate(() => ({
      text: document.querySelector('[data-tchip]')?.textContent?.trim() || '',
      syl: document.querySelector('[data-tchip]')?.getAttribute('data-syl') || '',
    }))
    ok(!TONE_MARK.test(chip.text) && /^[a-zü]+$/.test(chip.text), `音乐会 R${r + 1}：🔊 旁=纯基础音节（零调号）`, `"${chip.text}"`)
    ok(/^[a-z]+$/.test(chip.syl), `音乐会 R${r + 1}：data-syl=纯基础音节`, chip.syl)
    /* 玩一轮进下一题：接住目标音符（按 file 匹配） */
    await page.evaluate(() => {
      const t = document.querySelector('[data-tchip]')?.getAttribute('data-syl') || ''
      const n = [...document.querySelectorAll('#gstage [data-note]')].find((b) => (b.getAttribute('data-file') || '').startsWith(t))
      n?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    await sleep(900)
  }
  ok(errsAll.length === 0, '音乐会：零 pageerror', errsAll[0] || '')
  await page.close()
}

/* ② 镜像对决：口诀题题面零字母 + kj 题音频=谜面制 */
{
  console.log('\n— ② 镜像对决 口诀题面去答 —')
  const page = await mkPage()
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  await page.tap('[data-stall="duel"]')
  await page.waitForSelector('#gcount', { timeout: 5000 })
  await page.waitForSelector('#gcount', { state: 'detached', timeout: 9000 })
  let kjSeen = false, lettersSeen = false
  for (let r = 0; r < 12 && !kjSeen; r++) {
    await page.waitForSelector('[data-q]', { timeout: 8000 })
    const kjLine = await faceText(page, '.kjline')
    if (kjLine !== null) {
      ok(!LEAK.test(kjLine), `对决 R${r + 1}：口诀题面零字母（谜面化，剥 rt 后）`, `"${kjLine.trim()}"`)
      kjSeen = true
      /* kj 题的出题音=谜面（riddle/*），绝无整句 kj 原声 */
      const names = await page.evaluate(() => window.__AUDIO_LOG.map((e) => e.name))
      const last = names[names.length - 1] || ''
      ok(last.startsWith('riddle/'), `对决 R${r + 1}：kj 题出题音=谜面音频`, last)
      ok(!names.some((n) => n.startsWith('lessons/kj_')), `对决 R${r + 1}：全程零整句口诀原声（出题通道）`, names.join(','))
    } else {
      lettersSeen = true
      const names = await page.evaluate(() => window.__AUDIO_LOG.map((e) => e.name))
      const last = names[names.length - 1] || ''
      ok(last === safeName(await page.getAttribute('[data-q]', 'data-target')), `对决 R${r + 1}：字母题出题音=呼读音`, last)
    }
    /* 答题推进（点 qkey），inputLock 宽假期后点 */
    await sleep(650)
    await page.evaluate(() => {
      const b = document.querySelector('[data-opts] .duelopt[data-qkey]:not([data-qkey=""])')
      b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    await sleep(700)
  }
  ok(kjSeen || lettersSeen, '对决：至少验过一型题面')
  ok(errsAll.length === 0, '对决：零 pageerror', errsAll[0] || '')
  await page.close()
}

/* ③ 每日挑战 + 闯关 + 闪电：口诀题题面（bkj/kj）零字母 */
{
  console.log('\n— ③ 每日挑战/闯关/闪电 题面审计 —')
  /* 每日挑战：找 bkj 题（日期种子，10 题内遍历） */
  const page = await mkPage()
  await page.goto(`${BASE}/?open=daily`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-daily', { timeout: 8000 })
  let bkjChecked = false, bkjSeen = false
  for (let i = 0; i < 10 && !bkjChecked; i++) {
    const qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype').catch(() => null)
    if (qt === 'bkj') {
      const t = await faceText(page, '#v-daily .kjbig')
      ok(t !== null && !LEAK.test(t), `每日挑战 Q${i + 1}：bkj 题面零字母`, `"${(t || '').trim()}"`)
      bkjChecked = true; bkjSeen = true
    }
    /* 作答推进（选对） */
    const ans = await page.evaluate(() => { const D = window.__PJ.DC(); return D.qs[D.i]?.ans ?? -1 })
    if (ans < 0) break
    await page.tap(`#v-daily [data-opts] .opt:nth-of-type(${ans + 1})`)
    await sleep(1100)
  }
  ok(bkjSeen, '每日挑战：本次种子含 bkj 题（或全 zi/listen 无可查）', bkjSeen ? '' : 'no-bkj-today')
  await page.close()

  /* 闯关：进第 1 关 quiz，kj 题面零字母 */
  const page2 = await mkPage()
  await page2.goto(`${BASE}/?open=quiz`, { waitUntil: 'networkidle' })
  await page2.waitForSelector('#v-quiz', { timeout: 8000 })
  let kjQ = 0, listenFallback = 0
  for (let i = 0; i < 10; i++) {
    const t = await faceText(page2, '#v-quiz .ruletext')
    if (t !== null) {
      kjQ++
      ok(!LEAK.test(t), `闯关 Q${i + 1}：kj 题面零字母（谜面化）`, `"${t.trim()}"`)
    } else listenFallback++
    /* 作答推进（QZ 形状：q=当前题单对象；选项=onclick 两段式——双 click=arm+答） */
    const cur = await page2.evaluate(() => { const S = window.__PJ?.Q?.(); return S?.q ? { ans: S.q.ans, opts: S.q.opts.length } : null })
    if (!cur) break
    await page2.evaluate((ans) => {
      const b = document.querySelectorAll('#optbox .opt')[ans]
      b?.click(); b?.click()
    }, cur.ans)
    await sleep(1300)
  }
  ok(kjQ > 0, `闯关：kj 题面已审计 ${kjQ} 题（回退听写 ${listenFallback}）`)
  await page2.close()

  /* 闪电：bkj 题面零字母 */
  const page3 = await mkPage()
  await page3.goto(`${BASE}/?open=bolt`, { waitUntil: 'networkidle' })
  await page3.waitForSelector('#v-bolt', { timeout: 8000 })
  let boltBkj = 0
  for (let i = 0; i < 14 && boltBkj < 2; i++) {
    const t = await faceText(page3, '#v-bolt .ruletext')
    if (t !== null) {
      boltBkj++
      ok(!LEAK.test(t), `闪电 Q${i + 1}：bkj 题面零字母`, `"${t.trim()}"`)
    }
    const ans = await page3.evaluate(() => { const B = window.__PJ?.BT?.(); return B?.q?.ans ?? -1 })
    if (ans < 0) break
    await page3.evaluate((ans) => {
      document.querySelectorAll('#bopt .opt')[ans]?.click()
    }, ans)
    await sleep(450)
  }
  ok(boltBkj > 0, `闪电：bkj 题面已审计 ${boltBkj} 题`)
  await page3.close()
}

ok(errsAll.length === 0, '全程零 pageerror', errsAll.join(';'))
await browser.close()
console.log(`\nBug#41 回归样例：${pass} 过 / ${fail} 败`)
process.exit(fail ? 1 : 0)
