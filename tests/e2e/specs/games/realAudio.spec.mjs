/* specs/games/realAudio —— v4.8.1 真音频事件链回归（CI 绿但真机死的盲区修复）：
   病灶（kuaner 2026-10-03 13:10 真机实报）：游戏点按卡死、目标音播了元素迟迟不出——
   v4.7 把「谜面播完门/探头/奖励推进」挂到 audio onended 主路；iOS Safari/PWA 缓存音频
   元素的 ended 有已知不可靠性（currentTime 未重置/复用元素不触发 ended）→ 事件链断裂，
   守卫永不开/元素永不出/点按全吞。旧 e2e 在 Chromium 里 ended 正常触发 → 测试盲区。
   两组用例：
   A 真音频零行为拦截（真 mp3 播放、真 ended 链）：六游戏 入场→元素≤窗→点按判定→下一轮
   B stalled-ended 故障注入（play 真常、ended 回调永不送达=iOS 故障模式）：元素出现/
     点按判定仍须在「音频时长+400ms 兜底」窗内完成——ended 只做加速，绝不做唯一闸门 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { enterGame, popTargetBalloon, whackTargetMole, catchTargetFish, catchTargetNote, playEggRound, pd } from '../../flows/playGame.mjs'

const t = new Tally('games/realAudio 真音频事件链（A 真播放 / B stalled-ended 注入）')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* iOS stalled-ended 故障注入：play() 真常（真 mp3 真播放），但 ended 回调永不送达——
   onended 属性赋值吞掉 + 'ended' 监听注册吞掉（app 侧 audio.ts 只用这两条路） */
const STALL_ENDED = () => {
  Object.defineProperty(HTMLMediaElement.prototype, 'onended', { set() {}, get() { return null }, configurable: true })
  const AE = HTMLMediaElement.prototype.addEventListener
  HTMLMediaElement.prototype.addEventListener = function (ty, ...rest) {
    if (ty === 'ended') return
    return AE.call(this, ty, ...rest)
  }
}

/* 元素选择器（出现断言=目标元素本体，超时=真机"卡死"的 e2e 影子） */
const SEL = {
  fish: '#gstage .fishwrap:not(.caught):not(.scare)',
  balloon: '#gstage .balloon:not(.popped):not(.wrong)',
  mole: '#gstage .mole.up',
  tone: '#gstage .tnote:not(.caught):not(.wrong)',
  egg: '#gstage [data-halves][data-ready="1"]',
  duel: '#gstage [data-q]',
}
/* 出现预算：A/B 通用。B 模式=修复后「时长+400ms 兜底」必须仍满足（地鼠谜面≤1.9s→兜底 2.5s；
   对决呼读≤1.3s→2.5s；其余本就是 play()+300ms 定时闸不受 ended 影响）。
   地鼠 3200 = 谜面真时长(≤1.9s)+首轮 500ms 延迟+冷启动音频管线余量；修复前 3.6s 死兜底仍 >3200=红 */
const APPEAR_MS = { fish: 2000, balloon: 2000, egg: 2200, tone: 2500, mole: 3200, duel: 2500 }
const GAMES = ['balloon', 'mole', 'duel', 'fish', 'egg', 'tone']

const within = (page, sel, ms) => page.waitForFunction((s) => !!document.querySelector(s), sel, { timeout: ms }).then(() => true).catch(() => false)
const scoreN = (page) => page.evaluate(() => +(document.querySelector('#gscore')?.textContent || 0))

/* 每游戏一步「打中当前目标」：返回是否成功 */
async function hitTarget(page, id) {
  if (id === 'balloon') return popTargetBalloon(page)
  if (id === 'mole') return whackTargetMole(page)
  if (id === 'fish') return catchTargetFish(page)
  if (id === 'tone') return catchTargetNote(page)
  if (id === 'egg') { try { await playEggRound(page); return true } catch { return false } }
  if (id === 'duel') {
    const ok = await page.evaluate(() => !!document.querySelector('#gstage .duelopt[data-qkey]:not([data-qkey=""])'))
    if (!ok) return false
    await pd(page, '#gstage .duelopt[data-qkey]:not([data-qkey=""])')
    await page.waitForTimeout(450)
    return true
  }
  return false
}

