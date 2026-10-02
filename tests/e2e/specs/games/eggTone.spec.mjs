/* specs/games/eggTone —— 🥚拼音蛋合并 + 🎵声调音乐会（含 Bug#40 网格几何回归门）：
   蛋：开局自动播拼读合成音（hyp 音节文件+网络请求）→ 拼对 3 题（计分/连击）→ 拼错晃动清连击+账本
      → 小鸡破壳 + 两行网格几何硬断言（块 ≤4+4/≥56px 见方/字模 ≥30px/间距 ≥10px/无重叠/中心距）
   音乐会：自动播带调音节 → 目标音先于音符（300ms 闸门）→ 接住 3 音（计分/连击）→ 接错清连击
      → 换目标自动播 → 条目账本 items ok 记账
   迁移自：v43-accept ①② + regression-bug40-egg-grid。断言只写本文件。 */
import fs from 'node:fs'
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { enterGame, enterGameDeep, playEggRound, catchTargetNote, readHud, audioNames, audioFirst, waitDom, tapMoving } from '../../flows/playGame.mjs'
import { ledgerOf } from '../../flows/seedState.mjs'

const t = new Tally('games/eggTone 拼音蛋+声调音乐会')
const app = new BootApp()

/* ① 蛋：音频链 + 拼对/拼错 + 条目账本 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await enterGame(page, 'egg')
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  const tgt = await page.evaluate(() => ({
    syl: document.querySelector('[data-prompt]').getAttribute('data-target'),
    file: document.querySelector('[data-prompt]').getAttribute('data-afile'),
  }))
  const a = await audioFirst(page, tgt.file)
  t.ok(!!tgt.syl && !!tgt.file && !!a, '开局自动播拼读合成音（hyp 音节文件）', `syl=${tgt.syl} file=${tgt.file}`)
  const netReq = await page.evaluate((f) => performance.getEntriesByType('resource').some((r) => r.name.includes('audio/hyp/' + f + '.mp3')), tgt.file)
  t.ok(netReq, '拼读音频网络请求已发生', `audio/hyp/${tgt.file}.mp3`)
  const halvesReady = await waitDom(page, 'hhalf')
  const h0 = await page.evaluate(() => window.__DOM_LOG.filter((e) => e.kind === 'hhalf')[0] || null)
  t.ok(halvesReady && !!a && !!h0 && a.t < h0.t, '时序：目标音先于蛋半出现（声音先行）', `audio=${a && Math.round(a.t)} < half=${h0 && Math.round(h0.t)}`)

  await playEggRound(page)
  let hud = await readHud(page)
  t.ok(hud.score === '10' && hud.combo === '1', '拼对#1：合并得分 10+连击 1', JSON.stringify(hud))

  /* 拼错：点干扰声母半 → 清连击+账本 err */
  await page.waitForFunction(() => {
    const root = document.getElementById('v-egg')
    return root && root.getAttribute('data-stage') === 'pick' && document.querySelector('#gstage [data-halves][data-ready="1"]')
  }, null, { timeout: 8000 })
  const wrongKey = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('#gstage [data-kind="ini"]')).find((b) => b.getAttribute('data-key') !== document.querySelector('[data-prompt]').getAttribute('data-ini'))
    return el ? el.getAttribute('data-key') : ''
  })
  await page.tap(`#gstage [data-kind="ini"][data-key="${wrongKey}"]`)
  await page.waitForTimeout(350)
  hud = await readHud(page)
  t.ok(hud.combo === '0' && hud.score === '10', '拼错：蛋晃动不合+清连击（得分不变）', `wrong=${wrongKey} ` + JSON.stringify(hud))
  const errRec = (await ledgerOf(page)).letters[wrongKey]
  t.ok(!!errRec && errRec.err > 0, '拼错：错误账本记 err（干扰字母）', JSON.stringify(errRec))

  await playEggRound(page)
  hud = await readHud(page)
  t.ok(hud.score === '20' && hud.combo === '1', '拼对#2：得分 20+连击回 1', JSON.stringify(hud))
  await playEggRound(page)
  hud = await readHud(page)
  t.ok(hud.score === '30' && hud.combo === '2', '拼对#3：得分 30+连击 2', JSON.stringify(hud))
  await app.closePage(page)
}

