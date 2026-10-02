/* v4.2 练习馆+口诀地鼠验收（Bug#35 上半）：
   ① hub 8 摊位+占位不误触 ② hall 分段切换往返状态保持 ③ 闪电刷题真实试玩 5 题+结算+账本双记
   ④ 听写专练自动读音+只练弱项开关 ⑤ 易混对特训 weak 标+对内加权开练 ⑥ 识字表闯关解锁态+答 3 题+零自动播边界
   ⑦ 口诀地鼠：kj 音频先于地鼠探头时序+敲对得分+敲错清连击+🔊重听口诀 ⑧ 气球仍=呼读音（认知路径区分）。
   前置：preview 在 4173。时序证据 __AUDIO_LOG/__DOM_LOG（同 v41）。 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = '.acceptance-v42'
fs.mkdirSync(OUT, { recursive: true })

let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) } else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) } }
const letterAudioName = (k) => (k === 'ü' ? 'v' : k === 'ün' ? 'vn' : k === 'üe' ? 've' : k)
const kjAudioName = (k) => 'lessons/kj_' + letterAudioName(k)

const INIT = `window.__AUDIO_LOG = [];
window.__DOM_LOG = [];
function __setupObserver() {
  try {
    const mo = new MutationObserver((muts) => {
      const now = performance.now();
      for (const m of muts) {
        if (m.type === 'attributes' && m.target.classList) {
          if (m.target.classList.contains('mole') && m.target.classList.contains('up') && !m.target.__upLogged) {
            m.target.__upLogged = 1;
            window.__DOM_LOG.push({ kind: 'mole-up', letter: m.target.getAttribute('data-letter'), t: now });
          }
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  } catch (e) { }
}
if (document.documentElement) __setupObserver();
else document.addEventListener('DOMContentLoaded', __setupObserver);`

const browser = await chromium.launch()
async function mk({ muted = true, seed = '' } = {}) {
  const page = await browser.newPage({ ...devices['iPhone 13'], hasTouch: true })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.addInitScript(`
    ${INIT}
    localStorage.clear()
    localStorage.setItem('pinyin_v2', JSON.stringify({
      weights: {}, stars: { 1: 3, 2: 3, 3: 2 }, cards: {}, hist: [],
      mute: ${muted}, bolt: { acc: 0, d: '', tacc: 0, td: '' }, days: {},
    }))
    localStorage.setItem('pinyin_learn', JSON.stringify({ u: 4, stars: { 1: 3, 2: 3, 3: 3, 4: 2 }, best: { 1: 5, 2: 5, 3: 5, 4: 4 }, step: {} }))
    localStorage.setItem('pinyin_growth_v1', JSON.stringify({ v: 1, stars: 40, badges: [], seenStage: 1, det: 3, tone: 2, boltPerf: false }))
    ;${seed}
  `)
  return { page, errs }
}
const pd = (page, sel) => page.evaluate((s) => {
  document.querySelector(s)?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
}, sel)
const ck = (page, sel) => page.evaluate((s) => { document.querySelector(s)?.click() }, sel)

/* 练习馆直达：island → 点练习馆分段 */
async function enterDrill(page) {
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  await ck(page, '[data-hallbtn="drill"]')
  await page.waitForSelector('#drillgrid', { timeout: 5000 })
}

