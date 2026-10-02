/* 回归命名样例 Bug#37「两段式试听」（自 v431-accept 抽出的最小可重复用例）。
   立法背景：v4.2c 前首点即判分——孩子点选项只是想听听它读什么，就被扣分清连击。
   本样例=该 bug 的回归门（每日挑战题面）：首点=播该选项音频+armed 高亮+零判分零推进；
   切点别项=切试听仍不判分；再点同项（两段式第二段）才作答计分。全程零 pageerror。
   修 bug 先写失败测试（tests/README.md 规矩①）——若两段式回退，本样例红灯。
   前置：preview 在 4173（或 BASE_URL），独立可跑：node tests/e2e/regression-bug37-two-phase.mjs */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) } else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) } }

const browser = await chromium.launch()
const LEARN0 = { u: 4, stars: { 1: 3, 2: 3, 3: 3, 4: 2 }, best: { 1: 5, 2: 5, 3: 5, 4: 4 }, step: {} }
const page = await browser.newPage({ ...devices['iPhone 13'], hasTouch: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.addInitScript(`
  window.__AUDIO_LOG = [];
  const _p = HTMLAudioElement.prototype.play;
  HTMLAudioElement.prototype.play = function () { window.__AUDIO_LOG.push(this.src); return _p.call(this) };
  localStorage.clear()
  localStorage.setItem('pinyin_v2', JSON.stringify({ weights: {}, stars: { 1: 3, 2: 3, 3: 2 }, cards: {}, hist: [], mute: false, bolt: { acc: 0, d: '', tacc: 0, td: '' }, days: {} }))
  localStorage.setItem('pinyin_learn', JSON.stringify(${JSON.stringify(LEARN0)}))
  localStorage.setItem('pinyin_growth_v1', JSON.stringify({ v: 1, stars: 40, badges: [], seenStage: 1, det: 3, tone: 2, boltPerf: false }))
`)

await page.goto(`${BASE}/?open=daily`, { waitUntil: 'networkidle' })
await page.waitForSelector('#v-daily [data-qtype]', { timeout: 8000 })

/* 每日挑战首题类型每日一抽：zi 题不适用两段式（设计上不自动读音），顺序答错推进到听音题 */
let qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype')
let tries = 0
while (qt === 'zi' && tries++ < 11) {
  const w = await page.evaluate(() => {
    const D = window.__PJ.DC()
    return (D.qs[D.i].ans + 1) % D.qs[D.i].opts.length
  })
  await page.tap(`#v-daily [data-opts] .opt:nth-of-type(${w + 1})`)
  await page.waitForTimeout(1900)
  qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype')
}
ok(qt !== 'zi', '每日挑战：听音题就位', `qtype=${qt}`)

const ans = await page.evaluate(() => window.__PJ.DC().qs[window.__PJ.DC().i].ans)
const i0 = await page.evaluate(() => window.__PJ.DC().i) /* 日期敏感修复：zi 跳题后 i≠0，断言用基线不用硬编码 */
const wrongIdx = (ans + 1) % 2
const tapOpt = (i) => page.tap(`#v-daily [data-opts] .opt:nth-of-type(${i + 1})`)
const armedCls = (i) => page.evaluate((ix) => document.querySelector('#v-daily [data-opts] .opt:nth-of-type(' + (ix + 1) + ')').classList.contains('armed'), i)

/* 第一段：首点=试听（播音+高亮），不计分不推进 */
const audio0 = await page.evaluate(() => window.__AUDIO_LOG.length)
await tapOpt(wrongIdx)
await page.waitForTimeout(250)
const st1 = await page.evaluate(() => ({ log: window.__AUDIO_LOG.length, score: window.__PJ.DC().score, reveal: window.__PJ.DC().reveal, i: window.__PJ.DC().i }))
ok(st1.log > audio0, 'Bug#37 首点：发起该选项音频', `+${st1.log - audio0} 条`)
ok(st1.score === 0 && st1.reveal === null && st1.i === i0, 'Bug#37 首点：不计分不判分不推进', JSON.stringify({ score: st1.score, reveal: !!st1.reveal }))
ok(await armedCls(wrongIdx), 'Bug#37 首点：试听高亮态（armed）')

/* 切点正确项=切试听：仍不判分 */
await tapOpt(ans)
await page.waitForTimeout(250)
const st2 = await page.evaluate(() => ({ score: window.__PJ.DC().score, reveal: window.__PJ.DC().reveal }))
ok(st2.score === 0 && st2.reveal === null, 'Bug#37 切点别项：只切试听仍不判分')
ok(await armedCls(ans), 'Bug#37 切点：armed 换位到新项')

/* 第二段：再点同项=作答判分 */
await tapOpt(ans)
await page.waitForTimeout(300)
const st3 = await page.evaluate(() => ({ score: window.__PJ.DC().score, reveal: window.__PJ.DC().reveal }))
ok(st3.reveal !== null && st3.score === 10, 'Bug#37 再点同项：两段式第二段才判分（+10）', JSON.stringify(st3))

ok(errs.length === 0, '零 pageerror', errs.join(';'))
await browser.close()
console.log(`\nBug#37 回归样例：${pass} 过 / ${fail} 败`)
process.exit(fail ? 1 : 0)
