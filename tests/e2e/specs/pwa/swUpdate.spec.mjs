/* specs/pwa/swUpdate —— PWA 更新流程（skipWaiting → controllerchange → ready → reload 链）：
   prompt 模式立法（v2.3 照 bambu-nfc）：新 SW 装好进入 waiting → UpdatePrompt 提示条（不自动刷）
   → 点「更新」→ skipWaiting + 等 navigator.serviceWorker.ready 完全激活才 reload
   （Bug#11+16：预缓存未完就 reload 会白屏）。
   测试法：本 spec 自管 preview（4177 独立端口，不动 run-all 的 4173）——首载完成后改盘 dist/sw.js
   （追加注释=字节差）→ 页内 reg.update() → 新 SW 安装进 waiting → onNeedRefresh 提示条 →
   点击走完链路 → reload 后 waiting 消费干净。BASE_URL 外部服务时跳过（需 dist 磁盘控制权）。
   迁移说明：T3 新增（v*-accept 无 PWA 更新覆盖面）。断言只写本文件。 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
const require = createRequire(import.meta.url)
const { chromium, devices } = require('playwright')
import { Tally } from '../../flows/assert.mjs'

const t = new Tally('pwa/swUpdate SW更新流程（prompt→waiting→ready→reload）')
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

if (process.env.BASE_URL) {
  console.log('  ⤵ BASE_URL 外部服务（无 dist 磁盘控制权）——本 spec 跳过')
  console.log(`\n===== ${t.title}：跳过 =====`)
  process.exit(0)
}

const PORT = 4177
const BASE = `http://localhost:${PORT}`
const swPath = path.join(ROOT, 'dist/sw.js')
if (!fs.existsSync(swPath)) { console.error('dist/sw.js 缺失——先 build'); process.exit(2) }

/* 自管 preview（独立端口，结束即拆） */
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true })
const killPreview = () => { try { process.kill(-preview.pid) } catch { /* gone */ } }
process.on('exit', killPreview)
let ready = false
for (let i = 0; i < 40 && !ready; i++) {
  try { ready = (await fetch(BASE + '/')).ok } catch { await new Promise((r) => setTimeout(r, 500)) }
}
if (!ready) { console.error('preview 未就绪'); killPreview(); process.exit(2) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message))

const origSw = fs.readFileSync(swPath, 'utf8')
try {
  /* ① 首载：SW 安装并激活（precache 完成） */
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForFunction(async () => {
    const r = await navigator.serviceWorker.getRegistration()
    return !!r && !!r.active && !navigator.serviceWorker.controller === false
  }, null, { timeout: 20000 }).catch(() => {})
  const act = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration()
    return { active: !!r?.active, waiting: !!r?.waiting }
  })
  t.ok(act.active && !act.waiting, '首载：SW 安装激活（无 waiting）', JSON.stringify(act))

  /* ② 模拟发版：改盘 sw.js（追加注释=字节差，workbox 语义不变）→ 页内主动查新
     （UpdatePrompt visibilitychange 同款入口）。
     prompt 立法断言=提示条在且不自动刷（1.5s 无自发 reload——headless 首访未受控客户端
     新 SW 直通 activating，waiting 档环境依赖不断言，prompt 门以"用户点击才刷"为准绳） */
  fs.writeFileSync(swPath, origSw + '\n// e2e-update-probe ' + Date.now() + '\n')
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()))
  const barOn = await page.waitForSelector('[data-update="on"]', { timeout: 20000 }).then(() => true).catch(() => false)
  t.ok(barOn, '新版本就绪 → 更新提示条出（onNeedRefresh）')
  if (barOn) {
    let autoReload = false
    const navWatch = page.waitForNavigation({ timeout: 1500 }).then(() => { autoReload = true }).catch(() => {})
    await navWatch
    t.ok(!autoReload && !!(await page.$('[data-update]')), 'prompt 立法：不自动刷（1.5s 无自发 reload，等用户点击）')
  }

  /* ③ 点击更新：skipWaiting → controllerchange → ready → reload 链 */
  const navDone = page.waitForNavigation({ timeout: 15000 }).then(() => true).catch(() => false)
  await page.tap('[data-update-go]')
  const reloaded = await navDone
  t.ok(reloaded, '点击「更新」→ 页面 reload（ready 后刷，不白屏）')
  await page.waitForTimeout(1500)
  const after = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration()
    return { waiting: !!r?.waiting, controller: !!navigator.serviceWorker.controller, bar: !!document.querySelector('[data-update]') }
  })
  t.ok(!after.waiting, 'reload 后 waiting 消费干净（新 SW 已接管）', JSON.stringify(after))
  t.ok(after.controller, '新 SW 控制页面（controller 在）')
  t.ok(!after.bar, '更新提示条散场')
} finally {
  fs.writeFileSync(swPath, origSw)   /* 双保险恢复（try 内已恢复的正常路径幂等） */
  await browser.close().catch(() => {})
  killPreview()
}

t.ok(errs.length === 0, '全程零 pageerror', (errs[0] || '').slice(0, 120))
process.exit(t.finish())
