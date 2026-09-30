/* WebKit（iOS Safari 同内核）裁决：#8 ruby 居中几何测量 + #4 左滑 + #7 口诀页
   用法：node scripts/webkit-v241.mjs [outDir] */
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('/Users/kuaner/.npm/_npx/2334a3ea0ef73d73/node_modules/playwright/index.mjs')
const { chromium: _c, webkit } = require('playwright')
const iPhone = require('playwright-core').devices['iPhone 13']

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = process.argv[2] || '/tmp/pinyin-v241/webkit'
mkdirSync(OUT, { recursive: true })

const browser = await webkit.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const ok = (name, pass, detail = '') => console.log((pass ? '✓' : '✗') + ' ' + name + (detail ? ' — ' + detail : ''))

const ctx = await browser.newContext({ ...iPhone, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 200)))

/* ---------- #8 ruby 几何测量（WebKit） ---------- */
await page.goto(BASE + '?learn=1', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.evaluate(() => {
  const d = document.createElement('div')
  d.id = 'ruby-probe'
  d.style.cssText = 'position:fixed;left:8px;right:8px;top:120px;z-index:999;background:#fff;border:2px solid #e76f51;border-radius:12px;padding:10px 14px;font-size:22px;font-weight:800;line-height:2.4'
  d.innerHTML =
    '<ruby>庄<rt>zhuāng</rt></ruby><ruby>上<rt>shàng</rt></ruby><ruby>一<rt>yī</rt></ruby><ruby>堵<rt>dǔ</rt></ruby><ruby>墙<rt>qiáng</rt></ruby>' +
    '<br><ruby>双<rt>shuāng</rt></ruby><ruby>人<rt>rén</rt></ruby><ruby>走<rt>zǒu</rt></ruby>'
  document.body.appendChild(d)
})
await page.waitForTimeout(300)
await page.locator('#ruby-probe').screenshot({ path: OUT + '/08-ruby-webkit.png' })
const geo = await page.evaluate(() => {
  const out = []
  for (const rb of document.querySelectorAll('#ruby-probe ruby')) {
    const han = rb.childNodes[0]
    const rt = rb.querySelector('rt')
    const hr = document.createRange()
    hr.selectNodeContents(han)
    const hb = hr.getBoundingClientRect()
    const tb = rt.getBoundingClientRect()
    out.push({
      han: hb.left + hb.width / 2,
      hanW: hb.width,
      rt: tb.left + tb.width / 2,
      rtL: tb.left, rtR: tb.right,
      boxW: rb.getBoundingClientRect().width,
    })
  }
  return out
})
let centerOK = true
let gaps = []
for (let i = 0; i < geo.length; i++) {
  const g = geo[i]
  const off = Math.abs(g.han - g.rt)
  if (off > 3) centerOK = false
  if (i > 0) gaps.push(Math.round(g.rtL - geo[i - 1].rtR))
  console.log(`   ${i}: hanC=${g.han.toFixed(1)} rtC=${g.rt.toFixed(1)} off=${off.toFixed(1)}px hanW=${g.hanW.toFixed(0)} boxW=${g.boxW.toFixed(0)}`)
}
console.log('   相邻 rt 间隙(px):', gaps.join(', '))
ok('#8 WebKit 逐音节居中（偏差≤3px）', centerOK)
const realGaps = gaps.filter((x) => x > -50)   /* 负大值 = 换行边界（两行之间），非粘连 */
ok('#8 WebKit 相邻注音不粘连（间隙≥2px）', realGaps.every((x) => x >= 2), realGaps.join(','))

/* ---------- #4 左滑（WebKit = iOS 引擎） ----------
   Safari 不支持 new Touch/TouchEvent 构造器（Illegal constructor），
   真机 touch 路径已在 Chromium 用真 TouchEvent 验证；此处用 pointer(mouse)
   序列验证 WebKit 引擎侧的 HSteps 拖拽逻辑（down/move/up → 翻页）。 */
const stepBefore = await page.locator('#lprog').textContent()
const stage = await page.locator('#stagewrap').boundingBox()
const cx = stage.x + stage.width / 2, cy = stage.y + stage.height / 2
await page.touchscreen.tap(cx, cy)
await page.waitForTimeout(200)
await page.evaluate(({ cx, cy }) => {
  const el = document.elementFromPoint(cx, cy)
  const pev = (type, x) => new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse',
    clientX: x, clientY: cy, isPrimary: true,
  })
  el.dispatchEvent(pev('pointerdown', cx))
  for (let i = 1; i <= 8; i++) el.dispatchEvent(pev('pointermove', cx - i * 20))
  el.dispatchEvent(pev('pointerup', cx - 160))
}, { cx, cy })
await page.waitForTimeout(700)
const stepAfter = await page.locator('#lprog').textContent()
ok('#4 WebKit 拖拽翻页', stepBefore !== stepAfter, `${stepBefore} → ${stepAfter}`)
await page.screenshot({ path: OUT + '/04-webkit-after-swipe.png' })

/* ---------- #7 口诀页（WebKit） ---------- */
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await page.locator('[data-radio]').click()
await page.waitForTimeout(900)
await page.screenshot({ path: OUT + '/07-radio-webkit.png' })
const caps = await page.locator('#rcaps .cap').count()
const capsBox = await page.locator('#rcaps').boundingBox()
const hswrapBox = await page.locator('#v-radio .hswrap').boundingBox()
ok('#7 WebKit 口诀页可见', caps > 0 && capsBox && capsBox.height > 30 && hswrapBox && hswrapBox.height > 200,
  `caps=${caps} capsH=${capsBox?.height.toFixed(0)} hswrapH=${hswrapBox?.height.toFixed(0)}`)

await ctx.close()
await browser.close()
console.log('webkit done → ' + OUT)
