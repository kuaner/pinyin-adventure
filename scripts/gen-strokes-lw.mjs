/* 笔顺换血生成器（v2.3）：lasagoo/letter-writing glyphs.js → src/data/strokes.json
 * 底本直接采用（kuaner 2026-09-30 06:57 裁定"直接拿来用就可以了"），部编版适配四处：
 *   u 一笔拆两笔（竖右弯+竖）、w 一笔拆两笔（斜下斜上×2）、k 三笔并两笔（左斜右斜连写）、
 *   a/t 的竖改成竖右弯（底部右弯）；另自补 ü 两点 / ê 抑扬符。
 * 坐标变换：letter-writing (y 0..300，四线格) → 本仓 SVG (y 20..140，格线 20/60/100/140)：
 *   x' = off + 0.4x（每字母在 76 宽格内居中），y' = 20 + 0.4y。仅 M/L/C/Q 数字对，偶位=x。
 * 交叉校验：每单元笔名串接必须与 lessons.json 的 strokes 数组一致，防数据-展示脱节。
 * 运行：node scripts/gen-strokes-lw.mjs
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const LW_PATH = new URL('../../sources/stroke/letter-writing-glyphs.js', import.meta.url).pathname

/* ---------- 1. 载入 letter-writing（IIFE 挂 window.Glyphs） ---------- */
const win = {}
new Function('window', fs.readFileSync(LW_PATH, 'utf8'))(win)
const G = win.Glyphs

/* ---------- 2. 部编版笔名（与 lessons.json strokes 数组逐字一致） ---------- */
const NAMES = {
  a: ['左半圆', '竖右弯'], o: ['圆'], e: ['横加左半圆'],
  i: ['竖', '点'], u: ['竖右弯', '竖'], ü: ['竖右弯', '竖', '点', '点'], ê: ['横加左半圆', '抑扬符'],
  b: ['竖', '右半圆'], p: ['竖', '右半圆'], m: ['竖', '左弯竖', '左弯竖'], f: ['右弯竖', '横'],
  d: ['左半圆', '竖'], t: ['竖右弯', '横'], n: ['竖', '左弯竖'], l: ['竖'],
  g: ['左半圆', '竖左弯'], k: ['竖', '左斜右斜'], h: ['竖', '左弯竖'],
  j: ['竖左弯', '点'], q: ['左半圆', '竖'], x: ['右斜', '左斜'], r: ['竖', '右弯'],
  z: ['横左斜横'], c: ['左半圆'], s: ['左弯右弯'], y: ['右斜', '左斜'], w: ['斜下斜上', '斜下斜上'],
}
const BASE = Object.keys(NAMES)

/* ---------- 3. 数字坐标对变换（M/L/C/Q 全部成对，偶位=x） ---------- */
function tx(d, off) {
  let i = 0
  return d.replace(/-?\d*\.?\d+/g, (n) => {
    const v = parseFloat(n)
    const out = i++ % 2 === 0 ? off + v * 0.4 : 20 + v * 0.4
    return String(Math.round(out * 100) / 100)
  })
}
function tokens(d) { return d.split(' ') }
function pt(d, i) { const t = tokens(d); return [+t[i], +t[i + 1]] }

/* ---------- 4. 部编版适配（在 letter-writing 已按 XS 拉伸的坐标上改） ---------- */
function adapt(ch, g) {
  const st = g.strokes
  if (ch === 'u') {
    /* 一笔 'M x 100 L x 158 C … x2 158 L x2 100' → 竖右弯 + 竖（拆掉闭合段） */
    const d = st[0].d
    const t = tokens(d)
    const cut = t.lastIndexOf('L')
    const [lx, ly] = [+t[cut + 1], +t[cut + 2]]
    const [sx, sy] = [+t[1], +t[2]]
    const cend = [+t[cut - 2], +t[cut - 1]]   /* C 段终点 = 竖的落点 */
    return { adv: g.adv, strokes: [{ d: t.slice(0, cut).join(' ') }, { d: `M ${lx} ${ly} L ${cend[0]} ${cend[1]}` }] }
  }
  if (ch === 'w') {
    /* 一笔四段 → 两个"斜下斜上"（在中点顶拆开） */
    const d = st[0].d
    const t = tokens(d)
    const Ls = t.map((x, i) => (x === 'L' ? i : -1)).filter((i) => i >= 0)
    const mid = Ls[1]
    const [mx, my] = [+t[mid + 1], +t[mid + 2]]
    return { adv: g.adv, strokes: [{ d: t.slice(0, mid + 3).join(' ') }, { d: `M ${mx} ${my} ` + t.slice(mid + 3).join(' ') }] }
  }
  if (ch === 'k') {
    /* 三笔 → 两笔：右斜+左斜 连写成一笔（第二、三笔拼接） */
    const d2 = st[1].d, d3 = st[2].d
    const rest = tokens(d3).slice(3).join(' ')
    return { adv: g.adv, strokes: [{ d: st[0].d }, { d: d2 + ' ' + rest }] }
  }
  if (ch === 'a' || ch === 't') {
    /* 竖 → 竖右弯（底部向右弯出一小段） */
    const si = ch === 'a' ? 1 : 0
    const [sx] = pt(st[si].d, 1)
    const ny = ch === 'a' ? 'M %X 100 L %X 168 C %X 188, ' + (sx + 10) + ' 198, ' + (sx + 24) + ' 198'
      : 'M %X 24 L %X 160 C %X 186, ' + (sx + 9) + ' 198, ' + (sx + 25) + ' 198'
    const out = st.slice()
    out[si] = { d: ny.replaceAll('%X', String(sx)) }
    return { adv: g.adv, strokes: out }
  }
  return null
}

