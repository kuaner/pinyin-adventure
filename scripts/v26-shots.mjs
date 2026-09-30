/* v2.6 验收截图（6 张）：学习 tab / 练习 tab / 听写题 🔊 态 / Speak 点击播放波纹 / 未解锁卡新样式 / 纸纹特写
   用法: node scripts/v26-shots.mjs [outdir]（需 preview 服务在 BASE_URL） */
import { createRequire } from 'node:module'
import { mkdirSync } from 'fs'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) }
catch { ({ chromium } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173'
const OUT = process.argv[2] || '/tmp/pj-v26'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })

async function go(qs, name, wait = 1100) {
  await page.goto(`${BASE}/?${qs}`, { waitUntil: 'load' })
  await page.waitForTimeout(wait)
}

/* ① 学习 tab（新学生进度：仅解锁第 1 课 → 含锁定胶囊暖灰） */
await page.addInitScript(() => {
  localStorage.setItem('pinyin_v2', JSON.stringify({ weights: {}, stars: {}, hist: [], mute: true, bolt: {} }))
  localStorage.setItem('pinyin_learn', JSON.stringify({ u: 1, stars: {}, best: {}, step: {} }))
})
await go('open=learn', 'A-learn-tab')
await shot('A-learn-tab')

/* ② 练习 tab（六模式卡阵） */
await go('open=practice', 'B-practice-tab')
await shot('B-practice-tab')

/* ③ 听写题 🔊 态：闯关 listen 题的大喇叭（混编可能首题非 listen，重试至 bigsound 出现） */
let gotListen = false
for (let i = 0; i < 6 && !gotListen; i++) {
  await go('open=quiz', 'Q-retry')
  gotListen = await page.locator('.bigsound').count().then((n) => n > 0)
}
await shot('C-quiz-listen-sound')
console.log('bigsound visible =', gotListen)

/* ④ Speak 点击播放波纹：练习 tab 模式名可点（有音频=canplay），按住截波纹+按压态 */
await go('open=practice', 'P-warm')
const sp = page.locator('.mname .speak.canplay').first()
if (await sp.count()) {
  const box = await sp.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(420) /* 波纹动画中段+按压缩放 */
  await shot('D-speak-press-wave')
  await page.mouse.up()
  console.log('speak press shot ok, canplay count =', await page.locator('.speak.canplay').count())
} else {
  await shot('D-speak-press-wave')
  console.log('WARN: no canplay speak found（manifest 空？）')
}

/* ⑤ 未解锁卡新样式：关卡地图（零进度 → 1 关解锁其余暖灰锁定） */
await go('open=levels', 'L-warm')
await shot('E-locked-cards')

/* ⑥ 纸纹特写：hero 卡片局部 1:1 */
await go('open=learn', 'T-warm')
const card = page.locator('#hero')
if (await card.count()) {
  const b = await card.boundingBox()
  await page.screenshot({ path: `${OUT}/F-paper-texture.png`, clip: { x: b.x + 10, y: b.y + 10, width: 220, height: 220 } })
} else {
  await shot('F-paper-texture')
}

await browser.close()
console.log('DONE', OUT)
