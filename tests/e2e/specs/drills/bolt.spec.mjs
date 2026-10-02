/* specs/drills/bolt —— ⚡闪电刷题（练习馆入口）：
   出题自动读音与题型匹配（blisten=呼读/bkj=谜面）→ 真实连答 5 题（计数/连对）→ HUD 实时计数
   → 提前结束 → 结算页（总题数/正确率/最长连对）→ 游戏账本双记（pinyin_game_v1）→ 退出回练习馆 hall 保持
   迁移自：v42-accept②。断言只写本文件。 */
import { BootApp, safeName } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { enterDrill, ck } from '../../flows/playGame.mjs'
import { answerBolt } from '../../flows/answerQuiz.mjs'
import { ledgerSum } from '../../flows/seedState.mjs'

const t = new Tally('drills/bolt 闪电刷题')
const app = new BootApp()

const page = await app.newPage({ tier: 'mid', mute: false })
await enterDrill(page)
await ck(page, '[data-drill="bolt"]')
await page.waitForSelector('#v-bolt', { timeout: 5000 })
await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })

/* 首题自动读音与题型一致（blisten=呼读音 / bkj=谜面朗读） */
const q0 = await page.evaluate(() => { const q = window.__PJ.BT().q; return { type: q.type, a: q.A, snd: q.sound } })
const a0 = await page.evaluate(() => window.__AUDIO_LOG[0].name)
const exp0 = q0.type === 'bkj' ? 'riddle/' + safeName(q0.a) : safeName(q0.snd)
t.ok(a0 === exp0, '闪电：出题自动读音（题型匹配 ' + q0.type + '）', `log=${a0} exp=${exp0}`)

/* 真实连答 5 题 */
for (let i = 0; i < 5; i++) {
  await page.waitForFunction(() => { const b = window.__PJ.BT(); return b.q && !b.reveal }, null, { timeout: 6000 })
  await answerBolt(page, { correct: true })
  await page.waitForTimeout(1000)
}
const bt = await page.evaluate(() => { const b = window.__PJ.BT(); return { n: b.n, ok: b.ok, streak: b.streak } })
t.ok(bt.n === 5 && bt.ok === 5 && bt.streak === 5, '闪电：连答 5 题计数/连对', JSON.stringify(bt))
const hud = await page.evaluate(() => document.getElementById('boltans').textContent)
t.ok(/5$/.test(hud.trim()), '闪电：HUD 已答=5', hud)

/* 提前结束 → 结算页 */
await ck(page, '#boltstop')
await page.waitForSelector('#boltresult', { timeout: 5000 })
const res = await page.evaluate(() => ({
  on: getComputedStyle(document.getElementById('boltresult')).display !== 'none',
  stats: !!document.getElementById('bstats'),
}))
t.ok(res.on && res.stats, '闪电：结算页出（总题数/正确率/最长连对）')

/* 游戏账本双记 */
const led = await ledgerSum(page)
t.ok(led.ok >= 5, '闪电：作答写入错误账本 pinyin_game_v1', 'okSum=' + led.ok)

/* 结算回练习馆（hall 保持） */
await ck(page, '#bhome')
await page.waitForSelector('#v-island', { timeout: 5000 })
t.ok(await page.evaluate(() => document.getElementById('v-island').getAttribute('data-hall')) === 'drill', '闪电：退出回练习馆（hall 保持）')

t.pageErrors(app.errors, 'bolt 全程')
await app.closePage(page)
await app.close()
process.exit(t.finish())
