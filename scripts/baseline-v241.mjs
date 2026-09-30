/* v2.4.1 修前基线复现：六单全场景截图 + 机械断言（hasTouch iPhone 13）
   用法：node scripts/baseline-v241.mjs [outDir] */
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) }
catch { ({ chromium } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = process.argv[2] || '/tmp/pinyin-v241/baseline'
mkdirSync(OUT, { recursive: true })

const pwc = createRequire('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')('playwright-core')
const iPhone = pwc.devices['iPhone 13']

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const ok = (name, pass, detail = '') => console.log((pass ? '✓' : '✗') + ' ' + name + (detail ? ' — ' + detail : ''))

async function fresh() {
  const ctx = await browser.newContext({ ...iPhone, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 160)))
  return { ctx, page }
}

/* ---------- #4 左滑：学习岛第1课，从页1左滑应到页2（写法） ---------- */
{
  const { ctx, page } = await fresh()
  await page.goto(BASE + '?learn=1', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: OUT + '/04a-lesson-p1.png' })
  const stepBefore = await page.locator('#lprog').textContent()
  /* 真机模拟左滑：touch 在 pcard 区（#stagewrap 中心）横向拖 160px */
  const stage = await page.locator('#stagewrap').boundingBox()
  const cx = stage.x + stage.width / 2, cy = stage.y + stage.height / 2
  await page.touchscreen.tap(cx, cy)   // 先激活
  await page.waitForTimeout(200)
  // 手动 touch 序列（playwright touchscreen 无 swipe，用 CDP 触发或 dispatch）
  await page.evaluate(({ cx, cy }) => {
    const el = document.elementFromPoint(cx, cy)
    const mk = (t, x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: cy })
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [mk('s', cx)], changedTouches: [mk('s', cx)], bubbles: true, cancelable: true }))
    for (let i = 1; i <= 8; i++) {
      const x = cx - i * 20
      el.dispatchEvent(new TouchEvent('touchmove', { touches: [mk('m', x)], changedTouches: [mk('m', x)], bubbles: true, cancelable: true }))
    }
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [mk('e', cx - 160)], bubbles: true, cancelable: true }))
  }, { cx, cy })
  await page.waitForTimeout(700)
  const stepAfter = await page.locator('#lprog').textContent()
  ok('#4 左滑翻页', stepBefore !== stepAfter, `lprog ${stepBefore} → ${stepAfter}`)
  await page.screenshot({ path: OUT + '/04b-after-swipe.png' })

  /* 对照组：点步骤条跳页（应始终可用） */
  await page.locator('[data-step="2"]').click()
  await page.waitForTimeout(400)
  ok('#4 点步骤条跳页（对照）', (await page.locator('#lprog').textContent()) === '2/5')
  /* pointer 事件桌面拖拽对照 */
  await page.locator('[data-step="1"]').click()
  await page.waitForTimeout(300)
  const sb = await page.locator('#stagewrap').boundingBox()
  await page.mouse.move(sb.x + sb.width - 30, sb.y + sb.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) { await page.mouse.move(sb.x + sb.width - 30 - i * 20, sb.y + sb.height / 2); await page.waitForTimeout(16) }
  await page.mouse.up()
  await page.waitForTimeout(600)
  ok('#4 鼠标拖拽翻页（对照）', (await page.locator('#lprog').textContent()) === '2/5')
  await ctx.close()
}

