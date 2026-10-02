/* specs/learn/stroke —— 学一学字模合体（BUGS#31）+ 四线格视觉（BUGS#26）+ 音频预载（BUGS#23 前半）：
   ① 单 z：学一学页 .strokeanim svg 恰 1（=字模本体），静态大字模/旧结构零残留；进页自动播（笔画显形中）
   ② idleDone：翻去声调页后身后字模=定格完整字（全部笔画显形）+零编号徽章；滑回=重播
   ③ 全部播放键 ≥48×48（读音/口诀/看笔顺/声调跟我读/辨调replay/小测qplay）+ 读音点击真实发起音频请求
   ④ 四线格几何：字模 svg 吃满面板（底部 inset ≤20px）/首格线贴标题（≤30px）/字模高 ≥90px/格线色宽
   ⑤ 口诀广播（PinyinCard full 档第二消费方）：单 svg+读音键 ≥48+零纵向滚动+63 页挂载当前页不塌陷
   迁移自：v31-accept + v312-accept（B/C 段；v312 A 段预载→pwa/audioAssets）。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { openLesson, lessonState, swipeLeft, curScope, glyphState, btnBox, ge48 } from '../../flows/gotoLesson.mjs'
import { sleep } from '../../flows/assert.mjs'

const t = new Tally('learn/stroke 字模合体+四线格+播放键几何')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* ① L1 a 学一学：单 z + 自动播 + 🔊 三键几何 + 读音点击真实音频请求 */
{
  const page = await app.newPage({ tier: 'mid', dpr: 3 })
  const audioReqs = []
  page.on('request', (r) => { if (r.url().includes('/audio/')) audioReqs.push(r.url()) })
  await openLesson(page, 1)
  let sc = await curScope(page)
  let g = await glyphState(page, sc)
  t.ok(g.svgs === 1, '页内 svg 字模恰 1 个（唯一 z）', `svg=${g.svgs}`)
  t.ok(g.big === 0 && g.glyphfit === 0 && g.strokewrap === 0 && g.mainbtn === 0, '静态大字模/旧结构零残留', JSON.stringify(g))
  await sleep(900)
  g = await glyphState(page, sc)
  t.ok(g.visible > 0, '笔顺动画进页自动播（笔画显形中）', `visible=${g.visible}/${g.inks}`)
  for (const [sel, name] of [['[data-pcread]', '读音键'], ['[data-pckj]', '口诀键'], ['[data-pcreplay]', '看笔顺键']]) {
    const b = await btnBox(page, sc, sel)
    t.ok(ge48(b), `${name} ≥48×48`, b ? `${b.w}×${b.h}` : 'missing')
  }
  await page.locator(`${sc} [data-pcread]`).click()
  await sleep(250)
  const pingOn = await page.evaluate((s) => !!document.querySelector(`${s} [data-pcread].ping`), sc)
  t.ok(pingOn, '读音键点击 ping 动效反馈')
  t.ok(audioReqs.length > 0, '读音点击发起真实音频请求', `${audioReqs.length} req`)
  await app.closePage(page)
}

