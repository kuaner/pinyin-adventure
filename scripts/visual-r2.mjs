/* 视觉迭代轮 2：v2 设计语言特有风险审计（胶囊按钮裁字/rt 下限/图标基线/rw 词组换行/长按钮溢出） */
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

/* 首页：两行闪电/常见字按钮（胶囊 50px 圆角 + 竖排双行文本） */
await page.goto(BASE)
await page.click('#ulgo')
await page.waitForTimeout(600)
const home = await page.evaluate(() => {
  const bolt = document.querySelector('[data-go="bolt]')
  const b = document.querySelector('[data-go="bolt"]')
  const zi = document.querySelector('[data-go="zi"]')
  const btns = [...document.querySelectorAll('.menu .btn')]
  const r2 = document.querySelector('.foot')
  return {
    boltText: b?.textContent.trim(),
    boltOverflow: b ? b.scrollWidth > b.clientWidth + 1 : null,
    ziOverflow: zi ? zi.scrollWidth > zi.clientWidth + 1 : null,
    anyOverflow: btns.filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent.trim().slice(0, 8)),
    anyVertOverflow: btns.filter((x) => x.scrollHeight > x.clientHeight + 2).map((x) => x.textContent.trim().slice(0, 8)),
    footRt: r2 ? getComputedStyle(r2.querySelector('rt') || r2).fontSize : null,
    iconBtnGap: (() => {
      const btn = document.querySelector('[data-go="levels"]')
      const svg = btn.querySelector('svg')
      const txt = btn.querySelector('ruby')
      if (!svg || !txt) return null
      return Math.round(txt.getBoundingClientRect().top - svg.getBoundingClientRect().top)
    })(),
  }
})
ok('闪电双行按钮无横向裁字', !home.boltOverflow, '「' + home.boltText + '」')
ok('常见字双行按钮无横向裁字', !home.ziOverflow)
ok('八入口按钮零横向溢出', home.anyOverflow.length === 0, JSON.stringify(home.anyOverflow))
ok('八入口按钮零纵向裁字', home.anyVertOverflow.length === 0, JSON.stringify(home.anyVertOverflow))
ok('图标与文字行顶对齐(±14px 内)', home.iconBtnGap !== null && Math.abs(home.iconBtnGap) <= 14, 'Δtop=' + home.iconBtnGap)

/* rt 下限：12px foot 语境 rt=10px 下限（clamp） */
await page.goto(BASE + '?open=bolt')
await page.waitForTimeout(800)
const bolt = await page.evaluate(() => {
  const rts = [...document.querySelectorAll('#v-bolt rt')]
  const minFs = Math.min(...rts.map((r) => parseFloat(getComputedStyle(r).fontSize)))
  const sub = document.querySelector('#boltstop')
  return { minFs, subOverflow: sub ? sub.scrollWidth > sub.clientWidth + 1 : null, rwN: document.querySelectorAll('#v-bolt .rw').length }
})
ok('rt 字号 ≥10px 下限（小文本语境）', bolt.minFs >= 10, 'min=' + bolt.minFs + 'px')
ok('闪电页词组 nowrap 分组', bolt.rwN >= 5, '.rw=' + bolt.rwN)

/* 闯关答题页：题干/选项/进度条 + Icon 对号/叉号线条可读性（尺寸断言） */
await page.goto(BASE + '?probe=full')
await page.waitForTimeout(6000)
const quiz = await page.evaluate(() => {
  const opt = document.querySelector('#optbox .opt')
  return {
    optH: opt ? opt.getBoundingClientRect().height : 0,
    svgInOpt: !!opt?.querySelector('svg') || document.querySelectorAll('#v-quiz svg').length > 0,
    progress: !!document.querySelector('.pfill'),
  }
})
ok('闯关答题选项高度正常(≥76px)', quiz.optH >= 76, Math.round(quiz.optH) + 'px')
ok('闯关页图标渲染', quiz.svgInOpt)

/* 结算页：星星图标 + rw 词组 */
await page.waitForTimeout(9000)
const res = await page.evaluate(() => {
  const stars = document.querySelectorAll('#rstars svg').length
  const overflow = document.querySelector('#v-result') ? document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 : null
  return { stars, overflow }
})
ok('结算页三颗星图标', res.stars === 3, 'svg=' + res.stars)
ok('结算页无横向溢出', res.overflow)
await page.screenshot({ path: '.acceptance/6-result.png' })

await browser.close()
const failed = results.filter((r) => !r).length
console.log('\n===== 轮2 审计：' + (results.length - failed) + '/' + results.length + ' =====')
process.exit(failed ? 1 : 0)