/* ================= ① hub：8 摊位 + 占位不误触 + 分段切换往返 ================= */
{
  console.log('\n— ① hub 8 摊位 + hall 分段 —')
  const { page, errs } = await mk()
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  await page.waitForTimeout(400)
  const hub = await page.evaluate(() => ({
    hall: document.getElementById('v-island').getAttribute('data-hall'),
    gameOn: document.getElementById('hallbtn-game').classList.contains('on'),
    drillOn: document.getElementById('hallbtn-drill').classList.contains('on'),
    stalls: Array.from(document.querySelectorAll('#stalls [data-stall]')).map((e) => e.getAttribute('data-stall')),
    coming: Array.from(document.querySelectorAll('#stalls [data-coming]')).map((e) => e.getAttribute('data-coming')),
    comingBtn: document.querySelectorAll('#stalls [data-coming] button').length,
    stallBtn: document.querySelectorAll('#stalls [data-stall] button, #stalls [data-stall]').length,
    scrollV: document.getElementById('tab-view-root').scrollHeight <= document.getElementById('tab-view-root').clientHeight + 1,
  }))
  ok(hub.hall === 'game' && hub.gameOn && !hub.drillOn, '默认分段=游戏岛（hallbtn-game 高亮）')
  /* v4.3 终态：6 摊位全实装，零占位（裁定 2026-10-01：蛋/音乐会上，赛跑/翻牌删除） */
  ok(hub.stalls.join(',') === 'balloon,mole,duel,fish,egg,tone', 'hub：6 游戏摊位实装（v4.3 终态）', hub.stalls.join(','))
  ok(hub.coming.length === 0, 'hub：零占位残留（敬请期待灰卡清零）', hub.coming.join(','))
  ok(hub.scrollV, 'hub：零纵向滚动（2×3 网格 664 视口）')
  /* 往返切换：game→drill→game，摊位/挑战卡都在（状态保持） */
  await ck(page, '[data-hallbtn="drill"]')
  await page.waitForSelector('#drillgrid', { timeout: 5000 })
  const drill = await page.evaluate(() => ({
    hall: document.getElementById('v-island').getAttribute('data-hall'),
    cards: Array.from(document.querySelectorAll('#drillgrid [data-drill]')).map((e) => e.getAttribute('data-drill')),
    scrollV: document.getElementById('tab-view-root').scrollHeight <= document.getElementById('tab-view-root').clientHeight + 1,
  }))
  ok(drill.hall === 'drill' && drill.cards.join(',') === 'bolt,listen,pairs,zi,blend,tone', '练习馆：六入口卡（闪电/听写/易混对/识字表/拼读/声调）', drill.cards.join(','))
  ok(drill.scrollV, '练习馆：零纵向滚动')
  await ck(page, '[data-hallbtn="game"]')
  await page.waitForSelector('#stalls', { timeout: 5000 })
  const back = await page.evaluate(() => ({
    hall: document.getElementById('v-island').getAttribute('data-hall'),
    daily: !!document.getElementById('dailycard'),
    stalls: document.querySelectorAll('#stalls [data-stall]').length,
  }))
  ok(back.hall === 'game' && back.daily && back.stalls === 6, '往返切回游戏岛：挑战卡+6 摊位原样')
  /* 跨视图保持：drill → pairs 页 → 返回练习 tab 仍在练习馆 */
  await ck(page, '[data-hallbtn="drill"]')
  await page.waitForSelector('#drillgrid', { timeout: 5000 })
  await ck(page, '[data-drill="pairs"]')
  await page.waitForSelector('#v-pairs', { timeout: 5000 })
  await ck(page, '[data-back="practice"]')
  await page.waitForSelector('#v-island', { timeout: 5000 })
  ok(await page.evaluate(() => document.getElementById('v-island').getAttribute('data-hall')) === 'drill', '跨视图往返：pairs 返回后 hall=练习馆保持')
  ok(errs.length === 0, 'hub：零 pageerror', errs[0] || '')
  await page.context().close()
}

