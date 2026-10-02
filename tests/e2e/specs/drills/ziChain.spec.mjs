/* specs/drills/ziChain —— P0-1 识字表作答全链+多输入方式矩阵（挑刺报告 2026-10-03）：
   报告称「选项完全无响应」，实测复现结论：handler 链路是活的（审查员音频日志 hyp/liu4.mp3
   恰是 arm() 试听播音），死的是两段式可发现性。本规格把「点选项→判定→跳题→已答计数」全链
   用三种输入方式（合成 click / 真实 CDP 触摸 / PointerEvent 序列）各坐实一遍，并断言
   首击进入显性确认态（armed 强化 + 「再点一次确认」提示可见）——四种输入方式全可判定。
   断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally, sleep } from '../../flows/assert.mjs'

const t = new Tally('drills/ziChain 识字表作答全链+多输入方式（P0-1）')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

for (const method of ['click', 'touch', 'pointer']) {
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${BASE}/?open=zihall`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-zihall .zcell[data-locked="0"]', { timeout: 8000 })
  await page.tap('#v-zihall .zcell[data-locked="0"]')
  await page.waitForSelector('#v-zihall [data-q][data-reveal="0"]', { timeout: 6000 })
  await sleep(500)   /* P1-2 进题宽限（立法：进题首击忽略）——首击试听在宽限后 */
  const ans = await page.evaluate(() => window.__PJ.ziQ().ans)
  const answered0 = await page.getAttribute('#v-zihall [data-answered]', 'data-answered')

  /* 首击=试听确认态：显性确认提示出现（可发现性修复的可断言面）+ 零判定 */
  const sel = `#v-zihall [data-opts] .opt:nth-of-type(${ans + 1})`
  if (method === 'touch') {
    const cdp = page.__cdp || (page.__cdp = await page.context().newCDPSession(page))
    const box = await (await page.$(sel)).boundingBox()
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else if (method === 'pointer') {
    await page.evaluate((s) => {
      const el = document.querySelector(s)
      el?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      el?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
      el?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }, sel)
  } else {
    await page.evaluate((s) => document.querySelector(s)?.click(), sel)
  }
  await sleep(250)
  const armed = await page.evaluate(() => {
    const o = document.querySelector('#v-zihall [data-opts] .opt.armed')
    const plain = (x) => (x || '').replace(/[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s]/g, '')
    return {
      armed: !!o,
      hint: !!(o && plain(o.textContent).includes('再点一次')),
      reveal: document.querySelector('#v-zihall [data-q]')?.getAttribute('data-reveal'),
    }
  })
  t.ok(armed.armed, `[${method}] 首击=试听确认态（armed 高亮）`)
  t.ok(armed.hint, `[${method}] 确认态带「再点一次」显性提示（可发现性）`)
  t.ok(armed.reveal === '0', `[${method}] 首击不判定（reveal 仍 0）`)

  /* 再点同项 → 判定 → 跳题 → 已答计数（确认间隔立法 ≥400ms：距首击已 250ms，再补 260ms） */
  await sleep(260)
  {
    const sel2 = `#v-zihall [data-opts] .opt:nth-of-type(${ans + 1})`
    if (method === 'touch') {
      const cdp = page.__cdp
      const box2 = await (await page.$(sel2)).boundingBox()
      const x2 = box2.x + box2.width / 2, y2 = box2.y + box2.height / 2
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x2, y: y2 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    } else if (method === 'pointer') {
      await page.evaluate((s) => {
        const el = document.querySelector(s)
        el?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        el?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
        el?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      }, sel2)
    } else {
      await page.evaluate((s) => document.querySelector(s)?.click(), sel2)
    }
  }
  /* 判定反馈期（对=550ms 自动跳题）：在窗内抓判定态，再抓计数 */
  const revealed = await page.waitForFunction(() => document.querySelector('#v-zihall [data-q]')?.getAttribute('data-reveal') === '1', null, { timeout: 3000 }).then(() => true).catch(() => false)
  const after = await page.evaluate(() => ({
    reveal: document.querySelector('#v-zihall [data-q]')?.getAttribute('data-reveal'),
    correct: !!document.querySelector('#v-zihall [data-opts] .opt.correct'),
    answered: document.querySelector('#v-zihall [data-answered]')?.getAttribute('data-answered'),
  }))
  t.ok(revealed && after.reveal === '1' && after.correct, `[${method}] 再点同项=判定（correct 高亮）`)
  t.ok(+after.answered === +(answered0 || 0) + 1, `[${method}] 已答计数 +1`, `${answered0}→${after.answered}`)
  t.pageErrors(app.errors, `[${method}]`)
  await app.closePage(page)
}

/* 进题守卫回归：进题后立即连点（77ms 双击）不判定不泄答（P1-2/P1-3 与学习面同守卫） */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${BASE}/?open=zihall`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-zihall .zcell[data-locked="0"]', { timeout: 8000 })
  await page.tap('#v-zihall .zcell[data-locked="0"]')
  await page.waitForSelector('#v-zihall [data-q][data-reveal="0"]', { timeout: 6000 })
  await sleep(500)
  await page.evaluate(() => {
    const o = document.querySelector('#v-zihall [data-opts] .opt')
    o?.click()
    setTimeout(() => o?.click(), 77)
  })
  await sleep(400)
  const st = await page.evaluate(() => ({
    reveal: document.querySelector('#v-zihall [data-q]')?.getAttribute('data-reveal'),
    answered: document.querySelector('#v-zihall [data-answered]')?.getAttribute('data-answered'),
  }))
  t.ok(st.reveal === '0' && +st.answered === 0, '识字表：77ms 双击不判定（确认间隔 ≥400ms 立法）', JSON.stringify(st))
  await app.closePage(page)
}

await app.close()
process.exit(t.finish())
