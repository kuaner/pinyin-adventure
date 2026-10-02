/* specs/games/coexist —— 同屏共存立法（Bug#36 回归门 + v431 全游戏扩展）：
   立法背景：v4.2c 前同屏只出一个目标——清屏退化策略让孩子"点最新的就对"，听音形同虚设。
   ① 气球：空中常驻活球 ≥3 + 波次生成（≥3 只同批 <160ms）+ 盲点策略必亏（数据级：≥4 波观察，
      "波内最新升空球=当时目标"必须 0 次——出现时机零信号）
   ② 地鼠：同探活鼠 ≥3 + 目标在场 + 干扰 ≥2
   ③ 钓鱼：并发游鱼 ≥3 + 成群入场 + 目标鱼与干扰鱼同群（听音可辨）+ 真实钓对
   ④ 蛋：半堆两行各 ≥2 + 可选半堆必含错半块
   ⑤ 音乐会：目标符+≥2 干扰同落 + 干扰=同音节其他声调（异调）
   ⑥ 对决：强制二选一同屏核对
   修 bug 先写失败测试（tests/README.md 规矩①）——若共存立法回退，本 spec 红灯。
   迁移自：regression-bug36-coexist + v431-accept①。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { enterGame, catchTargetFish, readHud, liveBalloons, liveFish, upMoles } from '../../flows/playGame.mjs'

const t = new Tally('games/coexist 同屏共存立法（6 游戏面）')
const app = new BootApp()

/* ① 气球：成波共存 + 盲点策略必亏 + mp3 链路 */
{
  const page = await app.newPage({ tier: 'mid', routeMp3: true })
  await enterGame(page, 'balloon')
  await page.waitForFunction(() => document.querySelectorAll('#gstage .balloon:not(.popped):not(.wrong)').length >= 3, null, { timeout: 12000 }).catch(() => {})
  t.ok(await liveBalloons(page) >= 3, '气球：空中常驻活球 ≥3（禁单球出场轮）', `live=${await liveBalloons(page)}`)
  const batch = await page.evaluate(() => {
    const ts = window.__DOM_LOG.filter((e) => e.kind === 'balloon').map((e) => e.t)
    for (let i = 0; i + 2 < ts.length; i++) if (ts[i + 2] - ts[i] < 160) return { n: 3, span: Math.round(ts[i + 2] - ts[i]) }
    return null
  })
  t.ok(!!batch, '气球：波次生成（≥3 只同批升空）', batch ? `span=${batch.span}ms` : '无同批')
  t.ok(app.mp3.length > 0, '音频链路：呼读音 mp3 请求已发生（route 计数）', `mp3req=${app.mp3.length}`)
  /* 盲点策略（数据级，几何/时序免疫）：连续观察 ≥4 波，波内最新升空球≠当时目标 */
  const blind = await page.waitForFunction(() => {
    const ls = window.__DOM_LOG.filter((e) => e.kind === 'balloon')
    const waves = []
    for (const e of ls) {
      const w = waves[waves.length - 1]
      if (w && e.t - w.t0 < 160) w.items.push(e)
      else waves.push({ t0: e.t, items: [e] })
    }
    const full = waves.filter((w) => w.items.length >= 3)
    if (full.length < 4) return null
    const tgtAt = (tt) => { let v = null; for (const s of window.__TLOG) { if (s.t <= tt) v = s.target; else break } return v }
    const letters = new Map(ls.map((e) => [String(e.bid), e.letter]))
    const bad = []
    for (const w of full) {
      const tg = tgtAt(w.t0)
      const newest = w.items[w.items.length - 1]
      if (tg && letters.get(String(newest.bid)) === tg) bad.push(tg)
    }
    return { waves: full.length, bad }
  }, null, { timeout: 50000 }).then((h) => h.jsonValue()).catch(() => null)
  /* 窗口校准注（v4.7）：P1-11 密度帽（≤6 球/6 泳道）下整波回收=整波退场，
     rAF 节流时退场周期最长 ~20s——50s 窗口容纳 ≥4 全波（批性质断言不变） */
  t.ok(!!blind && blind.waves >= 4 && blind.bad.length === 0, '盲点策略：≥4 波观察——最新升空球从来不是当时目标（出现时机零信号）', blind ? `waves=${blind.waves} bad=${blind.bad.join(',')}` : '波数不足')
  await app.closePage(page)

  /* 真听音策略：按听到的音点 → 必中 + 共存保持（清到只剩目标的退化策略已废除）。独立棋局 */
  const pageB = await app.newPage({ tier: 'mid' })
  await enterGame(pageB, 'balloon')
  let hitsB = 0
  const s0 = await readHud(pageB)
  for (let i = 0; i < 12 && hitsB < 3; i++) {
    const sel = await pageB.waitForFunction(() => {
      const tt = window.__PJ.GS().target
      const el = Array.from(document.querySelectorAll('#gstage .balloon:not(.popped):not(.wrong)')).find((e) => e.getAttribute('data-letter') === tt)
      return el ? `[data-bid="${el.getAttribute('data-bid')}"]` : null
    }, null, { timeout: 9000 }).then((h) => h.jsonValue()).catch(() => null)
    if (!sel) continue
    if (await (await import('../../flows/playGame.mjs')).popTargetBalloon(pageB)) { await pageB.waitForTimeout(500); hitsB++ }
  }
  const s1 = await readHud(pageB)
  t.ok(hitsB === 3 && +s1.score > +s0.score, '真听音策略：按听到的音点 3 发 3 中（得分上涨）', `${s0.score}→${s1.score} hits=${hitsB}`)
  t.ok(await pageB.waitForFunction(() => document.querySelectorAll('#gstage .balloon:not(.popped):not(.wrong)').length >= 3, null, { timeout: 9000 }).then(() => true).catch(() => false),
    '共存保持：答对换目标后空中仍 ≥3 只', `live=${await liveBalloons(pageB)}`)
  await app.closePage(pageB)
}

