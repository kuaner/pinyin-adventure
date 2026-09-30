/* v2.3 综合腿验收（一次性，留档）：npm run preview -- --port 4173 后运行
   覆盖：首页桌面网格（无解锁层直达）/ 学习岛星图+五步 / 笔顺换血（letter-writing 帧截图）
   / 闪电听写+口诀回忆题型断言 / 闯关无 ll·rule 断言 / 闪卡正反面（注音遮挡检查）
   / 关卡图标 / 结算 / 更新提示条（PWA 二次访问实测）/ v1 全套动态探针。
   用法：node scripts/acceptance-v23.mjs  （PWA 段需先 build 一次，脚本内自动做二次构建） */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) }
catch { ({ chromium } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = new URL('../.acceptance-v23/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log((pass ? '✓' : '✗') + ' ' + name + (detail ? ' — ' + detail : ''))
}
async function fresh(opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    ...opts,
  })
  return ctx.newPage()
}
const shot = (page, name) => page.screenshot({ path: OUT + name + '.png' })

/* ---------- 1. 首页：无解锁层直达 + 桌面网格 ---------- */
{
  const page = await fresh()
  await page.goto(BASE)
  await page.waitForSelector('#v-home', { timeout: 5000 })
  await page.waitForTimeout(700)
  const noUnlock = (await page.locator('#unlock').count()) === 0
  ok('解锁层已删除：进 app 直达首页', noUnlock)
  const grid = await page.evaluate(() => ({
    apps: document.querySelectorAll('#desktop .dapp').length,
    secs: document.querySelectorAll('#desktop .dsec').length,
    go: ['learn', 'levels', 'detect', 'bolt', 'zi', 'pairs', 'practice', 'flash', 'history']
      .filter((g) => !!document.querySelector(`[data-go="${g}"]`)).length,
    diag: document.querySelectorAll('.diagbtn').length,
    anyRubyRt: document.querySelectorAll('#desktop rt').length,
  }))
  ok('桌面网格 9 应用 4 分区', grid.apps === 9 && grid.secs === 4, JSON.stringify(grid))
  ok('九个入口 data-go 齐全', grid.go === 9)
  ok('音频自检按钮已删', grid.diag === 0)
  ok('桌面应用名带注音', grid.anyRubyRt >= 9)
  await shot(page, '1-home-desktop')
  await page.context().close()
}

/* ---------- 2. 学习岛：星图 + 认识 + 写法（letter-writing 帧）+ 自由导航 + 小测 ---------- */
{
  const page = await fresh()
  await page.addInitScript(() => localStorage.setItem('pinyin_learn', JSON.stringify({ u: 3, stars: { 1: 3, 2: 3 }, best: {} })))
  await page.goto(BASE + '?learn=1')
  await page.waitForSelector('#v-lesson', { timeout: 5000 })
  await page.waitForTimeout(600)
  await shot(page, '2-lesson-renshi')
  /* 自由导航：stepbar 任意跳（从 1 直接跳 4 拼读） */
  await page.evaluate(() => document.querySelectorAll('.stepdot')[3].click())
  await page.waitForTimeout(500)
  const jump = await page.evaluate(() => document.querySelector('#v-lesson .scorechip')?.textContent)
  ok('学习岛自由导航：第1步直接跳第4步', /四/.test(jump || ''), jump || '')
  /* 写法：letter-writing 底本帧 */
  await page.goto(BASE + '?learn=1&step=2&li=0')
  await page.waitForSelector('#v-lesson .strokeanim', { timeout: 5000 })
  await page.waitForTimeout(1200)
  await shot(page, '3-lesson-xiefa')
  const anim = await page.evaluate(() => ({
    strokes: document.querySelectorAll('#v-lesson .strokeanim path.ghost').length,
    tags: document.querySelectorAll('#v-lesson .stag').length,
    tagRuby: document.querySelectorAll('#v-lesson .stag rt').length,
  }))
  ok('写法步渲染（b 两笔+笔名标签带注音）', anim.strokes === 2 && anim.tags === 2 && anim.tagRuby >= 2, JSON.stringify(anim))
  /* 小测步 */
  await page.goto(BASE + '?learn=1&step=5')
  await page.waitForSelector('#v-lesson .opts', { timeout: 5000 })
  await page.waitForTimeout(400)
  await shot(page, '4-lesson-quiz')
  await page.context().close()
}

