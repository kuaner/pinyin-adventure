/* answerQuiz flow：各题面的作答操作——只写一次。
   两段式适用矩阵（2026-10-02 立法）在这里固化：
   - 字母选项题（listen/blisten/bkj/听写/对决）= 一点即答（tapOnce）
   - 带调拼音/拆分/声调题（zi/look/blend/tone/学习岛小测/ToneDrill）= 首点试听+再点作答（tapTwoPhase）
   作答一律先读 __PJ/ DOM data-* 再点——specs 传语义（对/错），这里管操作。 */
import { sleep } from './assert.mjs'

/* 闯关/会话题（QZ）：读 ans → 点选项。矩阵 listen=一点即答；look/zi/tone=两段式（自动适配题型） */
export async function answerQZ(page, { correct = true, q = null } = {}) {
  const info = await page.evaluate(() => {
    const Q = window.__PJ.Q()
    return { ans: Q.q.ans, type: Q.q.type, n: document.querySelectorAll('#optbox .opt').length }
  })
  const idx = correct ? info.ans : (info.ans + 1) % info.n
  const twoPhase = info.type !== 'listen'
  await sleep(520)   /* P1-2 进题宽限（立法：进题首击忽略）——首击在宽限后 */
  await page.evaluate(([i, tp]) => {
    const el = document.querySelectorAll('#optbox .opt')[i]
    el?.click()
    /* P1-3 确认间隔 ≥400ms */
    if (tp) setTimeout(() => document.querySelectorAll('#optbox .opt')[i]?.click(), 470)
  }, [idx, twoPhase])
  await sleep(twoPhase ? 1000 : 350)
  return { idx, type: info.type, twoPhase }
}

/* 学习岛课内小测（qbody qkey 门）：确定性答对（data-qkey=答案键）；兜底首项 */
export async function answerLessonQuiz(page, { correct = true } = {}) {
  const info = await page.evaluate(() => {
    const body = document.querySelector('#v-lesson .qbody')
    if (!body) return null
    const ans = body.getAttribute('data-qkey')
    const opts = Array.from(document.querySelectorAll('#v-lesson [data-opts] .opt'))
    const hit = opts.findIndex((e) => e.getAttribute('data-qkey') === ans)
    return { hit, n: opts.length }
  })
  if (!info) return null
  const idx = correct ? (info.hit >= 0 ? info.hit : 0) : (info.hit >= 0 ? (info.hit + 1) % info.n : 1)
  const isLook = await page.$('#v-lesson .optear')   /* look 题=两段式；listen/tone 首选即答 */
  await sleep(520)   /* P1-2 进题宽限 */
  await page.evaluate((i) => {
    const el = document.querySelectorAll('#v-lesson [data-opts] .opt')[i]
    el?.click()
    /* P1-3 确认间隔立法 ≥400ms：第二击 470ms（380 会被守卫正确拒绝——曾致隔题才落一答） */
    setTimeout(() => el?.click(), 470)
  }, idx)
  await sleep(isLook ? 1000 : 800)
  return idx
}

/* 每日挑战：arm/answer 两段矩阵由 store 层管（字母题一点即答、zi 两段式）——这里给语义作答 */
export async function answerDaily(page, { correct = true, twoPhaseOverride = null } = {}) {
  const st = await page.evaluate(() => {
    const D = window.__PJ.DC()
    if (D.done || D.reveal) return null
    const q = D.qs[D.i]
    return { ans: q.ans, type: q.type, n: q.opts.length, i: D.i }
  })
  if (!st) return null
  const idx = correct ? st.ans : (st.ans + 1) % st.n
  const twoPhase = twoPhaseOverride !== null ? twoPhaseOverride : st.type === 'zi'
  await sleep(520)   /* P1-2 进题宽限 */
  await page.tap(`#v-daily [data-opts] .opt:nth-of-type(${idx + 1})`)
  if (twoPhase) { await sleep(470); await page.tap(`#v-daily [data-opts] .opt:nth-of-type(${idx + 1})`) }
  await sleep(twoPhase ? 450 : 300)
  return { idx, type: st.type, i: st.i }
}

/* 推进每日挑战直到指定题型就位（答对推进=零扰动；zi 除外——答对 zi 走两段式） */
export async function advanceDailyToType(page, want, maxTries = 11) {
  let qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype').catch(() => null)
  let tries = 0
  while (qt !== want && tries++ < maxTries) {
    if (qt === null) return null
    await answerDaily(page, { correct: true })
    await sleep(1000)
    qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype').catch(() => null)
  }
  return qt
}

/* 听写专练：一点即答（字母选项矩阵） */
export async function answerLdrill(page, { correct = true } = {}) {
  const t = await page.evaluate(() => document.querySelector('#v-ldrill [data-q]')?.getAttribute('data-target'))
  const ks = await page.evaluate(() => Array.from(document.querySelectorAll('#v-ldrill [data-opts] .opt')).map((e) => e.getAttribute('data-opt')))
  const hit = ks.indexOf(t)
  const idx = correct ? hit : (hit + 1) % ks.length
  await sleep(520)   /* P1-2 进题宽限 */
  await page.tap(`#v-ldrill [data-opts] .opt:nth-of-type(${idx + 1})`)
  await sleep(470)
  return { target: t, idx }
}

