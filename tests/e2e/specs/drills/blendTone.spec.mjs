/* specs/drills/blendTone —— ✍️拼读专练 + 🎵声调专练（练习馆六入口之两专练）：
   各=首题故意答错（账本 err 写入）→ 加权生效（itemW>1）→ 种子复现（__PJ.wpick 固定种子 200 次
   抽样，加权项频次第一压过 4 对照项）→ 真实答 5 题（计数）→ 听音题出题自动读音 → 结算卡
   （已答/正确率/最高连对一致）
   迁移自：v43-accept ③④。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { answerBlend, answerToneQuiz } from '../../flows/answerQuiz.mjs'
import { ledgerOf } from '../../flows/seedState.mjs'

const t = new Tally('drills/blendTone 拼读+声调专练（账本加权复现）')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* —— 拼读专练 —— */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${BASE}/?open=blenddrill`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-bquiz [data-q]', { timeout: 8000 })

  /* 首题故意答错（账本写入+加权素材） */
  await page.waitForFunction(() => document.querySelector('#v-bquiz [data-q]')?.getAttribute('data-reveal') === '0', null, { timeout: 6000 })
  await page.waitForTimeout(520)   /* P1-2 进题宽限：首击在宽限后（CI 快机器上裸 tap 会落窗内被守卫正确拒绝） */
  const ans0 = await page.evaluate(() => +document.querySelector('#v-bquiz [data-q]').getAttribute('data-ans'))
  const wrongIdx = (ans0 + 1) % 4
  const wrongKey = await page.evaluate(() => document.querySelector('#v-bquiz [data-q]').getAttribute('data-target'))
  await page.tap(`#v-bquiz [data-opt][data-idx="${wrongIdx}"]`)
  await page.waitForTimeout(470)
  await page.tap(`#v-bquiz [data-opt][data-idx="${wrongIdx}"]`)
  await page.waitForTimeout(1400)
  const rec = (await ledgerOf(page)).items[wrongKey]
  t.ok(!!rec && rec.err >= 1, '账本写入：拼错对子 err=1', `key=${wrongKey} ` + JSON.stringify(rec))
  const wBad = await page.evaluate((k) => window.__PJ.itemW(k), wrongKey)
  t.ok(wBad > 1, '加权生效：错过的对子权重>1', `itemW(${wrongKey})=${wBad.toFixed(2)}`)
  /* 种子复现：错过的对子 vs 固定 4 对照项，200 次抽样——加权项频次必须压过任一对照 */
  const stat = await page.evaluate((k) => {
    const pool = window.__PJ.blendPool().filter((x) => x !== k)
    const set = [k, ...pool.slice(0, 4)]
    const draws = window.__PJ.wpick(set, 20261001)
    const cnt = {}
    let maxOther = 0
    for (const d of draws) cnt[d] = (cnt[d] || 0) + 1
    for (const d in cnt) if (d !== k) maxOther = Math.max(maxOther, cnt[d])
    return { n: draws.length, hit: cnt[k] || 0, maxOther }
  }, wrongKey)
  t.ok(stat.hit > 0 && stat.hit > stat.maxOther, '加权复现：错过的对子抽样频次第一（对 4 对照项）', JSON.stringify(stat))

  /* 真实答对 5 题 */
  for (let i = 0; i < 5; i++) {
    await page.waitForFunction(() => document.querySelector('#v-bquiz [data-q]')?.getAttribute('data-reveal') === '0', null, { timeout: 6000 })
    await answerBlend(page, { correct: true })
  }
  const answered = await page.getAttribute('#v-bquiz [data-answered]', 'data-answered')
  t.ok(+answered >= 6, '真实答 5 题（+1 错）已答计数', `answered=${answered}`)
  const audioNamesAll = await page.evaluate(() => window.__AUDIO_LOG.map((e) => e.name))
  t.ok(audioNamesAll.length > 0 && audioNamesAll.some((x) => /^([bpmfdtnlgkhjqxzcsyvw]|zh|ch|sh)[a-z]+[1-4]$/.test(x)), '听合成音选拆分：出题自动读音（声音先行）', audioNamesAll.slice(0, 4).join(','))
  /* 结算 */
  await page.tap('#v-bquiz [data-finish]')
  await page.waitForSelector('#v-bquiz [data-done]', { timeout: 5000 })
  const res = await page.evaluate(() => ({
    rn: document.querySelector('#v-bquiz [data-rn]').textContent,
    racc: document.querySelector('#v-bquiz [data-racc]').textContent,
    rstreak: document.querySelector('#v-bquiz [data-rstreak]').textContent,
  }))
  t.ok(res.rn === answered, '拼读专练结算：已答题数一致', JSON.stringify(res))
  t.ok(res.racc.endsWith('%') && res.rstreak.length > 0, '拼读专练结算：正确率+最高连对展示', JSON.stringify(res))
  await app.closePage(page)
}

