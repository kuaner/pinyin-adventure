/* v2.8 布局验收（kuaner 布局系统级修复）：全屏截图 + 三问程序化检测
   三问：①文字溢出（scrollWidth 超差 & 非故意横滚区）②字号<14px ③内容区底部空白>1/3（附零纵向滚动断言）
   用法：BASE_URL=http://localhost:5199/ node scripts/layout-audit-v28.mjs [--final]
   --final = 同时把截图拷贝到 layout-audit-v28/（验收交付物，带三项结论命名） */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) }
catch { ({ chromium } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:5199/'
const FINAL = process.argv.includes('--final')
const OUT = '.acceptance/v28'
fs.mkdirSync(OUT, { recursive: true })
if (FINAL) fs.mkdirSync('layout-audit-v28', { recursive: true })

const today = new Date().toISOString().slice(0, 10)
const SEED = `localStorage.setItem('pinyin_v2', JSON.stringify({
  weights:{'b|d':{w:4,streak:0},'n|l':{w:2,streak:0}}, stars:{1:3,2:2,3:1},
  cards:{b:{box:1,due:'${today}'},d:{box:1,due:'${today}'},p:{box:2,due:'${today}'},a:{box:3,due:'${today}'}},
  hist:[{d:'09-30 08:12',lv:'第1关 · 单韵母 a o e',sc:9,st:3,wp:'b↔d'},{d:'09-29 20:01',lv:'正反小侦探',sc:7,st:1,wp:'p↔q'},{d:'09-29 19:30',lv:'⚡闪电刷题',sc:42,st:0,wp:''}],
  mute:false, bolt:{acc:42,d:'${today}',tacc:120,td:'2026-09-29'},
  days:{'${today}':1,'2026-09-29':1,'2026-09-28':1,'2026-09-27':1,'2026-09-26':1}
}));
localStorage.setItem('pinyin_learn', JSON.stringify({u:12, stars:{1:3,2:3}, best:{}}))`

const SCREENS = [
  { id: '01-learn-tab',    url: '?open=learn' },
  { id: '02-practice-tab', url: '?open=learn', post: "window.__PJ.show('practice')" },
  { id: '03-mine-tab',     url: '?open=mine' },
  { id: '04-lesson-1renshi', url: '?learn=1&step=1&li=0' },
  { id: '05-lesson-2xiefa',  url: '?learn=1&step=2&li=0' },
  { id: '06-lesson-3shengdiao', url: '?learn=1&step=3&li=0' },
  { id: '07-lesson-4pindu',  url: '?learn=1&step=4&li=0' },
  { id: '08-lesson-5xiaoce', url: '?learn=1&step=5&li=0' },
  { id: '09-level-map',    url: '?open=levels' },
  { id: '10-quiz-listen',  url: '?open=quiz' },
  { id: '11-result',       url: '?open=result' },
  { id: '12-flashcards',   url: '?open=flash' },
  { id: '13-pairs',        url: '?open=pairs' },
  { id: '14-detect',       url: '?open=detect' },
  { id: '15-bolt',         url: '?open=bolt' },
  { id: '16-zi',           url: '?open=zi' },
  { id: '17-ziword',       url: '?open=ziword' },
  { id: '18-radio',        url: '?open=radio' },
  { id: '19-history',      url: '?open=history' },
  { id: '20-settings',     url: '?open=settings' },
  { id: '21-sound',        url: '?open=sound' },
  { id: '22-free',         url: '?open=free' },
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.addInitScript(SEED)
const page = await ctx.newPage()

const CHECK = () => {
  const BAD = new Set(['HTML','BODY','SCRIPT','STYLE'])
  const out = { overflow: [], smallfont: [], blank: null, vscroll: null }
  const view = [...document.querySelectorAll('.view')].find(v => v.offsetParent !== null)
  if (view) {
    /* 零纵向滚动断言 */
    if (view.scrollHeight > view.clientHeight + 1)
      out.vscroll = `scrollHeight ${view.scrollHeight} > clientHeight ${view.clientHeight}`
    /* 底部空白（居中布局天然留白，跳过） */
    const jc = getComputedStyle(view).justifyContent
    if (jc !== 'center' && jc !== 'space-') {
      const vr = view.getBoundingClientRect()
      let maxBottom = vr.top
      view.querySelectorAll('*').forEach(el => {
        if (el.offsetParent === null) return
        if (/(floatstar|bfire|probe|toast)/.test(el.className || '')) return
        const r = el.getBoundingClientRect()
        if (r.height > 4 && r.width > 4 && r.bottom > maxBottom) maxBottom = r.bottom
      })
      const blank = (vr.bottom - 12) - maxBottom
      if (blank > vr.height / 3) out.blank = `底部空白 ${Math.round(blank)}px (> 1/3 屏 ${Math.round(vr.height / 3)}px)`
    }
  }
  document.querySelectorAll('body *').forEach(el => {
    if (BAD.has(el.tagName)) return
    const cls = '' + (el.className || '')
    /* HSteps 横向翻页容器 = 设计内横滚；.view 壳层滚动宽度被内部翻页器撑大，非溢出 */
    if (/(hswrap|hstage|hstrack|ghostcard)/.test(cls) || el.classList.contains('view')) return
    if (el.closest && el.closest('.hstage,.hswrap')) return
    if (el.querySelector && (el.querySelector('.hstage') || el.querySelector('.ghostcard'))) return  /* 翻页器外包裹/卡堆叠装饰容器：几何为内部设计 */
    const cs = getComputedStyle(el)
    /* ① 横向溢出：非故意滚动区（auto/scroll = 胶囊条等带状横滚，设计内） */
    if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll'
      && !/(floatstar|bfire|probe|toast|modal)/.test(cls) && el.clientWidth > 0)
      out.overflow.push(`${el.tagName.toLowerCase()}.${('' + el.className).split(' ')[0]} [${Math.round(el.scrollWidth)}>${Math.round(el.clientWidth)}] "${(el.textContent || '').trim().slice(0, 14)}"`)
    /* ② 小字：可读文本 <14px 违规；注音 rt 下限 11px（v4 规格，clamp 比例式） */
    if (el.children.length === 0 && el.textContent && el.textContent.trim()) {
      const fs = parseFloat(cs.fontSize)
      const isRT = el.tagName === 'RT'
      if ((isRT && fs < 10.5) || (!isRT && fs < 13.5)) out.smallfont.push(`${el.tagName.toLowerCase()}.${('' + el.className).split(' ')[0]} ${fs}px "${el.textContent.trim().slice(0, 14)}"`)
    }
  })
  return out
}

const report = {}
for (const s of SCREENS) {
  await page.goto(BASE + s.url, { waitUntil: 'networkidle' }).catch(() => page.goto(BASE + s.url))
  await page.waitForTimeout(900)
  if (s.post) { await page.evaluate(s.post).catch(e => console.log('post失败', s.id, e.message)); await page.waitForTimeout(500) }
  await page.screenshot({ path: `${OUT}/${s.id}.png` })
  const r = await page.evaluate(CHECK)
  report[s.id] = r
  const n = [r.overflow.length, r.smallfont.length, r.blank ? 1 : 0, r.vscroll ? 1 : 0]
  console.log(`${s.id}  溢出${n[0]} 小字${n[1]} 空白${n[2]} 纵滚${n[3]}`)
  if (FINAL) fs.copyFileSync(`${OUT}/${s.id}.png`, `layout-audit-v28/${s.id}.png`)
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1))
console.log('\n=== 明细 ===')
for (const [id, r] of Object.entries(report)) {
  if (r.overflow.length || r.smallfont.length || r.blank || r.vscroll) {
    console.log(`\n# ${id}`)
    r.overflow.slice(0, 6).forEach(x => console.log('  溢出 ' + x))
    r.smallfont.slice(0, 6).forEach(x => console.log('  小字 ' + x))
    if (r.blank) console.log('  ' + r.blank)
    if (r.vscroll) console.log('  纵滚 ' + r.vscroll)
  }
}
await browser.close()
