/* specs/growth/badges —— 徽章/签到/计数链：
   ① 闪电 n=2 <10 → 不记签到（阈值口径：days 空）
   ② 小侦探答对 → det 计数 +1
   ③ 闪电满分旗（boltPerf 种子）→ 任意 checkBadges 触发点（侦探计数）兑现「闪电满分」徽章
   迁移自：v32-accept④⑤。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { growthOf, storeOf } from '../../flows/seedState.mjs'

const t = new Tally('growth/badges 徽章/签到/计数链')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* ① 闪电 n=2 <10 不记签到 */
{
  const page = await app.newPage({ tier: 'newbie' })
  await page.goto(`${BASE}/?probe=bolt`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(4500)
  const v2 = await storeOf(page, 'pinyin_v2')
  t.ok(!v2.days || Object.keys(v2.days).length === 0, '闪电 n=2 <10 → 不记签到（阈值口径）', 'days=' + JSON.stringify(v2.days))
  await app.closePage(page)
}

/* ② + ③ 侦探 det 计数 + 满分旗徽章兑现 */
{
  const page = await app.newPage({ tier: 'newbie', growth: { boltPerf: true } })
  await page.goto(`${BASE}/?probe=det`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3800)
  const g = await growthOf(page)
  t.ok(g.det === 1, '侦探答对 1 → det=1', 'det=' + g.det)
  t.ok((g.badges || []).includes('boltperfect'), '闪电满分旗 → 徽章 boltperfect 兑现', 'badges=' + (g.badges || []).join(','))
  await app.closePage(page)
}

t.pageErrors(app.errors, 'badges 全程')
await app.close()
process.exit(t.finish())