/* —— 声调专练 —— */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${BASE}/?open=tonedrill`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-tquiz [data-q]', { timeout: 8000 })

  await page.waitForFunction(() => document.querySelector('#v-tquiz [data-q]')?.getAttribute('data-reveal') === '0', null, { timeout: 6000 })
  await page.waitForTimeout(520)   /* P1-2 进题宽限 */
  const ans0 = await page.evaluate(() => +document.querySelector('#v-tquiz [data-q]').getAttribute('data-ans'))
  const wrongIdx = (ans0 + 1) % 4
  const wrongKey = await page.evaluate(() => document.querySelector('#v-tquiz [data-q]').getAttribute('data-target'))
  await page.tap(`#v-tquiz [data-toneopt="${wrongIdx + 1}"]`)
  await page.waitForTimeout(470)
  await page.tap(`#v-tquiz [data-toneopt="${wrongIdx + 1}"]`)
  await page.waitForTimeout(1400)
  const rec = (await ledgerOf(page)).items[wrongKey]
  t.ok(!!rec && rec.err >= 1, '账本写入：听错的调 err=1', `key=${wrongKey} ` + JSON.stringify(rec))
  const wBad = await page.evaluate((k) => window.__PJ.itemW(k), wrongKey)
  t.ok(wBad > 1, '加权生效：听错的调权重>1', `itemW(${wrongKey})=${wBad.toFixed(2)}`)
  const stat = await page.evaluate((k) => {
    const pool = window.__PJ.tonePool().filter((x) => x !== k)
    const set = [k, ...pool.slice(0, 4)]
    const draws = window.__PJ.wpick(set, 20261002)
    const cnt = {}
    let maxOther = 0
    for (const d of draws) cnt[d] = (cnt[d] || 0) + 1
    for (const d in cnt) if (d !== k) maxOther = Math.max(maxOther, cnt[d])
    return { n: draws.length, hit: cnt[k] || 0, maxOther }
  }, wrongKey)
  t.ok(stat.hit > 0 && stat.hit > stat.maxOther, '加权复现：听错的调抽样频次第一（对 4 对照项）', JSON.stringify(stat))

  for (let i = 0; i < 5; i++) {
    await page.waitForFunction(() => document.querySelector('#v-tquiz [data-q]')?.getAttribute('data-reveal') === '0', null, { timeout: 6000 })
    await answerToneQuiz(page, { correct: true })
  }
  const answered = await page.getAttribute('#v-tquiz [data-answered]', 'data-answered')
  t.ok(+answered >= 6, '真实答 5 题（+1 错）已答计数', `answered=${answered}`)
  const audioNamesAll = await page.evaluate(() => window.__AUDIO_LOG.map((e) => e.name))
  t.ok(audioNamesAll.length > 0 && audioNamesAll.some((x) => /^[a-z]+[1-4]$/.test(x)), '听音选声调：出题自动读音', audioNamesAll.slice(0, 4).join(','))
  await page.tap('#v-tquiz [data-finish]')
  await page.waitForSelector('#v-tquiz [data-done]', { timeout: 5000 })
  const res = await page.evaluate(() => ({
    rn: document.querySelector('#v-tquiz [data-rn]').textContent,
    racc: document.querySelector('#v-tquiz [data-racc]').textContent,
  }))
  t.ok(res.rn === answered, '声调专练结算：已答题数一致', JSON.stringify(res))
  await app.closePage(page)
}

t.pageErrors(app.errors, 'blendTone 全程')
await app.close()
process.exit(t.finish())
