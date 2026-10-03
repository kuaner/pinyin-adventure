/* specs/learn/heroCard —— Bug#43（kuaner 2026-10-03 08:02 截图）学习 tab 首页课程卡字模区：
   ① 多字母课（≥3）字模区只显「当前在学单元」单主角放大 + 单元数角标 chip（"N 个拼音"，与课名同行右上）——
      L12 整体认读 16 字母全挤四线格互相叠压/右上被卡片右缘裁切/灰字母贴脸课名 chip 的现场根除
      （口诀行随旧布局退场：修法正本=字模区只含主角+角标，完整口诀在课页与口诀小广播）
   ② 几何不变量（逐课参数化全 12 课）：字模互不叠压（Range 墨迹联合盒两两相交=0）、
      字模不被 flex 压缩溢出（scrollWidth≤clientWidth）、零越卡边界、零越四线格横向、零压课名/角标
   ③ 顶部「拼音岛」ruby 注音距页面顶缘 ≥8px（真机字体度量下 rt 被顶缘裁上半的修复，间距立法）
   ④ 单字母互动不回退：大字模点读出声（mp3 请求在档）、步进点/CTA 照常
   断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { unitIndexOf, lessonHasBlend } from '../../../../src/lib/lessonUnits.ts'
import lessonsData from '../../../../src/data/lessons.json' with { type: 'json' }

const t = new Tally('learn/heroCard Bug#43 课程卡单主角+角标+几何不变量')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'
const LESSONS = lessonsData.lessons

/* node 侧独立复算断点单元（与 LearnTab 同源 lessonUnits，种子 step={n:1} → 断点页 0） */
function expectHeroLetter(n) {
  const lesson = LESSONS[n - 1]
  const ui = unitIndexOf(lesson, 0)
  return ui < lesson.letters.length ? lesson.letters[ui].k : lesson.letters[0].k
}

/* 种子：第 n 课为当前在学（前面课全过、本课未过、断点=第 1 页=第 1 单元） */
function seedFor(n) {
  const stars = {}
  for (let i = 1; i < n; i++) stars[i] = 3
  return { u: n, stars, best: {}, step: { [n]: 1 } }
}

/* 几何测量（页内执行）：字模墨迹联合盒 两两叠压/越界/压 chip/压缩 计数 */
const MEASURE = () => {
  const spans = [...document.querySelectorAll('#letters .letter')]
  const uni = spans.map((s) => {
    const rg = document.createRange(); rg.selectNodeContents(s)
    const u = { t: Infinity, l: Infinity, r: -Infinity, b: -Infinity }
    for (const x of rg.getClientRects()) { u.t = Math.min(u.t, x.top); u.l = Math.min(u.l, x.left); u.r = Math.max(u.r, x.right); u.b = Math.max(u.b, x.bottom) }
    return { t: u.t, l: u.l, r: u.r, b: u.b }
  })
  const hero = document.querySelector('#hero').getBoundingClientRect()
  const zone = document.querySelector('#letters').getBoundingClientRect()
  const chip = document.querySelector('#hero .lchip').getBoundingClientRect()
  const badgeEl = document.querySelector('#hero [data-hero-badge]')
  const badge = badgeEl ? badgeEl.getBoundingClientRect() : null
  const hits = (x, r) => x.r > r.left + 2 && x.l < r.right - 2 && x.b > r.top + 2 && x.t < r.bottom - 2
  let overlaps = 0
  for (let i = 0; i < uni.length; i++) for (let j = i + 1; j < uni.length; j++) {
    const a = uni[i], c = uni[j]
    if (Math.min(a.r, c.r) - Math.max(a.l, c.l) > 1 && Math.min(a.b, c.b) - Math.max(a.t, c.t) > 1) overlaps++
  }
  return {
    n: uni.length,
    overlaps,
    /* 四线格=字模占满格设计（g 下伸部/h 上伸部越格线合法）；横向出格=真裁切风险（Bug#43 L7 w 右缘被裁） */
    outZone: uni.filter((x) => x.l < zone.left - 2 || x.r > zone.right + 2).length,
    outCard: uni.filter((x) => x.l < hero.left - 1 || x.r > hero.right + 1 || x.t < hero.top - 1 || x.b > hero.bottom + 1).length,
    hitChip: uni.filter((x) => hits(x, chip)).length,
    hitBadge: badge ? uni.filter((x) => hits(x, badge)).length : 0,
    squeezed: spans.filter((s) => s.scrollWidth > s.clientWidth + 1).length,
    glyphTexts: spans.map((s) => s.textContent.trim()),
  }
}

