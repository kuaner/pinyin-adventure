/* specs/cross/firstTap —— 首击有效性 + 锁定表达统一（P1-6 / P2-6，挑刺报告 2026-10-03）：
   ① P1-6：切「我的」tab 后第一次点击立即生效（闪卡复习/学习历史/空白三路 × 立即 0/120/400ms）
      ——回归锁：切页后首击即有效，转场层不得吞第一击。
   ② P2-6：首页课程条未解锁课=🔒 图标锁定态，点击=抖动+温和提示（零反馈病灶根除）。
   断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally, sleep } from '../../flows/assert.mjs'

const t = new Tally('cross/firstTap 切页首击有效性+锁定表达统一')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* ① 我的 tab 首击有效性（CDP 真触摸，切页后 0/120/400ms 三档立即点击） */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#tabbar', { timeout: 8000 })
  await sleep(400)
  const cdp = await page.context().newCDPSession(page)
  const touch = async (sel) => {
    const el = await page.waitForSelector(sel, { timeout: 6000 })
    const b = await el.boundingBox()
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  let pass = 0, total = 0
  for (const from of ['learn', 'practice']) {
    for (const delay of [0, 120, 400]) {
      await touch(`[data-tab="mine"]`)
      await sleep(450)
      await touch(`[data-tab="${from}"]`)
      await sleep(500)
      await touch('[data-tab="mine"]')
      if (delay) await sleep(delay)
      const before = await page.evaluate(() => document.querySelector('#shell > *')?.id)
      await touch('[data-go="flash"]')
      await sleep(600)
      const after = await page.evaluate(() => document.querySelector('#shell > *')?.id)
      total++
      if (after === 'v-flash' && before !== 'v-flash') pass++
      if (after === 'v-flash') {
        const bk = await page.$('#v-flash .cbtn')
        if (bk) { await bk.click(); await sleep(400) }
      }
    }
  }
  t.ok(pass === total, `P1-6：切「我的」后首击立即生效（${pass}/${total} 三档延迟×双起点）`, `${pass}/${total}`)
  await app.closePage(page)
}

/* ② P2-6 未解锁课：🔒 图标 + 点击抖动+提示 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#caps .cap', { timeout: 8000 })
  const lock = await page.evaluate(() => {
    const c = document.querySelector('#caps .cap.locked')
    return c ? {
      hasIcon: !!c.querySelector('svg'),
      dataLocked: c.getAttribute('data-locked'),
    } : null
  })
  t.ok(lock && lock.hasIcon && lock.dataLocked === '1', 'P2-6：未解锁课 chip 带 🔒 图标锁定态', JSON.stringify(lock))
  /* 点击未解锁课：抖动类 + toast 提示，不进课 */
  await page.evaluate(() => document.querySelector('#caps .cap.locked')?.click())
  await sleep(300)
  const shake = await page.evaluate(() => ({
    shaken: !!document.querySelector('#caps .cap.locked.shake, #caps .cap.shake'),
    toast: document.getElementById('toast')?.classList.contains('on'),
    view: document.querySelector('#shell > *')?.id,
  }))
  t.ok(shake.shaken, 'P2-6：点未解锁课=抖动反馈', JSON.stringify(shake))
  t.ok(shake.toast, 'P2-6：点未解锁课=温和提示（toast）')
  t.ok(shake.view !== 'v-lesson', 'P2-6：点未解锁课不进课')
  t.pageErrors(app.errors, '锁定表达')
  await app.closePage(page)
}

await app.close()
process.exit(t.finish())
