/* 回归命名样例 Bug#36「同屏共存」（自 v431-accept 抽出的最小可重复用例）。
   立法背景：v4.2c 前同屏只出一个目标——清屏退化策略让孩子"点最新的就对"，听音形同虚设。
   本样例=该 bug 的回归门：气球成波同批 ≥3 + 地鼠同探 ≥3 + 钓鱼并发 ≥3，全程零 pageerror。
   修 bug 先写失败测试（tests/README.md 规矩①）——若共存立法回退，本样例红灯。
   前置：preview 在 4173（或 BASE_URL），独立可跑：node tests/e2e/regression-bug36-coexist.mjs */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) } else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) } }

/* 播音日志 + 实体 spawn 观察者（气球/地鼠/鱼） */
const INIT = `window.__AUDIO_LOG = [];
window.__DOM_LOG = [];
function __setupObserver() {
  try {
    const mo = new MutationObserver((muts) => {
      const now = performance.now();
      for (const m of muts) {
        if (m.type !== 'childList') continue;
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          const probe = (cls, kind, attrs) => {
            const el = n.classList && n.classList.contains(cls) ? n : n.querySelector ? n.querySelector('.' + cls) : null;
            if (el) {
              const e = { kind, t: now };
              for (const a of attrs) e[a] = el.getAttribute('data-' + a);
              window.__DOM_LOG.push(e);
            }
          };
          probe('balloon', 'balloon', ['bid', 'letter']);
          probe('mole', 'mole', ['letter']);
          probe('fishwrap', 'fish', ['fid', 'letter']);
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) { }
}
if (document.documentElement) __setupObserver();
else document.addEventListener('DOMContentLoaded', __setupObserver);`

const browser = await chromium.launch()
const LEARN0 = { u: 4, stars: { 1: 3, 2: 3, 3: 3, 4: 2 }, best: { 1: 5, 2: 5, 3: 5, 4: 4 }, step: {} }
async function mk() {
  const page = await browser.newPage({ ...devices['iPhone 13'], hasTouch: true })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.addInitScript(`
    ${INIT}
    localStorage.clear()
    localStorage.setItem('pinyin_v2', JSON.stringify({ weights: {}, stars: { 1: 3, 2: 3, 3: 2 }, cards: {}, hist: [], mute: false, bolt: { acc: 0, d: '', tacc: 0, td: '' }, days: {} }))
    localStorage.setItem('pinyin_learn', JSON.stringify(${JSON.stringify(LEARN0)}))
    localStorage.setItem('pinyin_growth_v1', JSON.stringify({ v: 1, stars: 40, badges: [], seenStage: 1, det: 3, tone: 2, boltPerf: false }))
  `)
  return { page, errs }
}
/* 真实开局流：hub → 点摊位（开局手势）→ 3-2-1 结束进 play */
async function enterGame(page, id) {
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  await page.tap(`[data-stall="${id}"]`)
  await page.waitForSelector('#gcount', { timeout: 5000 })
  await page.waitForSelector('#gcount', { state: 'detached', timeout: 9000 })
}
const liveBalloons = (page) => page.evaluate(() => document.querySelectorAll('#gstage .balloon:not(.popped):not(.wrong)').length)
const liveFish = (page) => page.evaluate(() => document.querySelectorAll('#gstage .fishwrap:not(.caught):not(.scare)').length)

/* ---- 气球：成波共存 ---- */
{
  const { page, errs } = await mk()
  await enterGame(page, 'balloon')
  await page.waitForFunction(() => document.querySelectorAll('#gstage .balloon:not(.popped):not(.wrong)').length >= 3, { timeout: 12000 }).catch(() => {})
  ok(await liveBalloons(page) >= 3, 'Bug#36 气球：空中常驻活球 ≥3（禁单球出场轮）', `live=${await liveBalloons(page)}`)
  const log = await page.evaluate(() => window.__DOM_LOG.filter((e) => e.kind === 'balloon'))
  let batch = null
  for (let i = 0; i + 2 < log.length + 1; i++) {
    const w = [log[i], log[i + 1], log[i + 2]].filter(Boolean)
    if (w.length === 3 && w[2].t - w[0].t < 160) batch = { span: w[2].t - w[0].t }
  }
  ok(!!batch, 'Bug#36 气球：波次生成（≥3 只同批升空 <160ms）', batch ? `span=${batch.span}ms` : '无同批')
  ok(errs.length === 0, '零 pageerror', errs.join(';'))
  await page.close()
}
/* ---- 口诀地鼠：多鼠同探 ---- */
{
  const { page, errs } = await mk()
  await enterGame(page, 'mole')
  const up = await page.waitForFunction(() => document.querySelectorAll('#gstage .mole.up').length, null, { timeout: 12000 }).then((h) => h.jsonValue()).catch(() => 0)
  ok(up >= 3, 'Bug#36 地鼠：同探活鼠 ≥3（禁单鼠出场轮）', `up=${up}`)
  ok(errs.length === 0, '零 pageerror', errs.join(';'))
  await page.close()
}
/* ---- 钓鱼：并发游鱼 ---- */
{
  const { page, errs } = await mk()
  await enterGame(page, 'fish')
  await page.waitForFunction(() => document.querySelectorAll('#gstage .fishwrap:not(.caught):not(.scare)').length >= 3, { timeout: 12000 }).catch(() => {})
  ok(await liveFish(page) >= 3, 'Bug#36 钓鱼：水里并发游鱼 ≥3', `live=${await liveFish(page)}`)
  ok(errs.length === 0, '零 pageerror', errs.join(';'))
  await page.close()
}

await browser.close()
console.log(`\nBug#36 回归样例：${pass} 过 / ${fail} 败`)
process.exit(fail ? 1 : 0)
