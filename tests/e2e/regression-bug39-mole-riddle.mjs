/* 命名回归样例 Bug#39「口诀地鼠谜面制+点对才换题」（v4.5 修复回归门）。
   病灶：口诀"右下半圆 b b b"音频带答案字母——听口诀=听到答案，无回忆过程；且节奏快+超时自动换题
   （kuaner："你说口诀我去点具体的拼音，不要自动切换，我点对了才换下一题"）。
   修法：谜面制（riddle/* mimo 中文谜面，出题零答案读音）+练习制（无 60s 计时、点对才换题、
   错点晃动+地鼠不走+可重听谜面）+点对播整句口诀原声奖励。
   本样例=真实开局全链：谜面先行→无输入零推进（≥6s 窗实证）→错点晃动不走→🔊重听→
   点对奖励口诀→换题→✕结算练完啦。前置：preview 4173（或 BASE_URL）。
   独立可跑：node tests/e2e/regression-bug39-mole-riddle.mjs */
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

const browser = await chromium.launch()
const LEARN0 = { u: 4, stars: { 1: 3, 2: 3, 3: 3, 4: 2 }, best: { 1: 5, 2: 5, 3: 5, 4: 4 }, step: {} }
const page = await browser.newPage({ ...devices['iPhone 13'], hasTouch: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.addInitScript(`
  localStorage.clear()
  localStorage.setItem('pinyin_v2', JSON.stringify({ weights: {}, stars: { 1: 3, 2: 3, 3: 2 }, cards: {}, hist: [], mute: false, bolt: { acc: 0, d: '', tacc: 0, td: '' }, days: {} }))
  localStorage.setItem('pinyin_learn', JSON.stringify(${JSON.stringify(LEARN0)}))
  localStorage.setItem('pinyin_growth_v1', JSON.stringify({ v: 1, stars: 40, badges: [], seenStage: 1, det: 3, tone: 2, boltPerf: false }))
  window.__AUDIO_LOG = []
`)

await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
await page.waitForSelector('#v-island', { timeout: 8000 })
await page.tap('[data-stall="mole"]')
await page.waitForSelector('#gcount', { timeout: 5000 })
await page.waitForSelector('#gcount', { state: 'detached', timeout: 9000 })
await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })

const audioNames = () => page.evaluate(() => window.__AUDIO_LOG.map((e) => e.name))
const target = () => page.evaluate(() => document.querySelector('[data-prompt]')?.getAttribute('data-target'))

/* ① 谜面制出题：首播=riddle/*（零答案读音），出题侧零 kj 原声、零呼读音 */
const target1 = await target()
const names1 = await audioNames()
ok(names1[0] === 'riddle/' + safeName(target1), `谜面先行：首播=riddle/${safeName(target1)}`, names1[0])
ok(!names1.some((n) => n.startsWith('lessons/kj_')), '谜面制：出题侧零口诀原声（kj 只作点对奖励）', names1.join(','))
ok(!names1.includes(safeName(target1)), '谜面制：目标呼读音未播（出题零答案读音）')

/* ② 共存保持：目标鼠+≥2 干扰鼠同场（Bug#36 立法不回退） */
await page.waitForFunction(() => document.querySelectorAll('#gstage .mole.up').length >= 3, null, { timeout: 8000 }).catch(() => {})
const upN = await page.evaluate(() => document.querySelectorAll('#gstage .mole.up').length)
ok(upN >= 3, '共存立法保持：目标+干扰 ≥3 鼠同场', `up=${upN}`)

/* ③ 无输入零推进（练习制核心）：7 秒完全不动 → 音频计数冻结+地鼠不走+对局不结束 */
await sleep(1500)
const s0 = await page.evaluate(() => ({ n: window.__AUDIO_LOG.length, up: document.querySelectorAll('#gstage .mole.up').length }))
await sleep(7000)
const s1 = await page.evaluate(() => ({
  n: window.__AUDIO_LOG.length,
  up: document.querySelectorAll('#gstage .mole.up').length,
  result: !!document.querySelector('#gresult'),
  score: document.querySelector('#gscore')?.textContent,
}))
ok(!s1.result, '练习制：零输入对局不结束（无超时强制推进）')
ok(s1.n === s0.n, '练习制：7 秒零输入零新题（音频计数冻结）', `${s0.n}→${s1.n}`)
ok(s1.up === s0.up && s1.up > 0, '练习制：地鼠常驻不走（窗口 ≥6s 实证）', `up ${s0.up}→${s1.up}`)

