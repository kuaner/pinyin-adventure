/* playGame flow：游戏岛/游戏进行态的导航与操作——只写一次。
   真实开局流（hub 点摊位=开局手势 → 3-2-1 → play）与深链开局（?open=game 冻结态）双轨。
   移动中元素用坐标级触摸（touchscreen.tap）；舞台可视区判定相对 .hall/#gstage 裁剪边界。 */
import { BASE_URL } from './bootApp.mjs'
import { sleep } from './assert.mjs'

/* 真实开局流：hub → 点摊位（开局手势，解锁+预载+3-2-1）→ 等进 play */
export async function enterGame(page, id) {
  await page.goto(`${BASE_URL()}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  await page.tap(`[data-stall="${id}"]`)
  await page.waitForSelector('#gcount', { timeout: 5000 })
  await page.waitForSelector('#gcount', { state: 'detached', timeout: 9000 })
}

/* 深链开局（验收态）：st=count|play|result（count/play=冻结计时） */
export async function enterGameDeep(page, id, st = 'play') {
  await page.goto(`${BASE_URL()}/?open=game&g=${id}&st=${st}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#gstage', { timeout: 8000 })
}

/* 练习馆直达：island → 点练习馆分段 */
export async function enterDrill(page) {
  await page.goto(`${BASE_URL()}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  await page.evaluate(() => document.querySelector('[data-hallbtn="drill"]')?.click())
  await page.waitForSelector('#drillgrid', { timeout: 5000 })
}

export const hall = (page) => page.evaluate(() => document.getElementById('v-island')?.getAttribute('data-hall'))

/* pointerdown 派发（游戏实体击打信任路径）与 click 包装 */
export const pd = (page, sel) => page.evaluate((s) => {
  document.querySelector(s)?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
}, sel)
export const ck = (page, sel) => page.evaluate((s) => { document.querySelector(s)?.click() }, sel)

/* HUD 读数 */
export const readHud = (page) => page.evaluate(() => ({
  score: document.querySelector('#gscore')?.textContent ?? '',
  combo: document.querySelector('#gcombo')?.getAttribute('data-combo') ?? '',
  mult: document.getElementById('gmult')?.getAttribute('data-mult') ?? '',
}))

/* 目标 → 等该目标的元素出现（跟随换目标，绝不死等旧字母——波次制下目标会自动换） */
export const waitCurTarget = (page, qsel, timeout = 8000) =>
  page.waitForFunction((qs) => {
    const t = window.__PJ.GS().target
    return document.querySelector(qs.replaceAll('{t}', t)) ? t : false
  }, qsel, { timeout }).then((h) => h.jsonValue()).catch(() => null)

/* 派发前复核目标未变（防陈旧派发误打干扰项）；返回是否真的派发 */
export const tapIfTarget = (page, qsel, letter) => page.evaluate(({ qs, k }) => {
  if (window.__PJ.GS().target !== k) return false
  const el = document.querySelector(qs.replaceAll('{t}', k))
  if (!el) return false
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  return true
}, { qs: qsel, k: letter })

/* 坐标级触摸（移动中元素信任输入） */
export async function tapMoving(page, sel) {
  const p = await page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, sel)
  await page.touchscreen.tap(p.x, p.y)
}

/* 元素进入舞台可视区（出生点在场外被 .hall/#gstage 裁剪——rect 相对舞台判定，坐标 tap 才落得中） */
export const waitVisible = (page, sel, scope = null, timeout = 8000) =>
  page.waitForFunction((o) => {
    const el = document.querySelector(o.sel)
    if (!el) return false
    const hall = el.closest(o.scope || '.hall') || el.closest('#gstage')
    if (!hall) return false
    const r = el.getBoundingClientRect()
    const h = hall.getBoundingClientRect()
    return r.top >= h.top + 2 && r.bottom <= h.bottom + 2 && r.left >= h.left && r.right <= h.right
  }, { sel, scope }, { timeout }).then(() => true).catch(() => false)

/* 等待第 min 个某类实体事件（声音 300ms 闸门后元素才出现，不能读完音频立刻读 DOM 日志） */
export const waitDom = (page, kind, min = 1, timeout = 6000) =>
  page.waitForFunction((o) => window.__DOM_LOG.filter((e) => e.kind === o.kind).length >= o.min, { kind, min }, { timeout }).then(() => true).catch(() => false)

/* 等下一次播音（装题锚：每次换题恰播一题音） */
export const waitAudioGrow = (page, timeout = 9000) => page.evaluate((to) => new Promise((resolve) => {
  const n0 = window.__AUDIO_LOG.length
  const tid = setInterval(() => {
    if (window.__AUDIO_LOG.length > n0) { clearInterval(tid); resolve(true) }
  }, 25)
  setTimeout(() => { clearInterval(tid); resolve(false) }, to)
}), timeout)

/* 活体元素计数 */
export const liveBalloons = (page) => page.evaluate(() => document.querySelectorAll('#gstage .balloon:not(.popped):not(.wrong)').length)
export const liveFish = (page) => page.evaluate(() => document.querySelectorAll('#gstage .fishwrap:not(.caught):not(.scare)').length)
export const liveNotes = (page) => page.evaluate(() => document.querySelectorAll('#gstage .tnote:not(.caught):not(.wrong)').length)
export const upMoles = (page) => page.evaluate(() => document.querySelectorAll('#gstage .mole.up').length)

/* 音频日志读取 */
export const audioNames = (page) => page.evaluate(() => window.__AUDIO_LOG.map((e) => e.name))
export const audioFirst = (page, name) => page.evaluate((n) => window.__AUDIO_LOG.filter((e) => e.name === n)[0] || null, name)

/* —— 各游戏"打中当前目标"一步（正例流复用）—— */
export async function popTargetBalloon(page) {
  const sel = await page.waitForFunction(() => {
    const t = window.__PJ.GS().target
    const el = Array.from(document.querySelectorAll('#gstage .balloon:not(.popped):not(.wrong)')).find((e) => e.getAttribute('data-letter') === t)
    return el ? `[data-bid="${el.getAttribute('data-bid')}"]` : null
  }, null, { timeout: 9000 }).then((h) => h.jsonValue()).catch(() => null)
  if (!sel) return false
  if (!await waitVisible(page, `#gstage ${sel}`, '.sky')) return false
  /* 点前确认中心点顶元素=本球（早前波残留球会漂到目标坐标上——被覆盖则等球群漂开重试） */
  for (let i = 0; i < 6; i++) {
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

export async function whackTargetMole(page) {
  const tgt = await page.evaluate(() => document.querySelector('[data-prompt]')?.getAttribute('data-target'))
  if (!tgt) return false
  await page.waitForSelector(`#gstage .mole.up[data-letter="${tgt}"]`, { timeout: 8000 })
  await page.waitForTimeout(380)   /* 探头 transition 0.22s 完成后再敲——过程中鼠心被洞沿遮挡 */
  await pd(page, `#gstage .mole.up[data-letter="${tgt}"]`)
  await page.waitForTimeout(400)
  return true
}

export async function catchTargetFish(page) {
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
  if (!sel) return false
  await waitVisible(page, `#gstage ${sel}`, '.pond')
  await tapMoving(page, `#gstage ${sel}`)
  await sleep(500)
  return true
}

export async function catchTargetNote(page) {
  const f = await page.evaluate(() => document.querySelector('[data-prompt]')?.getAttribute('data-target'))
  if (!f) return false
  const sel = `#gstage .tnote:not(.caught):not(.wrong)[data-file="${f}"]`
  await page.waitForSelector(sel, { timeout: 8000 })
  await waitVisible(page, sel, '.hall')
  await tapMoving(page, sel)
  await sleep(900)   /* >620ms 换目标周期+320ms 闸门：下次读到的必是新目标 */
  return true
}

/* 蛋合并一轮（pick 态门控：等蛋半放行——合并/裂壳/小鸡动画期点击被舞台忽略） */
export async function playEggRound(page) {
  await page.waitForFunction(() => {
    const root = document.getElementById('v-egg')
    return root && root.getAttribute('data-stage') === 'pick' && document.querySelector('#gstage [data-halves][data-ready="1"]')
  }, null, { timeout: 8000 })
  const t = await page.evaluate(() => ({
    ini: document.querySelector('[data-prompt]').getAttribute('data-ini'),
    fin: document.querySelector('[data-prompt]').getAttribute('data-fin'),
  }))
  await page.tap(`#gstage [data-kind="ini"][data-key="${t.ini}"]`)
  await page.waitForTimeout(200)
  await page.tap(`#gstage [data-kind="fin"][data-key="${t.fin}"]`)
  await page.waitForTimeout(600)
}

/* 连击计分期望：c1,c2=x1；c3-c5=x2；c6+=x3 → n 连对的累计分 */
export const streakScore = (n) => { let s = 0; for (let c = 1; c <= n; c++) s += 10 * (c >= 6 ? 3 : c >= 3 ? 2 : 1); return s }
