/* v4.3 验收（Bug#35 下半终版）：🥚拼音蛋合并 + 🎵声调音乐会 + 练习馆拼读/声调两专练 + hub 6 摊位终态。
   断言面：蛋=真实拼对 3 题+拼错清连击+拼读音频请求+截图；音乐会=真实接住 3 音+接错清连击
   +目标音先于音符时序+截图；两专练=各真实答 5 题+条目账本写入+加权复现（itemW/wpick 种子复算）
   +结算断言；hub=6 摊位+零占位残留。前置：preview 在 4173；真实开局流；mute=false。 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = '.acceptance-v43'
fs.mkdirSync(OUT, { recursive: true })

let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) } else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) } }

/* init 脚本：播音事件日志 + 蛋半/音符元素出现观察者（声音先行 300ms 闸门时序断言用） */
const INIT = `window.__AUDIO_LOG = [];
window.__DOM_LOG = [];
function __setupObserver() {
  try {
    const mo = new MutationObserver((muts) => {
      const now = performance.now();
      for (const m of muts) {
        if (m.type === 'childList') {
          for (const n of m.addedNodes) {
            if (n.nodeType !== 1) continue;
            /* Svelte 整块插入时 addedNodes 只有顶层节点——蛋半/音符要用 querySelector 下探一层 */
            const half = n.classList && n.classList.contains('hhalf') ? n : n.querySelector ? n.querySelector('.hhalf') : null;
            if (half) window.__DOM_LOG.push({ kind: 'hhalf', key: half.getAttribute('data-key'), t: now });
            const note = n.classList && n.classList.contains('tnote') ? n : n.querySelector ? n.querySelector('.tnote') : null;
            if (note) window.__DOM_LOG.push({ kind: 'tnote', file: note.getAttribute('data-file'), t: now });
          }
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
  `)
  return { page, errs }
}

/* 真实开局流：hub → 点摊位（开局手势）→ 3-2-1 结束进入 play */
async function enterGame(page, id) {
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  await page.tap(`[data-stall="${id}"]`)
  await page.waitForSelector('#gcount', { timeout: 5000 })
  await page.waitForSelector('#gcount', { state: 'detached', timeout: 9000 })
}
/* 等元素真正进入舞台可视区（音符出生点在顶缘外被 .hall 裁剪——rect 在视口内≠孩子看得见，
   必须相对 .hall 边界判定；坐标 tap 也只有可见时才落得中） */
const waitVisible = (page, sel, timeout = 8000) =>
  page.waitForFunction((s) => {
    const el = document.querySelector(s)
    if (!el) return false
    const hall = el.closest('.hall') || el.closest('#gstage')
    if (!hall) return false
    const r = el.getBoundingClientRect()
    const h = hall.getBoundingClientRect()
    return r.top >= h.top + 4 && r.bottom <= h.bottom - 4 && r.left >= h.left && r.right <= h.right
  }, sel, { timeout }).then(() => true).catch(() => false)

const waitDom = (page, kind, min = 1, timeout = 6000) =>
  page.waitForFunction((o) => window.__DOM_LOG.filter((e) => e.kind === o.kind).length >= o.min, { kind, min }, { timeout }).then(() => true).catch(() => false)
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