/* ================= ② ⚡闪电刷题：自动读音 + 答 5 题 + 结算 + 账本双记 ================= */
{
  console.log('\n— ② 闪电刷题 —')
  const { page, errs } = await mk({ muted: false })
  await enterDrill(page)
  await ck(page, '[data-drill="bolt"]')
  await page.waitForSelector('#v-bolt', { timeout: 5000 })
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  /* 首题自动读音与题型一致（blisten=呼读音 / bkj=口诀朗读） */
  const q0 = await page.evaluate(() => { const q = window.__PJ.BT().q; return { type: q.type, a: q.A, snd: q.sound } })
  const a0 = await page.evaluate(() => window.__AUDIO_LOG[0].name)
  const exp0 = q0.type === 'bkj' ? kjAudioName(q0.a) : letterAudioName(q0.snd)
  ok(a0 === exp0, '闪电：出题自动读音（题型匹配 ' + q0.type + '）', `log=${a0} exp=${exp0}`)
  /* 真实连答 5 题（读 BT 答案 → 点对应选项） */
  for (let i = 0; i < 5; i++) {
    await page.waitForFunction(() => { const b = window.__PJ.BT(); return b.q && !b.reveal }, null, { timeout: 6000 })
    await page.evaluate((i) => {
      const q = window.__PJ.BT().q
      document.querySelectorAll('#bopt .opt')[q.ans]?.click()
    }, i)
    await page.waitForTimeout(1400)
  }
  const bt = await page.evaluate(() => { const b = window.__PJ.BT(); return { n: b.n, ok: b.ok, streak: b.streak } })
  ok(bt.n === 5 && bt.ok === 5 && bt.streak === 5, '闪电：连答 5 题计数/连对', JSON.stringify(bt))
  /* HUD 实时计数 */
  const hud = await page.evaluate(() => document.getElementById('boltans').textContent)
  ok(/5$/.test(hud.trim()), '闪电：HUD 已答=5', hud)
  /* 提前结束 → 结算页（总题数/正确率/最长连对） */
  await ck(page, '#boltstop')
  await page.waitForSelector('#boltresult', { timeout: 5000 })
  const res = await page.evaluate(() => ({
    on: getComputedStyle(document.getElementById('boltresult')).display !== 'none',
    stats: !!document.getElementById('bstats'),
    n: document.querySelector('#bstats .bv')?.textContent,
  }))
  ok(res.on && res.stats, '闪电：结算页出（总题数/正确率/最长连对）')
  /* 游戏账本双记：闪电作答写入 pinyin_game_v1 */
  const led = await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('pinyin_game_v1') || '{}').letters || {}; return Object.values(l).reduce((a, r) => a + (r.ok || 0), 0) })
  ok(led >= 5, '闪电：作答写入错误账本 pinyin_game_v1', 'okSum=' + led)
  /* 结算回练习馆（hall 保持） */
  await ck(page, '#bhome')
  await page.waitForSelector('#v-island', { timeout: 5000 })
  ok(await page.evaluate(() => document.getElementById('v-island').getAttribute('data-hall')) === 'drill', '闪电：退出回练习馆（hall 保持）')
  ok(errs.length === 0, '闪电：零 pageerror', errs[0] || '')
  await page.context().close()
}

/* ================= ③ ✍️ 听写专练：自动读音 + 只练弱项开关 ================= */
{
  console.log('\n— ③ 听写专练 —')
  const { page, errs } = await mk({
    muted: false,
    seed: `(() => { const led = JSON.parse(localStorage.getItem('pinyin_game_v1') || '{"v":1,"letters":{},"games":{},"daily":{"day":"","best":0,"done":false}}'); led.letters.a = { ok: 0, err: 4, last: Math.floor(Date.now()/86400000) }; localStorage.setItem('pinyin_game_v1', JSON.stringify(led)) })()`,
  })
  await enterDrill(page)
  await ck(page, '[data-drill="listen"]')
  await page.waitForSelector('#v-ldrill', { timeout: 5000 })
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  const t0 = await page.evaluate(() => document.querySelector('#v-ldrill [data-q]').getAttribute('data-target'))
  const a0 = await page.evaluate(() => window.__AUDIO_LOG[0].name)
  ok(a0 === letterAudioName(t0), '听写：出题自动读音（呼读音）', `target=${t0} log=${a0}`)
  ok(await page.evaluate(() => document.querySelectorAll('#v-ldrill [data-opts] .opt').length) === 2, '听写：二选一')
  /* 连答 3 题（点 data-opt=target） */
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction(() => document.querySelector('#v-ldrill [data-q]')?.getAttribute('data-reveal') === '0', null, { timeout: 6000 })
    const t = await page.evaluate(() => document.querySelector('#v-ldrill [data-q]').getAttribute('data-target'))
    /* v4.2c Bug#37 两段式：首点=试听，再点同项=作答 */
    await page.evaluate((t) => {
      const opt = Array.from(document.querySelectorAll('#v-ldrill [data-opt]')).find((e) => e.getAttribute('data-opt') === t)
      opt?.click()
      setTimeout(() => opt?.click(), 350)
    }, t)
    await page.waitForTimeout(1500)
  }
  const st = await page.evaluate(() => ({
    answered: document.querySelector('#v-ldrill [data-answered]').getAttribute('data-answered'),
    acc: document.querySelector('#v-ldrill [data-acc]').textContent,
  }))
  ok(st.answered === '3' && /100%/.test(st.acc), '听写：连答 3 题计数+正确率', JSON.stringify(st))
  /* 只练弱项开关：开启后下一题目标必为弱项池字母（种了 a err=4） */
  await ck(page, '[data-weaktoggle]')
  await page.waitForTimeout(300)
  const tg = await page.evaluate(() => ({
    on: document.querySelector('[data-weaktoggle]').classList.contains('on'),
    note: !!document.querySelector('[data-weaknote]'),
    pressed: document.querySelector('[data-weaktoggle]').getAttribute('aria-pressed'),
  }))
  ok(tg.on && tg.note && tg.pressed === 'true', '只练弱项：开关开+说明文案出')
  /* 答掉当前题，下一题应从弱项池出（=a） */
  await page.waitForFunction(() => document.querySelector('#v-ldrill [data-q]')?.getAttribute('data-reveal') === '0', null, { timeout: 6000 })
  await page.evaluate(() => {
    const q = document.querySelector('#v-ldrill [data-q]')
    const t = q.getAttribute('data-target')
    const opt = Array.from(document.querySelectorAll('#v-ldrill [data-opt]')).find((e) => e.getAttribute('data-opt') === t)
    /* v4.2c Bug#37 两段式：首点=试听，再点同项=作答 */
    opt?.click()
    setTimeout(() => opt?.click(), 350)
  })
  await page.waitForTimeout(1500)
  const t1 = await page.evaluate(() => document.querySelector('#v-ldrill [data-q]').getAttribute('data-target'))
  ok(t1 === 'a', '只练弱项：开弱项后目标=弱项字母 a', 'target=' + t1)
  const led2 = await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('pinyin_game_v1')).letters; return { a: l.a, okSum: Object.values(l).reduce((s, r) => s + (r.ok || 0), 0) } })
  ok(led2.a && led2.a.ok >= 1 && led2.okSum >= 4, '听写：作答写入游戏错误账本', JSON.stringify(led2))
  await ck(page, '[data-back="ldrillquit"]')
  await page.waitForSelector('#v-island', { timeout: 5000 })
  ok(await page.evaluate(() => document.getElementById('v-island').getAttribute('data-hall')) === 'drill', '听写：退出回练习馆（hall 保持）')
  ok(errs.length === 0, '听写：零 pageerror', errs[0] || '')
  await page.context().close()
}

