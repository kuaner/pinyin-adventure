/* v2.9.2 热修验收（BUGS#22 两单）：
   ①省略号清零——Speak 可点播示能从"三竖条 swave"（静态形似"…"，kuaner 读作多余截断符）
     换成小喇叭 .sico；全仓无 text-overflow/ellipsis 截断（grep dist 断言）+ 页面 DOM 无 swave
   ②四线三格统一——PinyinCard 大字模复用 StrokeAnim 的 glyph 档 SVG（同 viewBox 76×160/字母 +
     同四线格 + 同 path 数据），radio 页大字模与"看笔顺"小字模逐线占格一致（DOM path d 串等价断言）
   配套：radio 卡外密度回收 + 空闲态 tip 移除（字模/笔顺预览预算回归）
   跑法：npm run build && npm run preview（4173）→ BASE_URL=… node scripts/v292-accept.mjs */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = '.acceptance/v292'
fs.mkdirSync(OUT, { recursive: true })
let fails = 0
const ok = (cond, name, detail = '') => {
  console.log(`${cond ? '✓' : '✗ FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!cond) fails++
}

/* ---------- ①构建产物层：零 ellipsis 截断 ---------- */
const distCss = execSync(`grep -oh "text-overflow[^;}]*" dist/assets/*.css || true`).toString().trim()
ok(distCss === '', 'dist CSS 零 text-overflow（省略号非 CSS 截断产生）', distCss)

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, hasTouch: true })
const page = await ctx.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })

/* DOM 提取：glyph（大字模）与 strokefit（看笔顺小字模）两 svg 的几何同源证据 */
const extract = () => page.evaluate(() => {
  const pick = (svg) => {
    if (!svg) return null
    const lines = [...svg.querySelectorAll('line.grid')].map((l) => l.getAttribute('y1'))
    /* 动画档每笔有 ghost+ink 两份 path，glyph 档一份——比较去重后的 d 集合 */
    const ds = [...new Set([...svg.querySelectorAll('path')].map((p) => p.getAttribute('d')))].sort()
    return { vb: svg.getAttribute('viewBox'), lines, ds, w: +svg.getBoundingClientRect().width.toFixed(1), h: +svg.getBoundingClientRect().height.toFixed(1) }
  }
  const g = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) } }
  return {
    glyph: pick(document.querySelector('.pc-glyphfit svg.strokeanim')),
    small: pick(document.querySelector('.pc-strokefit svg.strokeanim')),
    glyphFit: g('.pc-glyphfit'),
    scroll: (() => { const v = document.querySelector('.view.on'); return v ? { sh: v.scrollHeight, ch: v.clientHeight } : null })(),
    swaveCount: document.querySelectorAll('.swave').length,
    sicoCount: document.querySelectorAll('.speak .sico').length,
  }
})

/* ---------- ②radio 页 i/u/a：零省略号 + 双 svg 坐标系同源 + 预算健康 ---------- */
for (const k of ['i', 'u', 'a']) {
  await page.goto(`${BASE}?open=radio`, { waitUntil: 'load' })
  await page.waitForTimeout(800)
  await page.evaluate((kk) => {
    const caps = [...document.querySelectorAll('#rcaps .cap')]
    const cap = caps.find((c) => c.textContent.trim() === kk)
    cap?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  }, k)
  await page.waitForTimeout(600)
  const r = await extract()
  ok(r.swaveCount === 0, `radio[${k}] DOM 零 swave（省略号本体清除）`, `swave=${r.swaveCount}`)
  ok(r.sicoCount > 0, `radio[${k}] 喇叭示能存在`, `sico=${r.sicoCount}`)
  ok(r.glyph && r.small, `radio[${k}] 大字模+小字模双 svg 并存`)
  if (r.glyph && r.small) {
    ok(r.glyph.vb === r.small.vb && r.glyph.vb === '0 0 76 160', `radio[${k}] viewBox 同源 76×160`, `${r.glyph.vb} vs ${r.small.vb}`)
    ok(JSON.stringify(r.glyph.lines) === JSON.stringify(r.small.lines) && r.glyph.lines.join() === '20,60,100,140',
      `radio[${k}] 四线格 y 同源（20/60/100/140）`, `${r.glyph.lines} vs ${r.small.lines}`)
    ok(JSON.stringify(r.glyph.ds) === JSON.stringify(r.small.ds) && r.glyph.ds.length > 0,
      `radio[${k}] 笔画 path d 逐条一致（同一坐标系铁证）`, `${r.glyph.ds.length} strokes`)
    ok(r.glyph.h >= 100, `radio[${k}] 大字模高 ≥100`, `${r.glyph.h}`)
    ok(r.small.h >= 52, `radio[${k}] 看笔顺小字模高 ≥52（零塌陷）`, `${r.small.h}`)
  }
  ok(r.scroll.sh <= r.scroll.ch, `radio[${k}] 零纵向滚动`, `sh=${r.scroll.sh} ch=${r.scroll.ch}`)
  await shot(`radio-${k}`)
}

/* ---------- ③radio 播放态：连播中笔顺在跑、tip 在场（回归 R5 联动） ---------- */
await page.goto(`${BASE}?open=radio`, { waitUntil: 'load' })
await page.waitForTimeout(800)
await page.click('#chainbtn')
await page.waitForTimeout(700)
const chainOn = await page.$eval('#chainbtn', (el) => el.classList.contains('live'))
ok(chainOn, 'radio 连播可开启（R5 例外声源不回退）')
const tipDuringPlay = await page.$eval('.pc-tip', (el) => el.textContent.length > 0).catch(() => false)
ok(tipDuringPlay, '播放中 tip（听口诀看笔顺）在场')
await page.click('#chainbtn') // 关掉连播，静默
await page.waitForTimeout(300)

/* ---------- ④认识页（L3-b / L1-a）：字模健康 + 零滚动（BUGS#21 不回退） ---------- */
for (const [lesson, li, name] of [[3, 0, 'b'], [1, 0, 'a']]) {
  await page.goto(`${BASE}?open=lesson&lesson=${lesson}&letter=${li}`, { waitUntil: 'load' })
  await page.waitForSelector('#v-lesson', { timeout: 8000 })
  await page.waitForTimeout(700)
  const r = await extract()
  if (r.glyph && r.small) {
    ok(r.glyph.vb === r.small.vb, `lesson[${name}] viewBox 同源`, `${r.glyph.vb} vs ${r.small.vb}`)
    ok(JSON.stringify(r.glyph.ds) === JSON.stringify(r.small.ds), `lesson[${name}] path d 一致`)
    ok(r.glyph.h >= 110, `lesson[${name}] 大字模高 ≥110`, `${r.glyph.h}`)
    ok(r.small.h >= 60, `lesson[${name}] 笔顺预览高 ≥60（#21 不回退）`, `${r.small.h}`)
  } else ok(false, `lesson[${name}] 双 svg 存在`)
  ok(r.scroll.sh <= r.scroll.ch, `lesson[${name}] 零纵向滚动`, `sh=${r.scroll.sh} ch=${r.scroll.ch}`)
  await shot(`lesson-${name}`)
}

/* ---------- ⑤全页零 pageerror（v2.6.1 起常驻门槛） ---------- */
ok(pageErrors.length === 0, '全程零 pageerror', pageErrors.join(' | '))

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAIL`)
process.exit(fails === 0 ? 0 : 1)