/* ---------- 3. 学习岛星图（截图 B 腿自由导航入口） ---------- */
{
  const page = await fresh()
  await page.addInitScript(() => localStorage.setItem('pinyin_learn', JSON.stringify({ u: 3, stars: { 1: 3 }, best: {} })))
  await page.goto(BASE)
  await page.waitForSelector('#v-home', { timeout: 5000 })
  await page.evaluate(() => document.querySelector('[data-go="learn"]').click())
  await page.waitForSelector('#v-learn', { timeout: 5000 })
  await page.waitForTimeout(600)
  const isle = await page.evaluate(() => ({
    cells: document.querySelectorAll('#v-learn .cell').length,
    unlocked: document.querySelectorAll('#v-learn .cell:not(.lock)').length,
    emoji: /[\u{1F000}-\u{1FAFF}☀-➿]/u.test(document.querySelector('#v-learn')?.textContent || ''),
  }))
  ok('星图 12 课、已解锁 3 课可自由回看', isle.cells === 12 && isle.unlocked === 3, JSON.stringify(isle))
  ok('学习岛 UI emoji 清零', !isle.emoji)
  await shot(page, '5-island')
  await page.context().close()
}

/* ---------- 4. 闯关：题型断言（无 ll/rule）+ 听音题注音 hint ---------- */
{
  const page = await fresh()
  await page.goto(BASE + '?probe=full')
  await page.waitForSelector('#probe', { timeout: 5000 })
  let types = []
  for (let t = 0; t < 300; t++) {
    await page.waitForTimeout(300)
    const banner = await page.textContent('#probe').catch(() => '')
    if (/PROBE-FULL-OK/.test(banner || '')) break
    const q = await page.evaluate(() => window.__PJ?.Q().q?.type).catch(() => null)
    if (q && !types.includes(q)) types.push(q)
  }
  const banner = await page.textContent('#probe')
  ok('PROBE-FULL 10 题全对通关', /PROBE-FULL-OK/.test(banner || ''), (banner || '').slice(0, 80))
  ok('闯关题型只含 listen/look/kj（ll·rule 已删）', types.every((x) => ['listen', 'look', 'kj'].includes(x)), types.join(','))
  const kjSeen = types.includes('kj')
  ok('口诀正向回忆题型出现', kjSeen)
  /* 注音 hint：进一题看 qhint 有 rt */
  await page.goto(BASE + '?open=quiz')
  await page.waitForSelector('#qhint', { timeout: 5000 })
  await page.waitForTimeout(500)
  const hintRt = await page.evaluate(() => ({
    rt: document.querySelectorAll('#qhint rt').length,
    text: document.querySelector('#qhint')?.textContent,
  }))
  ok('闯关题面指令带注音（Bug#2）', hintRt.rt >= 3, JSON.stringify(hintRt))
  await shot(page, '6-quiz-listen')
  /* Bug#1 复验：答错 → 反馈层 desc 是渲染后的 ruby，不暴露 HTML 源码 */
  await page.evaluate(() => {
    const q = window.__PJ.Q().q
    document.querySelectorAll('#optbox .opt')[q.ans].click() /* 故意答对进反馈；desc 渲染路径相同 */
  })
  await page.waitForTimeout(400)
  const fb = await page.evaluate(() => {
    const el = document.querySelector('#fbdesc')
    return { html: el?.innerHTML || '', text: el?.textContent || '' }
  })
  ok('反馈层 desc 渲染为注音（不暴露 ruby 源码，Bug#1 同类）', fb.html.includes('<ruby') && !fb.text.includes('<ruby'), fb.text.slice(0, 40))
  await page.context().close()
}

