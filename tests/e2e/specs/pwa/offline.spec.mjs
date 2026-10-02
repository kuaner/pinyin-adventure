/* specs/pwa/offline —— 断网重进（缓存命中零网络）：
   在线首载 → 等 SW precache 完成（外壳/数据全量）→ setOffline 断网 → reload →
   app 完整可用（外壳渲染+tab 切换+进课页）+ 零资源加载失败（sw.js 更新探查失败属浏览器内部行为，豁免）。
   T3 新增覆盖面（v*-accept 无断网面）。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'

const t = new Tally('pwa/offline 断网重进（缓存命中零网络）')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

const page = await app.newPage({ tier: 'mid' })

/* ① 在线首载：SW 安装 + precache 全落 */
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
const pre = await page.waitForFunction(async () => {
  const names = await caches.keys()
  const shell = names.find((n) => n.includes('precache'))
  if (!shell) return null
  const n = (await (await caches.open(shell)).keys()).length
  return n >= 8 ? n : null
}, null, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => null)
t.ok(!!pre, `在线首载：SW precache 完成（${pre ?? 0} 条外壳/数据）`)

/* ② 断网 reload：缓存命中零网络，外壳完整可用。
   豁免：/audio/（mp3=边播边缓存按需拉取，离线未缓存该条→playAudio 静默兜底=设计内）与
   sw.js（浏览器更新探查，失败静默）。硬门槛=外壳资源（html/js/css/字体/数据）零失败 */
const failed = []
page.on('requestfailed', (r) => {
  const u = r.url()
  if (u.includes('sw.js') || u.includes('/audio/')) return
  failed.push(u)
})
await page.context().setOffline(true)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('#v-learntab', { timeout: 15000 })
t.ok(true, '断网 reload：外壳渲染（学习 tab 在）')
/* 交互可用：切练习 tab（纯前端路由=缓存 JS 驱动） */
await page.tap('[data-tab="practice"]')
await page.waitForSelector('#v-island', { timeout: 8000 })
t.ok(true, '断网：tab 切换可用（游戏岛在）')
/* 进课页（组件树完整挂载） */
await page.tap('[data-tab="learn"]')
await page.waitForSelector('#v-learntab', { timeout: 8000 })
await page.evaluate(() => { const c = document.querySelector('[data-cta]'); c?.click() })
await page.waitForSelector('#v-lesson .hspage', { timeout: 8000 })
t.ok(true, '断网：进课页可用（课页挂载）')
t.ok(failed.length === 0, '断网：零资源加载失败（缓存命中）', failed.slice(0, 3).join(','))

await page.context().setOffline(false)
t.pageErrors(app.errors, 'offline 全程')
await app.closePage(page)
await app.close()
process.exit(t.finish())
