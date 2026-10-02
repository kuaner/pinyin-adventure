/* T3 统一 runner：自起 preview → 串行驱动 specs/（五域）+ cross/（横切面）→ 汇总退出码。
   断言只住在 specs/，本 runner 只管发现/执行/重试/汇总。
   用法：
     npm run e2e                      # 全量（自起 4173 preview，缺 dist 先 build）
     node tests/e2e/run-all.mjs learn # 按域跑（learn/games/drills/growth/pwa/cross）
     node tests/e2e/run-all.mjs mole  # 按文件名子串跑
   环境变量 BASE_URL 可指外部服务（此时不起本地 preview）。 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const HERE = path.dirname(fileURLToPath(import.meta.url))

/* 发现 specs：e2e/specs/<域>/*.spec.mjs + e2e/cross/*.spec.mjs（横切面也是 spec——断言只住 spec 文件） */
function discover() {
  const out = []
  const walk = (dir, domain) => {
    for (const f of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, f)
      if (fs.statSync(p).isDirectory()) walk(p, domain)
      else if (f.endsWith('.spec.mjs')) out.push({ file: p, rel: path.relative(HERE, p), domain })
    }
  }
  walk(path.join(HERE, 'specs'), '')
  walk(path.join(HERE, 'cross'), 'cross')
  return out
}

const filters = process.argv.slice(2)
const all = discover()
const scripts = filters.length
  ? all.filter((s) => filters.some((f) => s.domain === f || s.rel.includes(f)))
  : all
if (!scripts.length) { console.error('无匹配 spec: ' + filters.join(' ') + '（可用域: learn games drills growth pwa cross）'); process.exit(2) }

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

/* 串行跑（不并行——浏览器实例多开互抢无益，输出也可读）。
   flake 加固：首跑失败自动重试一次（冷缓存/时序抖动类闪红），重试过=绿但标注 ⟲flake；再败=真红 */
const results = []
let failed = 0
let flakes = 0
for (const s of scripts) {
  const label = `[${s.rel}]`
  console.log('\n==================================================')
  console.log(label + ' 开始')
  console.log('==================================================')
  const t0 = Date.now()
  const run = () => spawnSync('node', [s.file], {
    cwd: ROOT,
    /* BASE_URL 仅在外部服务时下传——本地 preview 时留空（specs 落 4173 缺省），
       pwa/swUpdate 等需要磁盘控制权的 spec 才不会误判成外部服务而跳过 */
    env: external ? { ...process.env, BASE_URL: BASE } : { ...process.env, BASE_URL: '' },
    stdio: 'inherit',
  })
  let r = run()
  let flaked = false
  if (r.status !== 0) {
    console.log(`  ↻ 首跑失败（exit ${r.status}）→ flake 加固：自动重试一次`)
    flaked = true
    r = run()
  }
  const dur = ((Date.now() - t0) / 1000).toFixed(1) + 's'
  const okRun = r.status === 0
  if (okRun && flaked) flakes++
  if (!okRun) failed++
  results.push({ rel: s.rel, domain: s.domain || 'cross', ok: okRun, dur, code: r.status, flaked: okRun && flaked })
  console.log(okRun ? `✓ ${s.rel} 通过（${dur}）${flaked ? ' ⟲flake重试过' : ''}` : `✗ ${s.rel} 失败（exit ${r.status}，${dur}）`)
}

await teardown()

console.log('\n================ e2e 矩阵汇总 ================')
const byDomain = {}
for (const r of results) (byDomain[r.domain] = byDomain[r.domain] || []).push(r)
for (const d of Object.keys(byDomain).sort()) {
  const rs = byDomain[d]
  const pass = rs.filter((x) => x.ok).length
  console.log(`  ${d.padEnd(8)} ${pass}/${rs.length} 绿`)
}
console.log('--------------------------------------------')
for (const r of results) if (!r.ok) console.log('  ✗ ' + r.rel)
console.log('============================================')
const pass = results.filter((r) => r.ok).length
console.log(`e2e 矩阵：${pass}/${results.length} 绿${flakes ? `（含 ${flakes} 个 flake 重试过⟲）` : ''}${failed ? '（有失败！）' : '（全绿）'}`)
process.exit(failed ? 1 : 0)
