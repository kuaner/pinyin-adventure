/* specs/games/playScoring —— 计分连击 + 错误账本 + 退场结算（星星经济）：
   ① 气球连点 3 球=40 分（c3 起 x2）→ 6 连=110 分+×3 倍率章 → 点错清连击 → 账本 ok/err 记账 →
      退出常在无惩罚回岛
   ② 地鼠敲中 ≥3（弱项种子 → 目标高频+镜像陷阱在场）
   ③ 对决答对推绳得分/答错绳回撤+账本（输赢两向）
   ④ 完整一局结算：产星+每日星账（上限10/日）+best 刷新+星星飞入小鸡成长+庆祝仪式+再玩一次重开
   迁移自：v40-accept ②③④⑥。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { enterGameDeep, waitCurTarget, tapIfTarget, whackTargetMole, readHud, streakScore, pd, ck } from '../../flows/playGame.mjs'
import { answerDuel, waitDuelNextQ } from '../../flows/answerQuiz.mjs'
import { ledgerSum, storeOf } from '../../flows/seedState.mjs'

const t = new Tally('games/playScoring 计分连击+账本+退场结算')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* ① 气球：连击倍率计分 + 清连击 + 账本 + 退出 */
{
  const page = await app.newPage({ tier: 'mid' })
  await enterGameDeep(page, 'balloon', 'play')
  await pd(page, '[data-listen]')
  await page.waitForTimeout(300)
  let popped = 0
  for (let i = 0; i < 10 && popped < 3; i++) {
    const tt = await waitCurTarget(page, '#gstage .balloon[data-letter="{t}"]', 8000)
    if (tt && await tapIfTarget(page, '#gstage .balloon[data-letter="{t}"]', tt)) popped++
    await page.waitForTimeout(900)
  }
  let s = await page.evaluate(() => ({ score: window.__PJ.GS().score, combo: window.__PJ.GS().combo }))
  t.ok(s.score === streakScore(3) && s.score === 40, '气球：连点 3 球 得分=40（c3 起 x2）', 'score=' + s.score)
  t.ok(s.combo === 3, '气球：连击=3')
  popped = 0
  for (let i = 0; i < 10 && popped < 3; i++) {
    const tt = await waitCurTarget(page, '#gstage .balloon[data-letter="{t}"]', 8000)
    if (tt && await tapIfTarget(page, '#gstage .balloon[data-letter="{t}"]', tt)) popped++
    await page.waitForTimeout(900)
  }
  s = await page.evaluate(() => ({ score: window.__PJ.GS().score, combo: window.__PJ.GS().combo, mult: document.getElementById('gmult')?.getAttribute('data-mult') }))
  t.ok(s.score === streakScore(6), '气球：x2/x3 倍率计分（6 连=110）', 'score=' + s.score)
  t.ok(String(s.mult) === '3', '气球：连击≥6 出现 ×3 倍率章', 'mult=' + s.mult)
  /* 点错球 → 清连击 */
  const wrongK = await page.waitForFunction(() => {
    const tt = window.__PJ.GS().target
    const b = Array.from(document.querySelectorAll('#gstage .balloon')).find((e) => e.getAttribute('data-letter') !== tt)
    return b ? b.getAttribute('data-letter') : null
  }, null, { timeout: 8000 }).then((h) => h.jsonValue()).catch(() => null)
  if (wrongK) {
    await page.evaluate((letter) => {
      const b = Array.from(document.querySelectorAll('#gstage .balloon')).find((e) => e.getAttribute('data-letter') === letter)
      b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }, wrongK)
    await page.waitForTimeout(400)
  }
  s = await page.evaluate(() => window.__PJ.GS().combo)
  t.ok(s === 0, '气球：点错清连击', 'wrong=' + wrongK)
  const led = await ledgerSum(page)
  t.ok(led.ok >= 6, '气球：错误账本 ok 记账≥6', 'okSum=' + led.ok)
  t.ok(led.err >= 1, '气球：错误账本 err 记账（点错球）', 'errSum=' + led.err)
  await ck(page, '[data-back="gamequit"]')
  await page.waitForTimeout(400)
  t.ok(await page.evaluate(() => !!document.getElementById('v-island')), '气球：退出常在无惩罚回岛')
  await app.closePage(page)
}

/* ② 地鼠：弱项种子 → 目标高频 + 镜像陷阱在场 + 敲中计分 */
{
  const page = await app.newPage({ tier: 'mid', ledger: { letters: { b: { ok: 0, err: 5 } } } })
  await enterGameDeep(page, 'mole', 'play')
  await pd(page, '[data-listen]')
  await page.waitForTimeout(800)
  let hitOk = 0, trapSeen = false
  for (let i = 0; i < 12 && !(hitOk >= 3 && trapSeen); i++) {
    const tt = await waitCurTarget(page, '#gstage .mole[data-letter="{t}"].up', 5000)
    if (!tt) continue
    const round = await page.evaluate(() => Array.from(document.querySelectorAll('#gstage .mole.up')).map((e) => e.getAttribute('data-letter')))
    const mirror = { b: 'd', d: 'b', p: 'q', q: 'p' }[tt]
    if (mirror && round.includes(mirror)) trapSeen = true
    if (await whackTargetMole(page)) hitOk++
    await page.waitForTimeout(500)
  }
  const ms = await readHud(page)
  t.ok(hitOk >= 3 && +ms.score >= 30, '地鼠：敲中≥3 只 得分入账', `hits=${hitOk} score=${ms.score}`)
  t.ok(trapSeen, '地鼠：镜像对陷阱在场（搭档同轮探头）')
  await app.closePage(page)
}

