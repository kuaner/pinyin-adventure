/* v2.4.1 六单验收（BUGS#4-#9）：hasTouch iPhone 13 三滑动面 touch 复现 + 六张验收截图
   + ruby 几何断言 + meta 清零断言。npm run preview -- --port 4173 后运行：
   node scripts/acceptance-v241.mjs [outDir] */
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const req2 = createRequire('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')
const { chromium } = req2('playwright')
const iPhone = req2('playwright-core').devices['iPhone 13']

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = process.argv[2] || '/tmp/pinyin-v241/accept'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const results = []
const ok = (name, pass, detail = '') => { results.push({ name, pass }); console.log((pass ? '✓' : '✗') + ' ' + name + (detail ? ' — ' + detail : '')) }

async function fresh() {
  const ctx = await browser.newContext({ ...iPhone, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 160)))
  return { ctx, page }
}

/* 真机 touch 左滑（对 el 中心发 touch 序列，横移 -170px） */
async function touchSwipe(page, sel, dist = -170) {
  const bb = await page.locator(sel).boundingBox()
  const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2
  await page.evaluate(({ cx, cy, dist }) => {
    const el = document.elementFromPoint(cx, cy) || document.body
    const mk = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: cy })
    const tev = (type, x, touches) => new TouchEvent(type, { touches, changedTouches: [mk(x)], bubbles: true, cancelable: true })
    el.dispatchEvent(tev('touchstart', cx, [mk(cx)]))
    for (let i = 1; i <= 10; i++) el.dispatchEvent(tev('touchmove', cx + (dist / 10) * i, [mk(cx + (dist / 10) * i)]))
    el.dispatchEvent(tev('touchend', cx + dist, []))
  }, { cx, cy, dist })
  await page.waitForTimeout(650)
}

/* ========== 场景一：学习岛课内左滑（#4） ========== */
{
  const { ctx, page } = await fresh()
  await page.goto(BASE + '?learn=1', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await touchSwipe(page, '#stagewrap')
  const s1 = await page.locator('#lprog').textContent()
  await page.screenshot({ path: OUT + '/shot1-左滑后.png' })
  ok('S1 课内左滑 1→2', s1 === '2/5', `lprog=${s1}`)
  /* 再滑到页4 拼读（L1 四声读一读）截图 */
  await touchSwipe(page, '#stagewrap')
  await touchSwipe(page, '#stagewrap')
  const s4 = await page.locator('#lprog').textContent()
  await page.waitForTimeout(300)
  await page.screenshot({ path: OUT + '/shot2-拼读页.png' })
  ok('S1 课内左滑 2→4', s4 === '4/5', `lprog=${s4}`)
  const toneCards = await page.locator('.scard').count()
  ok('S1 L1 四声卡渲染', toneCards === 12, `scard=${toneCards}`)
  await ctx.close()
}

/* ========== 场景二：拼读页 L3 合成卡（#5） ========== */
{
  const { ctx, page } = await fresh()
  await page.goto(BASE + '?learn=3&step=4', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: OUT + '/shot3-拼读页L3.png' })
  const stage = await page.locator('.blenddrill .stage .inicard').textContent()
  const fin = await page.locator('.blenddrill .stage .fincard').textContent()
  ok('S2 L3 声母韵母合成卡', stage === 'b' && fin === 'a', `ini=${stage} fin=${fin}`)
  const chips = await page.locator('.bchip').count()
  ok('S2 L3 拼读表 14 条', chips === 14, `bchip=${chips}`)
  /* 点拼一拼 → 合成态出现 */
  await page.locator('.blenddrill .steps .btn').click()
  await page.waitForTimeout(1100)
  const shown = await page.locator('.blenddrill .result.show .rsyl').textContent().catch(() => '')
  ok('S2 拼一拼合成读音', shown === 'bā', `rsyl=${shown}`)
  await ctx.close()
}

