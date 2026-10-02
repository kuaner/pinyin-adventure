/* v4.1 声音先行制验收（Bug#34）：四游戏时序断言 + 反例零分 + 正例得分连击 + 🔊重听 + 每日挑战自动读音。
   时序证据：window.__AUDIO_LOG（playAudio play() 发起时刻，audio.ts markAudio 验收钩子）
           + window.__DOM_LOG（init 脚本 MutationObserver 记录游戏元素首次出现/探头时刻）。
   前置：preview 在 4173。真实开局流（hub 点摊位→3-2-1→自动播）。mute=false（时序断言要真播音）。 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = '.acceptance-v41'
fs.mkdirSync(OUT, { recursive: true })

let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) } else { fail++; console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) } }
const letterAudioName = (k) => (k === 'ü' ? 'v' : k === 'ün' ? 'vn' : k === 'üe' ? 've' : k)

/* init 脚本：播音事件日志 + 元素出现观察者（含 .up 探头 class 变化）——纯字符串注入；
   观察器等 DOMContentLoaded 再挂（init 脚本运行时 documentElement 可能未就绪） */
const INIT = `window.__AUDIO_LOG = [];
window.__DOM_LOG = [];
function __setupObserver() {
  try {
    const mo = new MutationObserver((muts) => {
      const now = performance.now();
      for (const m of muts) {
        if (m.type === 'childList') {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1 && n.classList) {
              for (const kind of ['balloon', 'fishwrap']) {
                if (n.classList.contains(kind)) window.__DOM_LOG.push({ kind, letter: n.getAttribute('data-letter'), t: now });
              }
              if (n.classList.contains('qwrap')) window.__DOM_LOG.push({ kind: 'qwrap', letter: n.getAttribute('data-target'), t: now });
            }
          }
        } else if (m.type === 'attributes' && m.target.classList) {
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

/* 真实开局流：hub → 点摊位（开局手势，解锁+预载+3-2-1）→ 等进入 play */
async function enterGame(page, id) {
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  await page.tap(`[data-stall="${id}"]`)
  await page.waitForSelector('#gcount', { timeout: 5000 })
  await page.waitForSelector('#gcount', { state: 'detached', timeout: 9000 })   /* 3-2-1 结束=play */
}

/* 目标字母 → 首个该字母的播音事件 */
const firstAudio = (logs, name) => logs.filter((e) => e.name === name)[0] || null
/* 等待第 n 个某类元素事件出现（元素在声音 300ms 闸门后才出现，不能读完音频立刻读 DOM 日志） */
const waitDom = (page, kind, min = 1, timeout = 6000) =>
  page.waitForFunction((o) => window.__DOM_LOG.filter((e) => e.kind === o.kind).length >= o.min, { kind, min }, { timeout }).then(() => true).catch(() => false)
/* 移动中元素的真实触摸：读中心坐标 → touchscreen.tap（信任输入，绕开 playwright 稳定性检查） */
const tapMoving = async (page, sel) => {
  const p = await page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, sel)
  await page.touchscreen.tap(p.x, p.y)
}
/* 等元素真正进入视口（鱼从屏外游入，刚 spawn 时 rect 在视口外，坐标 tap 会打空） */
const waitVisible = (page, sel, timeout = 6000) =>
  page.waitForFunction((s) => {
    const el = document.querySelector(s)
    if (!el) return false
    const r = el.getBoundingClientRect()
    return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight
  }, sel, { timeout }).then(() => true).catch(() => false)

/* ================= ① 打地鼠：时序 + 正例 + 重听 =================
   v4.2 起地鼠=口诀打地鼠：目标音=口诀朗读（lessons/kj_*，声音先行制不变——
   呼读音断言移交 v42-accept 气球段）。 */
{
  console.log('\n— 打地鼠 mole —')
  const kjName = (k) => 'lessons/kj_' + letterAudioName(k)
  const { page, errs } = await mk()
  await enterGame(page, 'mole')
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  const target = await page.getAttribute('[data-prompt]', 'data-target')
  const a = await page.evaluate((n) => window.__AUDIO_LOG.filter((e) => e.name === n)[0] || null, kjName(target))
  const upReady = await waitDom(page, 'mole-up')
  const up = await page.evaluate(() => window.__DOM_LOG.filter((e) => e.kind === 'mole-up')[0] || null)
  ok(!!a, '开局自动播第一轮目标音（v4.2=口诀朗读 kj_*；3-2-1 后零操作即播音）', `target=${target} audio@${a ? Math.round(a.t) : '-'}ms`)
  ok(upReady && !!a && !!up && a.t < up.t, '时序：目标音先于地鼠探头', `audio=${Math.round(a.t)} < up=${up ? Math.round(up.t) : '-'}`)
  ok(upReady && !!a && !!up && up.t - a.t >= 250, '时序：探头挂在声音开播 300ms 闸门后', `gap=${up && a ? Math.round(up.t - a.t) : '-'}ms`)
  const preNet = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => /audio\/.*(hyp|lessons)/.test(r.name)).length)
  ok(preNet > 0, '开局预载：字母池读音网络请求已发生', `reqs=${preNet}`)

  /* 进行中截图（地鼠探头在场上+目标提示可见） */
  await page.waitForSelector('#gstage .mole.up', { timeout: 5000 })
  await page.screenshot({ path: `${OUT}/shot-mole.png` })

  /* 正例：探头后真实触摸目标鼠（坐标级，紧贴当前探头窗；miss 后重读当前目标再试）→ 得分+连击 */
  let whacked = false
  for (let i = 0; i < 3 && !whacked; i++) {
    const tgt = await page.getAttribute('[data-prompt]', 'data-target')
    await page.waitForSelector(`#gstage .mole.up[data-letter="${tgt}"]`, { timeout: 6000 })
    await tapMoving(page, `#gstage .mole.up[data-letter="${tgt}"]`)
    await page.waitForTimeout(300)
    whacked = await page.evaluate(() => document.querySelector('#gscore').textContent === '10')
  }
  const after = await page.evaluate(() => ({ score: document.querySelector('#gscore').textContent, combo: document.querySelector('#gcombo').getAttribute('data-combo') }))
  ok(whacked && after.score === '10' && after.combo === '1', '正例：点中目标鼠 → 得分10+连击1', JSON.stringify(after))
  /* 换目标自动播新音：任一字母的第二次播音或新字母播音 */
  const grew = await page.waitForFunction(() => window.__AUDIO_LOG.length >= 2, null, { timeout: 6000 }).then(() => true).catch(() => false)
  ok(grew, '换目标：新目标音自动播（无操作也播音）')
  const tgt2 = await page.getAttribute('[data-prompt]', 'data-target')

  /* 🔊=重听：点后当前目标名的音频事件再发（v4.2=重听口诀）。
     v4.2c 适配（验收腿，只改脚本）：配对"tap 时刻目标"——400ms 窗内若回合到期 miss 换目标，
     新目标音会接在重听后面，拿窗末目标配对第一条音频会错位 */
  const beforeCnt = await page.evaluate(() => window.__AUDIO_LOG.length)
  const tgtAtTap = await page.evaluate(() => document.querySelector('[data-prompt]').getAttribute('data-target'))
  await page.tap('[data-listen]')
  await page.waitForTimeout(400)
  const now2 = await page.evaluate(() => ({
    n: window.__AUDIO_LOG.length,
    names: window.__AUDIO_LOG.map((e) => e.name),
  }))
  ok(now2.n > beforeCnt && now2.names[beforeCnt] === 'lessons/kj_' + letterAudioName(tgtAtTap), '🔊 重听可用：点击后音频再发（v4.2=口诀）', `now=${now2.names.slice(beforeCnt).join(',')} tgtAtTap=${tgtAtTap}`)
  ok(errs.length === 0, '零 pageerror', errs.join('|') || 'clean')
  await page.close()
}

