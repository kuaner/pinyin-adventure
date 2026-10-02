/* specs/games/moleRiddle —— 口诀地鼠谜面制+练习制全链（Bug#39 回归门）：
   病灶：口诀"右下半圆 b b b"音频带答案字母=听到答案无回忆；且节奏快+超时自动换题。
   修法：谜面制（riddle/* 中文谜面，出题零答案读音）+练习制（无 60s 计时、点对才换题、
   错点晃动+地鼠不走+可重听谜面）+点对播整句口诀原声奖励。
   ① 谜面先行：首播=riddle/*，出题侧零 kj 原声、零呼读音
   ② 时序：谜面音先于探头（300ms 闸门）+ prompt data-riddle=1 + 谜面 chip 在
   ③ 练习制：零输入 7 秒零新题零结束（地鼠常驻）
   ④ 错点：晃动+清连击+地鼠不走+不换题
   ⑤ 🔊 重听=谜面再发
   ⑥ 点对：奖励=整句口诀原声（lessons/kj_*）→ 播完才换新题；口诀原声只出现一次
   ⑦ HUD 答对计数累计 + ✕=结束练习走结算（计分）
   ⑧ 摊位名=口诀打地鼠
   迁移自：regression-bug39-mole-riddle + v42-accept⑥。断言只写本文件。 */
import { BootApp, safeName } from '../../flows/bootApp.mjs'
import { Tally, sleep } from '../../flows/assert.mjs'
import { enterGame, enterGameDeep, whackTargetMole, readHud, audioNames, waitDom, pd } from '../../flows/playGame.mjs'

