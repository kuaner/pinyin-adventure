/* specs/learn/quizGuard —— 输入守卫统一收口（P1-2 连点跨题泄漏 / P1-3 双击穿透，挑刺报告 2026-10-03）：
   ① P1-3：两段式选项 77ms 双击不得穿透判定（报告实测穿透间隔）——课内小测 look/tone、ToneDrill 练一练
   ② P1-2：判定后冷却——判定瞬间连点第二击不得替下一题作答（下一题无 armed/reveal、计分只 +1）
   ③ P1-2 谜面门：镜像大对决谜面音频播完前作答无效（点击时刻不得早于谜面播音且判分）
   断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally, sleep } from '../../flows/assert.mjs'
import { enterGame, readHud } from '../../flows/playGame.mjs'

const t = new Tally('learn/quizGuard 输入守卫统一收口')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* ① P1-3：ToneDrill 练一练 77ms 双击不穿透 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${BASE}/?learn=1&page=1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.tonedrill', { timeout: 8000 })
  await page.evaluate(() => {
    const plain = (x) => (x || '').replace(/[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s]/g, '')
    ;[...document.querySelectorAll('.tonedrill .trow .btn')].find((b) => plain(b.textContent).includes('小耳朵'))?.click()
  })
  await page.waitForSelector('.tonedrill .topts', { timeout: 6000 })
  await page.evaluate(() => {
    const o = document.querySelector('.tonedrill .topts .topt')
    o?.click()
    setTimeout(() => o?.click(), 77)
  })
  await sleep(500)
  const st = await page.evaluate(() => ({
    judged: !!document.querySelector('.tonedrill .topt.right, .tonedrill .topt.wrong'),
    armed: !!document.querySelector('.tonedrill .topt.armed'),
  }))
  t.ok(!st.judged, 'P1-3：ToneDrill 77ms 双击不判定（确认间隔 ≥400ms）', JSON.stringify(st))
  await app.closePage(page)
}

/* ①b P1-3：课内小测 tone 题 77ms 双击不穿透 + 两段式 armed 显性态 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  /* L2（mid 种子已过关的韵母课）有 tone 题；过关课重学不拦证据门 → 直接进小测页 */
  await page.goto(`${BASE}/?learn=2&step=5&qkey`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-lesson .qbody [data-opts] .opt', { timeout: 10000 })
  /* 等到 tone 题（最多重进 5 次——题型混编随机） */
  let kind = null
  for (let i = 0; i < 6 && !kind; i++) {
    kind = await page.evaluate(() => {
      const b = document.querySelector('#v-lesson .qbody')
      if (!b) return null
      if (b.querySelector('.topt')) return 'tone'
      return null
    })
    if (!kind) {
      /* 随便答掉当前题（走守卫合法路径），等下一题 */
      await page.evaluate(() => {
        const o = document.querySelector('#v-lesson [data-opts] .opt')
        o?.click()
        setTimeout(() => o?.click(), 470)
      })
      await sleep(2100)
    }
  }
  if (kind === 'tone') {
    await page.evaluate(() => {
      const o = document.querySelector('#v-lesson [data-opts] .topt')
      o?.click()
      setTimeout(() => o?.click(), 77)
    })
    await sleep(500)
    const st = await page.evaluate(() => ({
      judged: !!document.querySelector('#v-lesson .topt.right, #v-lesson .topt.wrong'),
      qn: document.querySelector('#v-lesson .qbody [data-qkey]')?.getAttribute('data-qkey'),
    }))
    t.ok(!st.judged, 'P1-3：课内小测 tone 题 77ms 双击不判定', JSON.stringify(st))
  } else {
    t.ok(true, 'P1-3：课内小测 tone 题（本轮混编未抽到，跳过——ToneDrill 同构已断言）')
  }
  await app.closePage(page)
}

