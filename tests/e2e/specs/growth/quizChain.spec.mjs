/* specs/growth/quizChain —— 升级体系事件链·小测过关链：
   学习岛小测全对过关 → 全屏庆祝（quiz 模式）+ 成长星星+5 + 「初次通关」徽章入账
   + L1 记星解锁下一课 + 庆祝点击即跳过。
   种子=newbie（首装）；作答=qkey 门确定性全对。
   迁移自：v32-accept①。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally, sleep } from '../../flows/assert.mjs'
import { answerLessonQuiz } from '../../flows/answerQuiz.mjs'
import { growthOf, learnOf } from '../../flows/seedState.mjs'

const t = new Tally('growth/quizChain 小测过关事件链')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

const page = await app.newPage({ tier: 'newbie' })
await page.goto(`${BASE}/?open=lesson&learn=1&qkey`, { waitUntil: 'networkidle' })
await page.waitForSelector('#v-lesson', { timeout: 8000 })
/* 直落小测页：URL page 参数（v32 同款深链）+ forcequiz 放行（未集旗=拦截卡，走家长通道） */
await page.evaluate(() => { const q = new URLSearchParams(location.search); q.set('page', '6'); history.replaceState(null, '', '?' + q.toString()) })
await sleep(800)
await page.evaluate(() => { document.querySelector('[data-bootquiz],[data-forcequiz]')?.click() })
await sleep(400)
for (let i = 0; i < 5; i++) {
  await page.waitForSelector('#v-lesson .qbody[data-qkey]', { timeout: 5000 })
  await answerLessonQuiz(page, { correct: true })
  await sleep(1400)
}
await page.waitForSelector('#celebrate[data-ce="quiz"]', { timeout: 6000 })
t.ok(true, '小测过关 → 全屏庆祝 overlay（quiz 模式）')
const g1 = await growthOf(page)
t.ok(g1.stars === 5, '成长星星 +5（0→5）', 'stars=' + g1.stars)
t.ok((g1.badges || []).includes('first'), '徽章「初次通关」入账', 'badges=' + (g1.badges || []).join(','))
const l1 = await learnOf(page)
t.ok((l1.stars && l1.stars['1'] > 0) || l1.u === 2, 'L1 记星 + 下一课解锁', 'u=' + l1.u + ' stars1=' + (l1.stars && l1.stars['1']))
await page.evaluate(() => document.getElementById('celebrate')?.click())
await sleep(400)
t.ok(await page.evaluate(() => !document.getElementById('celebrate')), '庆祝点击即跳过')

t.pageErrors(app.errors, 'quizChain 全程')
await app.closePage(page)
await app.close()
process.exit(t.finish())
