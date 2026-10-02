/* specs/games/eggGuide —— 拼音蛋点选配对引导（P0-2）+ 目标 chip 去调（P1-8）+ 半蛋字母完整（P2-3）
   + 进场音频单发 pin（挑刺报告 听验#3 代码层收口），挑刺报告 2026-10-03。
   产品裁定：点选配对为主（5-6 岁拖拽太难）——首局显性引导「先点声母，再点韵母」，
   完成首次配对后（持久标记）不再出现；拖拽暗示零残留。
   断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally, sleep } from '../../flows/assert.mjs'
import { enterGame, playEggRound, readHud } from '../../flows/playGame.mjs'

const t = new Tally('games/eggGuide 蛋引导+chip去调+字母完整+进场单音频')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'
const TONE_CHARS = /[āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ]/

/* ① 首局引导 + chip 去调 + 进场单音频 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.removeItem('pinyin_egg_hint_v1'))
  await enterGame(page, 'egg')
  await page.waitForFunction(() => document.querySelector('#gstage [data-halves][data-ready="1"]'), null, { timeout: 8000 })
  await sleep(300)

  /* 引导提示：首局可见，文案含「声母」「韵母」 */
  const hint = await page.evaluate(() => {
    const h = document.querySelector('#gstage [data-egghint]')
    const plain = (x) => (x || '').replace(/[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s]/g, '')
    return h ? { on: !!h && h.textContent.length > 0, text: plain(h.textContent) } : null
  })
  t.ok(hint && hint.on, 'P0-2：首局配对引导提示在屏', hint && hint.text)
  t.ok(hint && hint.text.includes('声母') && hint.text.includes('韵母'), 'P0-2：引导文案=先点声母再点韵母', hint && hint.text)

  /* P1-8：目标 chip 只显声母+韵母字母组合，不带调号字符 */
  const chip = await page.evaluate(() => {
    const TONE = /[\u0101\u00e1\u01ce\u00e0\u014d\u00f3\u01d2\u00f2\u0113\u00e9\u011b\u00e8\u012b\u00ed\u01d0\u00ec\u016b\u00fa\u01d4\u00f9\u01d6\u01d8\u01da\u01dc]/
    const c = document.querySelector('#gstage [data-tcard]')
    return { text: (c?.textContent || '').trim(), marks: TONE.test(c?.textContent || '') }
  })
  t.ok(chip.text.length > 0 && !chip.marks, 'P1-8：蛋目标 chip 去调（字母组合不带调，听音定调）', chip.text)

  /* P0-2：点选配对可得（真实 tap 两半） */
  const hud0 = await readHud(page)
  await playEggRound(page)
  const hud1 = await readHud(page)
  t.ok(+hud1.score > +hud0.score, 'P0-2：点选配对得分（点击两半→合并）', `${hud0.score}→${hud1.score}`)

  /* 引导消失（首次配对完成后本轮内不再出现） */
  await sleep(1400)
  const hintGone = await page.evaluate(() => !document.querySelector('#gstage [data-egghint]'))
  t.ok(hintGone, 'P0-2：完成首次配对后引导不再出现')

  /* 持久标记写入（跨会话一次性引导的存储契约；会话内不再出已由上一条断言覆盖。
     注：fixture 种子每次导航 localStorage.clear() 重注入——「重进不再出」的跨会话面
     在真实用户路径成立（无种子注入），e2e 以标记落盘为契约） */
  const flag = await page.evaluate(() => localStorage.getItem('pinyin_egg_hint_v1'))
  t.ok(flag === '1', 'P0-2：首次配对成功=持久标记落盘（跨会话一次性）', String(flag))
  t.pageErrors(app.errors, 'eggGuide')
  await app.closePage(page)
}

/* ② 进场音频单发 pin（听验#3 代码层收口：进场只播目标音节一个文件，无演示序列） */
{
  const page = await app.newPage({ tier: 'mid', mute: false, observers: true })
  await page.goto(`${BASE}/?open=game&g=egg&st=play`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.querySelector('#gstage [data-halves][data-ready="1"]'), null, { timeout: 8000 })
  const pin = await page.evaluate(() => {
    const log = (window.__AUDIO_LOG || []).filter((e) => e.t < performance.now())
    return { n: log.length, names: log.map((e) => e.name), afile: document.querySelector('[data-prompt]')?.getAttribute('data-afile') }
  })
  t.ok(pin.n === 1 && pin.names[0] === pin.afile, '进场只播目标音节单发（无 g→i 演示序列错位）', JSON.stringify(pin))
  await app.closePage(page)
}

/* ③ P2-3：半蛋内字母字形完整（字母中心落在色块 x 区间内——不再骑缝白底吃掉笔画） */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${BASE}/?open=game&g=egg&st=play`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.querySelector('#gstage [data-halves][data-ready="1"]'), null, { timeout: 8000 })
  const geo = await page.evaluate(() => {
    const out = []
    for (const kind of ['ini', 'fin']) {
      const btn = document.querySelector(`#gstage .hhalf.${kind}`)
      const k = btn?.querySelector('.hk')
      if (!btn || !k) continue
      const b = btn.getBoundingClientRect()
      const g = k.getBoundingClientRect()
      /* 色块区间：ini=x∈[12/64,36/64]，fin=x∈[28/64,52/64]（svg path 同源） */
      const lo = kind === 'ini' ? 12 / 64 : 28 / 64
      const hi = kind === 'ini' ? 36 / 64 : 52 / 64
      const rel = (g.x + g.width / 2 - b.x) / b.width
      out.push({ kind, rel, lo, hi, inside: rel >= lo - 0.02 && rel <= hi + 0.02 })
    }
    return out
  })
  t.ok(geo.length === 2 && geo.every((g) => g.inside), 'P2-3：半蛋字母中心在色块区间内（n 不再呈 r 状残形）', JSON.stringify(geo))
  await app.closePage(page)
}

await app.close()
process.exit(t.finish())
