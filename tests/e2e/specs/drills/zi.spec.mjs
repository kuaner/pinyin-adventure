/* specs/drills/zi —— 📖识字表闯关：
   180 字全网格 + 解锁数=学习进度派生（node 侧同算法复算期望）+ 锁定字温和提示不误触进练
   → 看字题零自动播（v4.1 边界）→ 两段式真实答 3 题 → Z: 字级权重写入 → 🔊 点播字音可用
   迁移自：v42-accept⑤ + v431-accept②（识字表两段式段）。断言只写本文件。 */
import fs from 'node:fs'
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { enterDrill, ck } from '../../flows/playGame.mjs'
import { ziStart, answerZi } from '../../flows/answerQuiz.mjs'
import { storeOf } from '../../flows/seedState.mjs'

const t = new Tally('drills/zi 识字表闯关')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* node 侧同算法算期望解锁数（learned=L1..L4，与 src/lib/ziGate 同式） */
const lessons = JSON.parse(fs.readFileSync('src/data/lessons.json', 'utf8')).lessons
const learned = new Set()
for (const l of lessons) if (l.n <= 4) for (const e of l.letters) learned.add(e.k)
const ZI = JSON.parse(fs.readFileSync('src/data/zi180.json', 'utf8'))
const TONEV = 'āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ'
const clean = (py) => [...py].map((ch) => { const i = TONEV.indexOf(ch); return i >= 0 ? 'aoeiuv'[Math.floor(i / 4)] : ch }).join('')
const INIS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']
const splitC = (py) => { for (const ini of INIS) { if (py.indexOf(ini) === 0) return [ini, py.slice(ini.length)] } return ['', py] }
const covF = (f) => {
  if (!f || learned.has(f)) return true
  let i = 0
  while (i < f.length) {
    let m = false
    for (let len = Math.min(3, f.length - i); len >= 1; len--) {
      if (learned.has(f.slice(i, i + len))) { i += len; m = true; break }
    }
    if (!m) return false
  }
  return true
}
const expectUnlock = ZI.filter((z) => { const [ini, fin] = splitC(clean(z.p)); return (!ini || learned.has(ini)) && covF(fin) }).length

const page = await app.newPage({ tier: 'mid', mute: false })
await enterDrill(page)

/* 解锁态 */
const logBefore = await page.evaluate(() => window.__AUDIO_LOG.length)
await ck(page, '[data-drill="zi"]')
await page.waitForSelector('#v-zihall', { timeout: 5000 })
const grid = await page.evaluate(() => {
  const cells = Array.from(document.querySelectorAll('#v-zihall .zcell'))
  return {
    total: cells.length,
    unlocked: cells.filter((e) => e.getAttribute('data-locked') === '0').length,
    locked: cells.filter((e) => e.getAttribute('data-locked') === '1').length,
    prog: document.querySelector('[data-ziProg]').textContent.replace(/\s/g, ''),
  }
})
t.ok(grid.total === 180, '识字表：180 字全网格')
t.ok(grid.unlocked === expectUnlock && expectUnlock > 0, `识字表：解锁数=学习进度派生（期望 ${expectUnlock}）`, `dom=${grid.unlocked}`)
t.ok(grid.locked > 0 && grid.unlocked + grid.locked === 180, '识字表：锁定态在网格（先解锁已学字母相关的字）')
t.ok(/\d+\/180/.test(grid.prog), '识字表：进度角标（已解锁 n/180）', grid.prog)

/* 锁定字点击=温和提示不进练 */
await page.evaluate(() => {
  const c = Array.from(document.querySelectorAll('#v-zihall .zcell')).find((e) => e.getAttribute('data-locked') === '1')
  c?.click()
})
await page.waitForTimeout(400)
t.ok(await page.evaluate(() => document.getElementById('toast').classList.contains('on')), '识字表：点锁定字=温和提示（不误触进练）')

/* 点解锁字开练：看字题零自动播（v4.1 边界） */
const logAtStart = await page.evaluate(() => window.__AUDIO_LOG.length)
await ziStart(page, 1)
await page.waitForTimeout(500)
const logQ = await page.evaluate(() => window.__AUDIO_LOG.length)
t.ok(logQ === logAtStart, '识字表：看字题不播答案音（v4.1 边界）', `log ${logAtStart}→${logQ}`)

