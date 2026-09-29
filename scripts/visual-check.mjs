/* 视觉度量校验（截图 Read 在当前运行时不可视 → 用可测量的几何断言替代肉眼）：
   字模字号 ≥ 规格、rt 注音渲染、390×844 无横向溢出、元素在视口内 */
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

async function overflowCheck(label) {
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  }))
  ok(label + ' 无横向溢出', m.sw <= m.cw + 1, 'scrollWidth=' + m.sw + ' clientWidth=' + m.cw)
}

/* 首页：ruby 注音密度 + 布局 */
await page.goto(BASE)
await page.click('#ulgo')
await page.waitForTimeout(500)
const home = await page.evaluate(() => ({
  rubies: document.querySelectorAll('#v-home ruby').length,
  rts: document.querySelectorAll('#v-home rt').length,
  btnCount: document.querySelectorAll('#v-home .menu .btn').length,
  appnameFs: getComputedStyle(document.querySelector('.appname')).fontSize,
}))
ok('首页全量注音（ruby≥30, rt≥30）', home.rubies >= 30 && home.rts >= 30, 'ruby=' + home.rubies + ' rt=' + home.rts)
ok('首页八入口', home.btnCount === 8, 'btn=' + home.btnCount)
ok('标题字号 30px', home.appnameFs === '30px', home.appnameFs)
await overflowCheck('首页')

/* 正反题：锚点 42px + 大字模 ≥84px + rt 12px + 镜像变换 */
await page.goto(BASE + '?open=detect')
await page.waitForTimeout(900)
const det = await page.evaluate(() => {
  const g = document.querySelector('#v-quiz .glyph')
  const rt = document.querySelector('#v-quiz .anchorbar rt')
  const anchar = document.querySelector('.anchorbar .anchar')
  return {
    glyphFs: getComputedStyle(g).fontSize,
    mirror: getComputedStyle(g).transform,
    rtFs: rt ? getComputedStyle(rt).fontSize : null,
    ancharFs: getComputedStyle(anchar).fontSize,
    tfOgFs: getComputedStyle(document.querySelector('.opt.tf .og')).fontSize,
  }
})
ok('正反大字模 ≥84px', parseFloat(det.glyphFs) >= 84, det.glyphFs)
ok('镜像 scaleX(-1) 生效', det.mirror.includes('-1'), det.mirror.slice(0, 40))
ok('锚点 rt 注音 14px（v1 特写）', det.rtFs === '14px', String(det.rtFs))
ok('锚点大字 42px', det.ancharFs === '42px', det.ancharFs)
ok('✅/🔄 选项图标 52px', det.tfOgFs === '52px', det.tfOgFs)
await overflowCheck('正反题页')

/* 闪电：选项字 62px + HUD 在位 */
await page.goto(BASE + '?open=bolt')
await page.waitForTimeout(800)
const bolt = await page.evaluate(() => {
  const og = document.querySelector('#bopt .opt .og')
  const isTf = !!document.querySelector('#bopt .opt.tf')
  return {
    ogFs: og ? getComputedStyle(og).fontSize : null,
    isTf,
    hudN: document.querySelectorAll('.bolthud > span').length,
    rts: document.querySelectorAll('#v-bolt rt').length,
  }
})
ok('闪电选项字 62px(字母)/46px(判断)', bolt.ogFs === (bolt.isTf ? '46px' : '62px'), String(bolt.ogFs) + (bolt.isTf ? ' [tf]' : ' [字母]'))
ok('闪电 HUD 三格', bolt.hudN === 3, 'hud=' + bolt.hudN)
ok('闪电页注音渲染', bolt.rts >= 4, 'rt=' + bolt.rts)
await overflowCheck('闪电页')

/* 常见字：汉字大字模 28vw≈109px */
await page.goto(BASE + '?open=zi')
await page.waitForTimeout(900)
const zi = await page.evaluate(() => {
  const g = document.querySelector('#v-quiz .glyph')
  return { fs: getComputedStyle(g).fontSize, text: g.textContent, optW: document.querySelector('#optbox .opt.wide') !== null }
})
ok('常见字字模 ≥96px', parseFloat(zi.fs) >= 96, zi.fs + '（' + zi.text + '）')
ok('拼音选项宽行布局', zi.optW)
await overflowCheck('常见字页')

/* 闪卡：背面口诀渲染 */
await page.goto(BASE + '?probe=flash')
await page.waitForTimeout(2500)
const fc = await page.evaluate(() => ({
  flipped: !!document.querySelector('.fcback'),
  kj: document.querySelector('.fckj')?.textContent?.slice(0, 12),
}))
ok('闪卡翻面背面(口诀+例词)', fc.flipped, fc.kj || '')

await browser.close()
const failed = results.filter((r) => !r).length
console.log('\n===== 视觉度量：' + (results.length - failed) + '/' + results.length + ' =====')
process.exit(failed ? 1 : 0)
