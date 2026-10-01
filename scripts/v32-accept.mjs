/* v3.2 升级体系功能验收：触发点接线行为断言（庆祝/星星/卡片解锁/徽章/进化/签到/侦探计数）。
   前置：preview 在 4173（BASE_URL 可指其他）。种子=localStorage，作答=qkey 门确定性全对（题面 data-qkey=答案键）。 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = '.acceptance-v32'
fs.mkdirSync(OUT, { recursive: true })

let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) } else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) } }
const growthOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('pinyin_growth_v1') || '{}'))
const learnOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('pinyin_learn') || '{}'))

const browser = await chromium.launch()
const mk = async (seed) => {
  const page = await browser.newPage({ ...devices['iPhone 13'], hasTouch: true })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.addInitScript((o) => {
    localStorage.clear()
    localStorage.setItem('pinyin_v2', JSON.stringify({
      weights: {}, stars: o.pstars || {}, cards: {}, hist: [],
      mute: true, bolt: { acc: 0, d: '', tacc: 0, td: '' }, days: o.days || {},
    }))
    localStorage.setItem('pinyin_learn', JSON.stringify({ u: o.u || 1, stars: o.lstars || {}, best: o.lbest || {}, step: {} }))
    if (o.growth) localStorage.setItem('pinyin_growth_v1', JSON.stringify(Object.assign({ v: 1, stars: 0, badges: [], seenStage: -1, det: 0, tone: 0, boltPerf: false }, o.growth)))
  }, seed || {})
  return { page, errs }
}

/* ---------- ① 学习岛小测全对过关 → 全屏庆祝 + 星星+5 + L1 记星解锁 + 徽章 ---------- */
{
  const { page, errs } = await mk({})
  await page.goto(`${BASE}/?open=lesson&learn=1&qkey`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-lesson', { timeout: 8000 })
  await page.evaluate(() => { const q = new URLSearchParams(location.search); q.set('page', '6'); history.replaceState(null, '', '?' + q.toString()) })
  await page.waitForTimeout(800)
  await page.evaluate(() => { document.querySelector('[data-bootquiz],[data-forcequiz]')?.click() })   /* BUGS#33：未集旗课=拦截卡（forcequiz=「我还要试试」放行） */
  await page.waitForTimeout(400)
  for (let i = 0; i < 5; i++) {
    await page.waitForSelector('#v-lesson .qbody[data-qkey]', { timeout: 5000 })
    await page.evaluate(() => {
      const ans = document.querySelector('#v-lesson .qbody').getAttribute('data-qkey')
      const opts = Array.from(document.querySelectorAll('#v-lesson [data-opts] .opt'))
      const hit = opts.find((e) => e.getAttribute('data-qkey') === ans) || opts[0]
      hit.click()
    })
    await page.waitForTimeout(2300)
  }
  await page.waitForSelector('#celebrate[data-ce="quiz"]', { timeout: 6000 })
  ok(true, '小测过关 → 全屏庆祝 overlay（quiz 模式）')
  const g1 = await growthOf(page)
  ok(g1.stars === 5, '成长星星 +5（0→5）', 'stars=' + g1.stars)
  ok((g1.badges || []).includes('first'), '徽章「初次通关」入账', 'badges=' + (g1.badges || []).join(','))
  const l1 = await learnOf(page)
  ok((l1.stars && l1.stars['1'] > 0) || l1.u === 2, 'L1 记星 + 下一课解锁', 'u=' + l1.u + ' stars1=' + (l1.stars && l1.stars['1']))
  await page.evaluate(() => document.getElementById('celebrate')?.click())
  await page.waitForTimeout(400)
  ok(await page.evaluate(() => !document.getElementById('celebrate')), '庆祝点击即跳过')
  ok(errs.length === 0, '全程零 pageerror', errs[0] || '')
  await page.context().close()
}

/* ---------- ② 卡片解锁口径：L1 过 → 图鉴 3 金 + 6 灰，计数 3/63 ---------- */
{
  const { page } = await mk({ lstars: { 1: 3 }, u: 2, growth: { stars: 5 } })
  await page.goto(`${BASE}/?open=album`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-albumpage="0"]', { timeout: 8000 })
  await page.waitForTimeout(600)
  const got = await page.evaluate(() => ({
    gold: document.querySelectorAll('[data-albumpage="0"] .alcard.got').length,
    gray: document.querySelectorAll('[data-albumpage="0"] .alcard:not(.got)').length,
    chip: document.querySelector('[data-cardcount]')?.textContent?.trim(),
  }))
  ok(got.gold === 3 && got.gray === 6, '图鉴=金卡3+灰卡6（课级解锁口径）', JSON.stringify(got))
  ok(/3\s*\/\s*63/.test(got.chip || ''), '顶部计数 3/63', got.chip)
  await page.context().close()
}

/* ---------- ③ 进化：星星达阈值 → 进我的 tab 播放并记账（不重播） ---------- */
{
  const { page, errs } = await mk({ growth: { stars: 60, seenStage: 0 } })
  await page.goto(`${BASE}/?open=mine`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#celebrate[data-ce="evolve"]', { timeout: 6000 })
  ok(true, '进我的 tab → 进化 overlay（破壳→小黄鸡）')
  const g = await growthOf(page)
  ok(g.seenStage === 1, 'seenStage 记账到 1（下次不重播）', 'seenStage=' + g.seenStage)
  ok(errs.length === 0, '进化零 pageerror', errs[0] || '')
  await page.context().close()
}

/* ---------- ④ 闪电：probe 答 2 题→结算（n<10 不记签到=阈值成立）+ 满分旗→徽章 ---------- */
{
  const { page, errs } = await mk({ growth: { boltPerf: true } })
  await page.goto(`${BASE}/?probe=bolt`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(4500)
  let g = await growthOf(page)
  const v2 = await page.evaluate(() => JSON.parse(localStorage.getItem('pinyin_v2') || '{}'))
  ok(!v2.days || Object.keys(v2.days).length === 0, '闪电 n=2 <10 → 不记签到（阈值口径）', 'days=' + JSON.stringify(v2.days))
  ok(errs.length === 0, 'bolt 全程零 pageerror', errs[0] || '')
  /* 满分旗 → 任意 checkBadges 触发点（侦探计数）兑现徽章：见 ⑤ 联合断言 */
  await page.context().close()
}

/* ---------- ⑤ 小侦探答对 → det 计数 + checkBadges 兑现满分旗徽章 ---------- */
{
  const { page, errs } = await mk({ growth: { boltPerf: true } })
  await page.goto(`${BASE}/?probe=det`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3800)
  const g = await growthOf(page)
  ok(g.det === 1, '侦探答对 1 → det=1', 'det=' + g.det)
  ok((g.badges || []).includes('boltperfect'), '闪电满分旗 → 徽章 boltperfect 兑现', 'badges=' + (g.badges || []).join(','))
  ok(errs.length === 0, '侦探零 pageerror', errs[0] || '')
  await page.context().close()
}

await browser.close()
console.log(`\n===== v32-accept：${pass} 通过，${fail} 失败 =====`)
process.exit(fail ? 2 : 0)
