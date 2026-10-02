/* specs/games/audioFirst —— 声音先行制（Bug#34 立法面）：
   四街机游戏 + 音乐会/蛋 出题音自动播先于元素出现（300ms 闸门），🔊=重听再发，
   反例=零操作零分零静默推进。谜面制（Bug#39）后地鼠段=谜面音频、对决=呼读或谜面、
   每日挑战听音题自动读音（zi 看字题不播=播了报答案）。
   迁移自：v41-accept ①-⑤（反例段在本文件末尾）+ v42-accept⑦（气球呼读对照）。
   断言只写本文件。 */
import { BootApp, safeName } from '../../flows/bootApp.mjs'
import { Tally, sleep } from '../../flows/assert.mjs'
import { enterGame, whackTargetMole, popTargetBalloon, catchTargetFish, catchTargetNote, readHud, audioNames, audioFirst, waitDom } from '../../flows/playGame.mjs'

const t = new Tally('games/audioFirst 声音先行制（时序+重听+反例）')
const app = new BootApp()

/* ① 打地鼠：谜面音先于探头（300ms 闸门）+ 预载 + 正例 + 🔊 重听 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await enterGame(page, 'mole')
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  const target = await page.getAttribute('[data-prompt]', 'data-target')
  const a = await audioFirst(page, 'riddle/' + safeName(target))
  const upReady = await waitDom(page, 'mole-up')
  const up = await page.evaluate(() => window.__DOM_LOG.filter((e) => e.kind === 'mole-up')[0] || null)
  t.ok(!!a, '开局自动播第一轮谜面音（零操作即播音）', `target=${target} audio@${a ? Math.round(a.t) : '-'}ms`)
  t.ok(upReady && !!a && !!up && a.t < up.t, '时序：目标音先于地鼠探头', `audio=${a && Math.round(a.t)} < up=${up && Math.round(up.t)}`)
  t.ok(upReady && !!a && !!up && up.t - a.t >= 250, '时序：探头挂在声音开播 300ms 闸门后', `gap=${up && a && Math.round(up.t - a.t)}ms`)
  const preNet = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => /audio\/.*(hyp|lessons|riddle)/.test(r.name)).length)
  t.ok(preNet > 0, '开局预载：字母池音频网络请求已发生', `reqs=${preNet}`)
  /* 正例：真实触摸目标鼠 → 得分10+连击1 */
  let whacked = false
  for (let i = 0; i < 3 && !whacked; i++) {
    await whackTargetMole(page)
    whacked = await page.evaluate(() => document.querySelector('#gscore').textContent === '10')
    await page.waitForTimeout(400)
  }
  const after = await readHud(page)
  t.ok(whacked && after.score === '10' && after.combo === '1', '正例：点中目标鼠 → 得分10+连击1', JSON.stringify(after))
  /* 换目标自动播新音 + 🔊 重听（配对 tap 时刻目标，400ms 窗防回合到期错位） */
  const grew = await page.waitForFunction(() => window.__AUDIO_LOG.length >= 2, null, { timeout: 6000 }).then(() => true).catch(() => false)
  t.ok(grew, '换目标：新目标音自动播（无操作也播音）')
  const beforeCnt = await page.evaluate(() => window.__AUDIO_LOG.length)
  const tgtAtTap = await page.evaluate(() => document.querySelector('[data-prompt]').getAttribute('data-target'))
  await page.tap('[data-listen]')
  await page.waitForTimeout(400)
  const now2 = await audioNames(page)
  t.ok(now2.length > beforeCnt && now2[beforeCnt] === 'riddle/' + safeName(tgtAtTap), '🔊 重听可用：点击后谜面音频再发', `now=${now2.slice(beforeCnt).join(',')} tgtAtTap=${tgtAtTap}`)
  await app.closePage(page)
}