/* ================= ① 🥚 拼音蛋合并：拼读音频 + 拼对 3 题 + 拼错清连击 + 截图 ================= */
{
  console.log('\n— 🥚 拼音蛋合并 egg —')
  const { page, errs } = await mk()
  await enterGame(page, 'egg')
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  const tgt = await page.evaluate(() => ({
    syl: document.querySelector('[data-prompt]').getAttribute('data-target'),
    file: document.querySelector('[data-prompt]').getAttribute('data-afile'),
    ini: document.querySelector('[data-prompt]').getAttribute('data-ini'),
    fin: document.querySelector('[data-prompt]').getAttribute('data-fin'),
  }))
  const a = await page.evaluate((n) => window.__AUDIO_LOG.filter((e) => e.name === n)[0] || null, tgt.file)
  ok(!!tgt.syl && !!tgt.file && !!a, '开局自动播拼读合成音（hyp 音节文件）', `syl=${tgt.syl} file=${tgt.file}`)
  /* 拼读音频网络请求断言：audio/hyp/{file}.mp3 真实请求已发生 */
  const netReq = await page.evaluate((f) => performance.getEntriesByType('resource').some((r) => r.name.includes('audio/hyp/' + f + '.mp3')), tgt.file)
  ok(netReq, '拼读音频网络请求已发生', `audio/hyp/${tgt.file}.mp3`)
  const halvesReady = await waitDom(page, 'hhalf')
  const h0 = await page.evaluate(() => window.__DOM_LOG.filter((e) => e.kind === 'hhalf')[0] || null)
  ok(halvesReady && !!a && !!h0 && a.t < h0.t, '时序：目标音先于蛋半出现（声音先行）', `audio=${Math.round(a.t)} < half=${h0 ? Math.round(h0.t) : '-'}`)

  /* 截图 1：拼读进行态（蛋半在场+目标卡+巢窝） */
  await page.waitForSelector('#gstage [data-half]', { timeout: 5000 })
  await page.screenshot({ path: `${OUT}/shot-egg-play.png` })

  /* 拼对 1 题 → 得分10+连击1；拼错 → 蛋晃动+清连击；再拼对 2 题（共 3 题）
     门控：等 #v-egg 回到 pick 态且蛋半放行（合并/裂壳/小鸡动画期点击被舞台忽略） */
  const waitPick = () => page.waitForFunction(() => {
    const root = document.getElementById('v-egg')
    return root && root.getAttribute('data-stage') === 'pick' && document.querySelector('#gstage [data-halves][data-ready="1"]')
  }, null, { timeout: 8000 })
  const playEgg = async () => {
    await waitPick()
    const t = await page.evaluate(() => ({
      ini: document.querySelector('[data-prompt]').getAttribute('data-ini'),
      fin: document.querySelector('[data-prompt]').getAttribute('data-fin'),
    }))
    await page.tap(`#gstage [data-kind="ini"][data-key="${t.ini}"]`)
    await page.waitForTimeout(200)
    await page.tap(`#gstage [data-kind="fin"][data-key="${t.fin}"]`)
    await page.waitForTimeout(600)
  }
  await playEgg()
  let hud = await readHud(page)
  ok(hud.score === '10' && hud.combo === '1', '拼对#1：合并得分 10+连击 1', JSON.stringify(hud))

  /* 拼错：点一个干扰声母半 → 清连击（sndNo+combo 0），蛋不合 */
  await waitPick()
  const wrongKey = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('#gstage [data-kind="ini"]')).find((b) => b.getAttribute('data-key') !== document.querySelector('[data-prompt]').getAttribute('data-ini'))
    return el ? el.getAttribute('data-key') : ''
  })
  await page.tap(`#gstage [data-kind="ini"][data-key="${wrongKey}"]`)
  await page.waitForTimeout(350)
  hud = await readHud(page)
  ok(hud.combo === '0' && hud.score === '10', '拼错：蛋晃动不合+清连击（得分不变）', `wrong=${wrongKey} ` + JSON.stringify(hud))
  /* 拼读对账本 err 记账（绝不静默推进） */
  const errRec = await page.evaluate((k) => (JSON.parse(localStorage.getItem('pinyin_game_v1') || '{}').letters || {})[k], wrongKey)
  ok(!!errRec && errRec.err > 0, '拼错：错误账本记 err（干扰字母）', JSON.stringify(errRec))

  await playEgg()
  hud = await readHud(page)
  ok(hud.score === '20' && hud.combo === '1', '拼对#2：得分 20+连击回 1', JSON.stringify(hud))
  await playEgg()
  hud = await readHud(page)
  ok(hud.score === '30' && hud.combo === '2', '拼对#3：得分 30+连击 2', JSON.stringify(hud))

  /* 小鸡破壳帧截图：拼对后 980-1750ms 窗口内抓 chick */
  await playEgg()
  await page.waitForSelector('#gstage .chick', { timeout: 5000 })
  await page.screenshot({ path: `${OUT}/shot-egg-chick.png` })
  await page.waitForTimeout(1400)
  ok(errs.length === 0, '零 pageerror', errs.join('|') || 'clean')
  await page.close()
}

