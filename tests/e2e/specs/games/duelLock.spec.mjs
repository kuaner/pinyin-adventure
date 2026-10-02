/* specs/games/duelLock —— 镜像对决单答锁（Bug#42 回归门）：
   病灶：答对仅 320ms 即换题+选项网格位不变——连点（double/triple-tap）后续点漏进下一题被误判
   （"我点对的它判我错"），绿/红双钮反馈同屏又被读成"两个都被点中"。修法=inputLock 输入闸
   （单答锁+切题宽假期 320ms+动画期锁）。
   本 spec=真实触摸连答 10 题（对错交替），逐题断言：
     ①零双中——宽假期内的连点余波被忽略（真答前反馈态必须为空；修复前此处必红）
     ②判分与所点逐题一致——点 qkey 必判对（绳右移），点干扰项必判错（绳左移）
     ③账本判分注册总数=10（恰好每题一记，零幻影注册）
   修 bug 先写失败测试（tests/README.md 规矩①）——若输入闸回退，本 spec 红灯。
   迁移自：regression-bug42-duel-single-answer。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally, sleep } from '../../flows/assert.mjs'
import { enterGame } from '../../flows/playGame.mjs'
import { waitDuelNextQ } from '../../flows/answerQuiz.mjs'

const t = new Tally('games/duelLock 镜像对决单答锁（连答10题）')
const app = new BootApp()

const page = await app.newPage({ tier: 'mid', mute: false })
await enterGame(page, 'duel')

const knotLeft = () => page.evaluate(() => parseFloat(document.querySelector('[data-rope]')?.style.left) || 0)
const qInfo = () => page.evaluate(() => {
  const bs = Array.from(document.querySelectorAll('[data-opts] .duelopt'))
  return {
    target: document.querySelector('[data-q]')?.getAttribute('data-target'),
    qkeyIdx: bs.findIndex((b) => (b.getAttribute('data-qkey') || '') !== ''),
    st: bs.map((b) => ({ letter: b.getAttribute('data-letter'), qkey: (b.getAttribute('data-qkey') || '') !== '', c: b.classList.contains('correct'), w: b.classList.contains('wrong') })),
  }
})

let leakCaught = 0
let pendingInstall = null   /* 下一题的装题 promise：真答前预挂，绝不与换题竞速 */
for (let i = 0; i < 10; i++) {
  let target = null
  if (i === 0) {
    await page.waitForFunction(() => !!document.querySelector('[data-q]')?.getAttribute('data-target'), null, { timeout: 9000 })
    target = await page.evaluate(() => document.querySelector('[data-q]')?.getAttribute('data-target'))
  } else {
    const okQ = await pendingInstall
    pendingInstall = null
    if (!okQ) { t.ok(false, `Q${i + 1} 装题超时（判分未触发换题或对局已结束）`); break }
    target = await page.evaluate(() => document.querySelector('[data-q]')?.getAttribute('data-target'))
  }
  if (await page.evaluate(() => !!document.querySelector('#gresult'))) { t.ok(false, `第 ${i + 1} 题对局提前结束（pos 漂移出界）`); break }

  /* ① 连点余波探针（i>0）：页内 setTimeout 精确装题+150ms 派发 pointerdown → 宽假期必须忽略。
     （合成事件只用于这把"定时枪"；判分路径全部真实 CDP 触摸） */
  if (i > 0) {
    await page.evaluate(() => setTimeout(() => {
      const b = document.querySelectorAll('[data-opts] .duelopt')[0]
      b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId: 1 }))
    }, 150))
  }

  /* ② 预挂下一题 watcher（此刻 < 真答，下一题换题在真答+320ms——绝对先挂） */
  pendingInstall = waitDuelNextQ(page)

  /* ③ 真实作答（装题后 ≥650ms，宽假期 320ms 早已开门）：
     偶数题点 qkey（必判对），奇数题点干扰项（必判错） */
  await sleep(300)
  const pre = await qInfo()
  if (pre.st.some((b) => b.c || b.w)) leakCaught++   /* 定时枪漏进本题判分=双中复发 */
  const wantRight = i % 2 === 0
  const pick = wantRight ? pre.qkeyIdx : 1 - pre.qkeyIdx
  const before = await knotLeft()
  await sleep(200)
  /* P1-2 谜面门：谜面播完前作答被守卫拒绝——重试至本题判分生效（≤4.5s 兜底开） */
  for (let r = 0; r < 15; r++) {
    await page.tap(`[data-opts] .duelopt >> nth=${pick}`)
    await sleep(300)
    const mid = await qInfo()
    if (mid.st.some((b) => b.c || b.w)) break
  }
  const post = await qInfo()
  const left = await knotLeft()
  const qkey = post.st[pre.qkeyIdx], other = post.st[1 - pre.qkeyIdx]
  if (wantRight) {
    t.ok(qkey.c && !qkey.w, `Q${i + 1} 点对必判对（qkey→correct）`, `target=${target} tap=${post.st[pick].letter}`)
    t.ok(!other.c && !other.w, `Q${i + 1} 另一钮保持中性（答对不刷红="两个都被点中"观感根除）`)
    t.ok(left > before, `Q${i + 1} 绳向敌方推进`, `${before.toFixed(1)}→${left.toFixed(1)}`)
  } else {
    t.ok(other.w && !other.c, `Q${i + 1} 点干扰项判错（判分与所点一致）`, `target=${target} tap=${other.letter}`)
    t.ok(qkey.c && !qkey.w, `Q${i + 1} 正确侧高亮（零错误信息反馈保持）`)
    t.ok(left < before, `Q${i + 1} 绳被拉回`, `${before.toFixed(1)}→${left.toFixed(1)}`)
  }
}
t.ok(leakCaught === 0, '宽假期连点余波全程被忽略（换题瞬间零判分）', `异常刷入=${leakCaught}`)

/* ③ 账本层总数断言：恰好 10 次判分注册（零幻影注册） */
const ledger = await page.evaluate(() => {
  const g = JSON.parse(localStorage.getItem('pinyin_game_v1') || '{}')
  return Object.values(g.letters || {}).reduce((s, r) => s + (r.ok || 0) + (r.err || 0), 0)
})
t.ok(ledger === 10, '账本判分注册总数=10（真实作答数，零多记零漏记）', `total=${ledger}`)
if (pendingInstall) pendingInstall.catch(() => {})   /* 收尾弃置未消费的装题 watcher */

t.pageErrors(app.errors, 'duelLock 全程')
await app.closePage(page)
await app.close()
process.exit(t.finish())
