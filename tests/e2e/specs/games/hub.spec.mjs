/* specs/games/hub —— 游戏岛 hub 结构 + 分段切换 + 文案清零（禁设计meta立法）：
   ① hub：每日挑战卡 + 6 摊位实装（balloon/mole/duel/fish/egg/tone）+ 零占位残留（敬请期待灰卡清零）
      + 闯关/自由练习保留入口 + 插画可辨识 + 零纵向滚动 + 摊位可开局（点气球 → 倒计时）
   ② hall 分段：默认游戏岛；game↔drill 往返状态保持（六入口卡/挑战卡原样）；跨视图保持
      （drill → pairs → 返回练习 tab 仍在练习馆）
   ③ 文案清零：岛/馆 DOM 无 .ddesc；摊位卡只留 游戏名+最佳成绩+插画；入口卡只留名称；
      自由练习四卡单行；源码级死 key/占位残留/死 mp3 清零
   迁移自：v40-accept① + v42-accept① + v43-accept⑤ + v431-accept③。断言只写本文件。 */
import fs from 'node:fs'
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { enterDrill, hall, ck } from '../../flows/playGame.mjs'

const t = new Tally('games/hub hub结构+分段保持+文案清零')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* ① hub 结构 + 可开局 */
{
  const page = await app.newPage({ tier: 'mid' })
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island #stalls', { timeout: 8000 })
  await page.waitForTimeout(400)
  const hub = await page.evaluate(() => ({
    daily: !!document.getElementById('dailycard'),
    stalls: Array.from(document.querySelectorAll('#stalls [data-stall]')).map((e) => e.getAttribute('data-stall')),
    coming: Array.from(document.querySelectorAll('#stalls [data-coming]')).map((e) => e.getAttribute('data-coming')),
    more: Array.from(document.querySelectorAll('#morerow [data-go]')).map((e) => e.getAttribute('data-go')),
    artVisible: Array.from(document.querySelectorAll('#stalls .art')).every((e) => e.getBoundingClientRect().width > 40),
    stallIsBtn: (() => { const c = document.querySelector('[data-stall="egg"]'); return !!c && c.tagName === 'BUTTON' })(),
    scrollV: document.getElementById('tab-view-root').scrollHeight <= document.getElementById('tab-view-root').clientHeight + 1,
  }))
  t.ok(hub.daily, 'hub：每日挑战卡在')
  t.ok(hub.stalls.join(',') === 'balloon,mole,duel,fish,egg,tone', 'hub：6 游戏摊位实装（v4.3 终态）', hub.stalls.join(','))
  t.ok(hub.coming.length === 0, 'hub：零占位残留（敬请期待灰卡清零）')
  t.ok(hub.more.join(',') === 'levels,free', 'hub：闯关/自由练习保留入口', hub.more.join(','))
  t.ok(hub.artVisible, 'hub：6 张摊位插画可辨识（宽>40px）')
  t.ok(hub.stallIsBtn, 'hub：摊位为实装按钮（可开局）')
  t.ok(hub.scrollV, 'hub：零纵向滚动（容器级）')
  await ck(page, '[data-stall="balloon"]')
  await page.waitForSelector('#gcount', { timeout: 6000 })
  t.ok(true, 'hub：点摊位 → 倒计时开局')
  await app.closePage(page)
}

/* ② hall 分段往返保持 + 跨视图保持 */
{
  const page = await app.newPage({ tier: 'mid' })
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-island', { timeout: 8000 })
  await page.waitForTimeout(400)
  const h0 = await hall(page)
  const btn0 = await page.evaluate(() => ({
    gameOn: document.getElementById('hallbtn-game').classList.contains('on'),
    drillOn: document.getElementById('hallbtn-drill').classList.contains('on'),
  }))
  t.ok(h0 === 'game' && btn0.gameOn && !btn0.drillOn, '默认分段=游戏岛（hallbtn-game 高亮）')
  await ck(page, '[data-hallbtn="drill"]')
  await page.waitForSelector('#drillgrid', { timeout: 5000 })
  const drill = await page.evaluate(() => ({
    hall: document.getElementById('v-island').getAttribute('data-hall'),
    cards: Array.from(document.querySelectorAll('#drillgrid [data-drill]')).map((e) => e.getAttribute('data-drill')),
    scrollV: document.getElementById('tab-view-root').scrollHeight <= document.getElementById('tab-view-root').clientHeight + 1,
  }))
  t.ok(drill.hall === 'drill' && drill.cards.join(',') === 'bolt,listen,pairs,zi,blend,tone', '练习馆：六入口卡（闪电/听写/易混对/识字表/拼读/声调）', drill.cards.join(','))
  t.ok(drill.scrollV, '练习馆：零纵向滚动')
  await ck(page, '[data-hallbtn="game"]')
  await page.waitForSelector('#stalls', { timeout: 5000 })
  const back = await page.evaluate(() => ({
    hall: document.getElementById('v-island').getAttribute('data-hall'),
    daily: !!document.getElementById('dailycard'),
    stalls: document.querySelectorAll('#stalls [data-stall]').length,
  }))
  t.ok(back.hall === 'game' && back.daily && back.stalls === 6, '往返切回游戏岛：挑战卡+6 摊位原样')
  /* 跨视图保持：drill → pairs 页 → 返回练习 tab 仍在练习馆 */
  await ck(page, '[data-hallbtn="drill"]')
  await page.waitForSelector('#drillgrid', { timeout: 5000 })
  await ck(page, '[data-drill="pairs"]')
  await page.waitForSelector('#v-pairs', { timeout: 5000 })
  await ck(page, '[data-back="practice"]')
  await page.waitForSelector('#v-island', { timeout: 5000 })
  t.ok(await hall(page) === 'drill', '跨视图往返：pairs 返回后 hall=练习馆保持')
  await app.closePage(page)
}