/* ================= ② 🎵 声调音乐会：时序 + 接住 3 音 + 接错清连击 + 截图 ================= */
{
  console.log('\n— 🎵 声调音乐会 tone —')
  const { page, errs } = await mk()
  await enterGame(page, 'tone')
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  const tgtFile = await page.getAttribute('[data-prompt]', 'data-target')
  const a = await page.evaluate((n) => window.__AUDIO_LOG.filter((e) => e.name === n)[0] || null, tgtFile)
  ok(!!tgtFile && !!a, '开局自动播带调音节（四声真人库）', `target=${tgtFile}`)
  const noteReady = await waitDom(page, 'tnote')
  const n0 = await page.evaluate(() => window.__DOM_LOG.filter((e) => e.kind === 'tnote')[0] || null)
  ok(noteReady && !!a && !!n0 && a.t < n0.t, '时序：目标音先于音符出现', `audio=${Math.round(a.t)} < note=${n0 ? Math.round(n0.t) : '-'}`)
  ok(noteReady && !!a && !!n0 && n0.t - a.t >= 250, '时序：音符入场在 300ms 闸门后', `gap=${n0 && a ? Math.round(n0.t - a.t) : '-'}ms`)

  /* 进行中截图（音符已入可视区——出生点在场外被裁剪，等可见再拍） */
  {
    const f0 = await page.getAttribute('[data-prompt]', 'data-target')
    const sel0 = `#gstage .tnote:not(.caught):not(.wrong)[data-file="${f0}"]`
    await page.waitForSelector(sel0, { timeout: 8000 })
    await waitVisible(page, sel0)
    await page.screenshot({ path: `${OUT}/shot-tone-play.png` })
  }

  /* 接住 2 音 → 得分 20+连击 2（音符自顶落下，入可视区后才坐标 tap；
     排除 caught/wrong 消失动画中的旧音符——那种音符 pointer-events 已关，点了不注册） */
  const catchTarget = async () => {
    const f = await page.getAttribute('[data-prompt]', 'data-target')
    const sel = `#gstage .tnote:not(.caught):not(.wrong)[data-file="${f}"]`
    await page.waitForSelector(sel, { timeout: 8000 })
    await waitVisible(page, sel)
    await tapMoving(page, sel)
    await page.waitForTimeout(900)   /* >620ms 换目标周期+320ms 闸门：下次读到的必是新目标 */
  }
  await catchTarget()
  let hud = await readHud(page)
  ok(hud.score === '10' && hud.combo === '1', '接住#1：得分 10+连击 1', JSON.stringify(hud))
  await catchTarget()
  hud = await readHud(page)
  ok(hud.score === '20' && hud.combo === '2', '接住#2：得分 20+连击 2', JSON.stringify(hud))

  /* 接错：点一个干扰音符（file≠当前目标）→ 清连击 */
  const cur = await page.getAttribute('[data-prompt]', 'data-target')
  const hasWrong = await page.waitForSelector(`#gstage .tnote:not(.caught):not(.wrong):not([data-file="${cur}"])`, { timeout: 9000 }).then(() => true).catch(() => false)
  if (hasWrong) {
    const wrongFile = await page.evaluate((c) => document.querySelector(`#gstage .tnote:not(.caught):not(.wrong)[data-file]:not([data-file="${c}"])`).getAttribute('data-file'), cur)
    await waitVisible(page, `#gstage .tnote:not(.caught):not(.wrong)[data-file="${wrongFile}"]`)
    await tapMoving(page, `#gstage .tnote:not(.caught):not(.wrong)[data-file="${wrongFile}"]`)
    await page.waitForTimeout(400)
    hud = await readHud(page)
    ok(hud.combo === '0' && hud.score === '20', '接错：清连击（得分不变）', `wrong=${wrongFile} ` + JSON.stringify(hud))
  } else {
    ok(false, '接错：清连击', '干扰音符未在窗口内出现')
  }
  /* 接住#3（换目标自动播新音已发生） */
  const grew = await page.waitForFunction(() => window.__AUDIO_LOG.length >= 3, null, { timeout: 8000 }).then(() => true).catch(() => false)
  ok(grew, '换目标：新目标音自动播', `audioEvents=${await page.evaluate(() => window.__AUDIO_LOG.length)}`)
  await catchTarget()
  hud = await readHud(page)
  ok(hud.score === '30' && hud.combo === '1', '接住#3：得分 30+连击 1', JSON.stringify(hud))
  /* 条目账本：接对的音节 ok 记账 */
  const itemsRec = await page.evaluate(() => JSON.parse(localStorage.getItem('pinyin_game_v1') || '{}').items || {})
  ok(Object.keys(itemsRec).length > 0 && Object.values(itemsRec).some((r) => r.ok > 0), '条目账本：接对音节 ok 记账', JSON.stringify(itemsRec))
  ok(errs.length === 0, '零 pageerror', errs.join('|') || 'clean')
  await page.close()
}