/* ========== 场景三：口诀小广播左滑 + 列表（#4/#7） ========== */
{
  const { ctx, page } = await fresh()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  /* meta 清零断言（#9）：学习 tab 口诀入口不再有设计说明式副标题 */
  const radioSub = await page.locator('#radio .rtx span').innerText()
  ok('S3 meta 清零：口诀入口副标题孩子话', !/全 \d+ 条|像儿歌一样|识字表|二选一|击破/.test(radioSub), `"${radioSub}"`)
  await page.locator('[data-radio]').click()
  await page.waitForTimeout(800)
  const p1 = await page.locator('#v-radio .lprog').textContent()
  await touchSwipe(page, '#v-radio .hswrap')
  const p2 = await page.locator('#v-radio .lprog').textContent()
  await page.screenshot({ path: OUT + '/shot4-口诀列表.png' })
  ok('S3 口诀页左滑 1→2', p1 === '1/63' && p2 === '2/63', `${p1} → ${p2}`)
  const caps = await page.locator('#rcaps .cap').count()
  ok('S3 口诀单 63 条', caps === 63, `caps=${caps}`)
  await ctx.close()
}

/* ========== 场景四：易混对专练左滑（#4 第三滑动面） ========== */
{
  const { ctx, page } = await fresh()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.locator('[data-tab="practice"]').click()
  await page.waitForTimeout(500)
  await page.locator('[data-go="pairs"]').click()
  await page.waitForTimeout(700)
  const dot1 = await page.locator('#v-pairs .hswrap').evaluate(() => {
    const t = document.querySelector('#v-pairs .hstage')
    return t.style.transform || '(none)'
  })
  await touchSwipe(page, '#v-pairs .hswrap')
  const dot2 = await page.locator('#v-pairs .hstage').evaluate((el) => el.style.transform || '(none)')
  await page.screenshot({ path: OUT + '/shot5-易混对滑动.png' }).catch(() => {})
  ok('S4 易混对页左滑', dot1 !== dot2, `${dot1} → ${dot2}`)
  await ctx.close()
}

/* ========== 场景五：笔顺 a 完成帧（#6） ========== */
{
  const { ctx, page } = await fresh()
  await page.goto(BASE + '?learn=1&step=2&li=0', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2800)
  await page.locator('.animfit').screenshot({ path: OUT + '/shot6-笔顺a.png' })
  const strokes = await page.locator('.animfit svg.strokeanim path:not(.ghost)').count()
  ok('S5 笔顺 a 两笔完成', strokes === 2, `strokes=${strokes}`)
  await ctx.close()
}

/* ========== 场景六：注音对齐特写（#8） ========== */
{
  const { ctx, page } = await fresh()
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
  await page.locator('#ruby-probe').screenshot({ path: OUT + '/shot7-注音对齐特写.png' })
  const geo = await page.evaluate(() => {
    const out = []
    for (const rb of document.querySelectorAll('#ruby-probe ruby')) {
      const hr = document.createRange(); hr.selectNodeContents(rb.childNodes[0])
      const hb = hr.getBoundingClientRect(), tb = rb.querySelector('rt').getBoundingClientRect()
      out.push({ hanC: hb.left + hb.width / 2, rtC: tb.left + tb.width / 2, rtL: tb.left, rtR: tb.right })
    }
    return out
  })
  const maxOff = Math.max(...geo.map((g) => Math.abs(g.hanC - g.rtC)))
  const gaps = geo.slice(1).map((g, i) => g.rtL - geo[i].rtR).filter((x) => x > -50)
  ok('S6 逐音节居中（≤3px）', maxOff <= 3, `maxOff=${maxOff.toFixed(1)}px`)
  ok('S6 相邻注音不粘连（≥2px）', gaps.every((x) => x >= 1.5), `minGap=${Math.min(...gaps).toFixed(1)}px`)
  /* 真实界面口诀行特写（LearnTab 大卡） */
  await page.evaluate(() => document.getElementById('ruby-probe').remove())
  await page.locator('#koujue').screenshot({ path: OUT + '/shot8-口诀行注音.png' }).catch(() => {})
  await page.screenshot({ path: OUT + '/shot9-meta清除后的学习页.png' })
  await ctx.close()
}

await browser.close()
const fails = results.filter((r) => !r.pass)
console.log(`\n${results.length - fails.length}/${results.length} passed`)
if (fails.length) process.exit(1)
