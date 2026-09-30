/* 笔顺自检：47 单元（声母23+韵母24）逐个渲染 StrokeAnim，
   每单元截两帧——中帧（static=前半笔数）+ 完成帧（static=全部）——存 .stroke-shots/。
   另做几何断言：ghost/ink 路径数 = 笔数×2、单元格数 = 字母数。
   v3.0：写法页并入学一学合并页（BUGS#29）——断言对象=PinyinCard 笔顺预览
   （.pc-strokefit，静态帧经 strokeStatic 透传），深链 ?li=I&static=K（?step 已废）。 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) }
catch { ({ chromium } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:5173/'
const OUT = '.stroke-shots'
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT)

const lessons = JSON.parse(fs.readFileSync('src/data/lessons.json', 'utf8')).lessons

/* 47 个必验单元：23 声母 + 24 韵母 */
const MUST = ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w',
  'a','o','e','i','u','ü','ai','ei','ui','ao','ou','iu','ie','üe','er','an','en','in','un','ün','ang','eng','ing','ong']

/* unit → (lesson n, letter idx, 笔数) */
const where = {}
for (const l of lessons) l.letters.forEach((e, i) => { if (!(e.k in where)) where[e.k] = { n: l.n, i, strokes: e.strokes.length } })
const missing = MUST.filter((u) => !(u in where))
if (missing.length) { console.error('✗ lessons.json 缺单元：', missing); process.exit(1) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.addInitScript(() => localStorage.setItem('pinyin_learn', JSON.stringify({ u: 12, stars: {}, best: {} })))

let pass = 0, fail = 0
for (const u of MUST) {
  const { n, i, strokes } = where[u]
  const key = u.replace('ü', 'v')
  const midK = Math.max(1, Math.ceil(strokes / 2))
  for (const [tag, st] of [['mid', midK], ['final', strokes]]) {
    await page.goto(`${BASE}?learn=${n}&li=${i}&static=${st}`, { waitUntil: 'load' })
    /* 关闭声音解锁层（若在） */
    try { await page.click('#ulgo', { timeout: 1200 }) } catch { /* 不在 */ }
    await page.waitForSelector('#v-lesson .pc-strokefit .strokeanim', { timeout: 8000 })
    await page.waitForTimeout(350)
    const geom = await page.evaluate((pgi) => {
      const svg = document.querySelector(`#v-lesson .hstage > .hspage:nth-child(${pgi + 1}) .pc-strokefit .strokeanim`)
      if (!svg) return null
      const ghosts = svg.querySelectorAll('path.ghost').length
      const inks = svg.querySelectorAll('path:not(.ghost)').length
      const cells = svg.querySelectorAll('g[transform]').length
      return { ghosts, inks, cells, w: svg.getAttribute('viewBox') }
    }, i * 2)
    const expLetters = u.length > 1 && u !== 'ü' ? u.length : 1
    const ok = geom && geom.ghosts === strokes && geom.inks === strokes && geom.cells === expLetters * 2
    if (tag === 'final') { if (ok) pass++; else { fail++; console.error(`✗ ${u}:`, JSON.stringify(geom), `期望 strokes=${strokes} cells=${u.length > 1 && u !== 'ü' ? u.length : 1}`) } }
    const el = page.locator(`#v-lesson .hstage > .hspage:nth-child(${i * 2 + 1}) .pc-strokefit`)
    await el.screenshot({ path: `${OUT}/${key}_${tag}.png` })
  }
  process.stdout.write(`✓ ${u} (${strokes}笔) `)
}
console.log(`\n===== 笔顺几何断言：${pass}/${MUST.length} 通过，${fail} 失败 =====`)
await browser.close()
process.exit(fail ? 1 : 0)