/* ================= ③ ✍️ 拼读专练：真实答 5 题 + 账本 + 加权复现 + 结算 ================= */
{
  console.log('\n— ✍️ 拼读专练 blenddrill —')
  const { page, errs } = await mk()
  await page.goto(`${BASE}/?open=blenddrill`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-bquiz [data-q]', { timeout: 8000 })

  /* 首题故意答错（账本写入+加权素材）→ 之后真答 5 题 */
  const wrongOnce = async () => {
    await page.waitForFunction(() => document.querySelector('#v-bquiz [data-q]')?.getAttribute('data-reveal') === '0', null, { timeout: 6000 })
    const ans = await page.evaluate(() => +document.querySelector('#v-bquiz [data-q]').getAttribute('data-ans'))
    const wrongIdx = (ans + 1) % 4
    const key = await page.evaluate(() => document.querySelector('#v-bquiz [data-q]').getAttribute('data-target'))
    await page.tap(`#v-bquiz [data-opt][data-idx="${wrongIdx}"]`)
    await page.waitForTimeout(1400)
    return key
  }
  const wrongKey = await wrongOnce()
  const rec = await page.evaluate((k) => (JSON.parse(localStorage.getItem('pinyin_game_v1') || '{}').items || {})[k], wrongKey)
  ok(!!rec && rec.err >= 1, '账本写入：拼错对子 err=1', `key=${wrongKey} ` + JSON.stringify(rec))
  const wBad = await page.evaluate((k) => window.__PJ.itemW(k), wrongKey)
  ok(wBad > 1, '加权生效：错过的对子权重>1', `itemW(${wrongKey})=${wBad.toFixed(2)}`)
  /* 种子复算：错过的对子 vs 固定 4 对照项，200 次抽样——加权项频次必须压过任一对照（复现） */
  const stat = await page.evaluate((k) => {
    const pool = window.__PJ.blendPool().filter((x) => x !== k)
    const set = [k, ...pool.slice(0, 4)]
    const draws = window.__PJ.wpick(set, 20261001)
    const cnt = {}
    let maxOther = 0
    for (const d of draws) cnt[d] = (cnt[d] || 0) + 1
    for (const d in cnt) if (d !== k) maxOther = Math.max(maxOther, cnt[d])
    return { n: draws.length, hit: cnt[k] || 0, maxOther }
  }, wrongKey)
  ok(stat.hit > 0 && stat.hit > stat.maxOther, '加权复现：错过的对子抽样频次第一（对 4 对照项）', JSON.stringify(stat))

  /* 真实答对 5 题（按 data-ans 点正确项） */
  for (let i = 0; i < 5; i++) {
    await page.waitForFunction(() => document.querySelector('#v-bquiz [data-q]')?.getAttribute('data-reveal') === '0', null, { timeout: 6000 })
    const ans = await page.evaluate(() => document.querySelector('#v-bquiz [data-q]').getAttribute('data-ans'))
    await page.tap(`#v-bquiz [data-opt][data-idx="${ans}"]`)
    await page.waitForTimeout(750)
  }
  const answered = await page.getAttribute('#v-bquiz [data-answered]', 'data-answered')
  ok(+answered >= 6, '真实答 5 题（+1 错）已答计数', `answered=${answered}`)
  /* 听音题自动读音断言：题目过程中存在音节音频事件 */
  const audioNames = await page.evaluate(() => window.__AUDIO_LOG.map((e) => e.name))
  ok(audioNames.length > 0 && audioNames.some((x) => /^([bpmfdtnlgkhjqxzcsyvw]|zh|ch|sh)[a-z]+[1-4]$/.test(x)), '听合成音选拆分：出题自动读音（声音先行）', audioNames.slice(0, 4).join(','))
  /* 结算：点结束 → 结算卡（已答/正确率/最高连对） */
  await page.tap('#v-bquiz [data-finish]')
  await page.waitForSelector('#v-bquiz [data-done]', { timeout: 5000 })
  const res = await page.evaluate(() => ({
    rn: document.querySelector('#v-bquiz [data-rn]').textContent,
    racc: document.querySelector('#v-bquiz [data-racc]').textContent,
    rstreak: document.querySelector('#v-bquiz [data-rstreak]').textContent,
  }))
  ok(res.rn === answered, '拼读专练结算：已答题数一致', JSON.stringify(res))
  ok(res.racc.endsWith('%') && res.rstreak.length > 0, '拼读专练结算：正确率+最高连对展示', JSON.stringify(res))
  await page.screenshot({ path: `${OUT}/shot-blendquiz.png` })
  ok(errs.length === 0, '零 pageerror', errs.join('|') || 'clean')
  await page.close()
}

/* ================= ④ ✍️ 声调专练：真实答 5 题 + 账本 + 加权 + 结算 ================= */
{
  console.log('\n— ✍️ 声调专练 tonedrill —')
  const { page, errs } = await mk()
  await page.goto(`${BASE}/?open=tonedrill`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-tquiz [data-q]', { timeout: 8000 })

  const wrongOnce = async () => {
    await page.waitForFunction(() => document.querySelector('#v-tquiz [data-q]')?.getAttribute('data-reveal') === '0', null, { timeout: 6000 })
    const ans = await page.evaluate(() => document.querySelector('#v-tquiz [data-q]').getAttribute('data-ans'))
    const wrongIdx = (ans + 1) % 4
    const key = await page.evaluate(() => document.querySelector('#v-tquiz [data-q]').getAttribute('data-target'))
    await page.tap(`#v-tquiz [data-toneopt="${wrongIdx + 1}"]`)
    await page.waitForTimeout(1400)
    return key
  }
  const wrongKey = await wrongOnce()
  const rec = await page.evaluate((k) => (JSON.parse(localStorage.getItem('pinyin_game_v1') || '{}').items || {})[k], wrongKey)
  ok(!!rec && rec.err >= 1, '账本写入：听错的调 err=1', `key=${wrongKey} ` + JSON.stringify(rec))
  const wBad = await page.evaluate((k) => window.__PJ.itemW(k), wrongKey)
  ok(wBad > 1, '加权生效：听错的调权重>1', `itemW(${wrongKey})=${wBad.toFixed(2)}`)
  /* 种子复算：听错的调 vs 固定 4 对照项，200 次抽样——加权项频次必须压过任一对照（复现） */
  const stat = await page.evaluate((k) => {
    const pool = window.__PJ.tonePool().filter((x) => x !== k)
    const set = [k, ...pool.slice(0, 4)]
    const draws = window.__PJ.wpick(set, 20261002)
    const cnt = {}
    let maxOther = 0
    for (const d of draws) cnt[d] = (cnt[d] || 0) + 1
    for (const d in cnt) if (d !== k) maxOther = Math.max(maxOther, cnt[d])
    return { n: draws.length, hit: cnt[k] || 0, maxOther }
  }, wrongKey)
  ok(stat.hit > 0 && stat.hit > stat.maxOther, '加权复现：听错的调抽样频次第一（对 4 对照项）', JSON.stringify(stat))

  for (let i = 0; i < 5; i++) {
    await page.waitForFunction(() => document.querySelector('#v-tquiz [data-q]')?.getAttribute('data-reveal') === '0', null, { timeout: 6000 })
    const ans = await page.evaluate(() => document.querySelector('#v-tquiz [data-q]').getAttribute('data-ans'))
    await page.tap(`#v-tquiz [data-toneopt="${+ans + 1}"]`)
    await page.waitForTimeout(750)
  }
  const answered = await page.getAttribute('#v-tquiz [data-answered]', 'data-answered')
  ok(+answered >= 6, '真实答 5 题（+1 错）已答计数', `answered=${answered}`)
  const audioNames = await page.evaluate(() => window.__AUDIO_LOG.map((e) => e.name))
  ok(audioNames.length > 0 && audioNames.some((x) => /^[a-z]+[1-4]$/.test(x)), '听音选声调：出题自动读音', audioNames.slice(0, 4).join(','))
  await page.tap('#v-tquiz [data-finish]')
  await page.waitForSelector('#v-tquiz [data-done]', { timeout: 5000 })
  const res = await page.evaluate(() => ({
    rn: document.querySelector('#v-tquiz [data-rn]').textContent,
    racc: document.querySelector('#v-tquiz [data-racc]').textContent,
  }))
  ok(res.rn === answered, '声调专练结算：已答题数一致', JSON.stringify(res))
  await page.screenshot({ path: `${OUT}/shot-tonequiz.png` })
  ok(errs.length === 0, '零 pageerror', errs.join('|') || 'clean')
  await page.close()
}

/* ================= ⑤ hub 终态：6 摊位 + 零占位 + 双厅截图 ================= */
{
  console.log('\n— hub 6 摊位终态 —')
  const { page, errs } = await mk()
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#stalls', { timeout: 8000 })
  await page.waitForTimeout(400)
  const hub = await page.evaluate(() => ({
    stalls: Array.from(document.querySelectorAll('#stalls [data-stall]')).map((e) => e.getAttribute('data-stall')),
    coming: Array.from(document.querySelectorAll('#stalls [data-coming]')).map((e) => e.getAttribute('data-coming')),
    art: Array.from(document.querySelectorAll('#stalls .art')).every((e) => e.getBoundingClientRect().width > 40),
    scrollV: document.getElementById('tab-view-root').scrollHeight <= document.getElementById('tab-view-root').clientHeight + 1,
  }))
  ok(hub.stalls.join(',') === 'balloon,mole,duel,fish,egg,tone', 'hub：6 摊位（蛋/音乐会实装）', hub.stalls.join(','))
  ok(hub.coming.length === 0, 'hub：零占位残留（赛跑/翻牌删除）', hub.coming.join(','))
  ok(hub.art, 'hub：6 张摊位插画可辨识')
  ok(hub.scrollV, 'hub：零纵向滚动')
  await page.screenshot({ path: `${OUT}/shot-hub-game.png` })
  await page.tap('[data-hallbtn="drill"]')
  await page.waitForSelector('#drillgrid', { timeout: 5000 })
  const cards = await page.evaluate(() => Array.from(document.querySelectorAll('#drillgrid [data-drill]')).map((e) => e.getAttribute('data-drill')))
  ok(cards.join(',') === 'bolt,listen,pairs,zi,blend,tone', '练习馆：六入口（拼读/声调专练在列）', cards.join(','))
  await page.screenshot({ path: `${OUT}/shot-hub-drill.png` })
  ok(errs.length === 0, '零 pageerror', errs.join('|') || 'clean')
  await page.close()
}

await browser.close()
console.log(`\n========== v43-accept: ${pass} pass / ${fail} fail ==========`)
process.exit(fail ? 2 : 0)
