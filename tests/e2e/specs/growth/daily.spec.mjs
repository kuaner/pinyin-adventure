/* specs/growth/daily —— 每日挑战种子链（升级体系事件链的一环）：
   ① 智能混编：10 题混编 + 题型结构（听写主导 ≥6 + 口诀 ≥1 + 识字 ≥1）
   ② 弱项加权：种 b 弱（err=8 且 last 久远）→ b 高频出现 ≥2
   ③ 种子同日稳定：刷新重 build 题面逐键一致（每日一换的"同日"侧）
   ④ 连击计分：真实作答 3 对 1 错 → score=30 + 答错清零后重计 + 账本记账
   迁移自：v40-accept⑦。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally, sleep } from '../../flows/assert.mjs'
import { answerDaily } from '../../flows/answerQuiz.mjs'
import { ledgerOf } from '../../flows/seedState.mjs'

const t = new Tally('growth/daily 每日挑战种子链')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

const page = await app.newPage({ tier: 'mid', mute: false, ledger: { letters: { b: { ok: 0, err: 8, last: -5 } } } })
await page.goto(`${BASE}/?open=daily`, { waitUntil: 'networkidle' })
await page.waitForSelector('#dqcard', { timeout: 8000 })

/* ① ② 混编结构 + 弱项加权 */
const mix = await page.evaluate(() => window.__PJ.DC().qs.map((q) => q.type).join(','))
const bCount = await page.evaluate(() => window.__PJ.DC().qs.filter((q) => q.A === 'b').length)
const types = mix.split(',')
t.ok(types.length === 10, '每日：10 题混编', mix)
t.ok(types.filter((x) => x === 'blisten').length >= 6 && types.filter((x) => x === 'bkj').length >= 1 && types.filter((x) => x === 'zi').length >= 1,
  '每日：题型结构（听写主导+口诀+识字）', mix)
t.ok(bCount >= 2, '每日：弱项字母 b 加权高频出现', 'b题数=' + bCount)

/* ③ 同日种子稳定 */
const q1 = await page.evaluate(() => window.__PJ.DC().qs.map((q) => q.type + ':' + (q.A || q.z?.h)).join('|'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('#dqcard', { timeout: 8000 })
const q2 = await page.evaluate(() => window.__PJ.DC().qs.map((q) => q.type + ':' + (q.A || q.z?.h)).join('|'))
t.ok(q1 === q2 && q1.split('|').length === 10, '每日：按日期种子，同日题面稳定（每日一换）', q2.slice(0, 60))

/* ④ 真实作答 3 对 1 错：连击计分 + 账本记账 */
let answered = 0
for (let i = 0; i < 10 && answered < 4; i++) {
  const wrong = answered === 2   /* 第 3 题故意答错 */
  const st = await answerDaily(page, { correct: !wrong })
  if (!st) { await sleep(300); continue }
  answered++
  await sleep(wrong ? 1400 : 700)
}
const dcState = await page.evaluate(() => { const d = window.__PJ.DC(); return { score: d.score, combo: d.combo, ok: d.ok } })
t.ok(dcState.score === 30, '每日：连击计分（10+10+错清+10=30）', 'score=' + dcState.score)
t.ok(dcState.combo === 1 && dcState.ok === 3, '每日：答错清零后重计（末题对→连击=1）', `combo=${dcState.combo} ok=${dcState.ok}`)
const led = await ledgerOf(page)
t.ok(Object.keys(led.letters || {}).length >= 2, '每日：作答写入错误账本', Object.keys(led.letters || {}).join(','))

t.pageErrors(app.errors, 'daily 全程')
await app.closePage(page)
await app.close()
process.exit(t.finish())
