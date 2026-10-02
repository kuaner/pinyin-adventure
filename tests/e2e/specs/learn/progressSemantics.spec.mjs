/* specs/learn/progressSemantics —— 进度语义（P1-7，挑刺报告 2026-10-03）：
   ① 小测进度点两态：答错=描边态（miss），只有答对才实心（ok）——答错的题不再亮绿点
   ② 课页头=「第 X 步」语义（不再出现 4/4 式完成误读）
   ③ 首页课程进度条只计有效完成：滑到 ≠ 学会（互动证据制持久化后，无证据的点不亮）
   断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally, sleep } from '../../flows/assert.mjs'

const t = new Tally('learn/progressSemantics 进度语义三面')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* ① 错题进度点=描边态 + ② 课页头「第 X 步」 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${BASE}/?learn=1&step=5`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-lesson .qbody [data-opts] .opt', { timeout: 10000 })
  /* 故意答错当前题 */
  await page.evaluate(() => {
    const body = document.querySelector('#v-lesson .qbody')
    const ans = body.getAttribute('data-qkey')
    const opts = [...document.querySelectorAll('#v-lesson [data-opts] .opt')]
    const wrong = opts.findIndex((e) => e.getAttribute('data-qkey') !== ans)
    const el = opts[wrong >= 0 ? wrong : 1]
    el?.click()
    setTimeout(() => el?.click(), 470)
  })
  await sleep(1000)
  const dots = await page.evaluate(() => [...document.querySelectorAll('#v-lesson .qdot')].map((d) => d.className))
  t.ok(dots.length === 5, '小测进度点：5 题点位在', dots.join('|'))
  t.ok(dots[0].includes('miss'), 'P1-7①：答错的题进度点=描边态（miss），不亮绿', dots[0])
  t.ok(!dots[0].includes('ok'), 'P1-7①：答错不亮实心 ok 点')
  /* 课页头步进语义 */
  const head = await page.evaluate(() => document.getElementById('lprog')?.textContent?.replace(/\s/g, '') || '')
  t.ok(/第.+步/.test(head) && !/\d+\/\d+/.test(head), 'P1-7②：课页头=「第 X 步」语义', head)
  t.pageErrors(app.errors, 'progress')
  await app.closePage(page)
}

/* ③ 首页进度条只计有效完成：滑到第 3 步但零互动证据 → 字母点全灰 */
{
  const page = await app.newPage({
    tier: 'mid', mute: false,
    learn: { step: { 5: 3 }, ev: {} },   /* 断点推到第 3 页（第 2 个字母单元），无证据 */
  })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#steps5 i', { timeout: 8000 })
  const dots = await page.evaluate(() => [...document.querySelectorAll('#steps5 i')].map((d) => d.className))
  t.ok(dots.length > 0 && dots.every((c) => !c.includes('d')), 'P1-7③：首页进度点零证据不亮（滑到≠学会）', dots.join('|'))
  t.ok(await page.evaluate(() => !!document.querySelector('#steps5 i.c')), 'P1-7③：当前位置点=进行中标记（c）保留')
  /* CTA 照常可用 */
  t.ok(await page.evaluate(() => !!document.querySelector('#cta')), 'P1-7③：CTA 不受影响')
  await app.closePage(page)
}

/* ③b 有证据时点亮：ev 覆盖种子 → 对应字母点实心 */
{
  const page = await app.newPage({
    tier: 'mid', mute: false,
    learn: { step: { 5: 3 }, ev: { 5: ['g'] } },   /* L5 第一个字母（g）有证据 */
  })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#steps5 i', { timeout: 8000 })
  const dots = await page.evaluate(() => [...document.querySelectorAll('#steps5 i')].map((d) => d.className))
  t.ok(dots[0].includes('d') && !dots[1].includes('d'), 'P1-7③：有证据的字母点实心、其余仍灰（有效完成口径）', dots.join('|'))
  await app.closePage(page)
}

await app.close()
process.exit(t.finish())