/* ② 气球：呼读音先于球出现 + 正例（认知路径=音→形对照） */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await enterGame(page, 'balloon')
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  const target = await page.getAttribute('[data-prompt]', 'data-target')
  const a = await audioFirst(page, safeName(target))
  const elReady = await waitDom(page, 'balloon')
  const el = await page.evaluate(() => window.__DOM_LOG.filter((e) => e.kind === 'balloon')[0] || null)
  t.ok(!!a, '开局自动播目标音（呼读音）', `target=${target}`)
  t.ok(elReady && !!a && !!el && a.t < el.t, '时序：目标音先于气球出现', `audio=${a && Math.round(a.t)} < balloon=${el && Math.round(el.t)}`)
  t.ok(elReady && !!a && !!el && el.t - a.t >= 250, '时序：气球入场在 300ms 闸门后', `gap=${el && a && Math.round(el.t - a.t)}ms`)
  const names = await audioNames(page)
  const kjUI = await page.evaluate(() => document.querySelector('[data-prompt]')?.getAttribute('data-kj'))
  t.ok(names[0] === safeName(target), '气球：首播=呼读音（音→形路径）', names[0])
  t.ok(kjUI !== '1' && !names.some((n) => n.startsWith('lessons/kj_') || n.startsWith('riddle/')), '气球：无口诀/谜面音频（与口诀地鼠认知路径区分）', `kj=${kjUI}`)
  let hit = false
  for (let i = 0; i < 3 && !hit; i++) {
    hit = await popTargetBalloon(page)
    await page.waitForTimeout(400)
  }
  const after = await readHud(page)
  t.ok(hit && after.score === '10' && after.combo === '1', '正例：pop 目标球 → 得分10+连击1', JSON.stringify(after))
  await app.closePage(page)
}

/* ③ 钓鱼：目标音先于鱼入场 + 正例 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await enterGame(page, 'fish')
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  const target = await page.getAttribute('[data-prompt]', 'data-target')
  const a = await audioFirst(page, safeName(target))
  const elReady = await waitDom(page, 'fish')
  const el = await page.evaluate(() => window.__DOM_LOG.filter((e) => e.kind === 'fish')[0] || null)
  t.ok(!!a, '开局自动播目标音', `target=${target}`)
  t.ok(elReady && !!a && !!el && a.t < el.t, '时序：目标音先于鱼入场', `audio=${a && Math.round(a.t)} < fish=${el && Math.round(el.t)}`)
  let hooked = false
  let after = null
  for (let i = 0; i < 3 && !hooked; i++) {
    hooked = await catchTargetFish(page)
    /* 紧贴 hook 读数：gameHit 同步落账（共存立法允许多目标鱼在池，晚读会撞上另一条
       同标鱼到岸的 miss 清连击——断言对象是「钓中这一杆」的即时入账） */
    after = await readHud(page)
    if (hooked && after.score === '10' && after.combo === '1') break
    await page.waitForTimeout(300)
  }
  t.ok(hooked && after && after.score === '10' && after.combo === '1', '正例：钓中目标鱼 → 得分10+连击1', JSON.stringify(after))
  await app.closePage(page)
}

/* ④ 镜像对决：出题即读音（字母题呼读/口诀题谜面两型）+ 正例 + 🔊 重听 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await enterGame(page, 'duel')
  await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
  const qel = await page.waitForSelector('[data-q]', { timeout: 5000 })
  const target = await qel.getAttribute('data-target')
  const a = await audioFirst(page, safeName(target))
  const akj = await audioFirst(page, 'riddle/' + safeName(target))
  const qaudio = a || akj
  const el = await page.evaluate(() => window.__DOM_LOG.filter((e) => e.kind === 'qwrap')[0] || null)
  t.ok(!!qaudio, '出题即自动读音（两型接受）', `target=${target} audio=${qaudio ? qaudio.name : 'none'}`)
  t.ok(!!qaudio && !!el && qaudio.t <= el.t + 30, '时序：读音与题面同步出现（题面出现即读）', `audio=${qaudio && Math.round(qaudio.t)} q=${el && Math.round(el.t)}`)
  let scored = false
  for (let i = 0; i < 3 && !scored; i++) {
    await page.waitForSelector('[data-opts] .duelopt[data-qkey]:not([data-qkey=""])', { timeout: 6000 })
    await page.waitForTimeout(700)   /* 输入闸宽假期后点 */
    await page.tap('[data-opts] .duelopt[data-qkey]:not([data-qkey=""])')
    await page.waitForTimeout(250)
    scored = await page.evaluate(() => document.querySelector('#gscore').textContent === '10')
  }
  const after = await readHud(page)
  t.ok(scored && after.score === '10' && after.combo === '1', '正例：答对推绳 → 得分10+连击1', JSON.stringify(after))
  const grew = await page.waitForFunction(() => window.__AUDIO_LOG.length >= 2, null, { timeout: 6000 }).then(() => true).catch(() => false)
  t.ok(grew, '下一题自动读音（换目标自动播）')
  const hasListen = await page.$('[data-q] [data-listen]')
  if (hasListen) {
    const cnt0 = await page.evaluate(() => window.__AUDIO_LOG.length)
    await page.tap('[data-q] [data-listen]')
    await page.waitForTimeout(350)
    const logNow = await audioNames(page)
    t.ok(logNow.length > cnt0, '🔊 重听可用（听写/口诀音频再发）', logNow.slice(cnt0).join(','))
  } else t.ok(false, '🔊 重听键存在', 'missing')
  await app.closePage(page)
}

