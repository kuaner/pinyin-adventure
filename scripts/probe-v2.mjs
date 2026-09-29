/* v2.1 设计语言专项度量（Read 截图在本运行时不可视 → 几何/样式断言替代目验）：
   波点壁纸、胶囊按钮、naive-icons 渲染、Nunito 字体、rt 暖棕+相对字号、
   词组 nowrap、pinyin-pro 运行时注音抽查（含多音字）。 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) }
catch { ({ chromium } = await import(process.argv[2] || '/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const results = []
const ok = (name, pass, detail = '') => { results.push(pass); console.log((pass ? '✓' : '✗') + ' ' + name + (detail ? ' — ' + detail : '')) }

/* ---- 首页 ---- */
await page.goto(BASE)
await page.click('#ulgo')
await page.waitForTimeout(600)
const home = await page.evaluate(() => {
  const btn = document.querySelector('.menu .btn')
  const bodyBg = getComputedStyle(document.body).backgroundImage
  const svg = document.querySelectorAll('#v-home svg').length
  const rt = document.querySelector('.appname rt')
  const rw = document.querySelectorAll('#v-home .rw').length
  return {
    bgDots: bodyBg.includes('radial-gradient'),
    btnPill: getComputedStyle(btn).borderRadius,
    btnShadow: getComputedStyle(btn).boxShadow.slice(0, 30),
    btnColor: getComputedStyle(btn).backgroundColor,
    svgs: svg,
    rtColor: rt ? getComputedStyle(rt).color : null,
    rtFs: rt ? getComputedStyle(rt).fontSize : null,
    rwSpans: rw,
    nunito: document.fonts.check('700 20px Nunito') || document.fonts.check('900 20px Nunito'),
    fontFamily: getComputedStyle(document.body).fontFamily.slice(0, 30),
    appnameRt: [...document.querySelectorAll('.appname rt')].map((r) => r.textContent).join(' '),
  }
})
ok('全局奶油波点壁纸', home.bgDots, home.bgDots ? 'radial-gradient ✓' : 'missing')
ok('按钮胶囊化(50px)', home.btnPill === '50px', home.btnPill)
ok('主按钮 teal 色板', home.btnColor === 'rgb(25, 200, 185)', home.btnColor)
ok('按压硬投影', home.btnShadow.includes('rgb('), home.btnShadow)
ok('首页 naive-icons 渲染(≥9 svg)', home.svgs >= 9, 'svg=' + home.svgs)
ok('Nunito 字体已加载', home.nunito, home.fontFamily)
ok('rt 暖棕色', home.rtColor === 'rgb(138, 122, 104)', String(home.rtColor))
ok('rt 相对字号 clamp(30px 正文→13px 顶)', home.rtFs === '13px', String(home.rtFs))
ok('词组 nowrap 分组(≥5)', home.rwSpans >= 5, '.rw=' + home.rwSpans)
ok('pinyin-pro 注音「拼音闯关大冒险」', home.appnameRt === 'pīn yīn chuǎng guān dà mào xiǎn', home.appnameRt)

/* ---- 闪电页（波点分区+多音字运行时抽查） ---- */
await page.goto(BASE + '?open=bolt')
await page.waitForTimeout(900)
const bolt = await page.evaluate(() => {
  const v = getComputedStyle(document.querySelector('#v-bolt')).backgroundImage
  const hud = [...document.querySelectorAll('.bolthud > span')].map((s) => s.textContent.trim()).join('|')
  const rts = [...document.querySelectorAll('#v-bolt rt')].map((r) => r.textContent)
  return { dots: v.includes('radial-gradient'), hud, lvs: rts.filter((x) => x === 'lǜ').length, las: rts.filter((x) => x === 'la').length }
})
ok('闪电页橙波点分区', bolt.dots)
ok('HUD 注音(已答/正确率)', bolt.hud.includes('dá') && bolt.lvs >= 1, bolt.hud)
/* 多音字运行时抽查挪到正反题页（见下） */

/* ---- 关卡页波点+图标 ---- */
await page.goto(BASE + '?open=levels')
await page.waitForTimeout(700)
const lv = await page.evaluate(() => ({
  dots: getComputedStyle(document.querySelector('#v-levels')).backgroundImage.includes('radial-gradient'),
  locks: document.querySelectorAll('.lvlcard svg').length,
}))
ok('关卡页绿波点分区', lv.dots)
ok('关卡卡锁形图标(未解锁关)', lv.locks >= 1, 'lock svg=' + lv.locks)

/* ---- 常见字页：锚点 rt 14px 保留 + zi 波点（quiz 页共用 v-quiz） ---- */
await page.goto(BASE + '?open=detect')
await page.waitForTimeout(900)
for (let r = 0; r < 5; r++) {
  const has = await page.evaluate(() => !!document.querySelector('#v-quiz .anchorbar rt'))
  if (has) break
  await page.goto(BASE + '?open=detect')
  await page.waitForTimeout(700)
}
const zi = await page.evaluate(() => {
  const rt = document.querySelector('#v-quiz .anchorbar rt')
  return { rtFs: rt ? getComputedStyle(rt).fontSize : null, glyph: document.querySelector('.anchorbar .anchar')?.textContent }
})
ok('锚点字模 rt 14px 特写保留', zi.rtFs === '14px', String(zi.rtFs) + '（' + zi.glyph + '）')
/* 多音字运行时抽查：正反题答对 → 反馈层夸奖语随机，重试至含「啦」的句子 */
let fbLa = { las: 0, text: '' }
for (let t = 0; t < 6 && fbLa.las === 0; t++) {
  if (t > 0) { await page.goto(BASE + '?open=detect'); await page.waitForTimeout(700) }
  await page.evaluate(() => { const q = window.__PJ.Q().q; document.querySelectorAll('#optbox .opt')[q.ans].click() })
  await page.waitForTimeout(700)
  fbLa = await page.evaluate(() => {
    const rts = [...document.querySelectorAll('#fb rt')].map((r) => r.textContent)
    return { las: rts.filter((x) => x === 'la').length, lvs: rts.filter((x) => x === 'lā').length, text: document.querySelector('#fbtext')?.textContent?.slice(0, 10) }
  })
}
ok('多音字「啦」轻声 la 且无 lā 本调（OVERRIDES 生效）', fbLa.las >= 1 && fbLa.lvs === 0, '「' + fbLa.text + '」la×' + fbLa.las + ' lā×' + fbLa.lvs)

await browser.close()
const failed = results.filter((r) => !r).length
console.log('\n===== v2 专项度量：' + (results.length - failed) + '/' + results.length + ' =====')
process.exit(failed ? 1 : 0)
