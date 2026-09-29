/* 验收脚本（一次性，留档）：npm run preview 后运行
   链路：解锁层→首页四入口→正反题(锚点+🔊)→闪电答3题计数变→常见字自动读音 + 5 张截图
   另跑 v1 全套动态探针（full/det/bolt/zi/flash）。用法：
   node scripts/acceptance.mjs [playwright模块绝对路径]  （默认尝试本地 node_modules） */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) }
catch { ({ chromium } = await import(process.argv[2] || '/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const SHOT_DIR = new URL('../.acceptance/', import.meta.url).pathname
import { mkdirSync } from 'node:fs'
mkdirSync(SHOT_DIR, { recursive: true })

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log((pass ? '✓' : '✗') + ' ' + name + (detail ? ' — ' + detail : ''))
}

async function fresh() {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  })
  return ctx.newPage()
}

/* ---------- 1. 解锁层 → 首页四入口 ---------- */
{
  const page = await fresh()
  await page.goto(BASE)
  await page.waitForSelector('#unlock.on', { timeout: 5000 })
  await page.screenshot({ path: SHOT_DIR + '1-unlock.png' })
  ok('解锁层显示', true)
  await page.click('#ulgo')
  await page.waitForSelector('#v-home', { timeout: 5000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: SHOT_DIR + '2-home.png' })
  const four = await page.evaluate(() => ['levels', 'detect', 'bolt', 'zi'].map((g) => !!document.querySelector(`[data-go="${g}"]`)))
  ok('首页四入口', four.every(Boolean), 'levels/detect/bolt/zi=' + four.join(','))
  const starText = await page.textContent('#homestars')
  ok('首页星星行渲染', /：\s*0/.test(starText || '') && /颗/.test(starText || ''), starText || '')
  await page.close()
}

/* ---------- 2. 正反小侦探：锚点 + 🔊 + 镜像字 ---------- */
{
  const page = await fresh()
  await page.goto(BASE + '?open=detect')
  await page.waitForSelector('#v-quiz', { timeout: 5000 })
  await page.waitForTimeout(900)
  let info = await page.evaluate(() => {
    const q = window.__PJ.Q()
    return {
      type: q.q.type, X: q.q.X, flipped: q.q.flipped,
      anchor: !!document.querySelector('#v-quiz .anchorbar'),
      anbtn: !!document.querySelector('#v-quiz .anchorbar .anbtn'),
      mirror: !!document.querySelector('#v-quiz .glyph.mirror'),
      tfOpts: document.querySelectorAll('#optbox .opt.tf').length,
    }
  })
  /* 首题 X 按 70/30 先验随机（kuaner 第6步优化规格）——核心组断言允许重试 */
  for (let retry = 0; retry < 5 && !(info.type === 'djudge' && info.flipped === true && 'bdpqtf'.includes(info.X)); retry++) {
    await page.goto(BASE + '?open=detect')
    await page.waitForTimeout(700)
    info = await page.evaluate(() => {
      const q = window.__PJ.Q().q
      const g = document.querySelector('#v-quiz .glyph')
      return {
        type: q.type, X: q.X, flipped: q.flipped,
        anchor: !!document.querySelector('.anchorbar'), anbtn: !!document.querySelector('.anchorbar .anbtn'),
        mirror: getComputedStyle(g).transform.includes('-1'), tfOpts: document.querySelectorAll('#optbox .opt.tf').length,
      }
    })
  }
  ok('正反题首题=写反的核心字母(70/30 先验,5 次重试)', info.type === 'djudge' && info.flipped === true && 'bdpqtf'.includes(info.X), JSON.stringify(info))
  ok('锚点区+🔊按钮', info.anchor && info.anbtn)
  ok('镜像大字+✅/🔄两选项', info.mirror && info.tfOpts === 2)
  await page.screenshot({ path: SHOT_DIR + '3-detect.png' })
  /* 答对首题 → 验证 M: 权重 + duila 音频路径 */
  const x = info.X
  await page.evaluate(() => {
    const q = window.__PJ.Q().q
    document.querySelectorAll('#optbox .opt')[q.ans].click()
  })
  await page.waitForTimeout(1200)
  const after = await page.evaluate((X) => {
    const w = window.__PJ.S.weights['M:' + X]
    return { w: w ? w.w : null, score: window.__PJ.Q().score }
  }, x)
  ok('正反题答对→M: 权重记录+得分', after.score === 1 && after.w !== null, JSON.stringify(after))
  await page.close()
}