/* ================= ④ 🔄 易混对特训：weak 小进度标 + 对内加权开练 ================= */
{
  console.log('\n— ④ 易混对特训 —')
  const { page, errs } = await mk({
    seed: `(() => { const led = JSON.parse(localStorage.getItem('pinyin_game_v1') || '{"v":1,"letters":{},"games":{},"daily":{"day":"","best":0,"done":false}}'); led.letters.b = { ok: 0, err: 3, last: Math.floor(Date.now()/86400000) }; led.letters.d = { ok: 5, err: 0, last: Math.floor(Date.now()/86400000) }; localStorage.setItem('pinyin_game_v1', JSON.stringify(led)) })()`,
  })
  await enterDrill(page)
  await ck(page, '[data-drill="pairs"]')
  await page.waitForSelector('#v-pairs', { timeout: 5000 })
  const chip = await page.evaluate(() => {
    const c = Array.from(document.querySelectorAll('#v-pairs .chip')).find((e) => e.textContent.includes('b ↔ d'))
    return { weak: c?.classList.contains('weak'), tag: c?.querySelector('[data-ptag]')?.getAttribute('data-ptag') }
  })
  ok(chip.weak && chip.tag === 'weak', '易混对：b↔d chip 带多练小进度标（账本 err 派生）', JSON.stringify(chip))
  /* 整组开练 → 10 题会话，真实答 3 题 */
  await ck(page, '#v-pairs .gstart')
  await page.waitForSelector('#v-quiz', { timeout: 5000 })
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction(() => { const q = window.__PJ.Q(); return q.q && !q.reveal && !q.fb }, null, { timeout: 6000 })
    await page.evaluate(() => {
      const q = window.__PJ.Q().q
      const el = document.querySelectorAll('#optbox .opt')[q.ans]
      /* v4.2c Bug#37：全题型两段式——首点=试听，再点同项=作答 */
      el?.click()
      setTimeout(() => { document.querySelectorAll('#optbox .opt')[q.ans]?.click() }, 400)
    })
    await page.waitForTimeout(1300)
  }
  const qs = await page.evaluate(() => window.__PJ.Q().score)
  ok(qs === 3, '易混对：开练真实答对 3 题', 'score=' + qs)
  const ledB = await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('pinyin_game_v1')).letters; return (l.b?.ok || 0) + (l.d?.ok || 0) + (l.n?.ok || 0) })
  ok(ledB >= 1, '易混对：作答写入游戏错误账本（字母题双记）', 'okSum=' + ledB)
  await ck(page, '[data-back="quit"]')   /* quiz 视图退出键（quitQuiz → 练习 tab） */
  await page.waitForSelector('#v-island', { timeout: 5000 })
  ok(errs.length === 0, '易混对：零 pageerror', errs[0] || '')
  await page.context().close()
}