/* ② 音乐会：时序 + 接住 3 音 + 接错清连击 + 条目账本 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await enterGame(page, 'tone')
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  const tgtFile = await page.getAttribute('[data-prompt]', 'data-target')
  const a = await audioFirst(page, tgtFile)
  t.ok(!!tgtFile && !!a, '开局自动播带调音节（四声真人库）', `target=${tgtFile}`)
  const noteReady = await waitDom(page, 'tnote')
  const n0 = await page.evaluate(() => window.__DOM_LOG.filter((e) => e.kind === 'tnote')[0] || null)
  t.ok(noteReady && !!a && !!n0 && a.t < n0.t, '时序：目标音先于音符出现', `audio=${a && Math.round(a.t)} < note=${n0 && Math.round(n0.t)}`)
  t.ok(noteReady && !!a && !!n0 && n0.t - a.t >= 250, '时序：音符入场在 300ms 闸门后', `gap=${n0 && a && Math.round(n0.t - a.t)}ms`)

  await catchTargetNote(page)
  let hud = await readHud(page)
  t.ok(hud.score === '10' && hud.combo === '1', '接住#1：得分 10+连击 1', JSON.stringify(hud))
  await catchTargetNote(page)
  hud = await readHud(page)
  t.ok(hud.score === '20' && hud.combo === '2', '接住#2：得分 20+连击 2', JSON.stringify(hud))

  /* 接错：点干扰音符 → 清连击 */
  const cur = await page.getAttribute('[data-prompt]', 'data-target')
  const hasWrong = await page.waitForSelector(`#gstage .tnote:not(.caught):not(.wrong):not([data-file="${cur}"])`, { timeout: 9000 }).then(() => true).catch(() => false)
  if (hasWrong) {
    const wrongFile = await page.evaluate((c) => document.querySelector(`#gstage .tnote:not(.caught):not(.wrong)[data-file]:not([data-file="${c}"])`).getAttribute('data-file'), cur)
    const { waitVisible } = await import('../../flows/playGame.mjs')
    await waitVisible(page, `#gstage .tnote:not(.caught):not(.wrong)[data-file="${wrongFile}"]`, '.hall')
    await tapMoving(page, `#gstage .tnote:not(.caught):not(.wrong)[data-file="${wrongFile}"]`)
    await page.waitForTimeout(400)
    hud = await readHud(page)
    t.ok(hud.combo === '0' && hud.score === '20', '接错：清连击（得分不变）', `wrong=${wrongFile} ` + JSON.stringify(hud))
  } else {
    t.ok(false, '接错：清连击', '干扰音符未在窗口内出现')
  }
  const grew = await page.waitForFunction(() => window.__AUDIO_LOG.length >= 3, null, { timeout: 8000 }).then(() => true).catch(() => false)
  t.ok(grew, '换目标：新目标音自动播', `audioEvents=${await page.evaluate(() => window.__AUDIO_LOG.length)}`)
  await catchTargetNote(page)
  hud = await readHud(page)
  t.ok(hud.score === '30' && hud.combo === '1', '接住#3：得分 30+连击 1', JSON.stringify(hud))
  const led = await ledgerOf(page)
  t.ok(Object.keys(led.items || {}).length > 0 && Object.values(led.items).some((r) => r.ok > 0), '条目账本：接对音节 ok 记账', JSON.stringify(led.items).slice(0, 90))
  await app.closePage(page)
}

