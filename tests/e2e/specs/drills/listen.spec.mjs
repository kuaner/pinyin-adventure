/* specs/drills/listen —— ✍️听写专练：
   A. 一点即答矩阵（独立局）：错答零选项试听音（首点即判分=错也记）+ 点对即判分
   B. 出题自动读音（呼读音）→ 二选一 → 连答 3 题计数+正确率 100% → 只练弱项开关
      （种 a err=4 → 下一题目标=弱项字母）→ 作答写入游戏错误账本 → 退出回练习馆 hall 保持
   迁移自：v42-accept③ + v431-accept②（听写一点即答段）。断言只写本文件。 */
import { BootApp, safeName } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { enterDrill, ck } from '../../flows/playGame.mjs'
import { answerLdrill } from '../../flows/answerQuiz.mjs'
import { ledgerSum } from '../../flows/seedState.mjs'

const t = new Tally('drills/listen 听写专练')
const app = new BootApp()

/* A · 一点即答矩阵（独立局） */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${process.env.BASE_URL || 'http://localhost:4173'}/?open=ldrill`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-ldrill [data-q][data-target]', { timeout: 8000 })
  const target = await page.getAttribute('#v-ldrill [data-q]', 'data-target')
  const audio0 = await page.evaluate(() => window.__AUDIO_LOG.length)
  const wrong = await page.evaluate((tgt) => {
    const ks = Array.from(document.querySelectorAll('#v-ldrill [data-opts] .opt')).map((e) => e.getAttribute('data-opt'))
    return ks.find((k) => k !== tgt)
  }, target)
  await page.evaluate((k) => {
    const opt = Array.from(document.querySelectorAll('#v-ldrill [data-opt]')).find((e) => e.getAttribute('data-opt') === k)
    opt?.click()
  }, wrong)
  await page.waitForTimeout(250)
  const st1 = await page.evaluate(() => ({
    log: window.__AUDIO_LOG.length, n: document.querySelector('#v-ldrill [data-answered]').getAttribute('data-answered'),
  }))
  t.ok(st1.log === audio0, '听写一点即答：错答零选项试听音（矩阵）', `+${st1.log - audio0}`)
  await answerLdrill(page, { correct: true })
  await page.waitForTimeout(700)
  const st2 = await page.evaluate(() => document.querySelector('#v-ldrill [data-answered]').getAttribute('data-answered'))
  t.ok(st2 === '1', '听写一点即答：点对即判分（已答 1）', `answered=${st2}`)
  await app.closePage(page)
}

/* B · 自动读音 + 连答 + 弱项开关 */
{
  const page = await app.newPage({
    tier: 'mid', mute: false,
    ledger: { letters: { a: { ok: 0, err: 4 } } },
  })
  await enterDrill(page)
  await ck(page, '[data-drill="listen"]')
  await page.waitForSelector('#v-ldrill', { timeout: 5000 })
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })

  const t0 = await page.evaluate(() => document.querySelector('#v-ldrill [data-q]').getAttribute('data-target'))
  const a0 = await page.evaluate(() => window.__AUDIO_LOG[0].name)
  t.ok(a0 === safeName(t0), '听写：出题自动读音（呼读音）', `target=${t0} log=${a0}`)
  t.ok(await page.evaluate(() => document.querySelectorAll('#v-ldrill [data-opts] .opt').length) === 2, '听写：二选一')

  /* 连答 3 题 */
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction(() => document.querySelector('#v-ldrill [data-q]')?.getAttribute('data-reveal') === '0', null, { timeout: 6000 })
    await answerLdrill(page, { correct: true })
    await page.waitForTimeout(1200)
  }
  const st = await page.evaluate(() => ({
    answered: document.querySelector('#v-ldrill [data-answered]').getAttribute('data-answered'),
    acc: document.querySelector('#v-ldrill [data-acc]').textContent,
  }))
  t.ok(st.answered === '3' && /100%/.test(st.acc), '听写：连答 3 题计数+正确率', JSON.stringify(st))

  /* 只练弱项开关：开启后下一题目标必为弱项池字母（种了 a err=4） */
  await ck(page, '[data-weaktoggle]')
  await page.waitForTimeout(300)
  const tg = await page.evaluate(() => ({
    on: document.querySelector('[data-weaktoggle]').classList.contains('on'),
    note: !!document.querySelector('[data-weaknote]'),
    pressed: document.querySelector('[data-weaktoggle]').getAttribute('aria-pressed'),
  }))
  t.ok(tg.on && tg.note && tg.pressed === 'true', '只练弱项：开关开+说明文案出')
  await page.waitForFunction(() => document.querySelector('#v-ldrill [data-q]')?.getAttribute('data-reveal') === '0', null, { timeout: 6000 })
  await answerLdrill(page, { correct: true })
  await page.waitForTimeout(1500)
  const t1 = await page.evaluate(() => document.querySelector('#v-ldrill [data-q]').getAttribute('data-target'))
  t.ok(t1 === 'a', '只练弱项：开弱项后目标=弱项字母 a', 'target=' + t1)

  const led = await ledgerSum(page)
  const ledRaw = await page.evaluate(() => JSON.parse(localStorage.getItem('pinyin_game_v1')).letters)
  t.ok(ledRaw.a && ledRaw.a.ok >= 1 && led.ok >= 4, '听写：作答写入游戏错误账本', JSON.stringify({ a: ledRaw.a, okSum: led.ok }))
  await ck(page, '[data-back="ldrillquit"]')
  await page.waitForSelector('#v-island', { timeout: 5000 })
  t.ok(await page.evaluate(() => document.getElementById('v-island').getAttribute('data-hall')) === 'drill', '听写：退出回练习馆（hall 保持）')
  await app.closePage(page)
}

t.pageErrors(app.errors, 'listen 全程')
await app.close()
process.exit(t.finish())
