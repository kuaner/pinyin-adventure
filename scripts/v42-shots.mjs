/* v4.2 视觉验收截图：hall 双厅 / 四练习模式 / 口诀地鼠（目验：字模大小/按钮热区/ruby 注音/零溢出） */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = '.acceptance-v42'
fs.mkdirSync(OUT, { recursive: true })
const shots = []

const browser = await chromium.launch()
async function mk(seed = '') {
  const p = await browser.newPage({ ...devices['iPhone 13'], hasTouch: true })
  await p.addInitScript(`
    localStorage.clear()
    localStorage.setItem('pinyin_v2', JSON.stringify({
      weights: {}, stars: { 1: 3, 2: 3, 3: 2 }, cards: {}, hist: [],
      mute: true, bolt: { acc: 86, d: '', tacc: 82, td: '' }, days: {},
    }))
    localStorage.setItem('pinyin_learn', JSON.stringify({ u: 4, stars: { 1: 3, 2: 3, 3: 3, 4: 2 }, best: { 1: 5, 2: 5, 3: 5, 4: 4 }, step: {} }))
    localStorage.setItem('pinyin_growth_v1', JSON.stringify({ v: 1, stars: 40, badges: [], seenStage: 1, det: 3, tone: 2, boltPerf: false }))
    ;${seed}
  `)
  return p
}

/* 01 游戏岛 hub（8 摊位） */
{
  const p = await mk()
  await p.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await p.waitForSelector('#stalls', { timeout: 8000 })
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/01-hub-game.png` })
  shots.push('01-hub-game')
  /* 02 练习馆 */
  await p.evaluate(() => document.querySelector('[data-hallbtn="drill"]')?.click())
  await p.waitForSelector('#drillgrid', { timeout: 5000 })
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${OUT}/02-hub-drill.png` })
  shots.push('02-hub-drill')
  await p.close()
}

/* 03 闪电刷题（进行中） */
{
  const p = await mk()
  await p.goto(`${BASE}/?open=bolt`, { waitUntil: 'networkidle' })
  await p.waitForSelector('#v-bolt #boltcard', { timeout: 8000 })
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/03-bolt.png` })
  shots.push('03-bolt')
  await p.close()
}

/* 04 听写专练（首题自动读音后）+ 05 弱项开关开 */
{
  const p = await mk(`(() => { const led = JSON.parse(localStorage.getItem('pinyin_game_v1') || '{"v":1,"letters":{},"games":{},"daily":{"day":"","best":0,"done":false}}'); led.letters.b = { ok: 0, err: 3, last: 0 }; led.letters.d = { ok: 1, err: 2, last: 0 }; localStorage.setItem('pinyin_game_v1', JSON.stringify(led)) })()`)
  await p.goto(`${BASE}/?open=ldrill`, { waitUntil: 'networkidle' })
  await p.waitForSelector('#v-ldrill [data-q]', { timeout: 8000 })
  await p.waitForTimeout(500)
  await p.screenshot({ path: `${OUT}/04-ldrill.png` })
  shots.push('04-ldrill')
  await p.evaluate(() => document.querySelector('[data-weaktoggle]')?.click())
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/05-ldrill-weak.png` })
  shots.push('05-ldrill-weak')
  await p.close()
}

/* 06 易混对（weak/good 小进度标） */
{
  const p = await mk(`(() => { const led = JSON.parse(localStorage.getItem('pinyin_game_v1') || '{"v":1,"letters":{},"games":{},"daily":{"day":"","best":0,"done":false}}'); led.letters.b = { ok: 0, err: 3, last: 0 }; led.letters.d = { ok: 5, err: 0, last: 0 }; led.letters.n = { ok: 0, err: 1, last: 0 }; led.letters.l = { ok: 6, err: 0, last: 0 }; localStorage.setItem('pinyin_game_v1', JSON.stringify(led)) })()`)
  await p.goto(`${BASE}/?open=pairs`, { waitUntil: 'networkidle' })
  await p.waitForSelector('#v-pairs .chip', { timeout: 8000 })
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/06-pairs.png` })
  shots.push('06-pairs')
  await p.close()
}

/* 07 识字表闯关（解锁网格）+ 08 练习态 */
{
  const p = await mk()
  await p.goto(`${BASE}/?open=zihall`, { waitUntil: 'networkidle' })
  await p.waitForSelector('#v-zihall .zcell', { timeout: 8000 })
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/07-zihall.png` })
  shots.push('07-zihall')
  await p.evaluate(() => Array.from(document.querySelectorAll('#v-zihall .zcell')).find((e) => e.getAttribute('data-locked') === '0')?.click())
  await p.waitForSelector('#v-zihall [data-q]', { timeout: 5000 })
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${OUT}/08-zihall-q.png` })
  shots.push('08-zihall-q')
  await p.close()
}

/* 09 口诀地鼠（探头+口诀 chip） */
{
  const p = await mk()
  await p.goto(`${BASE}/?open=game&g=mole&st=play`, { waitUntil: 'networkidle' })
  await p.waitForSelector('#gstage', { timeout: 8000 })
  await p.waitForSelector('#gstage .mole.up', { timeout: 8000 })
  await p.screenshot({ path: `${OUT}/09-mole-kj.png` })
  shots.push('09-mole-kj')
  await p.close()
}

await browser.close()
console.log('shots:', shots.join(', '))