/* ================= ② 气球：时序 + 正例 ================= */
{
  console.log('\n— 气球 balloon —')
  const { page, errs } = await mk()
  await enterGame(page, 'balloon')
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  const target = await page.getAttribute('[data-prompt]', 'data-target')
  const a = await page.evaluate((n) => window.__AUDIO_LOG.filter((e) => e.name === n)[0] || null, letterAudioName(target))
  const elReady = await waitDom(page, 'balloon')
  const el = await page.evaluate(() => window.__DOM_LOG.filter((e) => e.kind === 'balloon')[0] || null)
  ok(!!a, '开局自动播目标音', `target=${target}`)
  ok(elReady && !!a && !!el && a.t < el.t, '时序：目标音先于气球出现', `audio=${Math.round(a.t)} < balloon=${el ? Math.round(el.t) : '-'}`)
  ok(elReady && !!a && !!el && el.t - a.t >= 250, '时序：气球入场在 300ms 闸门后', `gap=${el && a ? Math.round(el.t - a.t) : '-'}ms`)

  await page.waitForSelector(`#gstage .balloon[data-letter="${target}"]`, { timeout: 5000 })
  /* 进行中截图（目标球在场上+目标提示可见） */
  await page.screenshot({ path: `${OUT}/shot-balloon.png` })
  await tapMoving(page, `#gstage .balloon[data-letter="${target}"]`)
  await page.waitForTimeout(300)
  const after = await page.evaluate(() => ({ score: document.querySelector('#gscore').textContent, combo: document.querySelector('#gcombo').getAttribute('data-combo') }))
  ok(after.score === '10' && after.combo === '1', '正例：pop 目标球 → 得分10+连击1', JSON.stringify(after))
  ok(errs.length === 0, '零 pageerror', errs.join('|') || 'clean')
  await page.close()
}