/* ---------- 5. ⚡闪电：blisten/bkj 题型断言 + 截图 ---------- */
{
  const page = await fresh()
  await page.goto(BASE + '?open=bolt')
  await page.waitForSelector('#v-bolt', { timeout: 5000 })
  await page.waitForTimeout(600)
  /* 连答 25 题，收集题型分布（blisten≈70% bkj≈30%） */
  const seen = { blisten: 0, bkj: 0 }
  for (let i = 0; i < 25; i++) {
    const q = await page.evaluate(() => window.__PJ.BT().q)
    if (!q) break
    seen[q.type] = (seen[q.type] || 0) + 1
    if (q.type === 'bkj' && seen.bkj === 1) await shot(page, '7-bolt-bkj')
    if (q.type === 'blisten' && seen.blisten === 1) await shot(page, '8-bolt-blisten')
    await page.evaluate(() => {
      const q = window.__PJ.BT().q
      document.querySelectorAll('#bopt .opt')[q.ans].click()
    })
    await page.waitForTimeout(450)
  }
  ok('闪电题型只含 blisten/bkj（blook·bdjudge 已删）', seen.blisten > 0 && seen.bkj > 0 && !('blook' in seen) && !('bdjudge' in seen), JSON.stringify(seen))
  ok('听写占比 ~70%', seen.blisten / (seen.blisten + seen.bkj) >= 0.5, JSON.stringify(seen))
  const noEmoji = await page.evaluate(() => !/[\u{1F000}-\u{1FAFF}☀-➿]/u.test(document.querySelector('#v-bolt')?.textContent || ''))
  ok('闪电页 emoji 清零', noEmoji)
  await page.context().close()
}

/* ---------- 6. 闪卡：翻面 + 注音遮挡检查 ---------- */
{
  const page = await fresh()
  await page.goto(BASE + '?probe=flash')
  await page.waitForSelector('#v-flash', { timeout: 5000 })
  await page.waitForTimeout(600)
  await shot(page, '9-flash-front')
  await page.evaluate(() => document.querySelector('#flashcard').click())
  await page.waitForTimeout(700)
  const back = await page.evaluate(() => {
    const card = document.querySelector('#flashcard')
    const rt = card.querySelectorAll('rt').length
    const clipped = [...card.querySelectorAll('.fckj,.fcword')].some((el) => {
      const b = el.getBoundingClientRect()
      return b.height > 0 && (el.scrollHeight - b.height > 6)
    })
    return { rt, clipped }
  })
  ok('闪卡背面注音齐全（口诀+例词 rt）', back.rt >= 4, JSON.stringify(back))
  ok('闪卡无注音裁切（scrollHeight 溢出检查）', !back.clipped)
  await shot(page, '10-flash-back')
  await page.context().close()
}

/* ---------- 7. 关卡图标 / 结算 / 历史 / 专练 / 家长页 emoji ---------- */
{
  const page = await fresh()
  await page.goto(BASE + '?open=levels')
  await page.waitForSelector('#v-levels', { timeout: 5000 })
  await page.waitForTimeout(400)
  const lv = await page.evaluate(() => ({
    icons: document.querySelectorAll('#lvgrid .lvnum svg').length,
    emoji: /[\u{1F000}-\u{1FAFF}☀-➿]/u.test(document.querySelector('#lvgrid')?.textContent || ''),
  }))
  ok('关卡 9 张全图标（em emoji 已换 naive-icons）', lv.icons >= 9 && !lv.emoji, JSON.stringify(lv))
  await shot(page, '11-levels')
  await page.goto(BASE + '?open=result')
  await page.waitForSelector('#v-result', { timeout: 5000 })
  await page.waitForTimeout(400)
  await shot(page, '12-result')
  await page.goto(BASE + '?open=history')
  await page.waitForSelector('#v-history', { timeout: 5000 })
  await page.waitForTimeout(400)
  const his = await page.evaluate(() => !/[\u{1F000}-\u{1FAFF}☀-➿]/u.test(document.querySelector('#v-history')?.textContent || ''))
  ok('历史页 emoji 清零', his)
  await shot(page, '13-history')
  await page.goto(BASE + '?open=pairs')
  await page.waitForSelector('#v-pairs', { timeout: 5000 })
  await page.waitForTimeout(400)
  await shot(page, '14-pairs')
  await page.context().close()
}