/* ================= ⑤ 📖 识字表闯关：解锁态 + 答 3 题 + 零自动播边界 ================= */
{
  console.log('\n— ⑤ 识字表闯关 —')
  const { page, errs } = await mk({ muted: false })
  /* node 侧同算法算期望解锁数（learned=L1..L4） */
  const lessons = JSON.parse(fs.readFileSync('src/data/lessons.json', 'utf8')).lessons
  const learned = new Set()
  for (const l of lessons) if (l.n <= 4) for (const e of l.letters) learned.add(e.k)
  const ZI = JSON.parse(fs.readFileSync('src/data/zi180.json', 'utf8'))
  const TONEV = 'āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ'
  const clean = (py) => [...py].map((ch) => { const i = TONEV.indexOf(ch); return i >= 0 ? 'aoeiuv'[Math.floor(i / 4)] : ch }).join('')
  const INIS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']
  const splitC = (py) => { for (const ini of INIS) { if (py.indexOf(ini) === 0) return [ini, py.slice(ini.length)] } return ['', py] }
  const covF = (f) => { if (!f || learned.has(f)) return true; let i = 0
    while (i < f.length) { let m = false; for (let len = Math.min(3, f.length - i); len >= 1; len--) { if (learned.has(f.slice(i, i + len))) { i += len; m = true; break } } if (!m) return false }
    return true }
  const expectUnlock = ZI.filter((z) => { const [ini, fin] = splitC(clean(z.p)); return (!ini || learned.has(ini)) && covF(fin) }).length
  await enterDrill(page)
  const logBefore = await page.evaluate(() => window.__AUDIO_LOG.length)
  await ck(page, '[data-drill="zi"]')
  await page.waitForSelector('#v-zihall', { timeout: 5000 })
  const grid = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('#v-zihall .zcell'))
    return {
      total: cells.length,
      unlocked: cells.filter((e) => e.getAttribute('data-locked') === '0').length,
      locked: cells.filter((e) => e.getAttribute('data-locked') === '1').length,
      prog: document.querySelector('[data-ziProg]').textContent.replace(/\s/g, ''),
    }
  })
  ok(grid.total === 180, '识字表：180 字全网格')
  ok(grid.unlocked === expectUnlock && expectUnlock > 0, `识字表：解锁数=学习进度派生（期望 ${expectUnlock}）`, `dom=${grid.unlocked}`)
  ok(grid.locked > 0 && grid.unlocked + grid.locked === 180, '识字表：锁定态在网格（先解锁已学字母相关的字）')
  ok(/\d+\/180/.test(grid.prog.replace(/\s/g, '')), '识字表：进度角标（已解锁 a/b 字）', grid.prog)
  /* 锁定字点击=温和提示不进练 */
  await page.evaluate(() => {
    const c = Array.from(document.querySelectorAll('#v-zihall .zcell')).find((e) => e.getAttribute('data-locked') === '1')
    c?.click()
  })
  await page.waitForTimeout(400)
  const toastOn = await page.evaluate(() => document.getElementById('toast').classList.contains('on'))
  ok(toastOn, '识字表：点锁定字=温和提示（不误触进练）')
  /* 点解锁字开练：看字题零自动播（__AUDIO_LOG 不增长） */
  const logAtStart = await page.evaluate(() => window.__AUDIO_LOG.length)
  await page.evaluate(() => {
    const c = Array.from(document.querySelectorAll('#v-zihall .zcell')).find((e) => e.getAttribute('data-locked') === '0')
    c?.click()
  })
  await page.waitForSelector('#v-zihall [data-q]', { timeout: 5000 })
  await page.waitForTimeout(500)
  const logQ = await page.evaluate(() => window.__AUDIO_LOG.length)
  ok(logQ === logAtStart, '识字表：看字题不播答案音（v4.1 边界）', `log ${logAtStart}→${logQ}`)
  /* 真实答 3 题（4 选拼音，__PJ.ziQ().ans → 点对应项） */
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction(() => document.querySelector('#v-zihall [data-q]')?.getAttribute('data-reveal') === '0', null, { timeout: 6000 })
    await page.evaluate(() => {
      const zq = window.__PJ.ziQ()
      const py = zq.opts[zq.ans]
      const opt = Array.from(document.querySelectorAll('#v-zihall [data-opt]')).find((e) => e.getAttribute('data-opt') === py)
      /* v4.2c Bug#37 两段式：首点=试听，再点同项=作答 */
      opt?.click()
      setTimeout(() => opt?.click(), 350)
    })
    await page.waitForTimeout(1300)
  }
  const zst = await page.evaluate(() => ({
    answered: document.querySelector('#v-zihall [data-answered]')?.getAttribute('data-answered'),
    acc: document.querySelector('#v-zihall [data-acc]')?.textContent,
  }))
  ok(zst.answered && +zst.answered >= 3, '识字表：真实答 3 题（计数累计）', JSON.stringify(zst))
  const zw = await page.evaluate(() => { const w = JSON.parse(localStorage.getItem('pinyin_v2')).weights; return Object.keys(w).filter((k) => k.startsWith('Z:')).length })
  ok(zw >= 1, '识字表：作答写入字级权重 Z:（字级错误账本）', 'Z:keys=' + zw)
  /* 🔊 点播照旧 */
  const logR0 = await page.evaluate(() => window.__AUDIO_LOG.length)
  await ck(page, '#v-zihall [data-listen]')
  await page.waitForTimeout(400)
  const logR1 = await page.evaluate(() => window.__AUDIO_LOG.length)
  ok(logR1 > logR0, '识字表：🔊 点播字音可用')
  ok(errs.length === 0, '识字表：零 pageerror', errs[0] || '')
  await page.context().close()
}

