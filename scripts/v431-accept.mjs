/* v4.2c 验收（Bug#36 共存立法 + Bug#37 两段式试听 + 描述文案清零）。
   断言面三块：
   ①共存：气球/钓鱼成波生成（目标出现时刻同屏干扰 ≥2+同批生成）+盲点策略 vs 真听音策略
     得分对比（总点最新必亏）；地鼠多鼠同探 ≥3；蛋堆必含错半块；音乐会目标+2 干扰同发；
     镜像对决二选一共存核对
   ②两段式：每日挑战/听写专练/识字表/闯关听音题——首点=播选项音+试听高亮（分数/状态
     不推进）→切点别项=切试听→再点同项才判分；route 拦截计数音频请求
   ③文案清零：游戏岛+练习馆 DOM 无 .ddesc/描述行；源码级死 key/占位残留清零断言
   前置：preview 在 4173；真实开局流；mute=false。全程零 pageerror 门槛。 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = '.acceptance-v431'
fs.mkdirSync(OUT, { recursive: true })

let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) } else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) } }

/* init 脚本：播音事件日志 + 游戏实体 spawn 观察者（气球/地鼠/鱼/音符/蛋半） */
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
          probe('tnote', 'tnote', ['tone', 'file']);
          probe('hhalf', 'hhalf', ['key']);
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) { }
}
if (document.documentElement) __setupObserver();
else document.addEventListener('DOMContentLoaded', __setupObserver);`

const browser = await chromium.launch()
async function mk({ muted = false } = {}) {
  const page = await browser.newPage({ ...devices['iPhone 13'], hasTouch: true })
  const errs = []
  const mp3 = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.route('**/*.mp3', (r) => { mp3.push(r.request().url()); return r.continue() })
  await page.addInitScript(`
    ${INIT}
    localStorage.clear()
    localStorage.setItem('pinyin_v2', JSON.stringify({
      weights: {}, stars: { 1: 3, 2: 3, 3: 2 }, cards: {}, hist: [],
      mute: ${muted}, bolt: { acc: 0, d: '', tacc: 0, td: '' }, days: {},
    }))
    localStorage.setItem('pinyin_learn', JSON.stringify({ u: 4, stars: { 1: 3, 2: 3, 3: 3, 4: 2 }, best: { 1: 5, 2: 5, 3: 5, 4: 4 }, step: {} }))
    localStorage.setItem('pinyin_growth_v1', JSON.stringify({ v: 1, stars: 40, badges: [], seenStage: 1, det: 3, tone: 2, boltPerf: false }))
  `)
  return { page, errs, mp3 }
}

/* 真实开局流：hub → 点摊位（开局手势）→ 3-2-1 结束进入 play */
async function enterGame(page, id) {
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  await page.tap(`[data-stall="${id}"]`)
  await page.waitForSelector('#gcount', { timeout: 5000 })
  await page.waitForSelector('#gcount', { state: 'detached', timeout: 9000 })
}
/* 元素真正进入舞台可视区（出生点常在场外被裁剪——相对舞台边界判定） */
const waitVisible = (page, sel, scope, timeout = 8000) =>
  page.waitForFunction((o) => {
    const el = document.querySelector(o.sel)
    if (!el) return false
    const hall = el.closest(o.scope) || el.closest('#gstage')
    if (!hall) return false
    const r = el.getBoundingClientRect()
    const h = hall.getBoundingClientRect()
    return r.top >= h.top + 2 && r.bottom <= h.bottom + 2 && r.left >= h.left && r.right <= h.right
  }, { sel, scope }, { timeout }).then(() => true).catch(() => false)
const tapMoving = async (page, sel) => {
  const p = await page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, sel)
  await page.touchscreen.tap(p.x, p.y)
}
const readHud = (page) => page.evaluate(() => ({
  score: document.querySelector('#gscore').textContent,
  combo: document.querySelector('#gcombo').getAttribute('data-combo'),
}))
const liveBalloons = (page) => page.evaluate(() => document.querySelectorAll('#gstage .balloon:not(.popped):not(.wrong)').length)
const liveFish = (page) => page.evaluate(() => document.querySelectorAll('#gstage .fishwrap:not(.caught):not(.scare)').length)

/* ================= ① 共存立法：气球（结构+盲点对比） ================= */
{
  console.log('\n— 🎈 气球大作战：成波共存 + 盲点策略必亏 —')
  const { page, errs, mp3 } = await mk()
  await enterGame(page, 'balloon')
  await page.waitForFunction(() => window.__DOM_LOG.some((e) => e.kind === 'balloon'), null, { timeout: 8000 })
  ok(await page.waitForFunction(() => document.querySelectorAll('#gstage .balloon:not(.popped):not(.wrong)').length >= 3, null, { timeout: 9000 }).then(() => true).catch(() => false),
    '共存：空中常驻活球 ≥3', `live=${await liveBalloons(page)}`)
  /* 同批生成：存在 t 差 <160ms 的气球 spawn ≥3 条（一波 3-4 只同出） */
  const batch = await page.evaluate(() => {
    const ts = window.__DOM_LOG.filter((e) => e.kind === 'balloon').map((e) => e.t)
    for (let i = 0; i + 2 < ts.length; i++) if (ts[i + 2] - ts[i] < 160) return { n: 3, span: Math.round(ts[i + 2] - ts[i]) }
    return null
  })
  ok(!!batch, '共存：波次生成（≥3 只同批升空）', batch ? `span=${batch.span}ms` : '无同批')
  ok(mp3.length > 0, '音频链路：呼读音 mp3 请求已发生（route 计数）', `mp3req=${mp3.length}`)

  /* 盲点策略 A：连续 4 次"总点最新出现的气球"——波内最后一只必是干扰（目标在波首），
     正确率必须显著低于真听音 */
  const blindOnce = async () => {
    const bid = await page.evaluate(() => {
      const live = new Set(Array.from(document.querySelectorAll('#gstage .balloon:not(.popped):not(.wrong)')).map((e) => e.getAttribute('data-bid')))
      const ls = window.__DOM_LOG.filter((e) => e.kind === 'balloon' && live.has(String(e.bid)))
      return ls.length ? String(ls[ls.length - 1].bid) : null
    })
    if (!bid) return null
    const sel = `#gstage .balloon[data-bid="${bid}"]:not(.popped):not(.wrong)`
    if (!await waitVisible(page, sel, '.sky', 6000)) return null
    const letter = await page.getAttribute(sel, 'data-letter')
    await tapMoving(page, sel)
    await page.waitForTimeout(450)
    return letter
  }
  const target0 = await page.evaluate(() => window.__PJ.GS().target)
  let hitsA = 0, triesA = 0
  for (let i = 0; i < 4; i++) {
    const k = await blindOnce()
    if (k === null) continue
    triesA++
    if (k === target0) hitsA++   /* 目标固定（盲点不换题：点不中目标就不推进），比较字母即可 */
  }
  ok(triesA >= 3 && hitsA === 0, '盲点策略：连点最新 4 次零命中（出现时机推不出答案）', `tries=${triesA} hits=${hitsA}`)

  /* 真听音策略 B：按听到的音（GS.target）点 → 必中 */
  let hitsB = 0
  const s0 = await readHud(page)
  for (let i = 0; i < 3; i++) {
    const sel = await page.waitForFunction(() => {
      const t = window.__PJ.GS().target
      const el = Array.from(document.querySelectorAll('#gstage .balloon:not(.popped):not(.wrong)')).find((e) => e.getAttribute('data-letter') === t)
      return el ? `[data-bid="${el.getAttribute('data-bid')}"]` : null
    }, null, { timeout: 9000 }).then((h) => h.jsonValue()).catch(() => null)
    if (!sel) continue
    if (!await waitVisible(page, `#gstage ${sel}`, '.sky', 8000)) continue
    await tapMoving(page, `#gstage ${sel}`)
    await page.waitForTimeout(500)
    hitsB++
  }
  const s1 = await readHud(page)
  ok(hitsB === 3 && +s1.score > +s0.score, '真听音策略：按听到的音点 3 发 3 中（得分上涨）', `${s0.score}→${s1.score} hits=${hitsB}`)
  ok(await page.waitForFunction(() => document.querySelectorAll('#gstage .balloon:not(.popped):not(.wrong)').length >= 3, null, { timeout: 9000 }).then(() => true).catch(() => false),
    '共存保持：答对换目标后空中仍 ≥3 只（清到只剩目标的退化策略已废除）', `live=${await liveBalloons(page)}`)
  await page.screenshot({ path: `${OUT}/shot-balloon-coexist.png` })
  ok(errs.length === 0, '零 pageerror', errs.join('|') || 'clean')
  await page.close()
}

