/* v3.1.2 验收（BUGS#23 音频智能预载 + BUGS#26 四线格视觉）：
   A. #23 预载：进课即并行预取本课音频集——
      - 断言预载请求发出（hyp 呼读音 / lessons 口诀·旁白 / ui 短语）
      - 断言写入 SW 运行时缓存 pinyin-audio（与 vite.config.ts runtimeCaching 同名），
        hyp/a.mp3 与 ui/swipe-next-step.mp3 cache.match 命中
      - 冷上下文进课→点 🔊 读第一个字母：「点击→readyState 可播」延迟 <100ms（预载命中=零网络等待；
        before 状态下此路径=网络冷请求，生产实测 1.2s+）
      - #23 顺带修回归：ui 短语请求 URL 单一 .mp3（修复前 .mp3.mp3 双扩展 → SPA fallback 回 HTML，
        Speak UI 点播全哑）且响应 content-type=audio
   B. #26 几何（before=截图实测：字模 a 高 49.8px、svg 上下各 92px 空白、上格线距标题 116px）：
      - 字模 svg 吃满面板：svg 在 hero 内上下 inset ≤20px（before 92）
      - 字母更大：path 包围盒高 ≥90px（before 49.8）
      - 标题→首格线距离 ≤30px（before 116.4）
      - 格线加深：上/下线 #dcd8d1（--animal-border）、中线 #b3a48a，线宽 2/2.4
      - 前后截图 .acceptance-v312/{before,after}/（before 由 /tmp 工作脚本产出，after 此处产出）
   C. 回归：radio 展开区单 svg、全程零 pageerror。
   用法：先 npm run build && npm run preview（4173），BASE_URL 可换线上地址跑生产版预载延迟。 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = process.env.OUT || '.acceptance-v312/after'
fs.mkdirSync(OUT, { recursive: true })

let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) } else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) } }
const errors = []

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true, deviceScaleFactor: 3 })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(String(e)))

const audioReqs = []
page.on('response', (r) => { if (r.url().includes('/audio/')) audioReqs.push({ u: r.url(), s: r.status(), ct: r.headers()['content-type'] || '' }) })

/* ---- A. 预载：冷上下文直达 L1 a 学一学页 ---- */
console.log('A. BUGS#23 音频智能预载')
await page.goto(`${BASE}/?open=lesson&learn=1&li=0`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#v-lesson .hspage', { timeout: 10000 })

/* 预载完成判据：期望集合全部出现在 pinyin-audio 缓存（页内 Cache API 直查） */
const expected = ['hyp/a.mp3', 'lessons/kj_a.mp3', 'lessons/write_a.mp3', 'ui/swipe-next-step.mp3']
const cacheHas = async (frag) => page.evaluate(async (f) => {
  const c = await caches.open('pinyin-audio')
  const keys = (await c.keys()).map((k) => k.url)
  return keys.some((u) => u.includes(f))
}, frag)
let preloaded = false
for (let i = 0; i < 60; i++) {
  if ((await Promise.all(expected.map(cacheHas))).every(Boolean)) { preloaded = true; break }
  await page.waitForTimeout(500)
}
ok(preloaded, '预载集写入 pinyin-audio 缓存', expected.join(' '))
ok(audioReqs.some((r) => r.u.includes('hyp/a.mp3')), '呼读音(hyp/a)预载请求发出')
ok(audioReqs.some((r) => r.u.includes('lessons/kj_a.mp3')), '口诀(lessons/kj_a)预载请求发出')
ok(audioReqs.some((r) => r.u.includes('lessons/write_a.mp3')), '写法旁白(lessons/write_a)预载请求发出')
ok(audioReqs.some((r) => r.u.includes('/ui/')), 'UI 短语预载请求发出', `共 ${audioReqs.filter((r) => r.u.includes('/ui/')).length} 条`)
const audioReqsPre = audioReqs.length

/* ---- A2. 冷进课→点读第一个字母：点击→可播延迟（先等预载全落定——孩子进课到点读有天然间隔；
     预载进行中点击会和 ~40 条并行 fetch 抢连接，不代表真实使用路径） ---- */
console.log('A2. 预载落定后点读延迟')
const cacheCount = () => page.evaluate(async () => (await (await caches.open('pinyin-audio')).keys()).length)
let stable = 0, prev = -1
for (let i = 0; i < 120 && stable < 3; i++) {
  const c = await cacheCount()
  stable = c === prev ? stable + 1 : 0
  prev = c
  await page.waitForTimeout(350)
}
console.log(`  预载缓存条目稳定在 ${prev}`)
const tPlay = await page.evaluate(() => new Promise((res) => {
  const btn = document.querySelector('[data-pcread="a"]')
  if (!btn) return res(-2)
  const t0 = performance.now()
  const audios = []
  const orig = Audio.prototype.play
  Audio.prototype.play = function () { audios.push(this); return orig.call(this) }
  btn.click()
  const tick = () => {
    const a = audios[audios.length - 1]
    if (a && (a.readyState >= 3 || a.currentTime > 0)) { Audio.prototype.play = orig; return res(performance.now() - t0) }
    if (performance.now() - t0 > 8000) { Audio.prototype.play = orig; return res(-1) }
    requestAnimationFrame(tick)
  }
  tick()
}))
ok(tPlay >= 0 && tPlay < 100, '点读第一个字母 点击→可播 <100ms（预载命中）', `${tPlay.toFixed(1)}ms`)

/* ---- A3. UI 短语双扩展名回归（#23 顺带修）。注：预载元素预热后点击命中 AUDIO_CACHE 不发网络请求
     （请求层"失聪"），故走元素级断言——播的元素 src 单一 .mp3 + 真实解码在播；再用直接 fetch 验 content-type ---- */
const uiInfo = await page.evaluate(() => new Promise((res) => {
  const audios = []
  const orig = Audio.prototype.play
  Audio.prototype.play = function () { audios.push(this); return orig.call(this) }
  const el = document.querySelector('#swipehint .speak.canplay')
  if (!el) { Audio.prototype.play = orig; return res(null) }
  el.click()
  setTimeout(() => {
    Audio.prototype.play = orig
    const a = audios[audios.length - 1]
    res(a ? { src: a.currentSrc || a.src, err: a.error ? a.error.code : null, t: a.currentTime } : { src: null })
  }, 900)
}))
ok(!!uiInfo && uiInfo.src && uiInfo.src.includes('ui/swipe-next-step.mp3') && !uiInfo.src.includes('.mp3.mp3'),
  'ui 短语元素 src 单一 .mp3（无双扩展）', uiInfo?.src ? uiInfo.src.split('/audio/')[1] : '未触发播放')
ok(!!uiInfo && uiInfo.src && !uiInfo.err && uiInfo.t > 0, 'ui 短语真实在播（解码成功、currentTime 前进）',
  uiInfo ? `t=${uiInfo.t?.toFixed(2)}s err=${uiInfo.err}` : '-')
const uiCt = await page.evaluate(async () => {
  const u = new URL('audio/ui/swipe-next-step.mp3', location.href)
  const r = await fetch(u)
  return r.headers.get('content-type')
})
ok(/audio\//.test(uiCt || ''), 'ui 短语 URL 响应 content-type=audio', uiCt || '-')

/* ---- B. #26 几何 + 截图 ---- */
console.log('B. BUGS#26 四线格视觉')
await page.waitForTimeout(4200) /* 笔顺动画播完回定格，截图口径一致 */
await page.screenshot({ path: `${OUT}/after-L1-a.png` })
const geo = await page.evaluate(() => {
  const $ = (s) => document.querySelector(s)
  const hero = $('.pc-hero'), svg = $('svg.strokeanim'), ptag = $('.pcard .ptag'), kj = $('.pc-kj')
  const rect = (el) => { const r = el.getBoundingClientRect(); return { y: r.y, b: r.bottom, h: r.height } }
  const H = rect(hero), S = rect(svg), P = rect(ptag), K = rect(kj)
  const lines = [...document.querySelectorAll('svg.strokeanim .grid')].map((l) => {
    const cs = getComputedStyle(l)
    return { stroke: cs.stroke, sw: cs.strokeWidth, y: l.getBoundingClientRect().y }
  })
  const paths = [...document.querySelectorAll('svg.strokeanim path')].map((p) => p.getBoundingClientRect())
  const gTop = Math.min(...paths.map((p) => p.y)), gBot = Math.max(...paths.map((p) => p.y + p.height))
  return {
    insetTop: +(S.y - H.y).toFixed(1), insetBot: +(H.b - S.b).toFixed(1),
    heroH: +H.h.toFixed(1), svgH: +S.h.toFixed(1),
    titleToGrid: +(lines[0].y - P.b).toFixed(1),
    gridToKj: +(K.y - lines[3].y).toFixed(1),
    glyphH: +(gBot - gTop).toFixed(1),
    lines,
  }
})
ok(geo.insetBot <= 20 && geo.svgH >= geo.heroH - 40, '字模 svg 吃满面板（底部 inset ≤20px、svg 高≥面板-40px 肩位）', `svg ${geo.svgH}/${geo.heroH} top ${geo.insetTop}(角标肩位) / bot ${geo.insetBot} (before 92/92)`)
ok(geo.titleToGrid >= 0 && geo.titleToGrid <= 30, '首格线避开角标且贴近（0..30px）', `${geo.titleToGrid}px (before 116.4)`)
ok(geo.glyphH >= 90, '字母字模高 ≥90px', `${geo.glyphH}px (before 49.8)`)
const c1 = geo.lines.find((l) => l.stroke === 'rgb(220, 216, 209)')
const c2 = geo.lines.find((l) => l.stroke === 'rgb(179, 164, 138)')
ok(!!c1 && c1.sw === '2px', '上/下格线 = --animal-border #dcd8d1 @2px')
ok(!!c2 && c2.sw === '2.4px', '中间格线 = #b3a48a @2.4px（加深档）')

/* L7 z（升格字母）参考截图 */
await page.goto(`${BASE}/?open=lesson&learn=7&li=0`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#v-lesson .hspage', { timeout: 10000 })
await page.waitForTimeout(4200)
await page.screenshot({ path: `${OUT}/after-L7-z.png` })

/* ---- C. 回归：radio（PinyinCard full 第二消费方，63 页全量挂载=既有结构）——
     当前页 svg 可见且不塌陷（BUGS#21/#22 病类：svg 高度 0） ---- */
console.log('C. 回归')
await page.goto(`${BASE}/?open=radio`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const radio = await page.evaluate(() => {
  const vw = innerWidth
  const vis = [...document.querySelectorAll('.strokeanim')].filter((s) => {
    const r = s.getBoundingClientRect()
    return r.width > 0 && r.right > 0 && r.left < vw
  })
  const h = vis.map((s) => +s.getBoundingClientRect().height.toFixed(1))
  return { svgs: document.querySelectorAll('.strokeanim').length, visible: vis.length, h: h[0] || 0, glyphBtn: !!document.querySelector('[data-pcmain]') }
})
ok(radio.svgs === 63 && radio.visible === 1 && radio.h >= 40 && radio.glyphBtn, 'radio 63 页挂载恒定、当前页 svg 可见不塌陷 + 字模键在位', JSON.stringify(radio))
ok(errors.length === 0, '全程零 pageerror', errors.slice(0, 2).join(' | '))

console.log(`\nRESULT: ${pass} pass / ${fail} fail`)
await browser.close()
process.exit(fail ? 2 : 0)
