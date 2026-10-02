/* v4.7 挑刺修复腿目验截图：armed 确认层/蛋引导/chip 去调/半蛋字母/锁定课 🔒/进度点两态/关卡卡清理 */
import { chromium } from 'playwright'
import { seedState } from '../tests/fixtures/seeds.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = 'docs/v47-shots'
import fs from 'node:fs'
fs.mkdirSync(OUT, { recursive: true })

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await seedState(page, 'mid', {})

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })

/* 1. 识字表 armed 确认层 */
await page.goto(`${BASE}/?open=zihall`, { waitUntil: 'networkidle' })
await page.tap('#v-zihall .zcell[data-locked="0"]')
await page.waitForSelector('#v-zihall [data-q]', { timeout: 6000 })
await page.waitForTimeout(600)
await page.tap('#v-zihall [data-opts] .opt:nth-of-type(1)')
await page.waitForTimeout(400)
await shot('01-zi-armed')

/* 2. 首页锁定课 🔒 + 进度点 */
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await shot('02-home-locked-dots')

/* 3. 关卡卡（注解行删除后） */
await page.goto(`${BASE}/?open=levels`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await shot('03-levels-clean')

/* 4. 游戏岛摊位卡（新游戏副标删） */
await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await shot('04-hub-clean')
await page.evaluate(() => document.querySelector('[data-hallbtn="drill"]')?.click())
await page.waitForTimeout(400)
await shot('05-hall-clean')

/* 5. 蛋：引导+chip 去调+半蛋字母 */
await page.goto(`${BASE}/?open=game&g=egg&st=play`, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.removeItem('pinyin_egg_hint_v1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForFunction(() => document.querySelector('#gstage [data-halves][data-ready="1"]'), null, { timeout: 9000 })
await page.waitForTimeout(300)
await shot('06-egg-guide')

/* 6. 音乐会 */
await page.goto(`${BASE}/?open=game&g=tone&st=play`, { waitUntil: 'networkidle' })
await page.waitForSelector('#gstage [data-note]', { timeout: 9000 })
await page.waitForTimeout(500)
await shot('07-tone-notes')

/* 7. 小测进度点两态（答错一题） */
await page.goto(`${BASE}/?learn=1&step=5&qkey`, { waitUntil: 'networkidle' })
await page.waitForSelector('#v-lesson .qbody [data-opts] .opt', { timeout: 10000 })
await page.evaluate(() => {
  const body = document.querySelector('#v-lesson .qbody')
  const ans = body.getAttribute('data-qkey')
  const opts = [...document.querySelectorAll('#v-lesson [data-opts] .opt')]
  const wrong = opts.findIndex((e) => e.getAttribute('data-qkey') !== ans)
  const el = opts[wrong >= 0 ? wrong : 1]
  el?.click()
  setTimeout(() => el?.click(), 470)
})
await page.waitForTimeout(1000)
await shot('08-quiz-dots-miss')

await b.close()
console.log('shots →', OUT)