/* ---------- 3. ⚡闪电：冻结计时连答 3 题 → 计数变化 ---------- */
{
  const page = await fresh()
  await page.goto(BASE + '?open=bolt')
  await page.waitForSelector('#v-bolt', { timeout: 5000 })
  await page.waitForTimeout(800)
  const before = await page.textContent('#boltans')
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      const q = window.__PJ.BT().q
      document.querySelectorAll('#bopt .opt')[q.ans].click()
    })
    await page.waitForTimeout(800)
  }
  const after = await page.textContent('#boltans')
  const acc = await page.textContent('#boltacc')
  const time = await page.textContent('#bolttime')
  const num = (t) => Number((t || '').match(/(\d+)\s*$/)?.[1])
  ok('闪电答3题计数变化', num(before) === 0 && num(after) === 3, (before || '') + ' → ' + (after || '') + '（' + acc + '）')
  ok('闪电计时冻结(截图模式)', /5:00/.test(time || ''), time || '')
  await page.screenshot({ path: SHOT_DIR + '4-bolt.png' })
  await page.close()
}

/* ---------- 4. 📖常见字：出题自动读音 + 🔊重听 ---------- */
{
  const page = await fresh()
  await page.goto(BASE + '?open=zi')
  await page.waitForSelector('#v-quiz', { timeout: 5000 })
  await page.waitForTimeout(1000)
  const info = await page.evaluate(() => {
    const q = window.__PJ.Q().q
    return {
      type: q.type, han: q.z.h, p: q.z.p,
      audioCached: !!window.__PJ.AUDIO[q.z.f],
      replay: !!document.querySelector('#glyphbox .replaybtn'),
      opts: document.querySelectorAll('#optbox .opt').length,
    }
  })
  ok('常见字首题=看字选拼音', info.type === 'zi' && !!info.han && info.opts === 4, JSON.stringify({ type: info.type, han: info.han, opts: info.opts }))
  ok('出题自动读音(mp3 已载入)', info.audioCached, 'audio/' + info.p)
  ok('🔊重听按钮', info.replay)
  await page.screenshot({ path: SHOT_DIR + '5-zi.png' })
  await page.close()
}

/* ---------- 5. v1 全套动态探针 ---------- */
async function runProbe(name, expect, url) {
  const page = await fresh()
  await page.goto(BASE + url)
  /* 轮询等最终横幅（10 题探针全程约 10-15s） */
  let text = ''
  for (let t = 0; t < 30; t++) {
    await page.waitForTimeout(1000)
    text = (await page.textContent('#probe')) || ''
    if (text.includes(expect)) break
  }
  ok('probe=' + name, text.includes(expect), text.slice(0, 110))
  await page.close()
}
await runProbe('full', 'PROBE-FULL-OK', '?probe=full')
await runProbe('det', 'PROBE-DET-OK', '?probe=det')
await runProbe('bolt', 'PROBE-BOLT-OK', '?probe=bolt')
await runProbe('zi', 'PROBE-ZI-OK', '?probe=zi')
await runProbe('flash', 'PROBE-OK', '?probe=flash')
await runProbe('basic', 'PROBE-OK', '?probe=1')

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log('\n===== 验收结果：' + (results.length - failed.length) + '/' + results.length + ' 通过 =====')
if (failed.length) { console.log('FAILED: ' + failed.map((f) => f.name).join(', ')); process.exit(1) }