/* ================= ⑥ 🔨 口诀地鼠：kj 音频先行 + 敲对/敲错 + 重听口诀 ================= */
{
  console.log('\n— ⑥ 口诀地鼠 —')
  const { page, errs } = await mk({ muted: false })
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  const stallName = await page.evaluate(() => document.querySelector('[data-stall="mole"] .sname')?.textContent || '')
  const plain = (t) => t.replace(/[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s]/g, '')
  ok(plain(stallName) === '口诀打地鼠', '摊位名=口诀打地鼠', stallName)
  await page.tap('[data-stall="mole"]')
  await page.waitForSelector('#gcount', { timeout: 5000 })
  await page.waitForSelector('#gcount', { state: 'detached', timeout: 9000 })
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  const target = await page.getAttribute('[data-prompt]', 'data-target')
  /* 核心断言：播的是口诀音频（lessons/kj_*），不是呼读音——认知路径=口诀→形 */
  const names0 = await page.evaluate(() => window.__AUDIO_LOG.map((e) => e.name))
  ok(names0.some((n) => n.startsWith('lessons/kj_')), '口诀先行：开局自动播口诀音频（lessons/kj_*）', names0.join(','))
  ok(!names0.includes(letterAudioName(target)), '认知路径区分：目标呼读音未播（气球才播呼读音）')
  ok(names0[0] === kjAudioName(target), '口诀先行：首播=kj_目标字母', names0[0])
  const a = await page.evaluate((n) => window.__AUDIO_LOG.filter((e) => e.name === n)[0] || null, kjAudioName(target))
  const upReady = await page.waitForFunction(() => window.__DOM_LOG.filter((e) => e.kind === 'mole-up').length >= 1, null, { timeout: 6000 }).then(() => true).catch(() => false)
  const up = await page.evaluate(() => window.__DOM_LOG.filter((e) => e.kind === 'mole-up')[0] || null)
  ok(upReady && !!a && !!up && a.t < up.t, '时序：口诀音频先于地鼠探头', `audio=${Math.round(a.t)} < up=${up ? Math.round(up.t) : '-'}`)
  ok(upReady && !!a && !!up && up.t - a.t >= 250, '时序：探头挂声音开播 300ms 闸门后', `gap=${up && a ? Math.round(up.t - a.t) : '-'}ms`)
  const kjUI = await page.evaluate(() => ({
    kj: document.querySelector('[data-prompt]')?.getAttribute('data-kj'),
    chip: !!document.querySelector('[data-kjchip]'),
  }))
  ok(kjUI.kj === '1' && kjUI.chip, '口诀标识：prompt data-kj=1 + 口诀 chip 在')
  /* 敲对得分：等目标鼠探头真实触摸 */
  let whacked = false
  for (let i = 0; i < 3 && !whacked; i++) {
    const tgt = await page.getAttribute('[data-prompt]', 'data-target')
    await page.waitForSelector(`#gstage .mole.up[data-letter="${tgt}"]`, { timeout: 6000 })
    await page.evaluate((letter) => {
      const m = Array.from(document.querySelectorAll('#gstage .mole.up')).find((e) => e.getAttribute('data-letter') === letter)
      m?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    }, tgt)
    await page.waitForTimeout(400)
    whacked = await page.evaluate(() => document.querySelector('#gscore').textContent === '10')
    await page.waitForTimeout(500)
  }
  ok(whacked, '敲对：目标鼠得分 10')
  /* 敲错清连击：等非目标鼠在场敲它 */
  let cleared = false
  for (let i = 0; i < 6 && !cleared; i++) {
    const decoy = await page.evaluate(() => {
      const t = document.querySelector('[data-prompt]').getAttribute('data-target')
      const m = Array.from(document.querySelectorAll('#gstage .mole.up')).find((e) => e.getAttribute('data-letter') !== t)
      if (!m) return null
      m.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      return m.getAttribute('data-letter')
    })
    if (decoy) {
      await page.waitForTimeout(300)
      cleared = await page.evaluate(() => document.querySelector('#gcombo').getAttribute('data-combo') === '0')
    }
    await page.waitForTimeout(800)
  }
  ok(cleared, '敲错：清连击（data-combo=0）')
  /* 🔊=重听口诀。v4.2c 适配（验收腿，只改脚本）：配对"tap 时刻目标"——400ms 窗内若回合到期
     miss 换目标，新目标音会接在重听后面，拿窗末目标配对第一条音频会错位（实录 kj_t,kj_b） */
  const cnt0 = await page.evaluate(() => window.__AUDIO_LOG.length)
  const tgtAtTap = await page.evaluate(() => document.querySelector('[data-prompt]').getAttribute('data-target'))
  await page.tap('[data-listen]')
  await page.waitForTimeout(400)
  const now2 = await page.evaluate(() => ({
    n: window.__AUDIO_LOG.length,
    names: window.__AUDIO_LOG.map((e) => e.name),
  }))
  ok(now2.n > cnt0 && now2.names[cnt0] === kjAudioName(tgtAtTap), '🔊 重听=口诀音频再发', now2.names.slice(cnt0).join(',') + ` tgtAtTap=${tgtAtTap}`)
  ok(errs.length === 0, '口诀地鼠：零 pageerror', errs[0] || '')
  await page.context().close()
}

/* ================= ⑦ 气球仍=呼读音→形（与口诀地鼠区分） ================= */
{
  console.log('\n— ⑦ 气球认知路径 —')
  const { page, errs } = await mk({ muted: false })
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  await page.tap('[data-stall="balloon"]')
  await page.waitForSelector('#gcount', { timeout: 5000 })
  await page.waitForSelector('#gcount', { state: 'detached', timeout: 9000 })
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  const target = await page.getAttribute('[data-prompt]', 'data-target')
  const names = await page.evaluate(() => window.__AUDIO_LOG.map((e) => e.name))
  const kjUI = await page.evaluate(() => document.querySelector('[data-prompt]')?.getAttribute('data-kj'))
  ok(names[0] === letterAudioName(target), '气球：首播=呼读音（音→形路径不变）', names[0])
  ok(kjUI !== '1' && !names.some((n) => n.startsWith('lessons/kj_')), '气球：无口诀音频（与口诀地鼠区分）', `kj=${kjUI} ${names.join(',')}`)
  ok(errs.length === 0, '气球：零 pageerror', errs[0] || '')
  await page.context().close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