/* ================= ③ 钓鱼：时序 + 正例 ================= */
{
  console.log('\n— 钓鱼 fish —')
  const { page, errs } = await mk()
  await enterGame(page, 'fish')
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  const target = await page.getAttribute('[data-prompt]', 'data-target')
  const a = await page.evaluate((n) => window.__AUDIO_LOG.filter((e) => e.name === n)[0] || null, letterAudioName(target))
  const elReady = await waitDom(page, 'fishwrap')
  const el = await page.evaluate(() => window.__DOM_LOG.filter((e) => e.kind === 'fishwrap')[0] || null)
  ok(!!a, '开局自动播目标音', `target=${target}`)
  ok(elReady && !!a && !!el && a.t < el.t, '时序：目标音先于鱼入场', `audio=${Math.round(a.t)} < fish=${el ? Math.round(el.t) : '-'}`)

  /* 正例：目标鱼游入视口后真实触摸（miss 后重读当前目标再试）→ 得分+连击 */
  let hooked = false
  let fishShot = false
  for (let i = 0; i < 3 && !hooked; i++) {
    const tgt = await page.getAttribute('[data-prompt]', 'data-target')
    await page.waitForSelector(`#gstage .fishwrap[data-letter="${tgt}"]`, { timeout: 6000 })
    await waitVisible(page, `#gstage .fishwrap[data-letter="${tgt}"]`)
    if (!fishShot) { await page.screenshot({ path: `${OUT}/shot-fish.png` }); fishShot = true }  /* 进行中截图（鱼在场上） */
    await tapMoving(page, `#gstage .fishwrap[data-letter="${tgt}"]`)
    await page.waitForTimeout(300)
    hooked = await page.evaluate(() => document.querySelector('#gscore').textContent === '10')
  }
  const after = await page.evaluate(() => ({ score: document.querySelector('#gscore').textContent, combo: document.querySelector('#gcombo').getAttribute('data-combo') }))
  ok(hooked && after.score === '10' && after.combo === '1', '正例：钓中目标鱼 → 得分10+连击1', JSON.stringify(after))
  ok(errs.length === 0, '零 pageerror', errs.join('|') || 'clean')
  await page.close()
}

/* ================= ④ 镜像对决：出题即读音 + 正例 + 口诀重听键 ================= */
{
  console.log('\n— 镜像对决 duel —')
  const { page, errs } = await mk()
  await enterGame(page, 'duel')
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  const qel = await page.waitForSelector('[data-q]', { timeout: 5000 })
  const target = await qel.getAttribute('data-target')
  /* v4.2 起对决题面两型（验收腿适配，只改脚本）：字母题播呼读/口诀题播 kj（gameEngine duelQ 35% 掷币）——
     断言接受"当前题型对应音频"，两型都验"出题即读音" */
  const a = await page.evaluate((n) => window.__AUDIO_LOG.filter((e) => e.name === n)[0] || null, letterAudioName(target))
  const akj = await page.evaluate((n) => window.__AUDIO_LOG.filter((e) => e.name === n)[0] || null, 'lessons/kj_' + letterAudioName(target))
  const qaudio = a || akj
  const el = await page.evaluate(() => window.__DOM_LOG.filter((e) => e.kind === 'qwrap')[0] || null)
  ok(!!qaudio, '出题即自动读音', `target=${target} audio=${qaudio ? qaudio.name : 'none'}`)
  ok(!!qaudio && !!el && qaudio.t <= el.t + 30, '时序：读音与题面同步出现（题面出现即读）', `audio=${qaudio ? Math.round(qaudio.t) : '-'} q=${el ? Math.round(el.t) : '-'}`)
  /* 进行中截图（题面+选项+目标可见） */
  await page.screenshot({ path: `${OUT}/shot-duel.png` })

  /* 正例：点正确选项（data-qkey=答案字母；错误选项 data-qkey="" 也带属性名——必须排除空串，
     否则点的是 DOM 第一个选项=抛硬币 flake）→ 得分+连击；新题自动读音（答错会换题，未中重读题再点） */
  let scored = false
  for (let i = 0; i < 3 && !scored; i++) {
    await page.waitForSelector('[data-opts] .duelopt[data-qkey]:not([data-qkey=""])', { timeout: 6000 })
    await page.tap('[data-opts] .duelopt[data-qkey]:not([data-qkey=""])')
    await page.waitForTimeout(250)
    scored = await page.evaluate(() => document.querySelector('#gscore').textContent === '10')
  }
  const after = await page.evaluate(() => ({ score: document.querySelector('#gscore').textContent, combo: document.querySelector('#gcombo').getAttribute('data-combo') }))
  ok(scored && after.score === '10' && after.combo === '1', '正例：答对推绳 → 得分10+连击1', JSON.stringify(after))
  const grew = await page.waitForFunction(() => window.__AUDIO_LOG.length >= 2, null, { timeout: 6000 }).then(() => true).catch(() => false)
  ok(grew, '下一题自动读音（换目标自动播）')
  /* 🔊 重听（当前题可能是口诀题=口诀朗读音频） */
  const q2 = await page.getAttribute('[data-q]', 'data-target')
  const cnt0 = await page.evaluate(() => window.__AUDIO_LOG.length)
  const hasListen = await page.$('[data-q] [data-listen]')
  if (hasListen) {
    await page.tap('[data-q] [data-listen]')
    await page.waitForTimeout(350)
    const logNow = await page.evaluate(() => window.__AUDIO_LOG.map((e) => e.name))
    ok(logNow.length > cnt0, '🔊 重听可用（听写/口诀音频再发）', logNow.slice(cnt0).join(','))
  } else ok(false, '🔊 重听键存在', 'missing')
  ok(errs.length === 0, '零 pageerror', errs.join('|') || 'clean')
  await page.close()
}

