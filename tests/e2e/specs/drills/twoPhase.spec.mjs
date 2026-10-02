/* specs/drills/twoPhase —— 两段式试听适用矩阵（Bug#37 立法 + Bug#38 矩阵裁定）：
   立法：带调拼音选项（zi，孩子读不出）保留两段式——首点=播该选项音频+armed 高亮+零判分零推进，
   切点别项=切试听，再点同项才作答；字母选项题（blisten/bkj，视觉即身份）一点即答
   （试听=挨个点听暴力匹配，毁掉检索练习）。
   ① 每日挑战 zi 题：首点/切点/二点三段断言（音频或仅高亮——hyp 缺失立法明许）
   ② 学习岛声调小练（ToneDrill）：四声选项首点播 a1+高亮零判分 → 切点播 a2+armed 换位 →
      二点判分 → 反馈期干净推进（流程不被两段式卡死）
   ③ 每日挑战听音题 + 闯关听音题：一点即答（首点判分+零选项试听音）
   迁移自：regression-bug37-two-phase + v431-accept②（ToneDrill/闯关段）。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally, sleep } from '../../flows/assert.mjs'
import { advanceDailyToType } from '../../flows/answerQuiz.mjs'
import { openLesson, curScope } from '../../flows/gotoLesson.mjs'

const t = new Tally('drills/twoPhase 两段式适用矩阵')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* ① 每日挑战 zi 题（两段式保留面）+ 听音题（一点即答面） */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${BASE}/?open=daily`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-daily [data-qtype]', { timeout: 8000 })
  const tapOpt = (i) => page.tap(`#v-daily [data-opts] .opt:nth-of-type(${i + 1})`)
  const armedCls = (i) => page.evaluate((ix) => document.querySelector('#v-daily [data-opts] .opt:nth-of-type(' + (ix + 1) + ')').classList.contains('armed'), i)

  let qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype')
  let tries = 0
  while (qt !== 'zi' && tries++ < 11) {
    const a = await page.evaluate(() => window.__PJ.DC().qs[window.__PJ.DC().i].ans)
    await tapOpt(a)
    await sleep(1300)
    qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype')
  }
  t.ok(qt === 'zi', '每日挑战：zi 题（两段式保留面）就位', `qtype=${qt}`)
  if (qt === 'zi') {
    const ans = await page.evaluate(() => window.__PJ.DC().qs[window.__PJ.DC().i].ans)
    const wrongIdx = (ans + 1) % 4
    const score0 = await page.evaluate(() => window.__PJ.DC().score)
    const audio0 = await page.evaluate(() => window.__AUDIO_LOG.length)
    await tapOpt(wrongIdx)
    await sleep(250)
    const st1 = await page.evaluate(() => ({ log: window.__AUDIO_LOG.length, score: window.__PJ.DC().score, reveal: window.__PJ.DC().reveal }))
    t.ok(st1.log > audio0 || (await armedCls(wrongIdx)), 'zi 首点：试听反馈（音频或仅高亮——hyp 缺失立法明许）')
    t.ok(st1.score === score0 && st1.reveal === null, 'zi 首点：不计分不判分不推进')
    t.ok(await armedCls(wrongIdx), 'zi 首点：试听高亮态（armed）')
    await tapOpt(ans)
    await sleep(250)
    const st2 = await page.evaluate(() => ({ score: window.__PJ.DC().score, reveal: window.__PJ.DC().reveal }))
    t.ok(st2.score === score0 && st2.reveal === null, 'zi 切点别项：只切试听仍不判分')
    t.ok(await armedCls(ans), 'zi 切点：armed 换位到新项')
    await tapOpt(ans)
    await sleep(300)
    const st3 = await page.evaluate(() => ({ score: window.__PJ.DC().score, reveal: window.__PJ.DC().reveal }))
    t.ok(st3.reveal !== null, 'zi 再点同项：两段式第二段才判分', JSON.stringify(st3))
  }
  /* 矩阵另一侧：字母选项题（blisten/bkj）一点即答 */
  qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype')
  tries = 0
  while (qt === 'zi' && tries++ < 11) {
    const a = await page.evaluate(() => window.__PJ.DC().qs[window.__PJ.DC().i].ans)
    await tapOpt(a)
    await sleep(1300)
    qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype')
  }
  if (qt && qt !== 'zi') {
    const ans = await page.evaluate(() => window.__PJ.DC().qs[window.__PJ.DC().i].ans)
    const audio1 = await page.evaluate(() => window.__AUDIO_LOG.length)
    await tapOpt(ans)
    await sleep(250)
    const st4 = await page.evaluate(() => ({ reveal: window.__PJ.DC().reveal, i: window.__PJ.DC().i, log: window.__AUDIO_LOG.length }))
    t.ok(st4.reveal !== null, `矩阵：${qt} 字母选项一点即答（首点即判分）`)
    t.ok(st4.log === audio1, '矩阵：一点即答零选项试听音（检索练习不被暴力匹配替代）')
  }
  await app.closePage(page)
}