/* 真实答 3 题（4 选拼音，两段式） */
for (let i = 0; i < 3; i++) {
  await page.waitForFunction(() => document.querySelector('#v-zihall [data-q]')?.getAttribute('data-reveal') === '0', null, { timeout: 6000 })
  await answerZi(page, { correct: true })
  await page.waitForTimeout(1000)
}
const zst = await page.evaluate(() => ({
  answered: document.querySelector('#v-zihall [data-answered]')?.getAttribute('data-answered'),
  acc: document.querySelector('#v-zihall [data-acc]')?.textContent,
}))
t.ok(zst.answered && +zst.answered >= 3, '识字表：真实答 3 题（计数累计）', JSON.stringify(zst))
const w = await storeOf(page, 'pinyin_v2')
const zw = Object.keys(w.weights || {}).filter((k) => k.startsWith('Z:')).length
t.ok(zw >= 1, '识字表：作答写入字级权重 Z:（字级错误账本）', 'Z:keys=' + zw)

/* 🔊 点播照旧 */
const logR0 = await page.evaluate(() => window.__AUDIO_LOG.length)
await ck(page, '#v-zihall [data-listen]')
await page.waitForTimeout(400)
const logR1 = await page.evaluate(() => window.__AUDIO_LOG.length)
t.ok(logR1 > logR0, '识字表：🔊 点播字音可用')
await app.closePage(page)

/* 两段式三段断言（独立局——v431 同款：网格轮换选字到首点有音） */
{
  const pz = await app.newPage({ tier: 'mid', mute: false })
  await pz.goto(`${BASE}/?open=zihall`, { waitUntil: 'networkidle' })
  await pz.waitForSelector('#v-zihall .zcell[data-locked="0"]', { timeout: 8000 })
  let audio0 = 0, ans = 0, wrongIdx = 0, got = false, tries = 0
  while (!got && tries++ < 5) {
    const cells = await pz.$$eval('#v-zihall .zcell[data-locked="0"]', (els) => els.length)
    await pz.tap(`#v-zihall .zcell[data-locked="0"]:nth-of-type(${(tries % cells) + 1})`).catch(async () => pz.tap('#v-zihall .zcell[data-locked="0"]'))
    await pz.waitForSelector('#v-zihall [data-q][data-reveal="0"]', { timeout: 6000 })
    ans = await pz.evaluate(() => window.__PJ.ziQ().ans)
    wrongIdx = (ans + 1) % 4
    audio0 = await pz.evaluate(() => window.__AUDIO_LOG.length)
    await pz.tap(`#v-zihall [data-opts] .opt:nth-of-type(${wrongIdx + 1})`)
    await pz.waitForTimeout(300)
    got = (await pz.evaluate(() => window.__AUDIO_LOG.length)) > audio0
    if (!got) {
      await pz.tap('#v-zihall .cbtn')   /* 退回网格换一个字 */
      await pz.waitForSelector('#v-zihall .zcell[data-locked="0"]', { timeout: 6000 })
    }
  }
  const st1 = await pz.evaluate((wi) => ({
    log: window.__AUDIO_LOG.length,
    reveal: document.querySelector('#v-zihall [data-q]').getAttribute('data-reveal'),
    n: document.querySelector('#v-zihall [data-answered]').getAttribute('data-answered'),
    armed: document.querySelector(`#v-zihall [data-opts] .opt:nth-of-type(${wi + 1})`).classList.contains('armed'),
  }), wrongIdx)
  t.ok(st1.armed && st1.reveal === '0' && st1.n === '0', '识字表首点：试听高亮+不计分不推进', JSON.stringify({ n: st1.n, reveal: st1.reveal, armed: st1.armed }))
  t.ok(got && st1.log > audio0, '识字表首点：播该选项拼音（hyp 音节，轮换选字验证）', `+${st1.log - audio0}`)
  await pz.tap(`#v-zihall [data-opts] .opt:nth-of-type(${ans + 1})`)
  await pz.waitForTimeout(300)
  const st2 = await pz.evaluate(() => document.querySelector('#v-zihall [data-q]').getAttribute('data-reveal'))
  t.ok(st2 === '0', '识字表切点别项：切试听（仍不判分）')
  await pz.tap(`#v-zihall [data-opts] .opt:nth-of-type(${ans + 1})`)
  await pz.waitForTimeout(400)
  const st3 = await pz.evaluate(() => ({
    reveal: document.querySelector('#v-zihall [data-q]').getAttribute('data-reveal'),
    n: document.querySelector('#v-zihall [data-answered]').getAttribute('data-answered'),
  }))
  t.ok(st3.reveal === '1' && st3.n === '1', '识字表二点同项：才判分', JSON.stringify(st3))
  await app.closePage(pz)
}

t.pageErrors(app.errors, 'zi 全程')
await app.close()
process.exit(t.finish())