/* ⑤ 每日挑战：听音题出题自动读音（zi 看字题不播）+ 🔊 重听键保留 */
{
  const page = await app.newPage({ tier: 'mid', mute: false })
  await page.goto(`${process.env.BASE_URL || 'http://localhost:4173'}/?open=daily`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-daily', { timeout: 8000 })
  /* 顺序作答推进到听音题（zi 设计上不自动读音——播了报答案） */
  let qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype').catch(() => null)
  let tries = 0
  while (qt === 'zi' && tries++ < 11) {
    const w = await page.evaluate(() => {
      const D = window.__PJ.DC()
      return (D.qs[D.i].ans + 1) % D.qs[D.i].opts.length
    })
    await page.tap(`#v-daily [data-opts] .opt:nth-of-type(${w + 1})`)
    await sleep(1900)
    qt = await page.getAttribute('#v-daily [data-qtype]', 'data-qtype').catch(() => null)
  }
  const fired = await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 }).then(() => true).catch(() => false)
  t.ok(fired, '每日挑战出题自动读音（游戏/挑战场景推翻零自动播放）')
  const replayKeys = await page.evaluate(() => Array.from(document.querySelectorAll('#v-daily [data-listen]')).length)
  t.ok(replayKeys >= 1, '🔊 重听键保留', `count=${replayKeys}`)
  await app.closePage(page)
}

/* ⑥ 反例：零操作 → 0 分零静默推进。地鼠=练习制零推进（不结束）；气球/钓鱼/对决=60s 到时结算 0 分 0 星
   + miss 记账（duel 可能拔河判负提前结束）。反例局很慢（60s×3），此处各局并行开（独立页互不干扰） */
{
  const jobs = []
  {
    const page = await app.newPage({ tier: 'mid', mute: false })
    jobs.push((async () => {
      await enterGame(page, 'mole')
      await page.waitForFunction(() => window.__AUDIO_LOG.length > 0, null, { timeout: 6000 })
      await sleep(1500)
      const s0 = await page.evaluate(() => ({ n: window.__AUDIO_LOG.length, up: document.querySelectorAll('#gstage .mole.up').length }))
      await sleep(4000)
      const s1 = await page.evaluate(() => ({
        n: window.__AUDIO_LOG.length, up: document.querySelectorAll('#gstage .mole.up').length,
        result: !!document.querySelector('#gresult'), score: document.querySelector('#gscore')?.textContent,
      }))
      t.ok(!s1.result, '反例mole：零操作对局不结束（✕ 才结算）')
      t.ok(s1.n === s0.n, '反例mole：驻留期内零新题（音频计数冻结）', `${s0.n}→${s1.n}`)
      t.ok(s1.up > 0 && s1.score === '0', '反例mole：驻留期内地鼠常驻+零分', `up=${s1.up} score=${s1.score}`)
      /* v4.7 P2-9：驻留上限 7s → 缩回+清连击，新回合谜面重发（不再永不缩回） */
      const ret = await page.waitForFunction((n0) => window.__AUDIO_LOG.length > n0, s0.n, { timeout: 16000 }).then(() => true).catch(() => false)
      t.ok(ret, '反例mole：驻留超时缩回→新回合重发（驻留上限生效）')
      await app.closePage(page)
    })())
  }
  for (const id of ['balloon', 'fish', 'duel']) {
    const page = await app.newPage({ tier: 'mid', mute: false })
    jobs.push((async () => {
      await enterGame(page, id)
      await page.waitForSelector('#gresult', { timeout: 75000 })
      await sleep(400)
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
      t.ok(res.rscore === '0' && res.score === '0', `反例${id}：60 秒零操作 → 结束得分 0`, JSON.stringify(res).slice(0, 80))
      t.ok(res.stars === 0, `反例${id}：无过关态（0 星）`)
      t.ok(id === 'duel' || res.missErrs > 0, `反例${id}：超时未击计 miss（绝不静默推进）`, `missErrs=${res.missErrs}`)
      await app.closePage(page)
    })())
  }
  await Promise.all(jobs)
}

t.pageErrors(app.errors, 'audioFirst 全程')
await app.close()
process.exit(t.finish())
