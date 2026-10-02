/* specs/growth/album —— 卡片图鉴解锁口径：
   卡片=「学会即解锁」（课级小测通过派生，单一真相=学习进度）：L1 过 → 图鉴 3 金 + 6 灰，计数 3/63。
   迁移自：v32-accept②。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'

const t = new Tally('growth/album 卡片图鉴解锁口径')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

const page = await app.newPage({ tier: 'newbie', learn: { u: 2, stars: { 1: 3 }, best: { 1: 5 }, step: {} }, growth: { stars: 5 } })
await page.goto(`${BASE}/?open=album`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-albumpage="0"]', { timeout: 8000 })
await page.waitForTimeout(600)
const got = await page.evaluate(() => ({
  gold: document.querySelectorAll('[data-albumpage="0"] .alcard.got').length,
  gray: document.querySelectorAll('[data-albumpage="0"] .alcard:not(.got)').length,
  chip: document.querySelector('[data-cardcount]')?.textContent?.trim(),
}))
t.ok(got.gold === 3 && got.gray === 6, '图鉴=金卡3+灰卡6（课级解锁口径）', JSON.stringify(got))
t.ok(/3\s*\/\s*63/.test(got.chip || ''), '顶部计数 3/63', got.chip)

t.pageErrors(app.errors, 'album 全程')
await app.closePage(page)
await app.close()
process.exit(t.finish())