const t = new Tally('games/moleRiddle 口诀地鼠谜面制+练习制')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* ⑧ 摊位名 + 全链 ①-⑦ */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  const stallName = await page.evaluate(() => document.querySelector('[data-stall="mole"] .sname')?.textContent || '')
  const plain = (s) => s.replace(/[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s]/g, '')
  t.ok(plain(stallName) === '口诀打地鼠', '摊位名=口诀打地鼠', stallName)
  await enterGame(page, 'mole')
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })

  /* ① 谜面制出题 */
  const target1 = await page.evaluate(() => document.querySelector('[data-prompt]')?.getAttribute('data-target'))
  const names1 = await audioNames(page)
  t.ok(names1[0] === 'riddle/' + safeName(target1), `谜面先行：首播=riddle/${safeName(target1)}`, names1[0])
  t.ok(!names1.some((n) => n.startsWith('lessons/kj_')), '谜面制：出题侧零口诀原声（kj 只作点对奖励）', names1.join(','))
  t.ok(!names1.includes(safeName(target1)), '谜面制：目标呼读音未播（出题零答案读音）')

  /* ② 时序 + 谜面标识 + 共存保持 */
  const target = await page.getAttribute('[data-prompt]', 'data-target')
  const a = await page.evaluate((n) => window.__AUDIO_LOG.filter((e) => e.name === n)[0] || null, 'riddle/' + safeName(target))
  const upReady = await waitDom(page, 'mole-up')
  const up = await page.evaluate(() => window.__DOM_LOG.filter((e) => e.kind === 'mole-up')[0] || null)
  t.ok(upReady && !!a && !!up && a.t < up.t, '时序：谜面音频先于地鼠探头', `audio=${a && Math.round(a.t)} < up=${up && Math.round(up.t)}`)
  t.ok(upReady && !!a && !!up && up.t - a.t >= 250, '时序：探头挂声音开播 300ms 闸门后', `gap=${up && a && Math.round(up.t - a.t)}ms`)
  await page.waitForFunction(() => document.querySelectorAll('#gstage .mole.up').length >= 3, null, { timeout: 8000 }).catch(() => {})
  const upN = await page.evaluate(() => document.querySelectorAll('#gstage .mole.up').length)
  t.ok(upN >= 3, '共存立法保持：目标+干扰 ≥3 鼠同场', `up=${upN}`)
  const kjUI = await page.evaluate(() => ({
    rj: document.querySelector('[data-prompt]')?.getAttribute('data-riddle'),
    chip: !!document.querySelector('[data-riddlechip]'),
  }))
  t.ok(kjUI.rj === '1' && kjUI.chip, '谜面标识：prompt data-riddle=1 + 谜面 chip 在')

  /* ③ 练习制+驻留上限（v4.7 P2-9）：7s 内地鼠常驻零新题；超时缩回清连击+新回合谜面重发 */
  await sleep(1500)
  const s0 = await page.evaluate(() => ({ n: window.__AUDIO_LOG.length, up: document.querySelectorAll('#gstage .mole.up').length }))
  await sleep(4000)
  const s1 = await page.evaluate(() => ({
    n: window.__AUDIO_LOG.length, up: document.querySelectorAll('#gstage .mole.up').length,
    result: !!document.querySelector('#gresult'), score: document.querySelector('#gscore')?.textContent,
  }))
  t.ok(!s1.result, '练习制：零输入对局不结束（✕ 才结算）')
  t.ok(s1.n === s0.n, '练习制：驻留期内零新题（音频计数冻结）', `${s0.n}→${s1.n}`)
  t.ok(s1.up === s0.up && s1.up > 0, 'P2-9：地鼠驻留期内常驻不走（≥5s 实证）', `up ${s0.up}→${s1.up}`)
  /* 驻留上限：超时缩回 → 新回合（谜面重发），零分零星（超时=miss 罚） */
  const s2 = await page.waitForFunction(() => window.__AUDIO_LOG.length > 0 && window.__AUDIO_LOG[window.__AUDIO_LOG.length - 1].name.startsWith('riddle/'), null, { timeout: 12000 }).then(() => true).catch(() => false)
  t.ok(s2, 'P2-9：驻留超时→新回合谜面重发（缩回后声音先行重来）')
  t.ok(await page.evaluate(() => document.querySelector('#gscore')?.textContent) === '0', 'P2-9：超时缩回零得分（miss 罚不清分但零产出）')

  /* ④ 错点：晃动+不走+不换题+清连击 */
  const decoyLetter = await page.evaluate(() => {
    const tt = document.querySelector('[data-prompt]').getAttribute('data-target')
    const m = Array.from(document.querySelectorAll('#gstage .mole.up')).find((e) => e.getAttribute('data-letter') !== tt)
    if (!m) return null
    m.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    return m.getAttribute('data-letter')
  })
  t.ok(!!decoyLetter, '错点前置：干扰鼠在场', `decoy=${decoyLetter}`)
  await sleep(250)
  const w0 = await page.evaluate(() => ({
    n: window.__AUDIO_LOG.length,
    up: document.querySelectorAll('#gstage .mole.up').length,
    combo: document.querySelector('#gcombo')?.getAttribute('data-combo'),
    bad: document.querySelectorAll('#gstage .mole.bad').length,
  }))
  t.ok(w0.combo === '0' && w0.bad >= 1, '错点：清连击+晃动反馈', JSON.stringify(w0))
  await sleep(700)
  const w1 = await page.evaluate(() => ({
    n: window.__AUDIO_LOG.length, up: document.querySelectorAll('#gstage .mole.up').length,
    result: !!document.querySelector('#gresult'),
  }))
  t.ok(w1.n === w0.n && w1.up === s1.up && !w1.result, '错点：地鼠不走+不换题（点对才换题）', `n=${w0.n}→${w1.n} up=${s1.up}→${w1.up}`)

  /* ⑤ 🔊 重听谜面（练习制无超时换题——tap 时刻目标即稳态目标） */
  const c0 = await page.evaluate(() => window.__AUDIO_LOG.length)
  const tgtAtTap = await page.evaluate(() => document.querySelector('[data-prompt]').getAttribute('data-target'))
  await page.tap('[data-listen]')
  await sleep(400)
  const names2 = await audioNames(page)
  t.ok(names2[c0] === 'riddle/' + safeName(tgtAtTap), '🔊 重听=谜面音频再发', names2.slice(c0).join(','))

  /* ⑥ 点对：奖励整句口诀 → 播完换新题（riddle 计数 ≥3） */
  await pd(page, `#gstage .mole.up[data-letter="${tgtAtTap}"]`)
  await sleep(500)
  const names3 = await audioNames(page)
  const tgtHit = await page.evaluate(() => document.querySelector('[data-prompt]').getAttribute('data-target'))
  t.ok(names3[names3.length - 1] === 'lessons/kj_' + safeName(tgtHit), '点对奖励：整句口诀原声（lessons/kj_*）', names3[names3.length - 1])
  const advanced = await page.waitForFunction(() => window.__AUDIO_LOG.filter((e) => e.name.startsWith('riddle/')).length >= 3, null, { timeout: 10000 }).then(() => true).catch(() => false)
  const names4 = await audioNames(page)
  t.ok(advanced && names4[names4.length - 1].startsWith('riddle/'), '点对→口诀奖励播完→新题谜面再发（换题挂在奖励之后）')
  t.ok(names4.filter((n) => n.startsWith('lessons/kj_')).length === 1, '口诀原声只出现一次（奖励态，非出题态）')

  /* ⑥b 再答对一题（HUD 计数累计=2） */
  await page.waitForFunction(() => document.querySelectorAll('#gstage .mole.up').length >= 3, null, { timeout: 8000 })
  await pd(page, await page.evaluate(() => {
    const tt = document.querySelector('[data-prompt]').getAttribute('data-target')
    return `#gstage .mole.up[data-letter="${tt}"]`
  }))
  await sleep(400)
  const triesNow = await page.evaluate(() => document.querySelector('#gok')?.getAttribute('data-ok'))
  t.ok(triesNow === '2', '练习制 HUD：答对计数累计=2', `data-ok=${triesNow}`)

  /* ⑦ ✕=结束练习走结算 */
  await page.tap('[data-back="gamequit"]')
  await page.waitForSelector('#gresult', { timeout: 6000 })
  const fin = await page.evaluate(() => ({
    score: document.querySelector('#rscore')?.textContent,
    stars: document.querySelectorAll('#rstars .rstar').length,
    combo: document.querySelector('#rcombo')?.textContent,
  }))
  t.ok(fin.score === '20' && +fin.combo >= 2, '✕=结束练习走结算（两答对连击分=20）', JSON.stringify(fin))
  await app.closePage(page)
}

t.pageErrors(app.errors, 'moleRiddle 全程')
await app.close()
process.exit(t.finish())