/* ③ 文案清零（DOM 面） */
{
  const page = await app.newPage({ tier: 'mid' })
  await page.goto(`${BASE}/?open=island`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#stalls', { timeout: 8000 })
  await page.waitForTimeout(300)
  const isl = await page.evaluate(() => ({
    ddesc: document.querySelectorAll('#v-island .ddesc').length,
    stalls: Array.from(document.querySelectorAll('#stalls [data-stall]')).map((e) => ({
      id: e.getAttribute('data-stall'),
      name: e.querySelector('.sname')?.textContent?.trim() || '',
      best: e.querySelector('.sbest')?.textContent?.trim() || '',
      extra: Array.from(e.querySelectorAll('.sinfo > *:not(.sname):not(.sbest)')).length,
    })),
  }))
  t.ok(isl.ddesc === 0, '游戏岛：DOM 无 .ddesc/描述行')
  /* v4.7 P1-9 立法收紧：摊位卡=名+插画，最佳>0 才有副标（「新游戏」meta 副标删除） */
  const allText = isl.stalls.map((s) => `${s.name}${s.best}`).join(' ')
  t.ok(isl.stalls.length === 6 && isl.stalls.every((s) => s.name && s.extra === 0 && (s.best === '' || /最佳/.test(s.best))), '游戏岛：摊位卡只留 游戏名+（有最佳才显）最佳+插画', isl.stalls.map((s) => `${s.id}:${s.name}/${s.best || '∅'}`).join(' '))
  t.ok(!allText.includes('新游戏') && !isl.stalls.some((s) => s.best && s.best.includes('新')), 'P1-9：摊位卡「新游戏」meta 副标清零')
  await page.evaluate(() => document.querySelector('[data-hallbtn="drill"]')?.click())
  await page.waitForSelector('#drillgrid', { timeout: 5000 })
  const hallDom = await page.evaluate(() => ({
    ddesc: document.querySelectorAll('#v-island .ddesc').length,
    cards: Array.from(document.querySelectorAll('#drillgrid [data-drill]')).map((e) => ({
      id: e.getAttribute('data-drill'),
      name: e.querySelector('.dname')?.textContent?.trim() || '',
      rows: Array.from(e.querySelectorAll(':scope > div')).map((d) => d.className),
    })),
  }))
  t.ok(hallDom.ddesc === 0, '练习馆：DOM 无 .ddesc/描述行')
  /* v4.7 P1-9 立法收紧：入口卡=名+图标，描述性/meta 徽章（新游戏/5分钟/14组/弱项N/n-180）全删 */
  const badges = await page.evaluate(() => document.querySelectorAll('#drillgrid .dbadge').length)
  t.ok(hallDom.cards.length === 6 && hallDom.cards.every((c) => c.name), '练习馆：入口卡只留 名称+图标', hallDom.cards.map((c) => c.id).join(','))
  t.ok(badges === 0, 'P1-9：入口卡 meta 徽章清零（5分钟/14组/新游戏等）', `badges=${badges}`)
  /* 自由练习页（原 desc 渲染点） */
  await page.goto(`${BASE}/?open=free`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#v-practice', { timeout: 8000 })
  const free = await page.evaluate(() => ({
    btns: Array.from(document.querySelectorAll('#pgroups2 .btn')).map((b) => Array.from(b.children).filter((c) => c.tagName === 'SPAN').length),
  }))
  t.ok(free.btns.length === 4 && free.btns.every((n) => n === 1), '自由练习：四卡描述行已清（每卡仅名称一行）', JSON.stringify(free.btns))
  await app.closePage(page)
}

/* ④ 文案清零（源码级）：死 key / 占位残留 / 死 mp3 / phrases desc 字段 */
{
  const strings = fs.readFileSync('src/text/strings.ts', 'utf8')
  const deadKeys = ['adventureDesc', 'boltDesc', 'quickPinDesc', 'detectiveDesc', 'pairsDesc', 'freeDesc', 'drillListenDesc', 'drillZiDesc', 'flashDesc', 'myCardsDesc', 'dailyDesc', 'hallBlendDesc', 'hallToneDesc', 'comingSoon', 'stallRace', 'stallMemory']
  t.ok(deadKeys.every((k) => !strings.includes(k)), 'strings.ts：16 个死 key 已删', deadKeys.filter((k) => strings.includes(k)).join(','))
  let svelteAll = ''
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = d + '/' + f; if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.svelte')) svelteAll += fs.readFileSync(p, 'utf8') } }
  walk('src/components')
  t.ok(!svelteAll.split('upddesc').join('').includes('ddesc'), '组件层：.ddesc 类名零残留（upddesc=更新提示功能文案，立法范围外）')
  t.ok(!strings.includes('敬请期待') && !svelteAll.includes('敬请期待'), '占位文案「敬请期待」零残留')
  const deadMp3 = ['bolt-desc', 'pairs-desc', 'adventure-desc', 'quick-pin-desc', 'detective-desc', 'free-desc', 'flash-desc', 'phrase-prac-sm-desc', 'phrase-prac-ym-desc', 'phrase-prac-zt-desc', 'phrase-prac-all-desc']
  t.ok(deadMp3.every((f) => !fs.existsSync(`public/audio/ui/${f}.mp3`)), '死配音 mp3 已删（11 个）')
  const ph = JSON.parse(fs.readFileSync('src/data/phrases.json', 'utf8'))
  t.ok((ph.practice || []).every((p) => !('desc' in p)), 'phrases.json：practice[].desc 字段已删')
}

t.pageErrors(app.errors, 'hub 全程')
await app.close()
process.exit(t.finish())
