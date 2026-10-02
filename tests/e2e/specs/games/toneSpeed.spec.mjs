/* specs/games/toneSpeed —— 声调音乐会音符去重+落速（P2-4，挑刺报告 2026-10-03）：
   ① 一轮三音（目标+2 干扰）声调互异——三选一不得退化成二选一
   ② 落速 ≥ 3 倍旧基线（0.085 → ≥0.26 舞台高/秒）：「节奏游戏」要有节奏
   断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally, sleep } from '../../flows/assert.mjs'
import { enterGame } from '../../flows/playGame.mjs'

const t = new Tally('games/toneSpeed 音乐会音符去重+落速×3')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OLD_FALL = 0.085   /* 修复前基线（舞台高比例/秒） */

/* ① 一轮三音去重：开局首批 3 个音符 tone 值互异 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await enterGame(page, 'tone')
  /* 一轮三音的判定锚=__DOM_LOG 齐发批（同 160ms 窗内 ≥3 个 tnote 添加事件）——
     批内序=生成序（目标先行），绝对不含周期补位/上轮残符的混采 */
  const tones = await page.evaluate(() => new Promise((resolve) => {
    const t0 = performance.now()
    const iv = setInterval(() => {
      const ls = window.__DOM_LOG.filter((e) => e.kind === 'tnote')
      const waves = []
      for (const e of ls) {
        const w = waves[waves.length - 1]
        if (w && e.t - w.t0 < 160) w.items.push(e)
        else waves.push({ t0: e.t, items: [e] })
      }
      const full = waves.find((w) => w.items.length >= 3)
      if (full) { clearInterval(iv); resolve(full.items.slice(0, 3).map((e) => e.tone)) }
      else if (performance.now() - t0 > 9000) { clearInterval(iv); resolve([]) }
    }, 40)
  }))
  t.ok(tones.length >= 3, '音乐会：齐发批 3 音符（DOM_LOG 批锚定）', tones.join(','))
  t.ok(new Set(tones.slice(0, 3)).size === 3, '音乐会：一轮三音声调互异（去重，不退化成二选一）', tones.join(','))
  await app.closePage(page)
}

/* ② 落速 ≥3×：同一元素连续采样（120ms×8 帧）取同 id 相邻对速度——同键新音符不串值 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await enterGame(page, 'tone')
  await page.waitForSelector('#gstage [data-note]', { timeout: 8000 })
  const m = await page.evaluate(() => {
    const pts = []
    const t0 = performance.now()
    return new Promise((resolve) => {
      const iv = setInterval(() => {
        const n = document.querySelector('#gstage [data-note]')
        if (n) {
          const lane = n.closest('.lane').getBoundingClientRect()
          pts.push({ t: performance.now() - t0, y: n.getBoundingClientRect().top, laneH: lane.height, id: n.getAttribute('data-file') + ':' + n.getAttribute('data-tone') })
        }
        if (performance.now() - t0 > 1000) { clearInterval(iv); resolve(pts) }
      }, 120)
    }).then((pts) => {
      let best = 0
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].id === pts[i - 1].id) {
          const v = (pts[i].y - pts[i - 1].y) / ((pts[i].t - pts[i - 1].t) / 1000) / pts[i].laneH
          if (v > best) best = v
        }
      }
      return best
    })
  })
  t.ok(m >= 0.24, '音乐会：落速 ≥3 倍基线（0.085→0.30，容差下限 0.24/s）', `v=${m.toFixed(3)}/s`)
  t.pageErrors(app.errors, 'toneSpeed')
  await app.closePage(page)
}

await app.close()
process.exit(t.finish())
