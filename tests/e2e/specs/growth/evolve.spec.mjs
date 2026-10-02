/* specs/growth/evolve —— 小鸡进化记账链：
   星星达阈值（60≥50）→ 进「我的」tab 播放进化 overlay（破壳→小黄鸡）→ seenStage 记账到 1
   （下次不重播）。进化动画记账 = 升级体系事件链的一环。
   迁移自：v32-accept③。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { growthOf } from '../../flows/seedState.mjs'

const t = new Tally('growth/evolve 进化记账链')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

const page = await app.newPage({ tier: 'newbie', growth: { stars: 60, seenStage: 0 } })
await page.goto(`${BASE}/?open=mine`, { waitUntil: 'networkidle' })
await page.waitForSelector('#celebrate[data-ce="evolve"]', { timeout: 6000 })
t.ok(true, '进我的 tab → 进化 overlay（破壳→小黄鸡）')
const g = await growthOf(page)
t.ok(g.seenStage === 1, 'seenStage 记账到 1（下次不重播）', 'seenStage=' + g.seenStage)

t.pageErrors(app.errors, 'evolve 全程')
await app.closePage(page)
await app.close()
process.exit(t.finish())
