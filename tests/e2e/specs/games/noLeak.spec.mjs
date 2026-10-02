/* specs/games/noLeak —— 全游戏出题泄漏审计（Bug#41 回归门）：
   病灶：目标侧把答案写在题面上——音乐会 🔊 旁显示带调音节 "má"；对决/每日/闯关/闪电的口诀题面
   整句上屏（含答案字母）。修法=目标侧去答：音乐会只显基础音节；口诀题面谜面化（文字剥字母+音频 riddle/*）。
   泄漏判定：题面文字任何拉丁/带调字母都算答案标记（谜面=纯中文，剥 rt 注音后断言）。
   例外=音乐会基础音节 chip（不带调，法规明许）——其泄漏判定=带调符号出现。
   ① 音乐会：🔊 旁纯基础音节（零调号）×3 轮
   ② 对决：口诀题面零字母 + kj 题出题音=谜面 + 全程零整句口诀原声；字母题出题音=呼读音
   ③ 每日挑战 bkj 题面零字母；闯关 kj 题面零字母；闪电 bkj 题面零字母
   迁移自：regression-bug41-no-leak。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally, sleep } from '../../flows/assert.mjs'
import { enterGame, audioNames } from '../../flows/playGame.mjs'
import { answerDaily } from '../../flows/answerQuiz.mjs'
import { faceText } from '../../flows/gotoLesson.mjs'

const t = new Tally('games/noLeak 全游戏出题泄漏审计')
const app = new BootApp()
const LEAK = /[a-zA-Züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/
const TONE_MARK = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* ① 声调音乐会：🔊 旁只显示不带调基础音节 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await enterGame(page, 'tone')
  await page.waitForSelector('#gstage [data-tchip]', { timeout: 8000 })
  for (let r = 0; r < 3; r++) {
    const chip = await page.evaluate(() => ({
      text: document.querySelector('[data-tchip]')?.textContent?.trim() || '',
      syl: document.querySelector('[data-tchip]')?.getAttribute('data-syl') || '',
    }))
    t.ok(!TONE_MARK.test(chip.text) && /^[a-zü]+$/.test(chip.text), `音乐会 R${r + 1}：🔊 旁=纯基础音节（零调号）`, `"${chip.text}"`)
    t.ok(/^[a-z]+$/.test(chip.syl), `音乐会 R${r + 1}：data-syl=纯基础音节`, chip.syl)
    await page.evaluate(() => {
      const syl = document.querySelector('[data-tchip]')?.getAttribute('data-syl') || ''
      const n = [...document.querySelectorAll('#gstage [data-note]')].find((b) => (b.getAttribute('data-file') || '').startsWith(syl))
      n?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    await sleep(900)
  }
  await app.closePage(page)
}

/* ② 镜像对决：口诀题面零字母 + kj 题音频=谜面制 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await enterGame(page, 'duel')
  let kjSeen = false, lettersSeen = false
  for (let r = 0; r < 12 && !kjSeen; r++) {
    await page.waitForSelector('[data-q]', { timeout: 8000 })
    const kjLine = await faceText(page, '.kjline')
    if (kjLine !== null) {
      t.ok(!LEAK.test(kjLine), `对决 R${r + 1}：口诀题面零字母（谜面化，剥 rt 后）`, `"${kjLine.trim()}"`)
      kjSeen = true
      const names = await audioNames(page)
      const last = names[names.length - 1] || ''
      t.ok(last.startsWith('riddle/'), `对决 R${r + 1}：kj 题出题音=谜面音频`, last)
      t.ok(!names.some((n) => n.startsWith('lessons/kj_')), `对决 R${r + 1}：全程零整句口诀原声（出题通道）`)
    } else {
      lettersSeen = true
      const names = await audioNames(page)
      const last = names[names.length - 1] || ''
      const tgt = await page.getAttribute('[data-q]', 'data-target')
      const safe = (k) => (k === 'ü' ? 'v' : k)
      t.ok(last === safe(tgt), `对决 R${r + 1}：字母题出题音=呼读音`, last)
    }
    await sleep(650)
    await page.evaluate(() => {
      const b = document.querySelector('[data-opts] .duelopt[data-qkey]:not([data-qkey=""])')
      b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    await sleep(700)
  }
  t.ok(kjSeen || lettersSeen, '对决：至少验过一型题面')
  await app.closePage(page)
}

/* ③ 每日挑战 + 闯关 + 闪电：口诀题题面零字母 */
{
  /* 每日挑战：找 bkj 题（日期种子，10 题内遍历） */
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${BASE}/?open=daily`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-daily', { timeout: 8000 })
  let bkjChecked = false, bkjSeen = false
  for (let i = 0; i < 10 && !bkjChecked; i++) {
    const qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype').catch(() => null)
    if (qt === 'bkj') {
      const txt = await faceText(page, '#v-daily .kjbig')
      t.ok(txt !== null && !LEAK.test(txt), `每日挑战 Q${i + 1}：bkj 题面零字母`, `"${(txt || '').trim()}"`)
      bkjChecked = true; bkjSeen = true
    }
    const st = await answerDaily(page, { correct: true })
    if (!st) break
    await sleep(900)
  }
  t.ok(bkjSeen, '每日挑战：本次种子含 bkj 题（或全 zi/listen 无可查）', bkjSeen ? '' : 'no-bkj-today')
  await app.closePage(page)

  /* 闯关：进第 1 关 quiz，kj 题面零字母 */
  const page2 = await app.newPage({ tier: 'newbie', mute: false })
  await page2.goto(`${BASE}/?open=quiz`, { waitUntil: 'networkidle' })
  await page2.waitForSelector('#v-quiz', { timeout: 8000 })
  let kjQ = 0, listenFallback = 0
  for (let i = 0; i < 10; i++) {
    const txt = await faceText(page2, '#v-quiz .ruletext')
    if (txt !== null) {
      kjQ++
      t.ok(!LEAK.test(txt), `闯关 Q${i + 1}：kj 题面零字母（谜面化）`, `"${txt.trim()}"`)
    } else listenFallback++
    const cur = await page2.evaluate(() => { const S = window.__PJ?.Q?.(); return S?.q ? { ans: S.q.ans } : null })
    if (!cur) break
    await page2.evaluate((ans) => {
      const b = document.querySelectorAll('#optbox .opt')[ans]
      b?.click(); b?.click()   /* 两段式：双 click=arm+答 */
    }, cur.ans)
    await sleep(1300)
  }
  t.ok(kjQ > 0, `闯关：kj 题面已审计 ${kjQ} 题（回退听写 ${listenFallback}）`)
  await app.closePage(page2)

  /* 闪电：bkj 题面零字母 */
  const page3 = await app.newPage({ tier: 'mid', mute: false })
  await page3.goto(`${BASE}/?open=bolt`, { waitUntil: 'networkidle' })
  await page3.waitForSelector('#v-bolt', { timeout: 8000 })
  let boltBkj = 0
  for (let i = 0; i < 14 && boltBkj < 2; i++) {
    const txt = await faceText(page3, '#v-bolt .ruletext')
    if (txt !== null) {
      boltBkj++
      t.ok(!LEAK.test(txt), `闪电 Q${i + 1}：bkj 题面零字母`, `"${txt.trim()}"`)
    }
    const ans = await page3.evaluate(() => { const B = window.__PJ?.BT?.(); return B?.q?.ans ?? -1 })
    if (ans < 0) break
    await page3.evaluate((a) => { document.querySelectorAll('#bopt .opt')[a]?.click() }, ans)
    await sleep(450)
  }
  t.ok(boltBkj > 0, `闪电：bkj 题面已审计 ${boltBkj} 题`)
  await app.closePage(page3)
}

t.pageErrors(app.errors, 'noLeak 全程')
await app.close()
process.exit(t.finish())
