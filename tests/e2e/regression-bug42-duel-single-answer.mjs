/* 命名回归样例 Bug#42「镜像对决点对判错+一击双中」（v4.5 修复回归门）。
   病灶：答对仅 320ms 即换题+选项网格位不变——孩子连点（double/triple-tap）的后续点漏进
   下一题被误判（"我点对的它判我错"），绿/红双钮反馈同屏又被读成"两个都被点中"。
   修法：inputLock 输入闸（单答锁+切题宽假期 320ms+动画期锁）。
   本样例=真实触摸输入连答 10 题（对错交替），逐题断言：
     ①零双中——宽假期内的连点余波被忽略（真答前反馈态必须为空；修复前此处必红）
     ②判分与所点逐题一致——点 qkey 必判对（绳右移），点干扰项必判错（绳左移）
     ③账本判分注册总数=10（恰好每题一记，零幻影注册）
   修 bug 先写失败测试（tests/README.md 规矩①）——若输入闸回退，本样例红灯。
   前置：preview 在 4173（或 BASE_URL），独立可跑：node tests/e2e/regression-bug42-duel-single-answer.mjs */
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
const page = await browser.newPage({ ...devices['iPhone 13'], hasTouch: true })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.addInitScript(`
  localStorage.clear()
  localStorage.setItem('pinyin_v2', JSON.stringify({ weights: {}, stars: { 1: 3, 2: 3, 3: 2 }, cards: {}, hist: [], mute: false, bolt: { acc: 0, d: '', tacc: 0, td: '' }, days: {} }))
  localStorage.setItem('pinyin_learn', JSON.stringify(${JSON.stringify(LEARN0)}))
  localStorage.setItem('pinyin_growth_v1', JSON.stringify({ v: 1, stars: 40, badges: [], seenStage: 1, det: 3, tone: 2, boltPerf: false }))
  window.__AUDIO_LOG = []
`)

/* 真实开局流：hub → 点摊位（开局手势）→ 3-2-1 结束进 play */
await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
await page.waitForSelector('#v-island', { timeout: 8000 })
await page.tap('[data-stall="duel"]')
await page.waitForSelector('#gcount', { timeout: 5000 })
await page.waitForSelector('#gcount', { state: 'detached', timeout: 9000 })

const knotLeft = () => page.evaluate(() => parseFloat(document.querySelector('[data-rope]')?.style.left) || 0)
const qInfo = () => page.evaluate(() => {
  const bs = Array.from(document.querySelectorAll('[data-opts] .duelopt'))
  return {
    target: document.querySelector('[data-q]')?.getAttribute('data-target'),
    qkeyIdx: bs.findIndex((b) => (b.getAttribute('data-qkey') || '') !== ''),
    st: bs.map((b) => ({ letter: b.getAttribute('data-letter'), qkey: (b.getAttribute('data-qkey') || '') !== '', c: b.classList.contains('correct'), w: b.classList.contains('wrong') })),
  }
})
const tapOpt = (i) => page.tap(`[data-opts] .duelopt >> nth=${i}`)
/* 精确装题锚：__AUDIO_LOG 计数增长即 resolve（每次 newQ 恰播一题音，必变信号——
   data-target 同字母连题不变会漏；微任务级不保证，用 25ms 页内轮询换确定性） */
const waitNextQ = () => page.evaluate(() => new Promise((resolve) => {
  const n0 = window.__AUDIO_LOG.length
  const tid = setInterval(() => {
    if (window.__AUDIO_LOG.length > n0) { clearInterval(tid); resolve(true) }
  }, 25)
  setTimeout(() => { clearInterval(tid); resolve(false) }, 9000)
}))

/* 每题协议（确定性）：装题锚 → 页内定时探针枪（装题+150ms，宽假期正中）→ 真实 CDP 触摸作答
   （装题+450ms，宽假期外）→ 判分断言。探针枪必须零判分；真实作答必须逐题判分一致 */