/* 全 12 课参数化（≥3 字母课=单主角方案；现课表最小 3 字母/课） */
for (let n = 1; n <= 12; n++) {
  const letters = LESSONS[n - 1].letters
  if (letters.length < 3) continue
  {
    const page = await app.newPage({ tier: 'newbie', mute: true, learn: seedFor(n) })
    await page.goto(`${BASE}/?open=learn`, { waitUntil: 'networkidle' })
    await page.waitForSelector('#v-learntab #hero #letters .letter', { timeout: 10000 })
    const want = expectHeroLetter(n)
    const m = await page.evaluate(MEASURE)
    t.ok(m.n === 1, `L${n}①：字模区单主角（当前在学单元放大，非 ${letters.length} 字全堆）`, `实见 ${m.n} 个: ${m.glyphTexts.join(',')}`)
    t.ok(m.glyphTexts[0] === want, `L${n}①：主角=当前在学单元 ${want}`, m.glyphTexts.join(','))
    const badge = await page.evaluate(() => {
      const el = document.querySelector('#hero [data-hero-badge]')
      if (!el) return null
      let text = el.textContent.replace(/\s/g, '')
      for (const r of el.querySelectorAll('rt')) text = text.split(r.textContent.replace(/\s/g, '')).join('')
      return { n: el.getAttribute('data-hero-badge'), text }
    })
    t.ok(!!badge && +badge.n === letters.length && badge.text.includes('个拼音'), `L${n}②：单元数角标 chip=${letters.length} 个拼音`, JSON.stringify(badge))
    t.ok(m.overlaps === 0, `L${n}③：字模墨迹零叠压`, `overlaps=${m.overlaps}`)
    t.ok(m.squeezed === 0, `L${n}③：字模零压缩溢出`, `squeezed=${m.squeezed}`)
    t.ok(m.outZone === 0, `L${n}③：字模零越四线格（横向）`, `outZone=${m.outZone}`)
    t.ok(m.outCard === 0, `L${n}③：字模零越卡片边界`, `outCard=${m.outCard}`)
    t.ok(m.hitChip === 0, `L${n}③：字模零压课名 chip`, `hitChip=${m.hitChip}`)
    t.ok(m.hitBadge === 0, `L${n}③：字模零压角标`, `hitBadge=${m.hitBadge}`)
    /* ④ 互动不回退：大字模热区 + 步进点 + CTA */
    const bj = await page.evaluate(() => {
      const r = document.querySelector('#letters .letterbtn').getBoundingClientRect()
      return { w: r.width, h: r.height }
    })
    t.ok(bj.w >= 48 && bj.h >= 48, `L${n}④：大字模点读热区 ≥48px`, JSON.stringify(bj))
    const unitN = letters.length + (lessonHasBlend(LESSONS[n - 1]) ? 1 : 0) + 1
    t.ok(await page.evaluate(`document.querySelectorAll('#steps5 i').length === ${unitN}`), `L${n}④：步进点=${unitN} 保留`)
    t.ok(await page.evaluate(() => { const b = document.querySelector('#cta'); return b && b.getBoundingClientRect().height > 40 }), `L${n}④：CTA 保留`)
    t.pageErrors(app.errors, `hero-l${n}`)
    await app.closePage(page)
  }
}

/* ④b 大字模点读出声（mp3 请求在档；mute 只静音不挡请求） */
{
  const page = await app.newPage({ tier: 'newbie', mute: false, learn: seedFor(12), routeMp3: true })
  await page.goto(`${BASE}/?open=learn`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#letters .letterbtn', { timeout: 10000 })
  const before = app.mp3.length
  await page.tap('#letters .letterbtn')
  await page.waitForTimeout(500)
  t.ok(app.mp3.length > before, '④b：L12 大字模点击触发点读（hyp mp3 请求）', app.mp3.slice(before).join(','))
  await app.closePage(page)
}

/* ③ 顶部「拼音岛」ruby 注音距顶缘 ≥8px（间距立法：真机字体度量下不再贴缘被裁） */
{
  const page = await app.newPage({ tier: 'newbie', mute: true, learn: seedFor(1) })
  await page.goto(`${BASE}/?open=learn`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.rowhead .h1 rt', { timeout: 10000 })
  const rt = await page.evaluate(() => {
    const r = document.querySelector('.rowhead .h1 rt').getBoundingClientRect()
    return { top: +r.top.toFixed(1), h: +r.height.toFixed(1) }
  })
  t.ok(rt.top >= 8, '③：拼音岛注音 rt 距页面顶缘 ≥8px（不被顶缘裁切）', JSON.stringify(rt))
  await app.closePage(page)
}

await app.close()
process.exit(t.finish())
