/* specs/learn/navigation —— 学习岛真实导航流 + 零滚动 sweep：
   ① 真实导航链（v293 遗产）：学习 tab → CTA 进课（落断点字母）→ 课内 chip 跳转零左移零滚动 →
      返回学习 tab → 胶囊换课 → 断点恢复
   ② 12 课 × 全 chip × 3 视口：零祖先左移 + 零纵向滚动（BUGS#24 架构根治面的回归 sweep——
      验收必须真实切换流，只验初始状态=BUGS#24 同款复发）
   迁移自：v30-accept B0/B 段。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { openLesson, lessonState } from '../../flows/gotoLesson.mjs'

const t = new Tally('learn/navigation 真实导航流+零滚动 sweep')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* ① 真实导航流 */
{
  const page = await app.newPage({ tier: 'mid', learn: { u: 7, stars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 }, best: {}, step: {} } })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.locator('[data-cta]').click()
  await page.waitForTimeout(600)
  let s = await lessonState(page)
  t.ok(!!await page.$('#v-lesson'), 'CTA 进课')
  t.ok(s.chipOn.length > 0, '进课落在断点字母', `chip=${s.chipOn}`)
  await page.locator('[data-lchips] .lchip[data-ler]').nth(1).click()
  await page.waitForTimeout(500)
  s = await lessonState(page)
  t.ok(s.secLeft === 0 && s.docScroll === 0, '课内 chip 跳转零左移零滚动')
  await page.locator('[data-back="learn"]').click()
  await page.waitForTimeout(500)
  t.ok(!!await page.$('#v-learntab'), '返回学习 tab')
  await page.locator('#caps .cap[data-lesson="7"]').click()
  await page.waitForTimeout(600)
  s = await lessonState(page)
  /* 断点续学（v3.0 页断点）：本会话刚才在 L7 停在字母 c（chip 跳转过）→ 重进恢复到 c */
  t.ok(!!await page.$('#v-lesson') && s.chipOn === 'c', '胶囊换课→断点恢复字母c', `chip=${s.chipOn}`)
  t.ok(s.docScroll === 0 && s.secLeft === 0, '换课后零滚动零左移')
  await app.closePage(page)
}

/* ② 12 课 × 全 chip × 3 视口 sweep */
{
  for (const vp of [{ width: 390, height: 844 }, { width: 390, height: 719 }, { width: 390, height: 664 }]) {
    const page = await app.newPage({ tier: 'mid' })
    await page.setViewportSize(vp)
    let bad = 0
    for (let n = 1; n <= 12; n++) {
      await openLesson(page, n)
      const units = await page.evaluate(() => document.querySelectorAll('[data-lchips] .lchip').length)
      for (let u = 0; u < units; u++) {
        await page.evaluate((idx) => { document.querySelectorAll('[data-lchips] .lchip')[idx].dispatchEvent(new MouseEvent('click', { bubbles: true })) }, u)
        await page.waitForTimeout(110)
        const s = await lessonState(page)
        if (s.secLeft !== 0 || s.rootLeft !== 0 || s.docScroll !== 0) { bad++; break }
      }
      const s = await lessonState(page)
      if (s.secLeft !== 0 || s.rootLeft !== 0 || s.docScroll !== 0) bad++
    }
    t.ok(bad === 0, `视口${vp.height}: 12课全chip零左移零滚动`, `bad=${bad}`)
    await app.closePage(page)
  }
}

t.pageErrors(app.errors, 'navigation 全程')
await app.close()
process.exit(t.finish())