/* ② 口诀地鼠：多鼠同探（两轮）+ 敲对得分 */
{
  const page = await app.newPage({ tier: 'mid' })
  await enterGame(page, 'mole')
  for (let round = 1; round <= 2; round++) {
    t.ok(await page.waitForFunction(() => document.querySelectorAll('#gstage .mole.up').length >= 3, null, { timeout: 10000 }).then(() => true).catch(() => false),
      `共存#r${round}：同探活鼠 ≥3（禁单鼠出场轮）`, `up=${await upMoles(page)}`)
    const snap = await page.evaluate(() => {
      const tt = document.querySelector('[data-prompt]').getAttribute('data-target')
      const up = Array.from(document.querySelectorAll('#gstage .mole.up')).map((e) => e.getAttribute('data-letter'))
      return { t: tt, up, hasT: up.includes(tt), decoys: new Set(up.filter((k) => k !== tt)).size }
    })
    t.ok(snap.hasT && snap.decoys >= 2, `共存#r${round}：目标鼠在场+干扰 ≥2 只`, `target=${snap.t} up=${snap.up.join(',')}`)
    if (round === 1) {
      await page.waitForTimeout(380)
      await page.evaluate((k) => {
        const m = Array.from(document.querySelectorAll('#gstage .mole.up')).find((e) => e.getAttribute('data-letter') === k)
        m?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      }, snap.t)
      await page.waitForTimeout(400)
      const hud = await readHud(page)
      t.ok(+hud.score >= 10, `敲对#r${round}：得分 +10`, JSON.stringify(hud))
    }
    await page.waitForFunction(() => document.querySelectorAll('#gstage .mole.up').length === 0, null, { timeout: 9000 }).catch(() => {})
  }
  await app.closePage(page)
}