/* ================= ① 共存立法：口诀地鼠（多鼠同探） ================= */
{
  console.log('\n— 🔨 口诀打地鼠：目标+干扰同探 —')
  const { page, errs } = await mk()
  await enterGame(page, 'mole')
  for (let round = 1; round <= 2; round++) {
    ok(await page.waitForFunction(() => document.querySelectorAll('#gstage .mole.up').length >= 3, null, { timeout: 10000 }).then(() => true).catch(() => false),
      `共存#r${round}：同探活鼠 ≥3（禁单鼠出场轮）`)
    const snap = await page.evaluate(() => {
      const t = document.querySelector('[data-prompt]').getAttribute('data-target')
      const up = Array.from(document.querySelectorAll('#gstage .mole.up')).map((e) => e.getAttribute('data-letter'))
      return { t, up, hasT: up.includes(t), decoys: new Set(up.filter((k) => k !== t)).size }
    })
    ok(snap.hasT && snap.decoys >= 2, `共存#r${round}：目标鼠在场+干扰 ≥2 只`, `target=${snap.t} up=${snap.up.join(',')}`)
    if (round === 1) {
      /* 敲对 → 得分上涨（真实输入；探头 transition 0.22s 完成后再敲——过程中鼠心被洞沿遮挡） */
      await page.waitForTimeout(380)
      await tapMoving(page, `#gstage .mole.up[data-letter="${snap.t}"]`)
      await page.waitForTimeout(400)
      const hud = await readHud(page)
      ok(+hud.score >= 10, `敲对#r${round}：得分 +10`, JSON.stringify(hud))
    }
    await page.waitForFunction(() => document.querySelectorAll('#gstage .mole.up').length === 0, null, { timeout: 9000 }).catch(() => { })
  }
  ok(errs.length === 0, '零 pageerror', errs.join('|') || 'clean')
  await page.close()
}