/* ③ 蛋网格几何（Bug#40 回归门，390 窄屏 3 轮硬断言） */
{
  const page = await app.newPage({ tier: 'mid', learn: { u: 8, stars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 }, best: {}, step: {} } })
  await enterGameDeep(page, 'egg', 'play')
  await page.waitForSelector('#gstage [data-half]', { timeout: 8000 })
  await page.waitForTimeout(400)
  for (let round = 0; round < 3; round++) {
    const geo = await page.evaluate(() => {
      const halves = [...document.querySelectorAll('#gstage [data-half]')]
      const rs = halves.map((b) => {
        const r = b.getBoundingClientRect()
        return { k: b.getAttribute('data-key'), kind: b.getAttribute('data-kind'), x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }
      })
      const rows = [...document.querySelectorAll('#gstage .hrow')]
      const fontHk = getComputedStyle(document.querySelector('#gstage .hk')).fontSize
      const gaps = []
      for (const row of rows) {
        const bs = [...row.querySelectorAll('[data-half]')].map((b) => b.getBoundingClientRect()).sort((p, q) => p.x - q.x)
        for (let i = 1; i < bs.length; i++) gaps.push(+(bs[i].x - (bs[i - 1].x + bs[i - 1].width)).toFixed(1))
      }
      let overlap = false, minCenter = 1e9
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
        const p = rs[i], q = rs[j]
        if (p.x < q.x + q.w - 0.5 && q.x < p.x + p.w - 0.5 && p.y < q.y + q.h - 0.5 && q.y < p.y + p.h - 0.5) overlap = true
        const d = Math.hypot(p.cx - q.cx, p.cy - q.cy)
        if (d < minCenter) minCenter = d
      }
      return { n: rs.length, ini: rs.filter((r) => r.kind === 'ini').length, fin: rs.filter((r) => r.kind === 'fin').length,
        minW: Math.min(...rs.map((r) => r.w)), minH: Math.min(...rs.map((r) => r.h)), fontHk,
        minGap: gaps.length ? Math.min(...gaps) : -1, overlap, minCenter: Math.round(minCenter), rows: rows.length }
    })
    const tag = `R${round + 1}`
    t.ok(geo.n <= 8 && geo.ini <= 4 && geo.fin <= 4, `${tag} 块数上限 ≤4+4（干扰截断，禁整池上屏）`, `ini=${geo.ini} fin=${geo.fin} total=${geo.n}`)
    t.ok(geo.minW >= 56 && geo.minH >= 56, `${tag} 每块 ≥56px 见方`, `min=${Math.round(geo.minW)}×${Math.round(geo.minH)}`)
    t.ok(parseFloat(geo.fontHk) >= 30, `${tag} 字模 ≥30px`, geo.fontHk)
    t.ok(geo.minGap >= 10, `${tag} 间距 ≥10px`, `minGap=${geo.minGap}`)
    t.ok(!geo.overlap, `${tag} 无重叠`)
    t.ok(geo.minCenter >= 8, `${tag} 可点区中心距 ≥8px`, `minCenter=${geo.minCenter}`)
    t.ok(geo.rows === 2, `${tag} 两行网格（声母/韵母各一档）`, `rows=${geo.rows}`)
    /* 玩过本轮进下一轮：点对触发合并动画链 */
    await page.evaluate(() => {
      const ini = document.querySelector('[data-prompt]').getAttribute('data-ini')
      const fin = document.querySelector('[data-prompt]').getAttribute('data-fin')
      for (const k of [ini, fin]) {
        const b = [...document.querySelectorAll('#gstage [data-half]')].find((e) => e.getAttribute('data-key') === k)
        b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      }
    })
    await page.waitForFunction(() => (document.querySelector('#v-egg')?.getAttribute('data-stage') || '') === 'chick', null, { timeout: 6000 }).catch(() => {})
    await page.waitForSelector('#gstage [data-half]', { timeout: 9000 })
    await page.waitForTimeout(450)
  }
  await app.closePage(page)
}

t.pageErrors(app.errors, 'eggTone 全程')
await app.close()
process.exit(t.finish())
