/* v2.9 学习模块全面重设计验收（BUGS#17+#18）：
   动态步骤架构（纯韵母 4 步/有声母 5 步）+ 小测三题型（听音选字母/看字母选音/听调辨调）
   + 步骤标签零截断 + 每页有返回/结算双按钮 + 布局三零（大空白/播放叠压/左缘碎片）+ 圆点题号同步
   跑法：npm run build && npm run preview（4173）→ BASE_URL=… node scripts/v290-accept.mjs
   输入走真实触摸/点击序列（hasTouch iPhone13 390×844；BUGS 6b/12 教训：el.click() 测不出事件死锁） */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = '.acceptance/v290'
fs.mkdirSync(OUT, { recursive: true })
let fails = 0
const ok = (cond, name, detail = '') => {
  console.log(`${cond ? '✓' : '✗ FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!cond) fails++
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, hasTouch: true })
const page = await ctx.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })
const lprog = () => page.$eval('#lprog', (el) => el.textContent.trim())
const railN = () => page.$$eval('#rail .rstep', (els) => els.length)
const dotsN = () => page.$$eval('#dots i', (els) => els.length)
const chipsVisible = () => page.$eval('[data-lchips]', (el) => !!el.offsetParent).catch(() => false)
const rnameOverflow = () => page.$$eval('#rail .rname', (els) => els.map((el) => ({ sw: el.scrollWidth, cw: el.clientWidth })))

/* 音频监听（两路）：请求层看首播缓存填充；play() 补丁看每次实播（AUDIO_CACHE 命中后
   play() 不发网络请求——只靠请求层会读到上一题的陈旧值，v2.9 首跑实测教训） */
let lastAudio = ''
page.on('request', (r) => {
  const m = r.url().match(/audio\/(?:hyp\/)?([A-Za-z0-9]+)\.mp3/)
  if (m) lastAudio = m[1]
})
await page.addInitScript(() => {
  const p = Audio.prototype.play
  Audio.prototype.play = function (...args) {
    try { window.__lastAudioSrc = this.currentSrc || this.src || '' } catch (e) { /* ignore */ }
    return p.apply(this, args)
  }
})
const playedName = async () => {
  const src = await page.evaluate(() => window.__lastAudioSrc || '')
  const m = String(src).match(/([A-Za-z0-9]+)\.mp3/)
  return m ? m[1] : ''
}

async function gotoLesson(params) {
  await page.goto(`${BASE}?${params}`, { waitUntil: 'load' })
  await page.waitForSelector('#v-lesson', { timeout: 8000 })
  await page.waitForTimeout(700)
}

/* ---------- A. 有声母课 L3：5 步架构 + 课页四步截图 ---------- */
await gotoLesson('learn=3&step=1&li=0')
ok((await lprog()) === '1/5', 'A1 L3 五步架构 lprog 1/5', `lprog=${await lprog()}`)
ok((await railN()) === 5 && (await dotsN()) === 5, 'A1 rail/dots = 5', `rail=${await railN()} dots=${await dotsN()}`)
const ro1 = await rnameOverflow()
ok(ro1.every((x) => x.sw <= x.cw + 1), 'A1 步骤标签零截断(5步)', JSON.stringify(ro1))
ok(await chipsVisible(), 'A1 认识页 chip 可见')
await shot('01-L3-认识')

await gotoLesson('learn=3&step=2&li=0')
ok((await lprog()) === '2/5', 'A2 写法 2/5', `lprog=${await lprog()}`)
await shot('02-L3-写法')

await gotoLesson('learn=3&step=3&li=0')
ok((await lprog()) === '3/5', 'A3 声调 3/5', `lprog=${await lprog()}`)
await shot('03-L3-声调')

await gotoLesson('learn=3&step=4&li=0')
ok((await lprog()) === '4/5', 'A4 拼读 4/5', `lprog=${await lprog()}`)
ok(!(await chipsVisible()), 'A4 拼读步 chip 隐藏（课级内容 Bug#16 延续）')
await shot('04-L3-拼读')

/* ---------- B. 左缘零碎片 + 播放按钮居中/不叠压 + qbody 填充（几何断言） ---------- */
{
  const geo = await page.$eval('#stagewrap', (wrap) => {
    const wr = wrap.getBoundingClientRect()
    const cards = [...wrap.querySelectorAll('.pcard')].map((c) => {
      const r = c.getBoundingClientRect()
      return { l: +r.left.toFixed(1), r: +r.right.toFixed(1) }
    })
    return { wl: wr.left, wr: wr.right, cards }
  })
  const intruder = geo.cards.filter((c) => c.r > geo.wl + 1 && c.l < geo.wr - 1).length
  ok(intruder === 1, 'B1 视口内仅当前卡片（左缘零碎片 #18⑥）', `cards=${JSON.stringify(geo.cards)}`)
}
await gotoLesson('learn=3&step=5&qkey=1')
ok((await lprog()) === '5/5', 'B2 小测步 5/5', `lprog=${await lprog()}`)
ok(!(await chipsVisible()), 'B2 小测步 chip 隐藏（考整课 #18②）')
/* 深链进小测步已自动建题（无 boot 键）；boot 仅在普通导航首见时出现 */
const boot0 = await page.$('[data-bootquiz]')
if (boot0) { await boot0.click(); await page.waitForTimeout(400) }
await page.waitForSelector('.qbody, [data-bootquiz]', { timeout: 4000 })
{
  const g = await page.$$eval('.pcard', (cards) => {
    const card = cards.find((c) => c.querySelector('.qbody'))
    if (!card) return null
    const cr = card.getBoundingClientRect()
    const body = card.querySelector('.qbody')
    const play = card.querySelector('[data-qplay]') || card.querySelector('[data-qglyph]')   /* look 题无播放键，锚点=大字模 */
    const tag = card.querySelector('.ptag')
    if (!body || !play || !tag) return null
    const br = body.getBoundingClientRect()
    const pr = play.getBoundingClientRect()
    const tr = tag.getBoundingClientRect()
    return {
      anchor: !!card.querySelector('[data-qplay]') ? 'play' : 'glyph',
      bodyFill: +(br.height / cr.height).toFixed(2),
      playCx: +((pr.left + pr.right) / 2 - cr.left).toFixed(1),
      cardCx: +(cr.width / 2).toFixed(1),
      clearTag: pr.top >= tr.bottom - 2,
    }
  }).catch((e) => 'ERR:' + e.message)
  ok(!!g && g !== null && g.bodyFill > 0.75, 'B3 qbody flex-grow 填充卡片（#18④）', JSON.stringify(g))
  ok(!!g && typeof g === 'object' && Math.abs(g.playCx - g.cardCx) <= 8, 'B3 播放按钮/题面锚点水平居中（#18⑤）', JSON.stringify(g))
  ok(!!g && typeof g === 'object' && g.clearTag, 'B3 播放按钮不叠压 ptag（#18⑤）', JSON.stringify(g))
}
await shot('05-小测答题')

/* 小测自动作答（probe 门 data-qkey + play() 实播补丁，全确定性）：
   listen=实播锚音认字母 / look=题面字模即答案 / tone=题音文件名声调号 */
async function answerQuiz() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const trace = []
    for (let qi = 0; qi < 5; qi++) {
      await page.waitForTimeout(500)
      const isTone = await page.$('.topt')
      const isLook = await page.$('.optear')
      const qtag = await page.$eval('.ptag.hot', (el) => { const c = el.cloneNode(true); c.querySelectorAll('rt').forEach((r) => r.remove()); return c.textContent.trim() }).catch(() => '?')
      if (isTone) {
        await page.click('[data-qplay]')
        await page.waitForTimeout(500)
        const t = parseInt((await playedName()).slice(-1), 10)
        await page.click(`.opts .topt[data-qkey="${t >= 1 && t <= 4 ? t : 1}"]`)
      } else if (isLook) {
        const glyph = await page.$eval('[data-qglyph]', (el) => el.textContent.trim())
        await page.click(`.opts .optear[data-qkey="${glyph}"]`)
      } else {
        await page.click('[data-qplay]')
        await page.waitForTimeout(500)
        const k = await playedName()
        await page.click(`.opts [data-qkey="${k}"]`).catch(async () => { await page.click('.opts .opt:not(.topt):first-child') })
      }
      await page.waitForTimeout(600)
      /* pick 类在 answer() 同步设置，过场前读得到；600ms 后再等过场 */
      const cls = await page.$$eval('.opts .opt', (els) => els.map((e) => e.classList.contains('right') ? 'R' : e.classList.contains('wrong') ? 'W' : '?')).catch(() => ['x'])
      trace.push(`${qtag}${isTone ? '[tone]' : isLook ? '[look]' : '[listen]'}:${cls.join('')}`)
      await page.waitForTimeout(2800)
      if (await page.$('.res')) break
    }
    await page.waitForTimeout(600)
    const dual = await page.$$eval('.res .resbtns button', (els) => els.map((e) => e.getAttribute('data-restudy') !== null ? 'restudy' : e.getAttribute('data-backlearn') !== null ? 'back' : '?'))
    const passed = !!(await page.$('.res .resstars'))
    ok(dual.length === 2 && dual[0] !== dual[1], `B4 结算双按钮(回课程地图+再学一遍) attempt=${attempt}`, JSON.stringify(dual))
    const scoreTxt = await page.$eval('.res .resscore', (el) => { const c = el.cloneNode(true); c.querySelectorAll('rt').forEach((r) => r.remove()); return c.textContent }).catch(() => '')
    console.log(`  trace[${attempt}]: ${trace.join(' ')}  score=${scoreTxt}`)
    await shot('06-小测结算')
    if (passed) return true
    await page.click('[data-restudy]')
    await page.waitForTimeout(500)
    const boot2 = await page.$('[data-bootquiz]')
    if (boot2) { await boot2.click(); await page.waitForTimeout(400) }
  }
  return false
}
const passed = await answerQuiz()
ok(passed, 'B5 小测 4/5 门槛通关路径可走通（≤3 轮）')
ok(pageErrors.length === 0, 'B6 全程零 pageerror', pageErrors.join(' | '))

/* ---------- C. 纯韵母课 L1：4 步架构（无拼读页） ---------- */
await gotoLesson('learn=1&step=1&li=0')
ok((await lprog()) === '1/4', 'C1 L1 四步架构 lprog 1/4', `lprog=${await lprog()}`)
ok((await railN()) === 4 && (await dotsN()) === 4, 'C1 rail/dots = 4', `rail=${await railN()} dots=${await dotsN()}`)
const ro2 = await rnameOverflow()
ok(ro2.every((x) => x.sw <= x.cw + 1), 'C1 步骤标签零截断(4步)', JSON.stringify(ro2))
ok(!(await page.$('#rail [data-step="4"].rstep .rname')) === false, 'C1 第4步存在（=小测）')
const step4name = await page.$eval('#rail [data-step="4"] .rname', (el) => el.textContent.trim())
ok(!step4name.includes('拼读'), 'C1 L1 无拼读步，第4步≠拼读', step4name)
await shot('07-L1-纯韵母四步')

/* L1 深链 step=4（=小测步，动态 NSTEP 深链适配） */
await gotoLesson('learn=1&step=4')
ok((await lprog()) === '4/4', 'C2 L1 深链小测步 4/4', `lprog=${await lprog()}`)
await page.waitForTimeout(300)
const l1types = await page.$$eval('.opts .opt', (els) => els.map((e) => ({ ear: !!e.querySelector('svg'), mark: e.classList.contains('topt'), txt: e.textContent.trim() })))
ok(l1types.length >= 3 && l1types.length <= 4, 'C2 L1 小测选项数 3-4（不超纲池）', JSON.stringify(l1types))

/* 题型走查：乱答走完一整卷（5 题），逐题记录题型 DOM 标记（.topt/.optear/字母键） */
async function walkTypes(learnParams) {
  await page.goto(`${BASE}?${learnParams}`, { waitUntil: 'load' })
  await page.waitForSelector('#v-lesson', { timeout: 8000 })
  await page.waitForTimeout(500)
  const boot = await page.$('[data-bootquiz]')
  if (boot) { await boot.click(); await page.waitForTimeout(350) }
  const seen = []
  for (let qi = 0; qi < 5; qi++) {
    if (await page.$('.topt')) seen.push('tone')
    else if (await page.$('.optear')) seen.push('look')
    else seen.push('listen')
    await page.click('.opts .opt:first-child')
    await page.waitForTimeout(2600)
    if (await page.$('.res')) break
  }
  return seen
}

/* L1 韵母课：一整卷走查——三种题型全出现（types 首三题=三型洗牌排列，构造性保证） */
{
  const seen = await walkTypes('learn=1&step=4')
  ok(seen.includes('tone'), 'C3 L1（韵母课）听调辨调题出现', seen.join(','))
  ok(seen.includes('listen') && seen.includes('look'), 'C3 听音/看字两题型出现', seen.join(','))
}

/* ---------- D. L3 声母课整卷无听调题 ---------- */
{
  const seen = await walkTypes('learn=3&step=5')
  ok(!seen.includes('tone'), 'D1 L3（声母课）无听调题', seen.join(','))
}

/* ---------- E. LearnTab 断点动态适配（L1 CTA 不指向拼读）+ 步点数 ---------- */
await page.goto(`${BASE}`, { waitUntil: 'load' })
await page.evaluate(() => { localStorage.setItem('pinyin_learn', JSON.stringify({ u: 2, stars: { 1: 3 }, best: {}, step: { 2: 4 } })) })
await page.goto(`${BASE}`, { waitUntil: 'load' })
await page.waitForSelector('#v-learntab', { timeout: 8000 })
await page.waitForTimeout(500)
{
  const cta = await page.$eval('#cta', (el) => { const c = el.cloneNode(true); c.querySelectorAll('rt').forEach((r) => r.remove()); return c.textContent })
  const dots = await page.$$eval('#steps5 i', (els) => els.length)
  ok(dots === 4, 'E1 L1（当前课）hero 步点=4', `dots=${dots}`)
  ok(!cta.includes('拼读') && cta.includes('小测'), 'E1 L1 CTA 步名=小测（不指向拼读）', cta.trim())
}

/* ---------- F. 真实触摸滑动回归（动态 NSTEP 下 HSteps 触屏翻页） ---------- */
await gotoLesson('learn=3&step=1&li=0')
async function swipe() {
  const st = await page.$('#stagewrap')
  const box = await st.boundingBox()
  const y = box.y + box.height / 2
  const steps = 9
  const x0 = box.x + box.width - 30, x1 = box.x + 30
  /* CDP 派发真实 touch 序列（playwright touchscreen 无 swipe，手搓 move 链） */
  const cdp = await ctx.newCDPSession(page)
  const tf = (x, yy, phase) => cdp.send('Input.dispatchTouchEvent', {
    type: phase, touchPoints: phase === 'touchEnd' ? [] : [{ x, y: yy, id: 1 }],
  })
  await tf(x0, y, 'touchStart')
  for (let i = 1; i <= steps; i++) await tf(x0 + ((x1 - x0) * i) / steps, y, 'touchMove')
  await tf(0, 0, 'touchEnd')
}
await swipe()
await page.waitForTimeout(700)
ok((await lprog()) === '2/5', 'F1 触摸滑动 1→2（hasTouch 真序列）', `lprog=${await lprog()}`)

/* ---------- 汇总 ---------- */
const ovf = await page.$eval('#v-lesson', (el) => el.scrollHeight - el.clientHeight).catch(() => 'n/a')
if (ovf !== 'n/a') ok(ovf <= 0, 'F2 lesson 零纵向滚动', `overflow=${ovf}`)
console.log(`\n${fails === 0 ? 'ALL PASS' : fails + ' FAILS'} — screenshots at ${OUT}/`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