/* ================= ① 共存立法：钓鱼（多鱼并发） + 蛋（错半块） + 音乐会（同发） + 对决（核对） ================= */
{
  console.log('\n— 🎣 钓鱼 / 🥚 蛋 / 🎵 音乐会 / ⚔️ 对决 —')
  { /* 钓鱼：鱼群并发+目标在群+真实钓对 */
    const { page, errs } = await mk()
    await enterGame(page, 'fish')
    await page.waitForFunction(() => window.__DOM_LOG.some((e) => e.kind === 'fish'), null, { timeout: 8000 })
    ok(await page.waitForFunction(() => document.querySelectorAll('#gstage .fishwrap:not(.caught):not(.scare)').length >= 3, null, { timeout: 9000 }).then(() => true).catch(() => false),
      '共存：水里并发游鱼 ≥3', `live=${await liveFish(page)}`)
    const batch = await page.evaluate(() => {
      const ts = window.__DOM_LOG.filter((e) => e.kind === 'fish').map((e) => e.t)
      for (let i = 0; i + 2 < ts.length; i++) if (ts[i + 2] - ts[i] < 800) return Math.round(ts[i + 2] - ts[i])
      return null
    })
    ok(!!batch, '共存：成群入场（≥3 条 800ms 内鱼贯游入）', batch ? `span=${batch}ms` : '无同批')
    const sel = await page.waitForFunction(() => {
      const t = window.__PJ.GS().target
      let best = null, bestFresh = 0
      for (const el of document.querySelectorAll('#gstage .fishwrap:not(.caught):not(.scare)')) {
        if (el.getAttribute('data-letter') !== t) continue
        const r = el.getBoundingClientRect()
        const pond = el.closest('.pond').getBoundingClientRect()
        const cx = (r.x + r.width / 2 - pond.left) / pond.width
        const fresh = el.style.getPropertyValue('--flip') === '-1' ? cx : 1 - cx   /* 距出场端越远=鱼龄越小 */
        if (fresh > bestFresh) { bestFresh = fresh; best = el }
      }
      return best && bestFresh > 0.3 ? `[data-fid="${best.getAttribute('data-fid')}"]` : null
    }, null, { timeout: 12000 }).then((h) => h.jsonValue()).catch(() => null)
    ok(!!sel, '共存：目标鱼与干扰鱼同群（听音可辨）', sel || '无目标鱼')
    if (sel) {
      await waitVisible(page, `#gstage ${sel}`, '.pond', 8000)
      await tapMoving(page, `#gstage ${sel}`)
      await page.waitForTimeout(500)
      const hud = await readHud(page)
      ok(+hud.score >= 10, '真实钓对：得分 +10', JSON.stringify(hud))
    }
    ok(errs.length === 0, '钓鱼：零 pageerror', errs.join('|') || 'clean')
    await page.close()
  }
  { /* 蛋：半堆必含错半块 */
    const { page, errs } = await mk()
    await enterGame(page, 'egg')
    await page.waitForSelector('#gstage [data-halves][data-ready="1"]', { timeout: 9000 })
    const egg = await page.evaluate(() => {
      const p = document.querySelector('[data-prompt]')
      const hs = Array.from(document.querySelectorAll('#gstage [data-half]'))
      const of = (kind) => hs.filter((h) => h.getAttribute('data-kind') === kind).map((h) => h.getAttribute('data-key'))
      return { ini: p.getAttribute('data-ini'), fin: p.getAttribute('data-fin'), iK: of('ini'), fK: of('fin') }
    })
    ok(egg.iK.length >= 2 && egg.fK.length >= 2, '共存：蛋堆两行各 ≥2 半块（非成对给全）', `ini=${egg.iK.join(',')} fin=${egg.fK.join(',')}`)
    ok(egg.iK.some((k) => k !== egg.ini) && egg.fK.some((k) => k !== egg.fin), '共存：可选半堆必含错半块', `target=${egg.ini}+${egg.fin}`)
    ok(errs.length === 0, '蛋：零 pageerror', errs.join('|') || 'clean')
    await page.close()
  }
  { /* 音乐会：目标符+干扰符同发 */
    const { page, errs } = await mk()
    await enterGame(page, 'tone')
    /* 等待条件=目标符在场且同屏 ≥3 活符（避免快照抓到"目标刚落底、清场前一瞬"的竞态帧） */
    ok(await page.waitForFunction(() => {
      const f = document.querySelector('[data-prompt]')?.getAttribute('data-target')
      if (!f) return false
      if (!document.querySelector(`#gstage .tnote:not(.caught):not(.wrong)[data-file="${f}"]`)) return false
      return document.querySelectorAll('#gstage .tnote:not(.caught):not(.wrong)').length >= 3
    }, null, { timeout: 10000 }).then(() => true).catch(() => false),
      '共存：目标符在场+同落音符 ≥3（1 目标+≥2 干扰）')
    const snap = await page.evaluate(() => {
      const f = document.querySelector('[data-prompt]').getAttribute('data-target')
      const notes = Array.from(document.querySelectorAll('#gstage .tnote:not(.caught):not(.wrong)'))
      const tt = notes.find((n) => n.getAttribute('data-file') === f)
      const toneOf = tt ? tt.getAttribute('data-tone') : null
      const decoys = notes.filter((n) => n.getAttribute('data-file') !== f)
      return { f, toneOf, decoyN: decoys.length, decoyTones: decoys.map((n) => n.getAttribute('data-tone')) }
    })
    ok(!!snap.toneOf && snap.decoyN >= 2, '共存：目标符+干扰符 ≥2 快照复核', `target=${snap.f}(调${snap.toneOf}) decoys=${snap.decoyTones.join(',')}`)
    ok(snap.decoyTones.every((t) => t !== snap.toneOf), '立法核对：干扰符=同音节其他声调（异调）', `decoyTones=${snap.decoyTones.join(',')}`)
    ok(errs.length === 0, '音乐会：零 pageerror', errs.join('|') || 'clean')
    await page.close()
  }
  { /* 对决：强制二选一共存（核对不动） */
    const { page, errs } = await mk()
    await enterGame(page, 'duel')
    const duel = await page.evaluate(() => ({
      opts: document.querySelectorAll('#gstage [data-opts] .duelopt').length,
      t: document.querySelector('#gstage [data-q]')?.getAttribute('data-target') || '',
    }))
    ok(duel.opts === 2 && !!duel.t, '共存核对：镜像对决强制二选一同屏', JSON.stringify(duel))
    ok(errs.length === 0, '对决：零 pageerror', errs.join('|') || 'clean')
    await page.close()
  }
}

