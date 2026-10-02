/* specs/games/balloonField —— 气球场上界+密度/叠压（P1-11，挑刺报告 2026-10-03）：
   ① 气球不得飘进提示卡后方（场上界在提示卡之下：活球元素顶 ≥ sky 顶缘，到线即淡出退场）
   ② 同屏密度上限 6 + 活球零叠压（双轴重叠才算遮挡——同轴异高不叠）
   采样断言：8 秒窗口每 250ms 抽全场几何。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { enterGame } from '../../flows/playGame.mjs'

const t = new Tally('games/balloonField 气球场上界+密度叠压')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await enterGame(page, 'balloon')
  const sample = await page.evaluate(() => new Promise((resolve) => {
    const shots = []
    const t0 = performance.now()
    const iv = setInterval(() => {
      const sky = document.querySelector('#gstage .sky')
      /* 活球口径：排除 popped/wrong/leaving（退场动画期残留在 DOM，不计密度/叠压） */
      const bs = [...document.querySelectorAll('#gstage .balloon')]
        .filter((b) => !b.classList.contains('popped') && !b.classList.contains('wrong') && !b.classList.contains('leaving'))
      const sr = sky.getBoundingClientRect()
      const rs = bs.map((b) => b.getBoundingClientRect())
      let overlap = 0
      for (let i = 0; i < rs.length; i++) {
        for (let j = i + 1; j < rs.length; j++) {
          /* 遮挡口径=双轴重叠：水平球心距 < 球宽(64px) 且垂直中心距 < 球高(84px) */
          if (Math.abs(rs[i].x - rs[j].x) < 60 && Math.abs((rs[i].y + rs[i].height / 2) - (rs[j].y + rs[j].height / 2)) < 80) overlap++
        }
      }
      shots.push({
        n: bs.length,
        above: rs.filter((r) => r.top < sr.top + 1).length,
        overlap,
      })
      if (performance.now() - t0 > 8000) { clearInterval(iv); resolve(shots) }
    }, 250)
  }))
  const maxN = Math.max(...sample.map((s) => s.n))
  const anyAbove = sample.some((s) => s.above > 0)
  const overlaps = sample.reduce((a, s) => a + s.overlap, 0)
  t.ok(maxN <= 6, 'P1-11：同屏密度上限（活球 ≤6）', `max=${maxN}`)
  t.ok(!anyAbove, 'P1-11：场上界在提示卡之下（活球零只越过 sky 顶缘钻进提示卡）', `above=${sample.map((s) => s.above).join(',')}`)
  t.ok(overlaps === 0, 'P1-11：活球零叠压（双轴重叠=字母被盖；同轴异高不算）', `overlaps=${overlaps}`)
  t.pageErrors(app.errors, 'balloonField')
  await app.closePage(page)
}

await app.close()
process.exit(t.finish())