/* ================= ⑤ 每日挑战：出题自动读音 + 口诀题重听键 ================= */
{
  console.log('\n— 每日挑战 daily —')
  const { page, errs } = await mk()
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  await page.tap('#dailycard')
  await page.waitForSelector('#v-daily', { timeout: 5000 })
  /* 脚本适配：每日挑战=日期种子（重掷同序），首题类型每日一抽——zi 看字题设计上不自动读音
     （播了=报答案）。顺序作答推进到听音题成为当前题，再断言其自动读音+重听键（只改脚本） */
  let qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype').catch(() => null)
  let tries = 0
  while (qt === 'zi' && tries++ < 11) {
    /* 故意答错推进：错题不加分不触发结算，反馈后照常换题 */
    const w = await page.evaluate(() => {
      const D = window.__PJ.DC()
      return (D.qs[D.i].ans + 1) % D.qs[D.i].opts.length
    })
    await page.tap(`#v-daily [data-opts] .opt:nth-of-type(${w + 1})`)
    await page.waitForTimeout(1900)   /* 错反馈 1500ms + 换题 */
    qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype').catch(() => null)
  }
  const fired = await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 }).then(() => true).catch(() => false)
  ok(fired, '每日挑战出题自动读音（游戏/挑战场景推翻零自动播放）')
  const qtypes = await page.evaluate(() => Array.from(document.querySelectorAll('#dqcard, #v-daily [data-qtype]')).map((e) => e.getAttribute('data-qtype')))
  const replayKeys = await page.evaluate(() => Array.from(document.querySelectorAll('#v-daily [data-listen]')).length)
  ok(replayKeys >= 1, '🔊 重听键保留', `count=${replayKeys} qtype=${qtypes.join(',') || 'n/a'}`)
  ok(errs.length === 0, '零 pageerror', errs.join('|') || 'clean')
  await page.close()
}

/* ================= ⑥ 反例路径：完全不操作 60 秒 → 0 分 / 无过关 ================= */
for (const id of ['mole', 'balloon', 'fish', 'duel']) {
  console.log(`\n— 反例 idle ${id} —`)
  const { page, errs } = await mk()
  await enterGame(page, id)
  /* 期间检查：等待窗内未击 → 元素退场且计 miss（错误账本 err 增长=非静默推进） */
  await page.waitForSelector('#gresult', { timeout: 75000 })   /* duel 可能被拔河判负提前结束 */
  await page.waitForTimeout(400)
  const res = await page.evaluate(() => {
    const gd = JSON.parse(localStorage.getItem('pinyin_game_v1') || '{}')
    const errs_ = Object.values(gd.letters || {}).reduce((s, r) => s + (r.err || 0), 0)
    return {
      rscore: document.querySelector('#rscore')?.textContent ?? '',
      stars: document.querySelectorAll('#rstars .rstar').length,
      score: document.querySelector('#gscore')?.textContent ?? '',
      missErrs: errs_,
    }
  })
  ok(res.rscore === '0' && res.score === '0', `反例${id}：60 秒零操作 → 结束得分 0`, JSON.stringify(res))
  ok(res.stars === 0, `反例${id}：无过关态（0 星）`)
  ok(id === 'duel' || res.missErrs > 0, `反例${id}：超时未击计 miss（错误账本 err>0，绝不静默推进）`, `missErrs=${res.missErrs}`)
  ok(errs.length === 0, `反例${id}：零 pageerror`, errs.join('|') || 'clean')
  await page.close()
}

await browser.close()
console.log(`\n========== v41-accept: ${pass} pass / ${fail} fail ==========`)
process.exit(fail ? 2 : 0)