/* ================= ② 两段式试听：每日挑战 + 听写专练 + 识字表 + 闯关听音 ================= */
{
  console.log('\n— 两段式试听（Bug#37）：四题目面状态机 —')
  { /* 每日挑战（blisten/bkj 题） */
    const { page, errs } = await mk()
    let qt = 'zi', tries = 0
    while (qt === 'zi' && tries++ < 6) {
      await page.goto(`${BASE}/?open=daily`, { waitUntil: 'networkidle' })
      await page.waitForSelector('#v-daily [data-qtype]', { timeout: 8000 })
      qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype')
      if (qt === 'zi') await page.evaluate(() => window.__PJ.startDaily())
    }
    ok(qt !== 'zi', '每日挑战：听音题就位', `qtype=${qt}`)
    const audio0 = await page.evaluate(() => window.__AUDIO_LOG.length)
    const ans = await page.evaluate(() => window.__PJ.DC().qs[window.__PJ.DC().i].ans)
    const wrongIdx = (ans + 1) % 2
    const letterOf = (i) => page.evaluate((ix) => window.__PJ.DC().qs[window.__PJ.DC().i].opts[ix], i)
    /* 用序号选择：选项 DOM 顺序=opts 顺序 */
    const tapOpt = async (i) => page.tap(`#v-daily [data-opts] .opt:nth-of-type(${i + 1})`)
    /* 首点错误项=试听：播音+高亮+不判分 */
    const wl = await letterOf(wrongIdx)
    await tapOpt(wrongIdx)
    await page.waitForTimeout(250)
    const st1 = await page.evaluate((wi) => ({
      log: window.__AUDIO_LOG.length, score: window.__PJ.DC().score, reveal: window.__PJ.DC().reveal,
      armed: document.querySelector('#v-daily [data-opts] .opt:nth-of-type(' + (wi + 1) + ')').classList.contains('armed'),
    }), wrongIdx)
    ok(st1.log > audio0, '每日挑战首点：发起该选项音频（__AUDIO_LOG 增量）', `wl=${wl} +${st1.log - audio0}`)
    ok(st1.score === 0 && st1.reveal === null && st1.armed, '每日挑战首点：不计分不推进+试听高亮态', JSON.stringify({ score: st1.score, reveal: !!st1.reveal, armed: st1.armed }))
    /* 切点正确项=切试听：仍不判分 */
    const audio1 = await page.evaluate(() => window.__AUDIO_LOG.length)
    await tapOpt(ans)
    await page.waitForTimeout(250)
    const st2 = await page.evaluate(() => ({ log: window.__AUDIO_LOG.length, score: window.__PJ.DC().score, reveal: window.__PJ.DC().reveal }))
    ok(st2.log > audio1 && st2.score === 0 && st2.reveal === null, '每日挑战切点别项：切试听（播新项音，仍不计分）', `+${st2.log - audio1}`)
    /* 再点同项=作答 */
    await tapOpt(ans)
    await page.waitForTimeout(400)
    const st3 = await page.evaluate(() => ({ score: window.__PJ.DC().score, reveal: window.__PJ.DC().reveal }))
    ok(st3.reveal !== null && st3.score === 10, '每日挑战二点同项：才判分（reveal+得分 10）', JSON.stringify(st3))
    ok(errs.length === 0, '每日挑战：零 pageerror', errs.join('|') || 'clean')
    await page.close()
  }
  { /* 听写专练 */
    const { page, errs } = await mk()
    await page.goto(`${BASE}/?open=ldrill`, { waitUntil: 'networkidle' })
    await page.waitForSelector('#v-ldrill [data-q][data-target]', { timeout: 8000 })
    const target = await page.getAttribute('#v-ldrill [data-q]', 'data-target')
    const audio0 = await page.evaluate(() => window.__AUDIO_LOG.length)
    const optIdxOf = async (k) => page.evaluate((kk) => Array.from(document.querySelectorAll('#v-ldrill [data-opts] .opt')).findIndex((e) => e.getAttribute('data-opt') === kk), k)
    const tapK = async (k) => {
      const i = await optIdxOf(k)
      await page.tap(`#v-ldrill [data-opts] .opt:nth-of-type(${i + 1})`)
    }
    const wrong = (await page.evaluate(() => Array.from(document.querySelectorAll('#v-ldrill [data-opts] .opt')).map((e) => e.getAttribute('data-opt')))).find((k) => k !== target)
    await tapK(wrong)
    await page.waitForTimeout(250)
    const st1 = await page.evaluate(() => ({
      log: window.__AUDIO_LOG.length, n: document.querySelector('#v-ldrill [data-answered]').getAttribute('data-answered'),
      armed: Array.from(document.querySelectorAll('#v-ldrill [data-opts] .opt')).some((e) => e.getAttribute('data-opt') !== document.querySelector('#v-ldrill [data-q]').getAttribute('data-target') && e.classList.contains('armed')),
    }))
    ok(st1.log > audio0, '听写专练首点：播错误项读音', `wrong=${wrong} +${st1.log - audio0}`)
    ok(st1.n === '0' && st1.armed, '听写专练首点：不推进+试听高亮', JSON.stringify(st1))
    const audio1 = await page.evaluate(() => window.__AUDIO_LOG.length)
    await tapK(target)
    await page.waitForTimeout(250)
    const st2 = await page.evaluate(() => ({ log: window.__AUDIO_LOG.length, n: document.querySelector('#v-ldrill [data-answered]').getAttribute('data-answered') }))
    ok(st2.log > audio1 && st2.n === '0', '听写专练切点：切试听（播目标项音，不判分）', `+${st2.log - audio1}`)
    await tapK(target)
    await page.waitForTimeout(700)
    const st3 = await page.evaluate(() => document.querySelector('#v-ldrill [data-answered]').getAttribute('data-answered'))
    ok(st3 === '1', '听写专练二点同项：才判分（已答 1）', `answered=${st3}`)
    ok(errs.length === 0, '听写专练：零 pageerror', errs.join('|') || 'clean')
    await page.close()
  }
  { /* 识字表闯关 */
    const { page, errs, mp3 } = await mk()
    await page.goto(`${BASE}/?open=zihall`, { waitUntil: 'networkidle' })
    await page.waitForSelector('#v-zihall .zcell[data-locked="0"]', { timeout: 8000 })
    /* hyp 带调音节部分覆盖（137/180 缺）——轮换选字直到首点有音（立法：缺音首点退化=仅高亮
       也合法，但不演示退化路径，找有音选项验证播音链路） */
    let audio0 = 0, ans = 0, wrongIdx = 0, got = false, tries = 0
    while (!got && tries++ < 5) {
      const cells = await page.$$eval('#v-zihall .zcell[data-locked="0"]', (els) => els.length)
      await page.tap(`#v-zihall .zcell[data-locked="0"]:nth-of-type(${(tries % cells) + 1})`).catch(async () => page.tap('#v-zihall .zcell[data-locked="0"]'))
      await page.waitForSelector('#v-zihall [data-q][data-reveal="0"]', { timeout: 6000 })
      ans = await page.evaluate(() => window.__PJ.ziQ().ans)
      wrongIdx = (ans + 1) % 4
      audio0 = await page.evaluate(() => window.__AUDIO_LOG.length)
      await page.tap(`#v-zihall [data-opts] .opt:nth-of-type(${wrongIdx + 1})`)
      await page.waitForTimeout(300)
      got = (await page.evaluate(() => window.__AUDIO_LOG.length)) > audio0
      if (!got) {
        await page.tap('#v-zihall .cbtn')   /* 退回网格换一个字 */
        await page.waitForSelector('#v-zihall .zcell[data-locked="0"]', { timeout: 6000 })
      }
    }
    const st1 = await page.evaluate((wi) => ({
      log: window.__AUDIO_LOG.length,
      reveal: document.querySelector('#v-zihall [data-q]').getAttribute('data-reveal'),
      n: document.querySelector('#v-zihall [data-answered]').getAttribute('data-answered'),
      armed: document.querySelector(`#v-zihall [data-opts] .opt:nth-of-type(${wi + 1})`).classList.contains('armed'),
    }), wrongIdx)
    ok(st1.armed && st1.reveal === '0' && st1.n === '0', '识字表首点：试听高亮+不计分不推进', JSON.stringify({ n: st1.n, reveal: st1.reveal, armed: st1.armed }))
    ok(got && st1.log > audio0, '识字表首点：播该选项拼音（hyp 音节，轮换选字验证）', `+${st1.log - audio0}（mp3req +${mp3.length}）`)
    await page.tap(`#v-zihall [data-opts] .opt:nth-of-type(${ans + 1})`)
    await page.waitForTimeout(300)
    const st2 = await page.evaluate(() => document.querySelector('#v-zihall [data-q]').getAttribute('data-reveal'))
    ok(st2 === '0', '识字表切点别项：切试听（仍不判分）')
    await page.tap(`#v-zihall [data-opts] .opt:nth-of-type(${ans + 1})`)
    await page.waitForTimeout(400)
    const st3 = await page.evaluate(() => ({
      reveal: document.querySelector('#v-zihall [data-q]').getAttribute('data-reveal'),
      n: document.querySelector('#v-zihall [data-answered]').getAttribute('data-answered'),
    }))
    ok(st3.reveal === '1' && st3.n === '1', '识字表二点同项：才判分', JSON.stringify(st3))
    ok(errs.length === 0, '识字表：零 pageerror', errs.join('|') || 'clean')
    await page.close()
  }
  { /* 闯关听音题（ListenQ） */
    const { page, errs } = await mk()
    await page.goto(`${BASE}/?open=quiz`, { waitUntil: 'networkidle' })
    await page.waitForSelector('#optbox .opt', { timeout: 8000 })
    const q = await page.evaluate(() => { const Q = window.__PJ.Q(); return { type: Q.q.type, ans: Q.q.ans } })
    ok(q.type === 'listen', '闯关：听音选字题就位', `type=${q.type}`)
    const audio0 = await page.evaluate(() => window.__AUDIO_LOG.length)
    await page.tap(`#optbox .opt:nth-of-type(${q.ans + 1})`)
    await page.waitForTimeout(250)
    const st1 = await page.evaluate(() => ({ log: window.__AUDIO_LOG.length, reveal: window.__PJ.Q().reveal, score: window.__PJ.Q().score }))
    ok(st1.log > audio0 && st1.reveal === null && st1.score === 0, '闯关听音首点：播选项读音+不判分', `+${st1.log - audio0} reveal=${st1.reveal}`)
    await page.tap(`#optbox .opt:nth-of-type(${q.ans + 1})`)
    await page.waitForTimeout(400)
    const st2 = await page.evaluate(() => ({ reveal: window.__PJ.Q().reveal, score: window.__PJ.Q().score }))
    ok(st2.reveal !== null && st2.score === 1, '闯关听音二点：才作答', JSON.stringify(st2))
    ok(errs.length === 0, '闯关：零 pageerror', errs.join('|') || 'clean')
    await page.close()
  }
}