/* ③ 对决：答对推绳 + 答错被推 + 账本（弱项种子 → 出题偏向） */
{
  const page = await app.newPage({ tier: 'mid', ledger: { letters: { b: { ok: 0, err: 3 }, d: { ok: 9, err: 0 } } } })
  await enterGameDeep(page, 'duel', 'play')
  const pos0 = await page.evaluate(() => parseFloat(document.querySelector('[data-rope]').style.left))
  await page.waitForSelector('[data-q]', { timeout: 6000 })
  await page.waitForTimeout(700)   /* v4.5 输入闸：newQ 后 320ms 宽假期忽略输入——出题后等 700ms 再答 */
  let ansOk = 0
  for (let i = 0; i < 2; i++) {
    const done = await answerDuel(page, { correct: true })
    if (!done) break
    ansOk++
    await page.waitForTimeout(800)   /* 答对换题 +320 + 宽假期 320 = 640ms 后开门 */
  }
  const pos1 = await page.evaluate(() => parseFloat(document.querySelector('[data-rope]').style.left))
  const ds = await page.evaluate(() => ({ score: window.__PJ.GS().score, combo: window.__PJ.GS().combo }))
  t.ok(ansOk === 2 && ds.score === 20, '拔河：答对推绳得分', `ansOk=${ansOk} score=${ds.score}`)
  t.ok(pos1 > pos0 + 8, '拔河：绳子推向敌方', `${pos0}%→${pos1}%`)
  /* 答错 2 次：绳被推回 + 错误账本 */
  const p2 = await page.evaluate(() => parseFloat(document.querySelector('[data-rope]').style.left))
  const ledBefore = (await ledgerSum(page)).err
  for (let i = 0; i < 2; i++) {
    await answerDuel(page, { correct: false })
    await page.waitForTimeout(1650)   /* 答错换题 +1050 + 宽假期 320 */
  }
  const p3 = await page.evaluate(() => parseFloat(document.querySelector('[data-rope]').style.left))
  t.ok(p3 < p2 - 5, '拔河：答错被推向我方（绳回撤）', `${p2}%→${p3}%`)
  const ledAfter = (await ledgerSum(page)).err
  t.ok(ledAfter >= ledBefore + 2, '拔河：答错写入错误账本', `${ledBefore}→${ledAfter}`)
  await app.closePage(page)
}

/* ④ 完整一局：结算接线（endGame → 产星/成长/庆祝/结算层/再玩） */
{
  const page = await app.newPage({ tier: 'mid' })
  await enterGameDeep(page, 'balloon', 'play')
  let popped6 = 0
  for (let i = 0; i < 12 && popped6 < 5; i++) {
    const tt = await waitCurTarget(page, '#gstage .balloon[data-letter="{t}"]', 8000)
    if (tt && await tapIfTarget(page, '#gstage .balloon[data-letter="{t}"]', tt)) popped6++
    await page.waitForTimeout(900)
  }
  const g0 = await storeOf(page, 'pinyin_growth_v1')
  await page.evaluate(() => window.__PJ.endGame())
  const ceSeen = await page.waitForSelector('#celebrate[data-ce="game"]', { timeout: 2500 }).then(() => true).catch(() => false)
  t.ok(ceSeen, '结算：星星飞入庆祝仪式（game 模式 overlay）')
  await page.waitForSelector('#gresult', { timeout: 6000 })
  const res = await page.evaluate(() => ({
    score: window.__PJ.GS().score,
    stars: window.__PJ.GS().stars,
    best: JSON.parse(localStorage.getItem('pinyin_game_v1')).games.balloon.best,
    starsToday: JSON.parse(localStorage.getItem('pinyin_game_v1')).games.balloon.starsToday,
    growth: JSON.parse(localStorage.getItem('pinyin_growth_v1')).stars,
  }))
  t.ok(res.score === 80 && res.best >= res.score, '结算：得分入账 + best 刷新', JSON.stringify(res))
  t.ok(res.stars >= 1 && res.starsToday === res.stars, '结算：产星 + 每日星账（上限10/日）', `stars=${res.stars}`)
  t.ok(res.growth === g0.stars + res.stars, '结算：星星飞入小鸡成长体系', `${g0.stars}→${res.growth}`)
  await page.evaluate(() => document.getElementById('celebrate')?.click())
  await page.waitForTimeout(2500)
  await ck(page, '#gagain')
  await page.waitForSelector('#gcount', { timeout: 6000 })
  t.ok(true, '结算：再玩一次 → 倒计时重开')
  await app.closePage(page)
}

t.pageErrors(app.errors, 'playScoring 全程')
await app.close()
process.exit(t.finish())
