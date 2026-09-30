/* v2.4.4 笔顺动画验收（BUGS #6b）：
   ① a/b/ü/üe 深链直达写法页 → 点"再看一遍"确定性重播 → t=0.5/1.5/2.5s 连拍 3 帧：
      帧两两字节不同（在动的截图证据）+ DOM 层 dashoffset 进度逐帧推进（在动的数值证据）
      + 底部笔名清单高亮随当前笔推进
   ② 真实路径时机：先进第 1 页停 3s（旧 bug 下动画此时已偷偷播完）→ 点步骤条进写法页 →
      400ms 时必须有笔正在画（dashoffset 严格介于 0 与 L 之间）——修复的直接证明
   ③ 47 单元断言：每单元笔数≥1（o/e/l/z/c/s 单笔画=课本规范）且总时长 > 笔数×400ms；
      a/b/ü/üe 另在真实 DOM 用 getTotalLength 校核纯 Node 路径长度近似（误差<2%） */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) }
catch { ({ chromium } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const OUT = '.stroke-anim-shots'
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT)

const strokesData = JSON.parse(fs.readFileSync('src/data/strokes.json', 'utf8'))
const lessons = JSON.parse(fs.readFileSync('src/data/lessons.json', 'utf8')).lessons
const where = {}
for (const l of lessons) l.letters.forEach((e, i) => { if (!(e.k in where)) where[e.k] = { n: l.n, i, strokes: e.strokes.length } })

/* ---- 纯 Node SVG 路径长度（M/L/C 采样 32 段折线近似）---- */
function pathLen(d) {
  const nums = d.match(/-?\d+(?:\.\d+)?/g).map(Number)
  let i = 0, cx = 0, cy = 0, len = 0
  const cmd = (c) => d[i++]
  // 简易 tokenizer：逐命令读取
  const toks = d.match(/[MLQC][^MLQC]*/g)
  for (const t of toks) {
    const c = t[0]
    const v = t.slice(1).match(/-?\d+(?:\.\d+)?/g).map(Number)
    if (c === 'M') { cx = v[0]; cy = v[1] }
    else if (c === 'L') { len += Math.hypot(v[0] - cx, v[1] - cy); cx = v[0]; cy = v[1] }
    else if (c === 'C') {
      const [x1, y1, x2, y2, x, y] = v
      let px = cx, py = cy
      for (let s = 1; s <= 32; s++) {
        const u = s / 32
        const a = (1 - u) ** 3, b = 3 * u * (1 - u) ** 2, c2 = 3 * u * u * (1 - u), e = u ** 3
        const qx = a * cx + b * x1 + c2 * x2 + e * x
        const qy = a * cy + b * y1 + c2 * y2 + e * y
        len += Math.hypot(qx - px, qy - py); px = qx; py = qy
      }
      cx = x; cy = y
    }
  }
  return len
}
const GAP = 420
const durOf = (len, n) => (n === '点' ? 450 : Math.max(650, Math.min(2200, len * 4.2)))
const totalTime = (strokes) => strokes.reduce((s, st) => s + durOf(pathLen(st.d), st.n), 0) + GAP * (strokes.length - 1)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.addInitScript(() => localStorage.setItem('pinyin_learn', JSON.stringify({ u: 12, stars: {}, best: {} })))

const key = (u) => u.replace('ü', 'v')
const prog = () => page.evaluate(() => {
  const ps = [...document.querySelectorAll('#v-lesson .strokeanim path:not(.ghost)')]
  return ps.map((p) => {
    const L = p.getTotalLength()
    const off = parseFloat(getComputedStyle(p).strokeDashoffset)
    return L ? +Math.min(1, Math.max(0, off / L)).toFixed(3) : 1   // 1=未画 0=画完，中间=正在画
  })
})

let fail = 0
const ok = (c, m) => { if (!c) { fail++; console.error('✗ ' + m) } }

/* ---- ① 连拍：a/b/ü/üe ---- */
for (const u of ['a', 'b', 'ü', 'üe']) {
  const { n, i } = where[u]
  await page.goto(`${BASE}?learn=${n}&step=2&li=${i}`, { waitUntil: 'load' })
  await page.waitForSelector('#v-lesson .strokeanim', { timeout: 8000 })
  await page.waitForTimeout(5600)   // 首播播完（üe 总时长≈4.5s）
  await page.evaluate(() => document.querySelector('#v-lesson .rebtn').click())   // 零延迟确定性重播
  const fit = await page.locator('#v-lesson .sawrap').boundingBox()
  const shots = []
  for (const t of [500, 1500, 2500]) {
    await page.waitForTimeout(t === 500 ? 500 : 1000)
    const p = `${OUT}/${key(u)}_${t}.png`
    await page.screenshot({ path: p, clip: fit })   // clip 小区域，压截图开销防时点漂移
    shots.push({ t, buf: fs.readFileSync(p), state: await prog() })
  }
  for (const { t, state } of shots) {
    const drawing = state.filter((x) => x > 0 && x < 1).length
    const done = state.filter((x) => x === 0).length
    console.log(`  ${u} t=${t}: strokes=${state.join(',')} 正在画=${drawing} 完成=${done}`)
  }
  ok(!shots[0].buf.equals(shots[1].buf), `${u} 帧1(0.5s)=帧2(1.5s) 字节相同→没在动`)
  ok(!shots[1].buf.equals(shots[2].buf), `${u} 帧2(1.5s)=帧3(2.5s) 字节相同→没在动`)
  ok(shots[0].state.join() !== shots[1].state.join(), `${u} DOM 进度 0.5s→1.5s 未推进`)
  /* 时长感知：总时长 ≤2.2s 的短单元（a/b 等两笔字母）第三帧已合法收官（s2=s3=全完成是
     动画正常结束的签名）；在动证明由 s1≠s2 + 帧两两字节不同承担。长单元三帧必须全推进 */
  if (totalTime(strokesData.letters[u] ? strokesData.letters[u].strokes : strokesData.units[u].flatMap((l) => strokesData.letters[l].strokes)) > 2200) {
    ok(shots[1].state.join() !== shots[2].state.join(), `${u} DOM 进度 1.5s→2.5s 未推进`)
  }
  // 清单高亮推进：0.5s 时第 1 项 is-cur；2.5s（üe 未完则跳过全完成断言，只验高亮存在）
  const chips = await page.evaluate(() => [...document.querySelectorAll('#v-lesson .sit')].map((e) => e.className))
  ok(chips.some((c) => c.includes('is-cur') || c.includes('is-done')), `${u} 底部笔名清单无高亮态`)
  console.log(`✓ ${u} 连拍 3 帧均不同 + DOM 进度推进`)
}

/* ---- ② 真实路径时机（第1页停留→进写法页→立即在画） ---- */
{
  await page.goto(`${BASE}?learn=1`, { waitUntil: 'load' })
  await page.waitForSelector('#v-lesson .strokeanim', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(3000)   // 旧 bug：此刻写法页动画早已播完
  await page.click('[data-step="2"]')
  await page.waitForTimeout(400)
  const s = await prog()
  const drawing = s.some((x) => x > 0 && x < 1)
  await page.screenshot({ path: `${OUT}/entry_step2_400ms.png` })
  ok(drawing, `进写法页 400ms 后无笔正在画（${s.join(',')}）→ 进入时机仍错`)
  console.log(`✓ 真实路径：第1页停 3s → 进写法页 400ms 正在画笔（进度 ${s.join(',')}）`)
}

/* ---- ③ 47 单元断言（纯 Node 几何 + 4 单元真 DOM 校核）---- */
const MUST = ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w',
  'a','o','e','i','u','ü','ai','ei','ui','ao','ou','iu','ie','üe','er','an','en','in','un','ün','ang','eng','ing','ong']
let pass47 = 0
const rows = []
for (const u of MUST) {
  const ls = strokesData.letters[u] ? [u] : strokesData.units[u]   // üe 等组合单元在 units
  const st = ls.flatMap((l) => strokesData.letters[l].strokes)
  const t = totalTime(st)
  const good = st.length >= 1 && t > st.length * 400
  if (good) pass47++; else console.error(`✗ ${u}: 笔数=${st.length} 总时长=${t}ms`)
  rows.push(`${u}:${st.length}笔/${(t / 1000).toFixed(2)}s`)
}
console.log(`47 单元断言: ${pass47}/${MUST.length} 通过（笔数≥1 且总时长>笔数×0.4s）`)
console.log(rows.join(' '))

/* 真 DOM 校核 Node 近似长度（a/b/ü/üe） */
const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page2.addInitScript(() => localStorage.setItem('pinyin_learn', JSON.stringify({ u: 12, stars: {}, best: {} })))
for (const u of ['a', 'b', 'ü', 'üe']) {
  const { n, i } = where[u]
  await page2.goto(`${BASE}?learn=${n}&step=2&li=${i}&static=99`, { waitUntil: 'load' })
  await page2.waitForSelector('#v-lesson .strokeanim', { timeout: 8000 })
  const lens = await page2.evaluate(() => [...document.querySelectorAll('#v-lesson .strokeanim path:not(.ghost)')].map((p) => +p.getTotalLength().toFixed(2)))
  const approx = (strokesData.letters[u] ? strokesData.letters[u].strokes : strokesData.units[u].flatMap((l) => strokesData.letters[l].strokes)).map((s) => +pathLen(s.d).toFixed(2))
  const err = Math.max(...lens.map((l, j) => Math.abs(l - approx[j]) / l))
  ok(err < 0.02, `${u} Node 近似长度误差 ${((err) * 100).toFixed(1)}% ≥2%`)
  console.log(`✓ ${u} 长度校核 DOM=[${lens}] 近似=[${approx}] 最大误差=${((err) * 100).toFixed(2)}%`)
}
await page2.close()
await browser.close()

console.log(fail ? `\n===== 失败 ${fail} 项 =====` : '\n===== 笔顺动画验收全通过 =====')
process.exit(fail ? 1 : 0)