/* ================= ③ 描述文案清零 ================= */
{
  console.log('\n— 文案清零（禁设计meta立法） —')
  const { page, errs } = await mk()
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#stalls', { timeout: 8000 })
  await page.waitForTimeout(300)
  const isl = await page.evaluate(() => ({
    ddesc: document.querySelectorAll('#v-island .ddesc').length,
    stalls: Array.from(document.querySelectorAll('#stalls [data-stall]')).map((e) => ({
      id: e.getAttribute('data-stall'),
      name: e.querySelector('.sname')?.textContent?.trim() || '',
      best: e.querySelector('.sbest')?.textContent?.trim() || '',
      extra: Array.from(e.querySelectorAll('.sinfo > *:not(.sname):not(.sbest)')).length,
    })),
  }))
  ok(isl.ddesc === 0, '游戏岛：DOM 无 .ddesc/描述行')
  ok(isl.stalls.length === 6 && isl.stalls.every((s) => s.name && s.best && s.extra === 0), '游戏岛：摊位卡只留 游戏名+最佳成绩+插画', isl.stalls.map((s) => `${s.id}:${s.name}/${s.best}`).join(' '))
  await page.screenshot({ path: `${OUT}/shot-island-clean.png` })
  await page.tap('[data-hallbtn="drill"]')
  await page.waitForSelector('#drillgrid', { timeout: 5000 })
  const hall = await page.evaluate(() => ({
    ddesc: document.querySelectorAll('#v-island .ddesc').length,
    cards: Array.from(document.querySelectorAll('#drillgrid [data-drill]')).map((e) => ({
      id: e.getAttribute('data-drill'),
      name: e.querySelector('.dname')?.textContent?.trim() || '',
      rows: Array.from(e.querySelectorAll(':scope > div')).map((d) => d.className),
    })),
  }))
  ok(hall.ddesc === 0, '练习馆：DOM 无 .ddesc/描述行')
  ok(hall.cards.length === 6 && hall.cards.every((c) => c.name && !c.rows.some((r) => r.includes('ddesc'))), '练习馆：入口卡只留 名称+角标+图标', hall.cards.map((c) => c.id).join(','))
  await page.screenshot({ path: `${OUT}/shot-hall-clean.png` })
  /* 自由练习页（原 desc 渲染点） */
  await page.goto(`${BASE}/?open=free`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-practice', { timeout: 8000 })
  const free = await page.evaluate(() => ({
    btns: Array.from(document.querySelectorAll('#pgroups2 .btn')).map((b) => Array.from(b.children).filter((c) => c.tagName === 'SPAN').length),
  }))
  ok(free.btns.length === 4 && free.btns.every((n) => n === 1), '自由练习：四卡描述行已清（每卡仅名称一行）', JSON.stringify(free.btns))
  ok(errs.length === 0, '文案清零页面：零 pageerror', errs.join('|') || 'clean')
  await page.close()

  /* 源码级断言：死 key / 占位残留 / 死 mp3 */
  const strings = fs.readFileSync('src/text/strings.ts', 'utf8')
  const deadKeys = ['adventureDesc', 'boltDesc', 'quickPinDesc', 'detectiveDesc', 'pairsDesc', 'freeDesc', 'drillListenDesc', 'drillZiDesc', 'flashDesc', 'myCardsDesc', 'dailyDesc', 'hallBlendDesc', 'hallToneDesc', 'comingSoon', 'stallRace', 'stallMemory']
  ok(deadKeys.every((k) => !strings.includes(k)), 'strings.ts：16 个死 key 已删', deadKeys.filter((k) => strings.includes(k)).join(','))
  const svelteAll = (() => {
    let out = ''
    const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = d + '/' + f; if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.svelte')) out += fs.readFileSync(p, 'utf8') } }
    walk('src/components')
    return out
  })()
  ok(!svelteAll.split('upddesc').join('').includes('ddesc'), '组件层：.ddesc 类名零残留（upddesc=更新提示功能文案，立法范围外）')
  ok(!strings.includes('敬请期待') && !svelteAll.includes('敬请期待'), '占位文案"敬请期待"零残留')
  const deadMp3 = ['bolt-desc', 'pairs-desc', 'adventure-desc', 'quick-pin-desc', 'detective-desc', 'free-desc', 'flash-desc', 'phrase-prac-sm-desc', 'phrase-prac-ym-desc', 'phrase-prac-zt-desc', 'phrase-prac-all-desc']
  ok(deadMp3.every((f) => !fs.existsSync(`public/audio/ui/${f}.mp3`)), '死配音 mp3 已删（11 个）')
  const ph = JSON.parse(fs.readFileSync('src/data/phrases.json', 'utf8'))
  ok((ph.practice || []).every((p) => !('desc' in p)), 'phrases.json：practice[].desc 字段已删')
}

await browser.close()
console.log(`\n========== v431-accept: ${pass} pass / ${fail} fail ==========`)
process.exit(fail ? 2 : 0)