/* ③ 钓鱼：并发鱼群 + 目标同群 + 真实钓对 */
{
  const page = await app.newPage({ tier: 'mid' })
  await enterGame(page, 'fish')
  await page.waitForFunction(() => window.__DOM_LOG.some((e) => e.kind === 'fish'), null, { timeout: 8000 })
  t.ok(await page.waitForFunction(() => document.querySelectorAll('#gstage .fishwrap:not(.caught):not(.scare)').length >= 3, null, { timeout: 9000 }).then(() => true).catch(() => false),
    '钓鱼：水里并发游鱼 ≥3', `live=${await liveFish(page)}`)
  const batch = await page.evaluate(() => {
    const ts = window.__DOM_LOG.filter((e) => e.kind === 'fish').map((e) => e.t)
    for (let i = 0; i + 2 < ts.length; i++) if (ts[i + 2] - ts[i] < 800) return Math.round(ts[i + 2] - ts[i])
    return null
  })
  t.ok(!!batch, '钓鱼：成群入场（≥3 条 800ms 内鱼贯游入）', batch ? `span=${batch}ms` : '无同批')
  t.ok(!!await page.waitForFunction(() => {
    const tt = window.__PJ.GS().target
    return Array.from(document.querySelectorAll('#gstage .fishwrap:not(.caught):not(.scare)')).some((e) => e.getAttribute('data-letter') === tt)
  }, null, { timeout: 16000 }).then(() => true).catch(() => false), '钓鱼：目标鱼与干扰鱼同群（听音可辨）')
  let hooked = false
  for (let i = 0; i < 3 && !hooked; i++) hooked = await catchTargetFish(page)
  const hud = await readHud(page)
  t.ok(hooked && +hud.score >= 10, '真实钓对：得分 +10', JSON.stringify(hud))
  await app.closePage(page)
}

/* ④ 蛋：半堆必含错半块 */
{
  const page = await app.newPage({ tier: 'mid' })
  await enterGame(page, 'egg')
  await page.waitForSelector('#gstage [data-halves][data-ready="1"]', { timeout: 9000 })
  const egg = await page.evaluate(() => {
    const p = document.querySelector('[data-prompt]')
    const hs = Array.from(document.querySelectorAll('#gstage [data-half]'))
    const of = (kind) => hs.filter((h) => h.getAttribute('data-kind') === kind).map((h) => h.getAttribute('data-key'))
    return { ini: p.getAttribute('data-ini'), fin: p.getAttribute('data-fin'), iK: of('ini'), fK: of('fin') }
  })
  t.ok(egg.iK.length >= 2 && egg.fK.length >= 2, '蛋：半堆两行各 ≥2 半块（非成对给全）', `ini=${egg.iK.join(',')} fin=${egg.fK.join(',')}`)
  t.ok(egg.iK.some((k) => k !== egg.ini) && egg.fK.some((k) => k !== egg.fin), '蛋：可选半堆必含错半块', `target=${egg.ini}+${egg.fin}`)
  await app.closePage(page)
}

/* ⑤ 音乐会：目标符+干扰符同发（原子快照）+ 干扰=同音节其他声调 */
{
  const page = await app.newPage({ tier: 'mid' })
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
  }, null, { timeout: 25000 }).then((h) => h.jsonValue()).catch(() => null)
  t.ok(!!snap, '音乐会：目标符在场+同落音符 ≥3（1 目标+≥2 干扰）')
  t.ok(!!snap && !!snap.toneOf && snap.decoyN >= 2, '音乐会：目标符+干扰符 ≥2 快照复核', snap ? `target=${snap.f}(调${snap.toneOf}) decoys=${snap.decoyTones.join(',')}` : 'null')
  t.ok(!!snap && snap.decoyTones.every((x) => x !== snap.toneOf), '立法核对：干扰符=同音节其他声调（异调）', snap ? `decoyTones=${snap.decoyTones.join(',')}` : 'null')
  await app.closePage(page)
}

/* ⑥ 对决：强制二选一共存（核对不动） */
{
  const page = await app.newPage({ tier: 'mid' })
  await enterGame(page, 'duel')
  const duel = await page.evaluate(() => ({
    opts: document.querySelectorAll('#gstage [data-opts] .duelopt').length,
    tgt: document.querySelector('#gstage [data-q]')?.getAttribute('data-target') || '',
  }))
  t.ok(duel.opts === 2 && !!duel.tgt, '对决：镜像对决强制二选一同屏', JSON.stringify(duel))
  await app.closePage(page)
}

t.pageErrors(app.errors, 'coexist 全程')
await app.close()
process.exit(t.finish())