let leakCaught = 0
let pendingInstall = null   /* 下一题的装题 promise：真答前预挂，绝不与换题竞速 */
for (let i = 0; i < 10; i++) {
  /* Q1：倒计时结束题已装好，等存在性即可；Q2+：消费上一轮预挂的音频计数 watcher */
  let target = null
  if (i === 0) {
    await page.waitForFunction(() => !!document.querySelector('[data-q]')?.getAttribute('data-target'), null, { timeout: 9000 })
    target = await page.evaluate(() => document.querySelector('[data-q]')?.getAttribute('data-target'))
  } else {
    const okQ = await pendingInstall
    pendingInstall = null
    if (!okQ) { ok(false, `Q${i + 1} 装题超时（判分未触发换题或对局已结束）`); break }
    target = await page.evaluate(() => document.querySelector('[data-q]')?.getAttribute('data-target'))
  }
  if (await page.evaluate(() => !!document.querySelector('#gresult'))) { ok(false, `第 ${i + 1} 题对局提前结束（pos 漂移出界）`); break }

  /* ① 连点余波探针（i>0）：页内 setTimeout 精确装题+150ms 派发 pointerdown → 宽假期必须忽略。
     （合成事件只用于这把"定时枪"；判分路径全部真实 CDP 触摸） */
  if (i > 0) {
    await page.evaluate(() => setTimeout(() => {
      const b = document.querySelectorAll('[data-opts] .duelopt')[0]
      b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId: 1 }))
    }, 150))
  }

  /* ② 预挂下一题 watcher（此刻 < 真答，下一题换题在真答+320ms——绝对先挂） */
  pendingInstall = waitNextQ()

  /* ③ 真实作答（装题后 ≥650ms，宽假期 320ms 早已开门——dbg 实测 CDP tap 落点须避开宽假期）：
     偶数题点 qkey（必判对），奇数题点干扰项（必判错） */
  await sleep(300)
  const pre = await qInfo()
  if (pre.st.some((b) => b.c || b.w)) leakCaught++   /* 定时枪漏进本题判分=双中复发 */
  const wantRight = i % 2 === 0
  const pick = wantRight ? pre.qkeyIdx : 1 - pre.qkeyIdx
  const before = await knotLeft()
  await sleep(200)
  await tapOpt(pick)
  await sleep(180)
  const post = await qInfo()
  const st = post.st
  const left = await knotLeft()
  const qkey = st[pre.qkeyIdx], other = st[1 - pre.qkeyIdx]
  if (wantRight) {
    ok(qkey.c && !qkey.w, `Q${i + 1} 点对必判对（qkey→correct）`, `target=${target} tap=${st[pick].letter}`)
    ok(!other.c && !other.w, `Q${i + 1} 另一钮保持中性（答对不刷红=“两个都被点中”观感根除）`)
    ok(left > before, `Q${i + 1} 绳向敌方推进`, `${before.toFixed(1)}→${left.toFixed(1)}`)
  } else {
    ok(other.w && !other.c, `Q${i + 1} 点干扰项判错（判分与所点一致）`, `target=${target} tap=${other.letter}`)
    ok(qkey.c && !qkey.w, `Q${i + 1} 正确侧高亮（零错误信息反馈保持）`)
    ok(left < before, `Q${i + 1} 绳被拉回`, `${before.toFixed(1)}→${left.toFixed(1)}`)
  }
}
ok(leakCaught === 0, '宽假期连点余波全程被忽略（换题瞬间零判分）', `异常刷入=${leakCaught}`)

/* ③ 账本层总数断言：恰好 10 次判分注册（零幻影注册） */
const ledger = await page.evaluate(() => {
  const g = JSON.parse(localStorage.getItem('pinyin_game_v1') || '{}')
  return Object.values(g.letters || {}).reduce((s, r) => s + (r.ok || 0) + (r.err || 0), 0)
})
ok(ledger === 10, `账本判分注册总数=10（真实作答数，零多记零漏记）`, `total=${ledger}`)
if (pendingInstall) pendingInstall.catch(() => {})   /* 收尾弃置未消费的装题 watcher（防关闭竞态报未处理拒绝） */
ok(errs.length === 0, '零 pageerror', errs.join(';'))

await page.close()
await browser.close()
console.log(`\nBug#42 回归样例：${pass} 过 / ${fail} 败`)
process.exit(fail ? 1 : 0)
