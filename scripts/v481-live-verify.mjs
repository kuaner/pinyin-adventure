/* v4.8.1 线上验证：真音频探针（发布硬门槛）——六游戏真机链路实测。
   病灶回归面：kuaner 2026-10-03 真机实报「点下就卡死/声音出来了元素不出」——
   本探针在线上（真 mp3、真事件链）逐游戏实测：入场→目标元素≤窗出现→点按判定落地。
   用法：BASE_URL=https://kuaner.github.io/pinyin-adventure/ node scripts/v481-live-verify.mjs */
import { chromium } from 'playwright'
import { seedState } from '../tests/fixtures/seeds.mjs'
import { OBSERVERS } from '../tests/e2e/flows/bootApp.mjs'
import { enterGame, popTargetBalloon, whackTargetMole, catchTargetFish, catchTargetNote, playEggRound, pd } from '../tests/e2e/flows/playGame.mjs'

const BASE = process.env.BASE_URL || 'https://kuaner.github.io/pinyin-adventure/'
const t = { pass: 0, fail: 0 }
const ok = (c, name, extra = '') => { if (c) { t.pass++; console.log('  ✓', name, extra) } else { t.fail++; console.log('  ✗', name, extra) } }

const SEL = {
  fish: '#gstage .fishwrap:not(.caught):not(.scare)',
  balloon: '#gstage .balloon:not(.popped):not(.wrong)',
  mole: '#gstage .mole.up',
  tone: '#gstage .tnote:not(.caught):not(.wrong)',
  egg: '#gstage [data-halves][data-ready="1"]',
  duel: '#gstage [data-q]',
}
/* 线上网络余量放宽：地鼠 4s（谜面≤1.9s+看门狗+冷网络）、对决 3.5s、其余 3s（4G 首载） */
const APPEAR_MS = { fish: 3000, balloon: 3000, egg: 3000, tone: 3000, mole: 4000, duel: 3500 }
const GAMES = ['balloon', 'mole', 'duel', 'fish', 'egg', 'tone']

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

/* ① 版本号（设置页） */
await seedState(page, 'mid', {})
await page.addInitScript(OBSERVERS)
await page.goto(BASE + '?open=settings', { waitUntil: 'networkidle', timeout: 30000 })
const ver = await page.evaluate(() => document.body.textContent.includes('4.8.1'))
ok(ver, '线上版本=4.8.1')

/* ② 六游戏真音频入场→元素→点按（真 mp3 真事件链，零拦截） */
for (const id of GAMES) {
  await enterGame(page, id)
  const appeared = await page.waitForFunction((s) => !!document.querySelector(s), SEL[id], { timeout: APPEAR_MS[id] }).then(() => true).catch(() => false)
  ok(appeared, `${id} 目标元素 ${APPEAR_MS[id]}ms 内出现（真音频入场）`)
  let hit = false
  if (id === 'mole') { await page.waitForTimeout(2500); hit = await whackTargetMole(page) }
  else if (id === 'balloon') hit = await popTargetBalloon(page)
  else if (id === 'fish') hit = await catchTargetFish(page)
  else if (id === 'tone') hit = await catchTargetNote(page)
  else if (id === 'egg') { try { await playEggRound(page); hit = true } catch { hit = false } }
  else {
    /* 作答门预等：进题宽限 450ms+谜面门（真时长+600ms）内点按被守卫正确吞掉——先等门开 */
    await page.waitForTimeout(1900)
    hit = await page.evaluate(() => !!document.querySelector('#gstage .duelopt[data-qkey]:not([data-qkey=""])'))
    if (hit) { await pd(page, '#gstage .duelopt[data-qkey]:not([data-qkey=""])'); await page.waitForTimeout(500) }
  }
  const sc = hit ? await page.evaluate(() => +(document.querySelector('#gscore')?.textContent || 0)) : 0
  ok(hit && sc > 0, `${id} 点按判定落地（score=${sc}）`)
  await page.evaluate(() => { window.__PJ && window.__PJ.quitGame && window.__PJ.quitGame() }).catch(() => {})
  await page.goto(BASE + '?open=island', { waitUntil: 'networkidle', timeout: 30000 })
}

/* ③ 线上音频抽查（riddle/kj/hyp 三源） */
for (const f of ['audio/riddle/b.mp3', 'audio/lessons/kj_b.mp3', 'audio/hyp/b.mp3']) {
  const audioOk = await page.evaluate(async (f) => (await fetch(new URL(f, location.href), { method: 'HEAD' })).ok, f)
  ok(audioOk, `线上音频可达 ${f}`)
}
ok(errors.length === 0, '全程零 pageerror', errors.slice(0, 2).join('|'))

await b.close()
console.log(`\nv4.8.1 线上验证：${t.pass} 过 / ${t.fail} 败`)
process.exit(t.fail ? 1 : 0)
