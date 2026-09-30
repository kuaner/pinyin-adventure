/* v2.5.0 Round1 交互截图：PinyinCard 三档 + 口诀联动 + 新视觉 → /tmp/pj-r1/ */
import { createRequire } from 'node:module'
import { mkdirSync } from 'fs'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) }
catch { ({ chromium } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199'
const OUT = process.argv[2] || '/tmp/pj-r1'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.addInitScript(() => {
  localStorage.setItem('pinyin_v2', JSON.stringify({ weights: {}, stars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 }, hist: [], mute: true, bolt: {} }))
  localStorage.setItem('pinyin_learn', JSON.stringify({ u: 12, stars: { 1: 3, 2: 3, 3: 3 }, best: {} }))
})
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })
async function go(qs, wait = 1100) {
  await page.goto(`${BASE}/?${qs}`, { waitUntil: 'load' })
  await page.waitForTimeout(wait)
}

/* 1. 学习岛 L1 认识页 = PinyinCard full */
await go('open=lesson&learn=1')
await shot('R1-lesson-full')

/* 2. 口诀广播：点播 → 联动中（笔顺动画跑+播放态） */
await go('open=radio')
await page.click('[data-pcmain="a"]').catch(() => {})
await page.waitForTimeout(1000)
await shot('R2-radio-linked')

/* 3. 闪卡正面（card 档） */
await go('open=flash')
await shot('R3-flash-front')
/* 4. 闪卡翻面 = 笔顺+例词 */
await page.click('#flashcard')
await page.waitForTimeout(900)
await shot('R4-flash-flipped')

/* 5. quiz 新实边选项 + 答错 → Feedback mini */
await go('open=quiz')
await shot('R5-quiz-opts')
/* 答错：点一个非正确项（listen 题 4 选项，点第 2 个大概率错；用 evaluate 找正确项的反面） */
const wrongPick = await page.evaluate(() => {
  const opts = [...document.querySelectorAll('#optbox .opt')]
  if (!opts.length) return false
  opts[opts.length - 1].click()
  return true
})
await page.waitForTimeout(350)
const fbMini = await page.evaluate(() => !!document.querySelector('[data-pcdetail]'))
if (!fbMini) { /* 若碰巧答对，等下一题再答错一次 */
  await page.waitForTimeout(1300)
  await page.evaluate(() => { const o = [...document.querySelectorAll('#optbox .opt')]; if (o.length) o[o.length - 1].click() })
  await page.waitForTimeout(350)
}
await shot('R6-fb-mini')

/* 6. 辨析卡 blob 弹窗 */
await go('open=pairs')
await page.click('[data-pi="0"]')
await page.waitForTimeout(600)
await shot('R7-pairmodal-blob')

/* 7. TabBar 新选中态（学习 tab） */
await go('open=learn')
await shot('R8-learn-tab')

/* 8. mine / levels 新实边 */
await go('open=mine'); await shot('R9-mine')
await go('open=levels'); await shot('R10-levels')

await browser.close()
console.log('DONE', OUT, 'fbMini=' + fbMini)
