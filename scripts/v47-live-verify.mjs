/* v4.7 线上验证：识字表实测可答题（发布硬门槛）+ 首页/版本探针。
   用法：BASE_URL=https://kuaner.github.io/pinyin-adventure/ node scripts/v47-live-verify.mjs */
import { chromium } from 'playwright'
import { seedState } from '../tests/fixtures/seeds.mjs'

const BASE = process.env.BASE_URL || 'https://kuaner.github.io/pinyin-adventure/'
const t = { pass: 0, fail: 0 }
const ok = (c, name, extra = '') => { if (c) { t.pass++; console.log('  ✓', name, extra) } else { t.fail++; console.log('  ✗', name, extra) } }

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await seedState(page, 'mid', {})
await page.addInitScript(() => { window.__AUDIO_LOG = [] })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

/* ① 首页可达 + 版本号（设置页才显示版本） */
await page.goto(BASE + '?open=settings', { waitUntil: 'networkidle' })
const ver = await page.evaluate(() => document.body.textContent.includes('4.7.0'))
ok(ver, '线上版本=4.7.0')

/* ② 识字表实测可答题（硬门槛）：网格→点字→armed→再点→判定→计数 */
await page.goto(BASE + '?open=zihall', { waitUntil: 'networkidle' })
await page.waitForSelector('#v-zihall .zcell[data-locked="0"]', { timeout: 15000 })
await page.tap('#v-zihall .zcell[data-locked="0"]')
await page.waitForSelector('#v-zihall [data-q]', { timeout: 10000 })
await page.waitForTimeout(600)
const opts = await page.evaluate(() => [...document.querySelectorAll('#v-zihall [data-opt]')].map((e) => e.getAttribute('data-opt')))
/* 合法音节抽查：无跨族乱码（含连续双 i/双 u 变调串） */
const TONEV = 'āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ'
const illegal = opts.filter((p) => { const n = [...p].filter((ch) => TONEV.includes(ch)).length; return n !== 1 || /ii|uu|oo/.test(p) })
ok(opts.length === 4 && illegal.length === 0, '识字表：4 选项全合法音节（P1-10）', JSON.stringify(opts))
await page.tap('#v-zihall [data-opts] .opt:nth-of-type(1)')
await page.waitForTimeout(300)
ok(await page.evaluate(() => !!document.querySelector('#v-zihall [data-opts] .opt.armed')), '识字表：首击=试听确认态（P0-1）')
await page.waitForTimeout(300)
await page.tap('#v-zihall [data-opts] .opt:nth-of-type(1)')
await page.waitForSelector('#v-zihall [data-q][data-reveal="1"]', { timeout: 5000 })
ok(true, '识字表：再点同项=判定（reveal）')
await page.waitForTimeout(900)
const answered = await page.getAttribute('#v-zihall [data-answered]', 'data-answered')
ok(answered === '1', '识字表：已答计数=1（全链）', String(answered))

/* ③ 音频真实可达（线上 mp3 抽查） */
const audioOk = await page.evaluate(async () => {
  const r = await fetch(new URL('audio/hyp/liu4.mp3', location.href), { method: 'HEAD' })
  return r.ok
})
ok(audioOk, '线上 hyp 音频可达（liu4）')
ok(errors.length === 0, '全程零 pageerror', errors.slice(0, 2).join('|'))

await b.close()
console.log(`\n线上验证：${t.pass} 过 / ${t.fail} 败`)
process.exit(t.fail ? 1 : 0)
