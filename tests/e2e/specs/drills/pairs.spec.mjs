/* specs/drills/pairs —— 🔄易混对特训：
   b↔d chip 带多练小进度标（账本 err 派生 weak 标）→ 整组开练 → 10 题会话真实答 3 题
   → 作答写入游戏错误账本（字母题双记）→ quiz 退出回练习 tab
   迁移自：v42-accept④。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { enterDrill, ck } from '../../flows/playGame.mjs'
import { answerQZ } from '../../flows/answerQuiz.mjs'

const t = new Tally('drills/pairs 易混对特训')
const app = new BootApp()

const page = await app.newPage({
  tier: 'mid',
  ledger: { letters: { b: { ok: 0, err: 3 }, d: { ok: 5, err: 0 } } },
})
await enterDrill(page)
await ck(page, '[data-drill="pairs"]')
await page.waitForSelector('#v-pairs', { timeout: 5000 })

/* weak 小进度标（账本 err 派生） */
const chip = await page.evaluate(() => {
  const c = Array.from(document.querySelectorAll('#v-pairs .chip')).find((e) => e.textContent.includes('b ↔ d'))
  return { weak: c?.classList.contains('weak'), tag: c?.querySelector('[data-ptag]')?.getAttribute('data-ptag') }
})
t.ok(chip.weak && chip.tag === 'weak', '易混对：b↔d chip 带多练小进度标（账本 err 派生）', JSON.stringify(chip))

/* 整组开练 → 10 题会话，真实答 3 题 */
await ck(page, '#v-pairs .gstart')
await page.waitForSelector('#v-quiz', { timeout: 5000 })
for (let i = 0; i < 3; i++) {
  await page.waitForFunction(() => { const q = window.__PJ.Q(); return q.q && !q.reveal && !q.fb }, null, { timeout: 6000 })
  await answerQZ(page, { correct: true })
}
const qs = await page.evaluate(() => window.__PJ.Q().score)
t.ok(qs === 3, '易混对：开练真实答对 3 题', 'score=' + qs)
const ledRaw = await page.evaluate(() => JSON.parse(localStorage.getItem('pinyin_game_v1')).letters)
const ledB = (ledRaw.b?.ok || 0) + (ledRaw.d?.ok || 0) + (ledRaw.n?.ok || 0)
t.ok(ledB >= 1, '易混对：作答写入游戏错误账本（字母题双记）', 'okSum=' + ledB)
await ck(page, '[data-back="quit"]')   /* quiz 视图退出键（quitQuiz → 练习 tab） */
await page.waitForSelector('#v-island', { timeout: 5000 })
t.ok(true, '易混对：退出回练习 tab')

t.pageErrors(app.errors, 'pairs 全程')
await app.closePage(page)
await app.close()
process.exit(t.finish())