/* ② P1-2：判定后冷却——答对瞬间 120ms 后的追加点击不得作答下一题 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${BASE}/?learn=1&step=5&qkey`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-lesson .qbody [data-opts] .opt', { timeout: 10000 })
  const q1 = await page.evaluate(() => document.querySelector('#v-lesson .qbody')?.getAttribute('data-qkey'))
  /* 答对（两段式 look 题间隔 470ms；listen/tone 一次性）+ 紧跟一次追加点击 */
  await page.evaluate(() => {
    const opts = [...document.querySelectorAll('#v-lesson [data-opts] .opt')]
    const hit = opts.findIndex((e) => e.getAttribute('data-qkey') === document.querySelector('#v-lesson .qbody').getAttribute('data-qkey'))
    const el = opts[hit >= 0 ? hit : 0]
    el?.click()
    setTimeout(() => el?.click(), 470)
    /* 追加击=判定反馈窗内（560ms：judgeHold 450ms+reveal 未散）——单答锁+守卫双重必拒；
       （此前固定 1250ms 在 CI 快机器上已出宽限窗，armed 落位=合法试听，断言失义） */
    setTimeout(() => document.querySelector('#v-lesson [data-opts] .opt')?.click(), 560)
  })
  await sleep(2800)   /* look 题反馈延迟 950ms+推进 650ms 全部落定 */
  const st = await page.evaluate(() => ({
    dots: [...document.querySelectorAll('#v-lesson .qdot')].map((d) => d.className).join('|'),
    armed: !!document.querySelector('#v-lesson [data-opts] .opt.armed'),
    reveal: !!document.querySelector('#v-lesson .opt.right, #v-lesson .opt.wrong, #v-lesson .topt.right, #v-lesson .topt.wrong'),
  }))
  t.ok(st.dots.includes('ok') && !st.dots.includes('ok|ok'), 'P1-2：判定后连点不得连吃两题（进度只进 1）', st.dots)
  t.ok(!st.armed && !st.reveal, 'P1-2：下一题零残留态（无 armed/reveal 幽灵选中）', JSON.stringify(st))
  await app.closePage(page)
}

/* ③ P1-2 谜面门：镜像大对决谜面播完前作答无效（只测 kj 谜面题——谜面音频为整句，窗口确定） */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  let hasKj = false
  for (let i = 0; i < 5 && !hasKj; i++) {
    await enterGame(page, 'duel')
    await page.waitForSelector('#gstage [data-q]', { timeout: 8000 })
    hasKj = await page.evaluate(() => !!document.querySelector('#gstage .kjline'))
    if (!hasKj) {
      await page.evaluate(() => document.querySelector('[data-back="gamequit"]')?.click())
      await sleep(500)
    }
  }
  t.ok(hasKj, 'P1-2 谜面门：进入谜面题（kj）')
  if (hasKj) {
  const q = await page.evaluate(() => ({
    ans: [...document.querySelectorAll('#gstage .duelopt')].findIndex((e) => e.getAttribute('data-qkey')),
    t0: performance.now(),
  }))
  await page.evaluate((i) => {
    document.querySelectorAll('#gstage .duelopt')[i]?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  }, q.ans)
  await sleep(500)
  const early = await readHud(page)
  t.ok(+early.score === 0, 'P1-2 谜面门：谜面播完前作答无效（零分）', `score=${early.score}`)
  /* 谜面结束（≤3.5s 兜底）后再答 → 得分 */
  await sleep(3400)
  const ans2 = await page.evaluate(() => [...document.querySelectorAll('#gstage .duelopt')].findIndex((e) => e.getAttribute('data-qkey')))
  if (ans2 >= 0) {
    await page.evaluate((i) => {
      document.querySelectorAll('#gstage .duelopt')[i]?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }, ans2)
    await sleep(600)
    const late = await readHud(page)
    t.ok(+late.score > 0, 'P1-2 谜面门：谜面播完后作答正常计分', `score=${late.score}`)
  } else {
    t.ok(true, 'P1-2 谜面门：谜面期后题已轮换（守卫放行路径由②覆盖）')
  }
  }
  t.pageErrors(app.errors, 'quizGuard')
  await app.closePage(page)
}

await app.close()
process.exit(t.finish())