/* ② 学习岛声调小练（ToneDrill）：课 1 未过 + step{1:2} 预置 → 直落字母 a 的声调页 */
{
  const page = await app.newPage({
    tier: 'mid', mute: false,
    learn: { u: 4, stars: { 2: 3, 3: 3, 4: 2 }, best: { 2: 5, 3: 5, 4: 4 }, step: { 1: 2 } },
  })
  await openLesson(page, 1)
  await page.waitForSelector('#v-lesson .hstage > .hspage', { timeout: 8000 })
  const SC = '#v-lesson .hstage > .hspage:nth-child(2)'
  await page.tap(`${SC} .tonedrill .trow .btn.green`)
  await page.waitForSelector(`${SC} .tonedrill .topts .topt`, { timeout: 6000 })
  const optN = await page.$$eval(`${SC} .tonedrill .topts .topt`, (e) => e.length)
  t.ok(optN === 4, '声调小练：四个声调选项就位', `n=${optN}`)
  const st = () => page.evaluate((sel) => {
    const opts = Array.from(document.querySelectorAll(sel + ' .tonedrill .topts .topt'))
    const L = window.__AUDIO_LOG
    return {
      log: L.length, lastName: L.length ? L[L.length - 1].name : '',
      armed: opts.findIndex((e) => e.classList.contains('armed')),
      reveal: opts.some((e) => e.classList.contains('right') || e.classList.contains('wrong')),
      dotsOk: document.querySelectorAll(sel + ' .qprog .dot.ok').length,
    }
  }, SC)
  const audio0 = (await st()).log
  await page.tap(`${SC} .tonedrill .topts .topt:nth-of-type(1)`)
  await sleep(300)
  const s1 = await st()
  t.ok(s1.log > audio0 && s1.lastName === 'a1', '声调首点：播该调读音（hyp a1）', `+${s1.log - audio0} name=${s1.lastName}`)
  t.ok(s1.armed === 0 && !s1.reveal && s1.dotsOk === 0, '声调首点：试听高亮+零判分零推进', `armed=${s1.armed} reveal=${s1.reveal} dotsOk=${s1.dotsOk}`)
  await page.tap(`${SC} .tonedrill .topts .topt:nth-of-type(2)`)
  await sleep(300)
  const s2 = await st()
  t.ok(s2.log > s1.log && s2.lastName === 'a2', '声调切点别项：切试听（播新调 a2）', `+${s2.log - s1.log} name=${s2.lastName}`)
  t.ok(s2.armed === 1 && !s2.reveal, '声调切点：armed 随切换+仍零判分', `armed=${s2.armed} reveal=${s2.reveal}`)
  await page.tap(`${SC} .tonedrill .topts .topt:nth-of-type(2)`)
  await sleep(450)
  const s3 = await st()
  t.ok(s3.reveal && s3.armed === -1, '声调二点同项：才判分（reveal 出现+试听态收回）', `reveal=${s3.reveal} armed=${s3.armed}`)
  const s4 = await page.waitForFunction((sel) => {
    const opts = Array.from(document.querySelectorAll(sel + ' .tonedrill .topts .topt'))
    return opts.length === 4 && opts.every((e) => !e.classList.contains('right') && !e.classList.contains('wrong') && !e.classList.contains('armed'))
  }, SC, { timeout: 5000 }).then(() => true).catch(() => false)
  t.ok(s4, '声调判分后：反馈期结束推进下一题（干净态，流程未被两段式卡死）')
  await app.closePage(page)
}

/* ③ 闯关听音题（ListenQ）：一点即答 */
{
  const page = await app.newPage({ tier: 'newbie', mute: false })
  await page.goto(`${BASE}/?open=quiz`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#optbox .opt', { timeout: 8000 })
  const q = await page.evaluate(() => { const Q = window.__PJ.Q(); return { type: Q.q.type, ans: Q.q.ans } })
  t.ok(q.type === 'listen', '闯关：听音选字题就位', `type=${q.type}`)
  const audio0 = await page.evaluate(() => window.__AUDIO_LOG.length)
  await page.tap(`#optbox .opt:nth-of-type(${q.ans + 1})`)
  await sleep(300)
  const st2 = await page.evaluate(() => ({ reveal: window.__PJ.Q().reveal, score: window.__PJ.Q().score, log: window.__AUDIO_LOG.length }))
  t.ok(st2.reveal !== null && st2.score === 1, '闯关听音一点即答：首点即作答（v4.5 矩阵）', JSON.stringify(st2))
  t.ok(st2.log === audio0, '闯关听音一点即答：零选项试听音', `+${st2.log - audio0}`)
  await app.closePage(page)
}

t.pageErrors(app.errors, 'twoPhase 全程')
await app.close()
process.exit(t.finish())