/* ---------- 5. ü / ê 自补 ---------- */
function extra(ch) {
  if (ch === 'ü') {
    const u = adapt('u', G.get('u'))
    const t1 = tokens(u.strokes[0].d)
    const [x1] = [+t1[1]], t2 = tokens(u.strokes[1].d)
    const [x2] = [+t2[1]]
    return u.strokes.concat([
      { dot: true, x: x1, y: 56 },
      { dot: true, x: x2, y: 56 },
    ])
  }
  if (ch === 'ê') {
    const e = G.get('e')
    const adv = e.adv
    const cx = adv / 2
    return e.strokes.concat([{ d: `M ${cx - 15} 86 L ${cx} 68 L ${cx + 15} 86` }])
  }
  return null
}

/* ---------- 6. 组装 ---------- */
const W = 76
const letters = {}
for (const ch of BASE) {
  const g = ch === 'ü' || ch === 'ê' ? { strokes: extra(ch), adv: ch === 'ü' ? G.get('u').adv : G.get('e').adv } : adapt(ch, G.get(ch)) || G.get(ch)
  const off = Math.round((W - g.adv * 0.4) / 2 * 100) / 100
  const names = NAMES[ch]
  if (names.length !== g.strokes.length) {
    console.error(`✗ ${ch} 笔数不合：names=${names.length} strokes=${g.strokes.length}`)
    process.exit(1)
  }
  letters[ch] = {
    strokes: g.strokes.map((s, i) => {
      if (s.type === 'dot' || s.dot) {
        const x = Math.round((off + s.x * 0.4) * 100) / 100
        const y = Math.round((20 + s.y * 0.4) * 100) / 100
        return { n: names[i], d: `M ${x} ${y} L ${Math.round((x + 0.8) * 100) / 100} ${Math.round((y + 0.8) * 100) / 100}` }
      }
      return { n: names[i], d: tx(s.d, off) }
    }),
  }
}

/* ---------- 7. units（沿用现网字母序列映射） ---------- */
const old = JSON.parse(fs.readFileSync(new URL('../src/data/strokes.json', import.meta.url), 'utf8'))
const units = old.units

/* ---------- 8. 校验：box 越界 / lessons.json 笔名一致性 ---------- */
for (const ch in letters) {
  for (const s of letters[ch].strokes) {
    for (const [x, y] of [... s.d.matchAll(/([-\d.]+)[ ,]([-\d.]+)/g)].map((m) => [+m[1], +m[2]])) {
      if (x < -0.01 || x > W + 0.01 || y < 19.99 || y > 142.6) {
        console.error(`✗ ${ch} 越界 (${x},${y}) in ${s.d}`)
        process.exit(1)
      }
    }
  }
}
const lessons = JSON.parse(fs.readFileSync(new URL('../src/data/lessons.json', import.meta.url), 'utf8')).lessons
let checked = 0
for (const l of lessons) {
  for (const e of l.letters) {
    const seq = units[e.k] || [e.k]
    const got = seq.flatMap((c) => letters[c].strokes.map((s) => s.n))
    if (JSON.stringify(got) !== JSON.stringify(e.strokes)) {
      console.error(`✗ lessons.json 第${l.n}课 ${e.k} 笔名不合：data=[${got}] lessons=[${e.strokes}]`)
      process.exit(1)
    }
    checked++
  }
}

const out = {
  _meta: 'v2.3 笔顺换血：lasagoo/letter-writing glyphs.js 底本直接采用（MIT，kuaner 2026-09-30 裁定），致谢见 repo README。'
    + '坐标系：四线三格 y=20/60/100/140（中格 60-100），每格宽 76，笔画粗 8 圆头。'
    + '部编版适配：u 拆竖右弯+竖、w 拆两个斜下斜上、k 左斜右斜连写、a/t 竖改竖右弯；自补 ü 两点与 ê 抑扬符（4 声调符号由 ToneDrill 内置 SVG 承担）。'
    + `生成器 scripts/gen-strokes-lw.mjs（勿手改本文件，${checked} 单元与 lessons.json 笔名已交叉校验）。`,
  letters,
  units,
}
fs.writeFileSync(new URL('../src/data/strokes.json', import.meta.url), JSON.stringify(out, null, 1).replace(/\n/g, '\n') + '\n')
console.log(`✓ strokes.json v2 生成：${Object.keys(letters).length} 基础字母 + ${Object.keys(units).length} 复合单元，lessons ${checked} 单元笔名全部一致`)
