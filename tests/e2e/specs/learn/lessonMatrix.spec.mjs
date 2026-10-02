/* specs/learn/lessonMatrix —— 12 课×全步骤矩阵：
   ① 页数矩阵：全部 12 课 hspage 数 = 字母×(学一学+声调?) + 拼读? + 小测（L1=7 / L3=10 / L7=12 / L12=24，
      L12 无调字母单页——6 声调行按 base 精确匹配）
   ② 步数（chip 单元）矩阵：纯韵母课 4 步（L1/L2=字母+小测）、hasBlend 课 字母+拼读+小测（L5 3字母课=5 步、
      L12=18 步）——fixtures lessonStructure 与 src/lib/lessonUnits 同式推导对拍
   ③ 全步骤走查（L1）：每字母 学一学参与证据（旗A 读音点播）→ 声调页（旗B 3 声调点读）→ 读完了 →
      自动推进下一字母 → chip ✓（证据制）
   ④ chip 第 4/5 个跳转零祖先左移（BUGS#30 根治面）+ chip 条横滑只滚 chip 条不翻页
   迁移自：v30-accept（A1-A5/A3 段）+ v31 页数复核。断言只写本文件。 */
import fs from 'node:fs'
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { openLesson, lessonState, swipeLeft, curScope, flagRead, flagTones, finishToneDrill, tapChip } from '../../flows/gotoLesson.mjs'
import { lessonStructure } from '../../../fixtures/seeds.mjs'

const t = new Tally('learn/lessonMatrix 12课×全步骤矩阵')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'
const STRUCT = lessonStructure(JSON.parse(fs.readFileSync('src/data/lessons.json', 'utf8')))

/* ① ② 页数/步数矩阵：全部 12 课 */
{
  const page = await app.newPage({ tier: 'mid' })
  for (let n = 1; n <= 12; n++) {
    await openLesson(page, n)
    const s = await lessonState(page)
    const exp = STRUCT[n]
    t.ok(s.npages === exp.pages, `L${n} 页数=${exp.pages}（${exp.letters}字母+${exp.tonePages}调+${exp.hasBlend ? '拼读+' : ''}小测）`, `实得 ${s.npages}`)
    t.ok(s.nchips === exp.units, `L${n} 步数=${exp.units}（chip 单元=字母+${exp.hasBlend ? '拼读+' : ''}小测）`, `实得 ${s.nchips}`)
  }
  t.ok(STRUCT[1].units === 4, '纯韵母课 4 步（L1：a o e + 小测）')
  t.ok(STRUCT[5].units === 5 && STRUCT[5].hasBlend, 'hasBlend 课 5 步（L5：g k h + 拼读 + 小测）')
  t.ok(STRUCT[12].units === 18 && STRUCT[12].tonePages === 6, 'L12 整体认读 18 步（16 字母+拼读+小测，6 声调行 base 匹配）')
  await app.closePage(page)
}

/* ③ 全步骤走查（L1 新生档）：证据制参与 → 声调推进 → chip ✓ */
{
  const page = await app.newPage({ tier: 'newbie' })
  await openLesson(page, 1)
  let s = await lessonState(page)
  t.ok(s.npages === 7 && s.transform === 0 && s.chipOn === 'a', 'L1 初始=字母a合并页（7 页）', `chip=${s.chipOn}`)
  for (const li of [0, 1, 2]) {   /* a / o / e 全步骤 */
    let sc = await curScope(page)
    await flagRead(page, sc)      /* 旗A：读音点播 */
    await swipeLeft(page)         /* → 声调页 */
    sc = await curScope(page)
    await flagTones(page, sc, 3)  /* 旗B：3 声调点读 */
    await finishToneDrill(page, sc)   /* 听调小练 4 题走通 → 读完了 → 自动推进 */
    if (li === 0) {
      s = await lessonState(page)
      t.ok(s.chipDone.includes('a'), 'a 集齐两旗 → 跨出即 chip ✓（证据制）', `done=${JSON.stringify(s.chipDone)}`)
    }
  }
  s = await lessonState(page)
  t.ok(JSON.stringify(s.chipDone) === JSON.stringify(['a', 'o', 'e']), '三字母全走完 chip 全 ✓', `done=${JSON.stringify(s.chipDone)}`)
  t.ok(!await page.$('[data-gate]'), '旗齐进小测不拦截（放行态）')
  await app.closePage(page)
}

/* ④ L7 chip 第 4/5 个跳转零祖先左移 + chip 条横滑不翻页（BUGS#30 面） */
{
  const page = await app.newPage({ tier: 'mid' })
  await openLesson(page, 7)
  let s = await lessonState(page)
  t.ok(s.chipOn === 'z', 'L7 初始=字母z', `chip=${s.chipOn}`)
  await tapChip(page, 'y')
  s = await lessonState(page)
  t.ok(s.secLeft === 0 && s.rootLeft === 0, '点第4个chip(y) 零祖先左移', `sec=${s.secLeft} root=${s.rootLeft}`)
  t.ok(s.transform === Math.round(-358 * 6) && s.chipOn === 'y', 'y 合并页 transform 落位', `=${s.transform}`)
  await tapChip(page, 'w')
  s = await lessonState(page)
  t.ok(s.secLeft === 0 && s.rootLeft === 0, '点第5个chip(w) 零祖先左移')
  t.ok(s.transform === Math.round(-358 * 8), 'w 合并页 transform 落位', `=${s.transform}`)
  /* chip 条横滑：只滚 chip 条不翻页 */
  const cdp = await page.context().newCDPSession(page)
  const cb = await page.locator('[data-lchips]').boundingBox()
  const tx = (type, px, py) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py }] })
  await tx('touchStart', cb.x + cb.width - 20, cb.y + cb.height / 2)
  for (let i = 1; i <= 6; i++) await tx('touchMove', cb.x + cb.width - 20 - i * 12, cb.y + cb.height / 2)
  await tx('touchEnd', cb.x + cb.width - 92, cb.y + cb.height / 2)
  await page.waitForTimeout(550)
  s = await lessonState(page)
  t.ok(s.transform === Math.round(-358 * 8), 'chip条横滑只滚条不翻页', `transform=${s.transform}`)
  await app.closePage(page)
}

await app.close()
process.exit(t.finish())
