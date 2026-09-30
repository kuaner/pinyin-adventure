/* 注音 lint（Bug#2 修复方向，kuaner 定：数据纯文本、展示层统一 T()/Ruby）：
   扫 svelte 模板区的中文插值——中文串没包 T() 且不在 Ruby 组件属性里的报 warning。
   豁免：script 区、块注释、playAudio hint 兜底（家长向诊断 toast）、aria-*（非视觉）。
   运行：node scripts/check-ruby.mjs */
import fs from 'node:fs'
import { globSync } from 'node:fs'

const HAN = /[一-鿿]/
let warn = 0
for (const f of globSync('src/**/*.svelte')) {
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  let inScript = false, inStyle = false, inComment = false
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    if (/^\s*<script/.test(line)) { inScript = true; continue }
    if (/^\s*<\/script>/.test(line)) { inScript = false; continue }
    if (inScript) continue
    if (/^\s*<style/.test(line)) { inStyle = true; continue }
    if (inStyle) { if (/<\/style>/.test(line)) inStyle = false; continue }
    /* 块注释逐行剥离（含跨行） */
    let out = ''
    for (let k = 0; k < line.length; k++) {
      if (!inComment && line[k] === '/' && line[k + 1] === '*') { inComment = true; k++ ; continue }
      if (inComment && line[k] === '*' && line[k + 1] === '/') { inComment = false; k++ ; continue }
      if (!inComment) out += line[k]
    }
    line = out
    if (/^\s*\/\//.test(line)) continue
    if (/<Ruby\s/.test(line)) continue                       /* Ruby 组件整体注音 */
    if (/\bhint:\s*'/.test(line) || /\bhint:\s+"/.test(line)) continue /* 音频缺失兜底 toast=家长向 */
    for (const m of line.matchAll(/\{([^{}]*)\}/g)) {
      const inner = m[1]
      if (!HAN.test(inner)) continue
      /* 中文串全在 T('…') 里的算安全：先把 T 包裹的中文串占位掉再查残留 */
      const stripped = inner.replace(/\bT\(\s*'[^']*'\s*\)/g, '').replace(/\bT\(\s*"[^"]*"\s*\)/g, '')
      const leftover = [...stripped.matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => x[1] || x[2]).filter((x) => HAN.test(x))
      if (leftover.length) {
        console.warn(`⚠ ${f}:${i + 1} 中文串未过 T()：{${inner.trim().slice(0, 70)}}`)
        warn++
      }
    }
  }
}
console.log(warn ? `\n✗ ${warn} 处疑似漏注音（若确属家长向文本，改写结构或加豁免）` : '✓ 模板中文插值全部走 T()/Ruby 通道')
process.exit(warn ? 2 : 0)
