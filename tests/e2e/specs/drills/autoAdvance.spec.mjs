/* specs/drills/autoAdvance —— 交互基本逻辑三连之②切题过渡+③自动推进（Bug#38 回归门）：
   病灶：②连续出题面切题无过渡反馈（孩子感知不到换题）③答完题下一题还要手点。
   修法：②连续出题面题目卡滑入过渡（.qslide，{#key} 重挂触发）；③答完反馈停顿自动推进
   （对~0.8s/错~1.6s；session 闯关/学习岛小测/听写/拼读/声调/每日全链）。
   ① 闯关：答对反馈期停留（~0.8s 内不出题）→ 反馈散场自动进下一题（零手点）
   ② 听写专练：答对自动出下一题 + 答错也自动推进（无"下一题"按钮依赖）
   ③ 切题过渡：拼读/听写/声调三面题目卡 animationName=qslidein + 声调面进度指示在场
   迁移自：regression-bug38-auto-advance。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally, sleep } from '../../flows/assert.mjs'
import { answerLdrill } from '../../flows/answerQuiz.mjs'
import { enterDrill } from '../../flows/playGame.mjs'

const t = new Tally('drills/autoAdvance 自动推进+切题过渡')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* ① 闯关自动推进（对 800ms 档） */
{
  const page = await app.newPage({ tier: 'newbie' })
  await page.goto(`${BASE}/?open=quiz`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#optbox .opt', { timeout: 8000 })
  const ans = await page.evaluate(() => window.__PJ.Q().q.ans)
  const i0 = await page.evaluate(() => window.__PJ.Q().i)
  await sleep(520)   /* P1-2 进题宽限 */
  await page.evaluate((a) => document.querySelectorAll('#optbox .opt')[a]?.click(), ans)
  await sleep(500)
  const mid = await page.evaluate((i) => ({ i: window.__PJ.Q().i, fb: !!window.__PJ.Q().fb }), i0)
  t.ok(mid.i === i0 && mid.fb, '答对反馈期停留（~0.8s 内不出题，反馈可读）')
  await sleep(700)
  const after = await page.evaluate(() => ({ i: window.__PJ.Q().i, fb: !!window.__PJ.Q().fb }))
  t.ok(after.i === i0 + 1 && !after.fb, '反馈散场自动进下一题（零手点，对 800ms 档）', `i ${i0}→${after.i}`)
  await app.closePage(page)
}

/* ② 听写专练自动推进（对 480ms 档 + 错档） */
{
  const page = await app.newPage({ tier: 'mid' })
  await page.goto(`${BASE}/?open=ldrill`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-ldrill [data-q][data-target]', { timeout: 8000 })
  const t0 = await page.getAttribute('#v-ldrill [data-q]', 'data-target')
  const optK = async () => page.evaluate(() => Array.from(document.querySelectorAll('#v-ldrill [data-opts] .opt')).map((e) => e.getAttribute('data-opt')))
  const tapK = async (k) => {
    const ks = await optK()
    await page.tap(`#v-ldrill [data-opts] .opt:nth-of-type(${ks.indexOf(k) + 1})`)
  }
  await tapK(t0)   /* 答对 */
  await sleep(800)
  const t1 = await page.getAttribute('#v-ldrill [data-q]', 'data-target')
  t.ok(!!t1, '听写：答对自动出下一题（零手点）')
  const ks1 = await optK()
  await tapK(ks1.find((k) => k !== t1))   /* 答错 */
  await sleep(1500)
  const t2 = await page.getAttribute('#v-ldrill [data-q]', 'data-target')
  t.ok(!!t2 && t2 !== t1, '听写：答错也自动推进（错档停顿后出题，无手点按钮）')
  await app.closePage(page)
}

/* ③ 切题过渡（连续出题面题目卡滑入动画） */
{
  const anim = (page, sel) => page.evaluate((s) => {
    const el = document.querySelector(s)
    return el ? getComputedStyle(el).animationName : '(none)'
  }, sel)

  const p1 = await app.newPage({ tier: 'mid' })
  await p1.goto(`${BASE}/?open=blenddrill`, { waitUntil: 'networkidle' })
  await p1.waitForSelector('#v-bquiz [data-q]', { timeout: 8000 })
  t.ok((await anim(p1, '#v-bquiz [data-q]')) === 'qslidein', '拼读专练：题目卡滑入动画在场')
  await app.closePage(p1)

  const p2 = await app.newPage({ tier: 'mid' })
  await p2.goto(`${BASE}/?open=ldrill`, { waitUntil: 'networkidle' })
  await p2.waitForSelector('#v-ldrill [data-q]', { timeout: 8000 })
  t.ok((await anim(p2, '#v-ldrill [data-q]')) === 'qslidein', '听写专练：题目卡滑入动画在场')
  await app.closePage(p2)

  /* 声调测一测（练习馆 tone 入口——本 bug 主诉面） */
  const p3 = await app.newPage({ tier: 'mid' })
  await enterDrill(p3)
  await p3.evaluate(() => document.querySelector('#drillgrid [data-drill="tone"]')?.click())
  await p3.waitForSelector('#v-tquiz [data-q]', { timeout: 8000 })
  t.ok((await anim(p3, '#v-tquiz [data-q]')) === 'qslidein', '声调测一测：题目卡滑入动画在场（本 bug 主诉面）')
  const hud0 = await p3.evaluate(() => document.querySelector('#v-tquiz [data-answered]')?.getAttribute('data-answered'))
  t.ok(hud0 !== undefined, '声调测一测：进度指示在场', `n=${hud0}`)
  await app.closePage(p3)
}

t.pageErrors(app.errors, 'autoAdvance 全程')
await app.close()
process.exit(t.finish())