/* ② idleDone：身后字模定格完整字 + 零徽章；滑回重播 + 声调页按钮几何 */
{
  const page = await app.newPage({ tier: 'mid' })
  await openLesson(page, 1)
  await sleep(3600)   /* 等 a 动画播完 */
  await swipeLeft(page)
  await sleep(500)
  let s = await lessonState(page)
  t.ok(s.transform !== 0, '左滑到声调页', `transform=${s.transform}`)
  const sc = await curScope(page)
  const tb = await btnBox(page, sc, '.tonedrill .trow .btn')
  t.ok(ge48(tb), '声调 跟我读/听音练 ≥48×48', tb ? `${tb.w}×${tb.h}` : 'missing')
  await page.locator(`${sc} .tonedrill .trow .btn.green`).click()
  await sleep(450)
  const rp = await btnBox(page, sc, '.tonedrill .replay')
  t.ok(ge48(rp), '声调辨调 replay 钮 ≥48×48', rp ? `${rp.w}×${rp.h}` : 'missing')
  const behind = await glyphState(page, '#v-lesson .hstage > .hspage:nth-child(1)')
  t.ok(behind.visible === behind.inks && behind.inks > 0, '身后字模定格完整字（idleDone 全显形）', `${behind.visible}/${behind.inks}`)
  t.ok(behind.badges === 0, 'idle 态零编号徽章（纯字模观感）', `badges=${behind.badges}`)
  /* 滑回=重播：chip 回跳等价翻页路径 */
  await page.evaluate(() => { document.querySelector('[data-lchips] .lchip').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await sleep(700)
  const sc2 = await curScope(page)
  await sleep(500)
  const g = await glyphState(page, sc2)
  t.ok(g.visible > 0 && g.visible < g.inks + 1, '滑回学一学重播（笔画再显形中）', `visible=${g.visible}/${g.inks}`)
  await app.closePage(page)
}

/* ③④ L7 z 页单 z + 三键几何 + 四线格几何（v312 #26 before 值对照） */
{
  const page = await app.newPage({ tier: 'mid', dpr: 3, learn: { u: 8, stars: { 7: 3 }, best: {}, step: {} } })   /* L7 记星=重学不拦（BUGS#33） */
  await page.goto(`${BASE}/?open=lesson&learn=7&li=0&qkey=1`, { waitUntil: 'networkidle' })   /* qkey 门：look 题可确定性作答翻题 */
  await page.waitForSelector('#v-lesson .hspage', { timeout: 10000 })
  const sc = await curScope(page)
  const g = await glyphState(page, sc)
  t.ok(g.svgs === 1 && g.big === 0, 'L7 z 页单 z（svg=1 无字体字模）', `svg=${g.svgs} big=${g.big}`)
  for (const [sel, name] of [['[data-pcread]', '读音键'], ['[data-pckj]', '口诀键'], ['[data-pcreplay]', '看笔顺键']]) {
    const b = await btnBox(page, sc, sel)
    t.ok(ge48(b), `z 页 ${name} ≥48×48`, b ? `${b.w}×${b.h}` : 'missing')
  }
  await sleep(4200)   /* 笔顺播完回定格，几何口径一致 */
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
      insetBot: +(H.b - S.b).toFixed(1), heroH: +H.h.toFixed(1), svgH: +S.h.toFixed(1),
      titleToGrid: +(lines[0].y - P.b).toFixed(1),
      glyphH: +(gBot - gTop).toFixed(1),
      lines,
    }
  })
  t.ok(geo.insetBot <= 20 && geo.svgH >= geo.heroH - 40, '字模 svg 吃满面板（底部 inset ≤20px）', `svg ${geo.svgH}/${geo.heroH} bot ${geo.insetBot}（before 92）`)
  t.ok(geo.titleToGrid >= 0 && geo.titleToGrid <= 30, '首格线避开角标且贴近（0..30px）', `${geo.titleToGrid}px（before 116.4）`)
  t.ok(geo.glyphH >= 90, '字母字模高 ≥90px', `${geo.glyphH}px（before 49.8）`)
  const c1 = geo.lines.find((l) => l.stroke === 'rgb(220, 216, 209)')
  const c2 = geo.lines.find((l) => l.stroke === 'rgb(179, 164, 138)')
  t.ok(!!c1 && c1.sw === '2px', '上/下格线 = --animal-border #dcd8d1 @2px')
  t.ok(!!c2 && c2.sw === '2.4px', '中间格线 = #b3a48a @2.4px（加深档）')
  /* 小测 qplay ≥48（复核；look 题无 qplay 则作答翻到 listen/tone 题再量） */
  await page.locator('[data-punit="quiz"]').click()
  await sleep(650)
  const scq = await curScope(page)
  let qp = null
  for (let i = 0; i < 6 && !qp; i++) {
    qp = await btnBox(page, scq, '.qplay')
    if (qp) break
    const glyph = await page.$eval('[data-qglyph]', (el) => el.textContent.trim()).catch(() => '')
    if (glyph) await page.click(`.opts .optear[data-qkey="${glyph}"]`, { timeout: 2500 }).catch(() => {})
    await sleep(2600)
  }
  t.ok(ge48(qp), '小测 qplay ≥48×48', qp ? `${qp.w}×${qp.h}` : 'missing')
  await app.closePage(page)
}

/* ⑤ 口诀广播（full 档第二消费方）：63 页挂载恒定、当前页 svg 可见不塌陷 + 零滚动 */
{
  const page = await app.newPage({ tier: 'mid' })
  await page.goto(`${BASE}/?open=radio`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-radio .hspage', { timeout: 10000 })
  await sleep(1500)
  const radio = await page.evaluate(() => {
    const vw = innerWidth
    const vis = [...document.querySelectorAll('.strokeanim')].filter((s) => {
      const r = s.getBoundingClientRect()
      return r.width > 0 && r.right > 0 && r.left < vw
    })
    const pg = document.querySelector('#v-radio .hstage > .hspage:nth-child(1)')
    const r = pg.querySelector('[data-pcread]')?.getBoundingClientRect()
    return {
      svgs: document.querySelectorAll('.strokeanim').length, visible: vis.length, h: +vis.map((s) => s.getBoundingClientRect().height.toFixed(1))[0] || 0,
      readW: r ? Math.round(r.width) : 0, readH: r ? Math.round(r.height) : 0,
      big: pg.querySelectorAll('.pc-big').length,
      docScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }
  })
  t.ok(radio.svgs === 63 && radio.visible === 1 && radio.h >= 40, 'radio 63 页挂载恒定、当前页 svg 可见不塌陷', JSON.stringify(radio))
  t.ok(radio.big === 0, 'radio 展开区单 z（无静态字模）')
  t.ok(radio.readW >= 48 && radio.readH >= 48, 'radio 读音键 ≥48×48', `${radio.readW}×${radio.readH}`)
  t.ok(radio.docScroll === 0, 'radio 零纵向滚动')
  await app.closePage(page)
}

t.pageErrors(app.errors, 'stroke 全程')
await app.close()
process.exit(t.finish())
