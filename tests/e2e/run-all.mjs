/* T1 统一回归包 runner：起 preview → 串行跑全部 v*-accept 回归脚本 → 汇总退出码。
   用法：
     npm run e2e                    # 全量（自起 4173 preview，缺 dist 先 build）
     node tests/e2e/run-all.mjs v40 v431   # 只跑指定腿（名字前缀匹配）
   环境变量 BASE_URL 可指外部服务（此时不起本地 preview）。
   脚本本体零改动收编（断言原样），仅由本 runner 统一供给 preview/BASE_URL。 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ALL = [
  'v30-accept.mjs',   // v3.0 学习岛结构反转+零滚动+自动推进
  'v31-accept.mjs',   // v3.1 字模=笔顺动画合体+播放键几何
  'v312-accept.mjs',  // v3.1.2 音频智能预载+四线格
  'v32-accept.mjs',   // v3.2 升级体系触发点接线
  'v40-accept.mjs',   // v4.0 游戏岛 hub+四游戏+连击+账本+每日种子
  'v401-accept.mjs',  // v4.0.1 互动证据制（BUGS#33）
  'v41-accept.mjs',   // v4.1 声音先行制（BUGS#34）
  'v42-accept.mjs',   // v4.2 练习馆+口诀地鼠（BUGS#35 上）
  'v43-accept.mjs',   // v4.3 蛋合并+音乐会+两专练（BUGS#35 下）
  'v431-accept.mjs',  // v4.3.1 共存立法+两段式+文案清零（Bug#36+37）
  'regression-bug36-coexist.mjs',     // 命名回归样例：同屏共存立法（自 v431 抽出）
  'regression-bug37-two-phase.mjs',   // 命名回归样例：两段式试听（自 v431 抽出）
]

const filters = process.argv.slice(2)
const scripts = filters.length ? ALL.filter((s) => filters.some((f) => s.startsWith(f))) : ALL
if (!scripts.length) { console.error('无匹配脚本: ' + filters.join(' ')); process.exit(2) }

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const external = !!process.env.BASE_URL

/* preview 服务管理 */
let preview = null
async function startPreview() {
  if (external) return
  if (!fs.existsSync(path.join(ROOT, 'dist/index.html'))) {
    console.log('dist 缺失 → 先构建（vite build）…')
    const b = spawnSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'inherit' })
    if (b.status !== 0) { console.error('构建失败'); process.exit(2) }
  }
  console.log('起 preview（4173, strictPort）…')
  preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true })
  const t0 = Date.now()
  while (Date.now() - t0 < 30000) {
    try {
      const r = await fetch(BASE + '/')
      if (r.ok) return
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  console.error('preview 30s 未就绪'); await teardown(); process.exit(2)
}

async function teardown() {
  if (preview) { try { process.kill(-preview.pid) } catch { /* already gone */ } preview = null }
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await teardown(); process.exit(130) })

await startPreview()

/* 串行跑（不并行——浏览器实例多开互抢无益，输出也可读） */
const results = []
let failed = 0
for (const s of scripts) {
  const label = '[' + s + ']'
  console.log('\n==================================================')
  console.log(label + ' 开始')
  console.log('==================================================')
  const t0 = Date.now()
  const r = spawnSync('node', [path.join(HERE, s)], {
    cwd: ROOT,   /* 脚本按 repo 根写相对输出目录（.acceptance-*） */
    env: { ...process.env, BASE_URL: BASE },
    stdio: 'inherit',
  })
  const dur = ((Date.now() - t0) / 1000).toFixed(1) + 's'
  const okRun = r.status === 0
  if (!okRun) failed++
  results.push({ s, ok: okRun, dur, code: r.status })
  console.log(okRun ? `✓ ${s} 通过（${dur}）` : `✗ ${s} 失败（exit ${r.status}，${dur}）`)
}

await teardown()

console.log('\n================ 回归包汇总 ================')
for (const r of results) console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.s.padEnd(20) + r.dur)
console.log('============================================')
const pass = results.filter((r) => r.ok).length
console.log(`回归包：${pass}/${results.length} 通过${failed ? '（有失败！）' : '（全绿）'}`)
process.exit(failed ? 1 : 0)