/* 闪电刷题：一点即答 */
export async function answerBolt(page, { correct = true } = {}) {
  await sleep(320)   /* P1-2 守卫：闪电短窗（300ms）后的合法一击 */
  const q = await page.evaluate(() => { const b = window.__PJ.BT(); return { ans: b.q.ans, n: document.querySelectorAll('#bopt .opt').length } })
  const idx = correct ? q.ans : (q.ans + 1) % q.n
  await page.evaluate((i) => document.querySelectorAll('#bopt .opt')[i]?.click(), idx)
  await sleep(470)
  return idx
}

/* 识字表（zi 两段式）：首点试听 → 再点同项作答 */
export async function answerZi(page, { correct = true, twoPhase = true } = {}) {
  const q = await page.evaluate(() => {
    const z = window.__PJ.ziQ()
    return { ans: z.ans, n: document.querySelectorAll('#v-zihall [data-opt]').length }
  })
  const idx = correct ? q.ans : (q.ans + 1) % q.n
  await sleep(520)   /* P1-2 进题宽限 */
  await page.tap(`#v-zihall [data-opts] .opt:nth-of-type(${idx + 1})`)
  if (twoPhase) { await sleep(470); await page.tap(`#v-zihall [data-opts] .opt:nth-of-type(${idx + 1})`) }
  await sleep(twoPhase ? 450 : 300)
  return idx
}

/* 拼读专练（两段式） */
export async function answerBlend(page, { correct = true } = {}) {
  const st = await page.evaluate(() => ({
    ans: +document.querySelector('#v-bquiz [data-q]').getAttribute('data-ans'),
    n: document.querySelectorAll('#v-bquiz [data-opt]').length,
  }))
  const idx = correct ? st.ans : (st.ans + 1) % st.n
  await sleep(520)   /* P1-2 进题宽限 */
  await page.tap(`#v-bquiz [data-opt][data-idx="${idx}"]`)
  await sleep(470)
  await page.tap(`#v-bquiz [data-opt][data-idx="${idx}"]`)
  await sleep(700)
  return idx
}

/* 声调专练（两段式，toneopt 1-4） */
export async function answerToneQuiz(page, { correct = true } = {}) {
  const st = await page.evaluate(() => ({
    ans: +document.querySelector('#v-tquiz [data-q]').getAttribute('data-ans'),
    n: document.querySelectorAll('#v-tquiz [data-toneopt]').length,
  }))
  const idx = correct ? st.ans : (st.ans + 1) % st.n
  await sleep(520)   /* P1-2 进题宽限 */
  await page.tap(`#v-tquiz [data-toneopt="${idx + 1}"]`)
  await sleep(470)
  await page.tap(`#v-tquiz [data-toneopt="${idx + 1}"]`)
  await sleep(700)
  return idx
}

/* 镜像对决：读 data-q / duelopt，等宽假期（320ms）开门后答 */
export async function answerDuel(page, { correct = true } = {}) {
  const info = await page.evaluate(() => {
    const bs = Array.from(document.querySelectorAll('[data-opts] .duelopt'))
    const qkeyIdx = bs.findIndex((b) => (b.getAttribute('data-qkey') || '') !== '')
    return { qkeyIdx, target: document.querySelector('[data-q]')?.getAttribute('data-target') }
  })
  const pick = correct ? info.qkeyIdx : 1 - info.qkeyIdx
  /* P1-2 谜面门：谜面播完前作答无效（点击被守卫拒绝）——重试至计分生效（≤4.2s 兜底开） */
  const s0 = await page.evaluate(() => window.__PJ.GS().score)
  for (let i = 0; i < 14; i++) {
    await page.tap(`[data-opts] .duelopt >> nth=${pick}`)
    await sleep(300)
    const s1 = await page.evaluate(() => ({ score: window.__PJ.GS().score, reveal: !!document.querySelector('.duelopt.correct, .duelopt.wrong') }))
    if (s1.reveal || s1.score > s0) break
  }
  await sleep(200)
  return { pick, ...info }
}

/* 等待下一题装好（对决：音频计数增长=换题必变信号） */
export const waitDuelNextQ = (page, timeout = 9000) =>
  page.evaluate((to) => new Promise((resolve) => {
    const n0 = window.__AUDIO_LOG.length
    const tid = setInterval(() => {
      if (window.__AUDIO_LOG.length > n0) { clearInterval(tid); resolve(true) }
    }, 25)
    setTimeout(() => { clearInterval(tid); resolve(false) }, to)
  }), timeout)

/* 识字表选字开练（网格点解锁字） */
export async function ziStart(page, nth = 1) {
  await page.evaluate((n) => {
    const cells = Array.from(document.querySelectorAll('#v-zihall .zcell[data-locked="0"]'))
    cells[(n - 1) % cells.length]?.click()
  }, nth)
  await page.waitForSelector('#v-zihall [data-q]', { timeout: 6000 })
}