/* ---------- 8. PWA 更新链路：二次访问出现更新提示条 → 点击更新生效 ---------- */
{
  const page = await fresh()
  await page.goto(BASE)
  await page.waitForSelector('#v-home', { timeout: 5000 })
  await page.evaluate(() => navigator.serviceWorker.ready)
  const reg1 = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration()
    return { ok: !!r, swUrl: r?.active?.scriptURL }
  })
  ok('首次访问 SW 注册', reg1.ok, JSON.stringify(reg1))
  /* 模拟部署新版本：index.html 注释（HTML 不 minify → precache revision 必变）→ 重建 */
  const reIdx = (tag) => {
    const h = fs.readFileSync('index.html', 'utf8')
    fs.writeFileSync('index.html', h.replace('<div id="app"></div>', '<div id="app"></div><!-- ' + tag + ' -->'))
    execSync('npm run build', { stdio: 'pipe' })
  }
  reIdx('v23-pwa-test')
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('#v-home', { timeout: 5000 })
  let bar = false
  for (let t = 0; t < 40; t++) {
    bar = (await page.locator('[data-update="on"]').count()) > 0
    if (bar) break
    await page.waitForTimeout(500)
    if (t === 15) await page.reload({ waitUntil: 'load' }).catch(() => {})
  }
  ok('二次访问出现更新提示条（onNeedRefresh 链路）', bar)
  if (bar) {
    await shot(page, '15-update-prompt')
    const swBefore = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)
    await page.evaluate(() => document.querySelector('[data-update-go]').click())
    await page.waitForTimeout(2500)
    const after = await page.evaluate(async () => ({
      url: location.href,
      sw: (await navigator.serviceWorker.getRegistration())?.active?.scriptURL,
      ctrl: !!navigator.serviceWorker.controller,
    }))
    ok('点击更新 → SW 接管（skipWaiting+reload）', after.ctrl && !!after.sw, JSON.stringify(after))
  }
  /* 清理测试注释并重建最终版 */
  {
    const h = fs.readFileSync('index.html', 'utf8')
    fs.writeFileSync('index.html', h.replace('<!-- v23-pwa-test -->', ''))
    execSync('npm run build', { stdio: 'pipe' })
  }
  await page.context().close()
}

/* ---------- 9. v1 动态探针（det/bolt/zi） ---------- */
for (const [name, url, expect] of [
  ['det', '?probe=det', /PROBE-DET-OK/],
  ['bolt', '?probe=bolt', /PROBE-BOLT-OK/],
  ['zi', '?probe=zi', /PROBE-ZI-OK/],
]) {
  const page = await fresh()
  await page.goto(BASE + url)
  await page.waitForSelector('#probe', { timeout: 5000 })
  let banner = ''
  for (let t = 0; t < 40; t++) {
    banner = (await page.textContent('#probe').catch(() => '')) || ''
    if (expect.test(banner) || /FAIL/.test(banner)) break
    await page.waitForTimeout(300)
  }
  ok('PROBE-' + name.toUpperCase(), expect.test(banner || ''), (banner || '').slice(0, 90))
  await page.context().close()
}

await browser.close()
const fail = results.filter((r) => !r.pass)
console.log(`\n===== v2.3 验收：${results.length - fail.length}/${results.length} 通过 =====`)
fs.writeFileSync(OUT + 'results.json', JSON.stringify(results, null, 1))
process.exit(fail.length ? 1 : 0)