/* ④ 错点：晃动+地鼠不走+不换题+清连击 */
const decoyLetter = await page.evaluate(() => {
  const t = document.querySelector('[data-prompt]').getAttribute('data-target')
  const m = Array.from(document.querySelectorAll('#gstage .mole.up')).find((e) => e.getAttribute('data-letter') !== t)
  if (!m) return null
  m.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  return m.getAttribute('data-letter')
})
ok(!!decoyLetter, '错点前置：干扰鼠在场', `decoy=${decoyLetter}`)
await sleep(250)
const w0 = await page.evaluate(() => ({
  n: window.__AUDIO_LOG.length,
  up: document.querySelectorAll('#gstage .mole.up').length,
  combo: document.querySelector('#gcombo')?.getAttribute('data-combo'),
  bad: document.querySelectorAll('#gstage .mole.bad').length,
}))
ok(w0.combo === '0' && w0.bad >= 1, '错点：清连击+晃动反馈', JSON.stringify(w0))
await sleep(700)
const w1 = await page.evaluate(() => ({
  n: window.__AUDIO_LOG.length,
  up: document.querySelectorAll('#gstage .mole.up').length,
  result: !!document.querySelector('#gresult'),
}))
ok(w1.n === w0.n && w1.up === s1.up && !w1.result, '错点：地鼠不走+不换题（点对才换题）', `n=${w0.n}→${w1.n} up=${s1.up}→${w1.up}`)

/* ⑤ 🔊 重听谜面 */
const c0 = await page.evaluate(() => window.__AUDIO_LOG.length)
const tgtAtTap = await target()
await page.tap('[data-listen]')
await sleep(400)
const names2 = await audioNames()
ok(names2[c0] === 'riddle/' + safeName(tgtAtTap), '🔊 重听=谜面音频再发', names2.slice(c0).join(','))

/* ⑥ 点对：奖励=整句口诀原声（lessons/kj_*）→ 播完才换新题（新 riddle）。
   等待条件=riddle 计数 ≥3（首题1+重听1+新题1）——重听谜面也带 riddle/ 前缀，≥2 会被提前满足 */
await page.evaluate(() => {
  const t = document.querySelector('[data-prompt]').getAttribute('data-target')
  const m = Array.from(document.querySelectorAll('#gstage .mole.up')).find((e) => e.getAttribute('data-letter') === t)
  m?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
})
await sleep(500)
const names3 = await audioNames()
const tgtHit = await target()
ok(names3[names3.length - 1] === 'lessons/kj_' + safeName(tgtHit), '点对奖励：整句口诀原声（lessons/kj_*）', names3[names3.length - 1])
const advanced = await page.waitForFunction(() => window.__AUDIO_LOG.filter((e) => e.name.startsWith('riddle/')).length >= 3, null, { timeout: 10000 }).then(() => true).catch(() => false)
const names4 = await audioNames()
ok(advanced && names4[names4.length - 1].startsWith('riddle/'), '点对→口诀奖励播完→新题谜面再发（换题挂在奖励之后）', names4.join(','))
ok(names4.filter((n) => n.startsWith('lessons/kj_')).length === 1, '口诀原声只出现一次（奖励态，非出题态）')

/* ⑥b 再答对一题（连击保留），答对数累计=2 */
await page.waitForFunction(() => document.querySelectorAll('#gstage .mole.up').length >= 3, null, { timeout: 8000 })
await page.evaluate(() => {
  const t = document.querySelector('[data-prompt]').getAttribute('data-target')
  const m = Array.from(document.querySelectorAll('#gstage .mole.up')).find((e) => e.getAttribute('data-letter') === t)
  m?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
})
await sleep(400)
const triesNow = await page.evaluate(() => document.querySelector('#gok')?.getAttribute('data-ok'))
ok(triesNow === '2', '练习制 HUD：答对计数累计=2', `data-ok=${triesNow}`)

/* ⑦ 练习制结算：✕=结束练习 → 练完啦+计分（产星档由 starsFor 公式管，v32/v40 段覆盖） */
await page.tap('[data-back="gamequit"]')
await page.waitForSelector('#gresult', { timeout: 6000 })
const fin = await page.evaluate(() => ({
  score: document.querySelector('#rscore')?.textContent,
  stars: document.querySelectorAll('#rstars .rstar').length,
  combo: document.querySelector('#rcombo')?.textContent,
}))
ok(fin.score === '20' && +fin.combo >= 2, '✕=结束练习走结算（两答对连击分=20）', JSON.stringify(fin))
ok(errs.length === 0, '零 pageerror', errs.join(';'))

await page.close()
await browser.close()
console.log(`\nBug#39 回归样例：${pass} 过 / ${fail} 败`)
process.exit(fail ? 1 : 0)
