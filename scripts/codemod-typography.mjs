/* v2.8 排版立法 codemod：全库 font-size/间距值 → app.css 变量引用（一次性脚本）
   字号映射（px→var）：≤14→xs 15.x→sm 16-20→md 21-26→lg 27-34→xl 35-40→em 41-48→glyph-sm 49-70→glyph 71-95→glyph-lg ≥96→hero
   间距映射：1-5→sp-1 6-10→sp-2 11-14→sp-3 15-20→sp-4 21-28→sp-5 29-40→sp-6 41-56→sp-7（>56 保留并上报）
   范围：padding/margin/gap 家族 + font-size。box-shadow/border/几何/位移/圆角一律不动。 */
import fs from 'node:fs'

const ROOT = new URL('..', import.meta.url).pathname
const files = [ROOT + 'src/app.css']
for (const p of fs.readdirSync(ROOT + 'src/components', { recursive: true })) {
  const full = ROOT + 'src/components/' + p
  if (fs.statSync(full).isFile() && /\.svelte$/.test(p)) files.push(full)
}

const FS_MAP = v =>
  v <= 14 ? '--fs-xs' : v < 16 ? '--fs-sm' : v <= 20 ? '--fs-md' : v <= 26 ? '--fs-lg'
  : v <= 34 ? '--fs-xl' : v <= 40 ? '--fs-em' : v <= 48 ? '--fs-glyph-sm' : v <= 70 ? '--fs-glyph'
  : v <= 95 ? '--fs-glyph-lg' : '--fs-hero'
const SP_MAP = v =>
  v <= 5 ? '--sp-1' : v <= 10 ? '--sp-2' : v <= 14 ? '--sp-3' : v <= 20 ? '--sp-4'
  : v <= 28 ? '--sp-5' : v <= 40 ? '--sp-6' : v <= 56 ? '--sp-7' : null

let nFS = 0, nSP = 0
const odd = []
for (const f of files) {
  let src = fs.readFileSync(f, 'utf8')
  const rel = f.replace(ROOT, '')

  /* clamp 字模：精确串替换（先于通用 pass） */
  for (const [from, to] of [
    ['clamp(96px, 30vw, 128px)', 'clamp(96px,30vw,var(--fs-hero))'],
    ['clamp(96px,30vw,128px)', 'clamp(96px,30vw,var(--fs-hero))'],
    ['clamp(96px,28vw,128px)', 'clamp(96px,28vw,var(--fs-hero))'],
    ['clamp(84px,24vw,116px)', 'clamp(var(--fs-glyph-lg),24vw,var(--fs-hero))'],
    ['clamp(64px,19vw,88px)', 'clamp(var(--fs-glyph),19vw,var(--fs-glyph-lg))'],
  ]) src = src.split(from).join(to)

  /* font-size: Npx（含小数）→ var；已是 var()/clamp()/calc()/JS 表达式的不动 */
  src = src.replace(/font-size:\s*([0-9]+(?:\.[0-9]+)?)px/g, (m, num) => {
    nFS++
    return `font-size:var(${FS_MAP(parseFloat(num))})`
  })
  /* JS 动态字号（font-size:{...}）上报不改 */
  for (const m of src.matchAll(/font-size:\s*\{[^}]+\}[^;"}]*/g)) odd.push(`${rel}: JS字号 ${m[0].slice(0, 60)}`)

  /* 间距家族：值内每个 Npx → var（跳过已是 var 的；calc 内也换） */
  src = src.replace(
    /((?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left))?:)([^;}\n]+)/g,
    (m, prop, val) => {
      if (/var\(--sp-/.test(val)) return m
      const nv = val.replace(/(^|[\s(+])([0-9]+(?:\.[0-9]+)?)px/g, (mm, pre, num) => {
        const tok = SP_MAP(parseFloat(num))
        if (!tok) { odd.push(`${rel}: 大间距保留 ${prop}${val.trim()}`); return mm }
        nSP++
        return `${pre}var(${tok})`
      })
      return nv === val ? m : prop + nv
    }
  )
  /* 负间距上报 */
  for (const m of src.matchAll(/(?:padding|margin)[^:;}-]*?:[^;}\n]*-[0-9.]+px/g)) odd.push(`${rel}: 负值 ${m[0].slice(0, 60)}`)

  fs.writeFileSync(f, src)
}
console.log(`font-size 替换 ${nFS} 处；间距替换 ${nSP} 处`)
console.log(odd.length ? '--- 上报（人工处理）---\n' + odd.join('\n') : '无异常项')