async function sweep(mode) {
  for (const id of GAMES) {
    const page = await app.newPage({ tier: 'mid', mute: false })
    if (mode === 'B') await page.addInitScript(STALL_ENDED)
    await enterGame(page, id)
    const label = `${mode}/${id}`

    /* ① 元素及时出现 */
    const ok = await within(page, SEL[id], APPEAR_MS[id])
    t.ok(ok, `${label} 目标元素 ${APPEAR_MS[id]}ms 内出现`)

    /* ② 点按即判定（分数落地）。对决/地鼠的作答门在 B 模式修复后 ≤时长+400ms 放行——
       统一先等 1.9s 再打（A 模式真 ended ~1.2s 早已开门；不掩盖 B 模式超时） */
    if (id === 'duel' || id === 'mole') await page.waitForTimeout(1900)
    /* 推进基线在动作前取（命中→换题音是动作的直接后件，动作后取基线会漏掉它） */
    const n0 = await page.evaluate(() => window.__AUDIO_LOG.length)
    let hit = await hitTarget(page, id)
    if (!hit) { await page.waitForTimeout(900); hit = await hitTarget(page, id) }   /* 移动实体/覆盖重试一轮 */
    const sc = hit ? await scoreN(page) : 0
    t.ok(hit && sc > 0, `${label} 点按判定落地（score=${sc}）`)

    /* ③ 下一轮推进（换题音再发） */
    if (hit) {
      const advanced = await page.waitForFunction((n) => window.__AUDIO_LOG.length > n, n0, { timeout: id === 'mole' ? 7000 : 5000 }).then(() => true).catch(() => false)
      t.ok(advanced, `${label} 下一轮推进（题音再发）`)
    }
    await app.closePage(page)
  }
}

await sweep('A')
await sweep('B')

/* 每日挑战真音频链（出题音→作答→推进；守卫=纯定时窗，两模式同窗） */
for (const mode of ['A', 'B']) {
  const page = await app.newPage({ tier: 'mid', mute: false })
  if (mode === 'B') await page.addInitScript(STALL_ENDED)
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  await page.tap('[data-daily]')
  await page.waitForSelector('#dqcard', { timeout: 8000 })
  const n0 = await page.evaluate(() => window.__AUDIO_LOG.length)
  t.ok(n0 > 0, `daily/${mode} 出题即读音（真音频）`)
  let answered = 0
  for (let i = 0; i < 10 && answered < 2; i++) {
    const qt = await page.evaluate(() => document.querySelector('#dqcard')?.getAttribute('data-qtype'))
    if (qt === 'zi') { /* 两段式面：跳过（本 spec 不测两段式） */ await answerAny(page); answered++; continue }
    const tgt = await page.evaluate(() => document.querySelector('#dqcard')?.getAttribute('data-target'))
    const tapped = await page.evaluate((k) => {
      const b = document.querySelector(`#dqcard .opt[data-letter="${k}"]`)
      if (!b) return false
      b.click()
      return true
    }, tgt)
    if (!tapped) break
    await page.waitForTimeout(1700)   /* reveal 750ms + 进题宽限 450ms + 余量 */
    answered++
    t.ok(await page.evaluate(() => !!document.querySelector('#dqcard')), `daily/${mode} 第${answered}题作答推进无卡死`)
  }
  t.ok(answered >= 2, `daily/${mode} 连答两题全程无卡死`)
  await app.closePage(page)
}

/* zi 题两段式作答（首点试听+470ms 后再点确认） */
async function answerAny(page) {
  await page.evaluate(() => document.querySelector('#dqcard .opt')?.click())
  await page.waitForTimeout(600)
  await page.evaluate(() => document.querySelector('#dqcard .opt')?.click())
  await page.waitForTimeout(1700)
}

t.pageErrors(app.errors, 'realAudio 全程')
await app.close()
process.exit(t.finish())