/* ---------- #5 拼读页：L1（无 blends 预期空白）vs L3（有 blends） ---------- */
for (const n of [1, 3]) {
  const { ctx, page } = await fresh()
  await page.goto(BASE + `?learn=${n}&step=4`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.screenshot({ path: OUT + `/05-blend-L${n}.png` })
  const cardText = await page.locator('#v-lesson .pcard >> nth=3').evaluate((el) => el.innerText.replace(/\s+/g, ' ').trim())
  const hasStage = await page.locator('.blenddrill .stage').count()
  const hasZt = await page.locator('.blenddrill .ztgrid').count()
  ok(`#5 L${n} 拼读页内容`, cardText.length > 10, `text="${cardText.slice(0, 60)}" stage=${hasStage} zt=${hasZt}`)
  await ctx.close()
}

/* ---------- #6 笔顺：a / b / ü 静态完成帧 ---------- */
for (const [n, li, k] of [[1, 0, 'a'], [3, 0, 'b'], [2, 2, 'ü']]) {
  const { ctx, page } = await fresh()
  await page.goto(BASE + `?learn=${n}&step=2&li=${li}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2600)   // 等动画播完
  const anim = page.locator('.animfit svg.strokeanim')
  const cnt = await anim.count()
  const done = cnt ? await anim.evaluate((el) => el.querySelectorAll('path:not(.ghost)').length + ' strokes, done-offset=' + [...el.querySelectorAll('path:not(.ghost)')].every((p) => p.style.strokeDashoffset === '0px' || p.style.strokeDashoffset === '0')) : 'NO SVG'
  await page.locator('.animfit').screenshot({ path: OUT + `/06-stroke-${k === 'ü' ? 'v' : k}.png` }).catch(() => {})
  ok(`#6 笔顺 ${k} 渲染`, cnt > 0 && String(done).includes('true'), done)
  await ctx.close()
}

/* ---------- #7 口诀小广播 ---------- */
{
  const { ctx, page } = await fresh()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.locator('[data-radio]').click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: OUT + '/07-radio.png' })
  const caps = await page.locator('#rcaps .cap').count()
  const pages = await page.locator('#v-radio .hspage').count()
  const prog = await page.locator('#v-radio .lprog').textContent()
  const big = await page.locator('#v-radio .big').count()
  ok('#7 口诀列表', caps > 0 && pages > 0 && big > 0, `caps=${caps} pages=${pages} big=${big} prog="${prog}"`)
  await ctx.close()
}

/* ---------- #8 注音对齐特写：长拼音单词行 ---------- */
{
  const { ctx, page } = await fresh()
  await page.goto(BASE + '?learn=1', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  /* 特写样板：直接注入长拼音测试行（多音节压短汉字）到当前屏 */
  const probe = await page.evaluate(() => {
    const d = document.createElement('div')
    d.id = 'ruby-probe'
    d.style.cssText = 'position:fixed;left:8px;right:8px;top:120px;z-index:999;background:#fff;border:2px solid #e76f51;border-radius:12px;padding:10px 14px;font-size:22px;font-weight:800;line-height:2.4'
    d.innerHTML =
      '<ruby>庄<rt>zhuāng</rt></ruby><ruby>上<rt>shàng</rt></ruby><ruby>一<rt>yī</rt></ruby><ruby>堵<rt>dǔ</rt></ruby><ruby>墙<rt>qiáng</rt></ruby>' +
      '<br><span class="rw"><ruby>装<rt>zhuāng</rt></ruby><ruby>作<rt>zuò</rt></ruby></span><span class="rw"><ruby>睡<rt>shuì</rt></ruby><ruby>觉<rt>jiào</rt></ruby></span>' +
      '<br><ruby>双<rt>shuāng</rt></ruby><ruby>人<rt>rén</rt></ruby><ruby>走<rt>zǒu</rt></ruby>'
    document.body.appendChild(d)
    return d.offsetHeight
  })
  await page.waitForTimeout(300)
  await page.locator('#ruby-probe').screenshot({ path: OUT + '/08-ruby-closeup.png' })
  ok('#8 注音特写样板', probe > 0, `h=${probe}`)
  /* 真实页面：口诀行注音 */
  await page.locator('#koujue').screenshot({ path: OUT + '/08-koujue-live.png' }).catch(() => {})
  await ctx.close()
}

await browser.close()
console.log('baseline done → ' + OUT)
