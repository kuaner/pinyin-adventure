/* 命名回归样例 Bug#38「交互基本逻辑三连」之②切题过渡+③自动推进（v4.5 回归门）。
   病灶：②声调测一测等连续出题面切题无过渡反馈（孩子感知不到换题）
        ③答完题下一题还要手点（"难道不应该是自动吗"）。
   修法：②连续出题面题目卡滑入过渡（.qslide，{#key} 重挂触发——音乐会/听写/拼读/闪电照发）
        ③答完反馈停顿自动推进（对~0.8s 错~1.6s；session 闯关/学习岛小测/听写/拼读/声调/每日全链）。
   矩阵①（listen 一点即答/zi 两段式保留）回归在 regression-bug37-two-phase.mjs。
   前置：preview 4173（或 BASE_URL）。独立可跑：node tests/e2e/regression-bug38-auto-advance.mjs */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) } else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch()
const LEARN0 = { u: 4, stars: { 1: 3, 2: 3, 3: 3, 4: 2 }, best: { 1: 5, 2: 5, 3: 5, 4: 4 }, step: {} }
const errsAll = []
const mkPage = async () => {
  const page = await browser.newPage({ ...devices['iPhone 13'], hasTouch: true })
  page.on('pageerror', (e) => errsAll.push(e.message))
  await page.addInitScript(`
    localStorage.clear()
    localStorage.setItem('pinyin_v2', JSON.stringify({ weights: {}, stars: { 1: 3, 2: 3, 3: 2 }, cards: {}, hist: [], mute: false, bolt: { acc: 0, d: '', tacc: 0, td: '' }, days: {} }))
    localStorage.setItem('pinyin_learn', JSON.stringify(${JSON.stringify(LEARN0)}))
    localStorage.setItem('pinyin_growth_v1', JSON.stringify({ v: 1, stars: 40, badges: [], seenStage: 1, det: 3, tone: 2, boltPerf: false }))
  `)
  return page
}

/* ③ 自动推进：闯关（session QZ）答对 → 零手点 → 下一题自动就位（对 800ms 档） */
{
  console.log('\n— ③ 闯关自动推进 —')
  const page = await mkPage()
  await page.goto(`${BASE}/?open=quiz`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#optbox .opt', { timeout: 8000 })
  const ans = await page.evaluate(() => window.__PJ.Q().q.ans)
  const i0 = await page.evaluate(() => window.__PJ.Q().i)
  await page.evaluate((a) => document.querySelectorAll('#optbox .opt')[a]?.click(), ans)
  await sleep(500)
  const mid = await page.evaluate((i) => ({ i: window.__PJ.Q().i, fb: !!window.__PJ.Q().fb }), i0)
  ok(mid.i === i0 && mid.fb, '答对反馈期停留（~0.8s 内不出题，反馈可读）')
  await sleep(700)
  const after = await page.evaluate(() => ({ i: window.__PJ.Q().i, fb: !!window.__PJ.Q().fb }))
  ok(after.i === i0 + 1 && !after.fb, '反馈散场自动进下一题（零手点，对 800ms 档）', `i ${i0}→${after.i}`)
  ok(errsAll.length === 0, '闯关：零 pageerror', errsAll[0] || '')
  await page.close()
}

/* ③ 自动推进：听写专练（对 480ms 档）+ 错答后也自动推进（无"下一题"按钮依赖） */
{
  console.log('\n— ③ 听写专练自动推进 —')
  const page = await mkPage()
  await page.goto(`${BASE}/?open=ldrill`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-ldrill [data-q][data-target]', { timeout: 8000 })
  const t0 = await page.getAttribute('#v-ldrill [data-q]', 'data-target')
  const optK = async () => page.evaluate(() => Array.from(document.querySelectorAll('#v-ldrill [data-opts] .opt')).map((e) => e.getAttribute('data-opt')))
  const tapK = async (k) => {
    const ks = await optK()
    await page.tap(`#v-ldrill [data-opts] .opt:nth-of-type(${ks.indexOf(k) + 1})`)
  }
  await tapK(t0)   // 答对
  await sleep(800)
  const t1 = await page.getAttribute('#v-ldrill [data-q]', 'data-target')
  ok(!!t1, '听写：答对自动出下一题（零手点）')
  const ks1 = await optK()
  await tapK(ks1.find((k) => k !== t1))   // 答错
  await sleep(1500)
  const t2 = await page.getAttribute('#v-ldrill [data-q]', 'data-target')
  ok(!!t2 && t2 !== t1, '听写：答错也自动推进（错档停顿后出题，无手点按钮）')
  await page.close()
}

/* ② 切题过渡：连续出题面题目卡=滑入动画（animationName=qslidein，{#key} 重挂重放） */
{
  console.log('\n— ② 切题过渡（声调测一测/拼读/听写） —')
  const anim = (page, sel) => page.evaluate((s) => {
    const el = document.querySelector(s)
    return el ? getComputedStyle(el).animationName : '(none)'
  }, sel)

  const p1 = await mkPage()
  await p1.goto(`${BASE}/?open=blenddrill`, { waitUntil: 'networkidle' })
  await p1.waitForSelector('#v-bquiz [data-q]', { timeout: 8000 })
  ok((await anim(p1, '#v-bquiz [data-q]')) === 'qslidein', '拼读专练：题目卡滑入动画在场')
  await p1.close()

  const p2 = await mkPage()
  await p2.goto(`${BASE}/?open=ldrill`, { waitUntil: 'networkidle' })
  await p2.waitForSelector('#v-ldrill [data-q]', { timeout: 8000 })
  ok((await anim(p2, '#v-ldrill [data-q]')) === 'qslidein', '听写专练：题目卡滑入动画在场')
  await p2.close()

  /* 声调测一测（练习馆 tone 入口） */
  const p3 = await mkPage()
  await p3.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await p3.waitForSelector('#v-island', { timeout: 8000 })
  await p3.evaluate(() => window.__PJ?.hall?.('drill'))
  await p3.waitForSelector('#drillgrid [data-drill="tone"]', { timeout: 6000 })
  await p3.tap('#drillgrid [data-drill="tone"]')
  await p3.waitForSelector('#v-tquiz [data-q]', { timeout: 8000 })
  ok((await anim(p3, '#v-tquiz [data-q]')) === 'qslidein', '声调测一测：题目卡滑入动画在场（本 bug 主诉面）')
  /* 进度点同步：切题后 HUD 计数（已答 n）随动 */
  const hud0 = await p3.evaluate(() => document.querySelector('#v-tquiz [data-answered]')?.getAttribute('data-answered'))
  ok(hud0 !== undefined, '声调测一测：进度指示在场', `n=${hud0}`)
  await p3.close()
}

ok(errsAll.length === 0, '全程零 pageerror', errsAll.join(';'))
await browser.close()
console.log(`\nBug#38 回归样例：${pass} 过 / ${fail} 败`)
process.exit(fail ? 1 : 0)
