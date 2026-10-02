/* v4.2c 验收（Bug#36 共存立法 + Bug#37 两段式试听 + 描述文案清零）。
   断言面三块：
   ①共存：气球/钓鱼成波生成（目标出现时刻同屏干扰 ≥2+同批生成）+盲点策略 vs 真听音策略
     得分对比（总点最新必亏）；地鼠多鼠同探 ≥3；蛋堆必含错半块；音乐会目标+2 干扰同发；
     镜像对决二选一共存核对
   ②两段式：每日挑战/听写专练/识字表/闯关听音题/学习岛声调小练（ToneDrill）——首点=播选项音+
     试听高亮（分数/状态不推进）→切点别项=切试听→再点同项才判分；route 拦截计数音频请求
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

/* init 脚本：播音事件日志 + 游戏实体 spawn 观察者（气球/地鼠/鱼/音符/蛋半）+ 目标时间线采样 */
const INIT = `window.__AUDIO_LOG = [];
window.__DOM_LOG = [];
window.__TLOG = [];
setInterval(function () {
  try {
    var p = document.querySelector('[data-prompt]');
    var t = p && p.getAttribute('data-target');
    if (t) window.__TLOG.push({ t: performance.now(), target: t });
  } catch (e) { }
}, 40);
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
const LEARN0 = { u: 4, stars: { 1: 3, 2: 3, 3: 3, 4: 2 }, best: { 1: 5, 2: 5, 3: 5, 4: 4 }, step: {} }
async function mk({ muted = false, learn = null } = {}) {
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
    localStorage.setItem('pinyin_learn', JSON.stringify(${JSON.stringify(learn || LEARN0)}))
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
  /* 点击位占位核对：球在飘，早前波残留球会漂到目标坐标上——点前确认中心点顶元素=本球，
     被覆盖则等球群漂开重试（否则 tap 落在别家球上，断言被几何竞态污染） */
  const tapClear = async (page, sel, tries = 6) => {
    for (let i = 0; i < tries; i++) {
      const c = await page.evaluate((s) => {
        const el = document.querySelector(s)
        if (!el) return null
        const r = el.getBoundingClientRect()
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2
        const top = document.elementFromPoint(cx, cy)
        const tb = top && top.closest ? top.closest('.balloon') : null
        return { x: cx, y: cy, clear: !!tb && tb.getAttribute('data-bid') === el.getAttribute('data-bid') }
      }, sel)
      if (!c) return false
      if (c.clear) { await page.touchscreen.tap(c.x, c.y); return true }
      await page.waitForTimeout(350)
    }
    return false
  }
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

  /* 盲点策略（数据级，几何/时序免疫）：连续观察 ≥4 波，"波内最新升空球=当时目标"必须 0 次。
     目标恒为波首入队（spawnWave 先 push target），所以 spawn 顺序不携带答案信号——
     总点最新的盲点策略不可能超过随机猜。（tap 版会吃到"残留球漂移覆盖点击坐标"的几何竞态） */
  const blind = await page.waitForFunction(() => {
    const ls = window.__DOM_LOG.filter((e) => e.kind === 'balloon')
    const waves = []
    for (const e of ls) {
      const w = waves[waves.length - 1]
      if (w && e.t - w.t0 < 160) w.items.push(e)   /* 同帧成波（spawn 同步 forEach） */
      else waves.push({ t0: e.t, items: [e] })
    }
    const full = waves.filter((w) => w.items.length >= 3)
    if (full.length < 4) return null
    const tgtAt = (t) => { let v = null; for (const s of window.__TLOG) { if (s.t <= t) v = s.target; else break } return v }
    const letters = new Map(ls.map((e) => [String(e.bid), e.letter]))
    let bad = []
    for (const w of full) {
      const tg = tgtAt(w.t0)
      const newest = w.items[w.items.length - 1]
      if (tg && letters.get(String(newest.bid)) === tg) bad.push(tg)
    }
    return { waves: full.length, bad }
  }, null, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => null)
  ok(!!blind && blind.waves >= 4 && blind.bad.length === 0, '盲点策略：≥4 波观察——最新升空球从来不是当时目标（出现时机零信号）', blind ? `waves=${blind.waves} bad=${blind.bad.join(',')}` : '波数不足')
  ok(errs.length === 0, '盲点局：零 pageerror', errs.join('|') || 'clean')
  await page.close()

  /* 真听音策略 B：按听到的音（GS.target）点 → 必中。
     独立棋局——盲点局的点剩/残留球会积压天空（balloons.length<9 出波闸），拖饿听音局的出题 */
  const { page: pageB, errs: errsB } = await mk()
  await enterGame(pageB, 'balloon')
  let hitsB = 0
  const s0 = await readHud(pageB)
  for (let i = 0; i < 8 && hitsB < 3; i++) {
    const sel = await pageB.waitForFunction(() => {
      const t = window.__PJ.GS().target
      const el = Array.from(document.querySelectorAll('#gstage .balloon:not(.popped):not(.wrong)')).find((e) => e.getAttribute('data-letter') === t)
      return el ? `[data-bid="${el.getAttribute('data-bid')}"]` : null
    }, null, { timeout: 9000 }).then((h) => h.jsonValue()).catch(() => null)
    if (!sel) continue
    if (!await waitVisible(pageB, `#gstage ${sel}`, '.sky', 8000)) continue
    if (await tapClear(pageB, `#gstage ${sel}`)) { await pageB.waitForTimeout(500); hitsB++ }
  }
  const s1 = await readHud(pageB)
  ok(hitsB === 3 && +s1.score > +s0.score, '真听音策略：按听到的音点 3 发 3 中（得分上涨）', `${s0.score}→${s1.score} hits=${hitsB}`)
  ok(await pageB.waitForFunction(() => document.querySelectorAll('#gstage .balloon:not(.popped):not(.wrong)').length >= 3, null, { timeout: 9000 }).then(() => true).catch(() => false),
    '共存保持：答对换目标后空中仍 ≥3 只（清到只剩目标的退化策略已废除）', `live=${await liveBalloons(pageB)}`)
  await pageB.screenshot({ path: `${OUT}/shot-balloon-coexist.png` })
  ok(errsB.length === 0, '真听音局：零 pageerror', errsB.join('|') || 'clean')
  await pageB.close()
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
      return best && bestFresh > 0.18 ? `[data-fid="${best.getAttribute('data-fid')}"]` : null
    }, null, { timeout: 16000 }).then((h) => h.jsonValue()).catch(() => null)
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
  { /* 音乐会：目标符+干扰符同发（原子快照：条件满足的同一帧内取样，防"目标刚落底"竞态）。
       轮询条件=完整断言条件（1 目标+≥2 活干扰同落）——开局波首 1+2 同发必出现该帧，
       trickle 期（60% 概率补干扰）decoy=1 是常态帧，不能作取样点 */
    const { page, errs } = await mk()
    await enterGame(page, 'tone')
    const snap = await page.waitForFunction(() => {
      const f = document.querySelector('[data-prompt]')?.getAttribute('data-target')
      if (!f) return null
      const notes = Array.from(document.querySelectorAll('#gstage .tnote:not(.caught):not(.wrong)'))
      const tt = notes.find((n) => n.getAttribute('data-file') === f)
      if (!tt) return null
      const decoys = notes.filter((n) => n.getAttribute('data-file') !== f)
      if (decoys.length < 2) return null
      return { f, toneOf: tt.getAttribute('data-tone'), decoyN: decoys.length, decoyTones: decoys.map((n) => n.getAttribute('data-tone')) }
    }, null, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => null)
    ok(!!snap, '共存：目标符在场+同落音符 ≥3（1 目标+≥2 干扰）')
    ok(!!snap && !!snap.toneOf && snap.decoyN >= 2, '共存：目标符+干扰符 ≥2 快照复核', snap ? `target=${snap.f}(调${snap.toneOf}) decoys=${snap.decoyTones.join(',')}` : 'null')
    ok(!!snap && snap.decoyTones.every((t) => t !== snap.toneOf), '立法核对：干扰符=同音节其他声调（异调）', snap ? `decoyTones=${snap.decoyTones.join(',')}` : 'null')
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
  { /* 每日挑战（blisten/bkj 题）。v4.5 适用矩阵（Bug#38）：字母选项题一点即答——
       本块断言反转为"首点即判分"；两段式保留面（zi 题）的回归由 regression-bug37-two-phase.mjs 承担 */
    const { page, errs } = await mk()
    await page.goto(`${BASE}/?open=daily`, { waitUntil: 'networkidle' })
    await page.waitForSelector('#v-daily [data-qtype]', { timeout: 8000 })
    let qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype')
    let tries = 0
    while (qt === 'zi' && tries++ < 11) {
      /* 故意答错推进到听音题（错题不加分=首点判分断言以 score===10 为基线），反馈后照常换题 */
      const w = await page.evaluate(() => {
        const D = window.__PJ.DC()
        return (D.qs[D.i].ans + 1) % D.qs[D.i].opts.length
      })
      await page.tap(`#v-daily [data-opts] .opt:nth-of-type(${w + 1})`)
      await page.waitForTimeout(1900)   /* 错反馈 + 换题 */
      qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype')
    }
    ok(qt !== 'zi', '每日挑战：听音题就位', `qtype=${qt}`)
    const ans = await page.evaluate(() => window.__PJ.DC().qs[window.__PJ.DC().i].ans)
    const tapOpt = async (i) => page.tap(`#v-daily [data-opts] .opt:nth-of-type(${i + 1})`)
    /* 一点即答：首点=判分（矩阵），且零选项试听音 */
    const audio0 = await page.evaluate(() => window.__AUDIO_LOG.length)
    await tapOpt(ans)
    await page.waitForTimeout(300)
    const st3 = await page.evaluate(() => ({ score: window.__PJ.DC().score, reveal: window.__PJ.DC().reveal }))
    ok(st3.reveal !== null && st3.score === 10, '每日挑战一点即答：首点即判分（v4.5 矩阵，reveal+得分 10）', JSON.stringify(st3))
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
    /* v4.5 适用矩阵（Bug#38）：听写选项=已学单字母 → 一点即答（错答也计，答对计数推进） */
    const wrong = (await page.evaluate(() => Array.from(document.querySelectorAll('#v-ldrill [data-opts] .opt')).map((e) => e.getAttribute('data-opt')))).find((k) => k !== target)
    await tapK(wrong)
    await page.waitForTimeout(250)
    const st1 = await page.evaluate(() => ({
      log: window.__AUDIO_LOG.length, n: document.querySelector('#v-ldrill [data-answered]').getAttribute('data-answered'),
    }))
    ok(st1.log === audio0, '听写专练一点即答：错答零选项试听音（矩阵）', `+${st1.log - audio0}`)
    await tapK(target)
    await page.waitForTimeout(900)
    const st3 = await page.evaluate(() => document.querySelector('#v-ldrill [data-answered]').getAttribute('data-answered'))
    ok(st3 === '1', '听写专练一点即答：点对即判分（已答 1）', `answered=${st3}`)
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
    /* v4.5 适用矩阵（Bug#38）：闯关听音选项=已学单字母 → 一点即答 */
    const audio0 = await page.evaluate(() => window.__AUDIO_LOG.length)
    await page.tap(`#optbox .opt:nth-of-type(${q.ans + 1})`)
    await page.waitForTimeout(300)
    const st2 = await page.evaluate(() => ({ reveal: window.__PJ.Q().reveal, score: window.__PJ.Q().score, log: window.__AUDIO_LOG.length }))
    ok(st2.reveal !== null && st2.score === 1, '闯关听音一点即答：首点即作答（v4.5 矩阵）', JSON.stringify(st2))
    ok(st2.log === audio0, '闯关听音一点即答：零选项试听音', `+${st2.log - audio0}`)
    ok(errs.length === 0, '闯关：零 pageerror', errs.join('|') || 'clean')
    await page.close()
  }
  { /* 学习岛声调小练（ToneDrill，Bug#37 补全：声调=可发声内容，最需要先听后选）。
       课 1 未过 + step{1:2} 预置 → 直落字母 a 的声调页（第 2 页）；「听音练」进辨调小练。
       选项=四声符号，音频=当前音节对应调（a1..a4，hyp），__AUDIO_LOG 逐条可核 */
    const { page, errs } = await mk({ learn: { u: 4, stars: { 2: 3, 3: 3, 4: 2 }, best: { 2: 5, 3: 5, 4: 4 }, step: { 1: 2 } } })
    await page.goto(`${BASE}/?open=lesson&learn=1`, { waitUntil: 'networkidle' })
    await page.waitForSelector('#v-lesson .hstage > .hspage', { timeout: 8000 })
    const SC = '#v-lesson .hstage > .hspage:nth-child(2)'
    await page.tap(`${SC} .tonedrill .trow .btn.green`)
    await page.waitForSelector(`${SC} .tonedrill .topts .topt`, { timeout: 6000 })
    const optN = await page.$$eval(`${SC} .tonedrill .topts .topt`, (e) => e.length)
    ok(optN === 4, '声调小练：四个声调选项就位', `n=${optN}`)
    const st = () => page.evaluate((sel) => {
      const opts = Array.from(document.querySelectorAll(sel + ' .tonedrill .topts .topt'))
      const L = window.__AUDIO_LOG
      return {
        log: L.length, lastName: L.length ? L[L.length - 1].name : '',
        armed: opts.findIndex((e) => e.classList.contains('armed')),
        reveal: opts.some((e) => e.classList.contains('right') || e.classList.contains('wrong')),
        dotsOk: document.querySelectorAll(sel + ' .qprog .dot.ok').length,
      }
    }, SC)
    const audio0 = (await st()).log
    await page.tap(`${SC} .tonedrill .topts .topt:nth-of-type(1)`)
    await page.waitForTimeout(300)
    const s1 = await st()
    ok(s1.log > audio0 && s1.lastName === 'a1', '声调首点：播该调读音（hyp a1，__AUDIO_LOG 增量）', `+${s1.log - audio0} name=${s1.lastName}`)
    ok(s1.armed === 0 && !s1.reveal && s1.dotsOk === 0, '声调首点：试听高亮+零判分零推进', `armed=${s1.armed} reveal=${s1.reveal} dotsOk=${s1.dotsOk}`)
    await page.tap(`${SC} .tonedrill .topts .topt:nth-of-type(2)`)
    await page.waitForTimeout(300)
    const s2 = await st()
    ok(s2.log > s1.log && s2.lastName === 'a2', '声调切点别项：切试听（播新调 a2）', `+${s2.log - s1.log} name=${s2.lastName}`)
    ok(s2.armed === 1 && !s2.reveal, '声调切点：armed 随切换+仍零判分', `armed=${s2.armed} reveal=${s2.reveal}`)
    /* armed 态取证（试听高亮可见、未判分） */
    try {
      fs.mkdirSync('/tmp/pinyin-v431/accept', { recursive: true })
      await page.screenshot({ path: '/tmp/pinyin-v431/accept/shot7-声调小练试听.png' })
      console.log('  📸 shot7-声调小练试听.png → /tmp/pinyin-v431/accept/')
    } catch (e) { console.log('  (screenshot skip:', e.message + ')') }
    await page.tap(`${SC} .tonedrill .topts .topt:nth-of-type(2)`)
    await page.waitForTimeout(450)
    const s3 = await st()
    ok(s3.reveal && s3.armed === -1, '声调二点同项：才判分（reveal 出现+试听态收回）', `reveal=${s3.reveal} armed=${s3.armed}`)
    const s4 = await page.waitForFunction((sel) => {
      const opts = Array.from(document.querySelectorAll(sel + ' .tonedrill .topts .topt'))
      return opts.length === 4 && opts.every((e) => !e.classList.contains('right') && !e.classList.contains('wrong') && !e.classList.contains('armed'))
    }, SC, { timeout: 5000 }).then(() => true).catch(() => false)
    ok(s4, '声调判分后：反馈期结束推进下一题（干净态，流程未被两段式卡死）')
    ok(errs.length === 0, '声调小练：零 pageerror', errs.join('|') || 'clean')
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
