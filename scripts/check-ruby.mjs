/* 注音+文案层 lint（v2.6 双门槛，kuaner 文案层+全点击语音架构）：
   A. 模板区中文必须走 Speak/t() 通道（数据纯文本、展示层统一注音 —— Bug#2 收口延续）
   B. 组件/库中文字面量告警：src 组件与 stores/lib 的 '中文' 字面量一律违法，
      唯一真相 = src/text/strings.ts（key→中文）；数据层文案（*.json）不扫描。
   豁免：块注释/行注释、hint: 音频缺失兜底（家长向诊断 toast）、aria-* 属性、
        <ruby 手写平价位、HTML 注释、lib/probe.ts（?probe 验收钩子=开发者向）。
   运行：node scripts/check-ruby.mjs */
import fs from 'node:fs'
import { globSync } from 'node:fs'

const HAN = /[一-鿿]/
let warn = 0
const fail = (msg) => { console.warn(msg); warn++ }

for (const f of globSync('src/**/*.svelte')) {
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  let inScript = false, inStyle = false, inComment = false
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    if (/^\s*<script/.test(line)) { inScript = true; continue }
    if (/^\s*<\/script>/.test(line)) { inScript = false; continue }
    if (/^\s*<style/.test(line)) { inStyle = true; continue }
    if (inStyle) { if (/<\/style>/.test(line)) inStyle = false; continue }
    /* 块注释逐行剥离（含跨行） */
    let out = ''
    for (let k = 0; k < line.length; k++) {
      if (!inComment && line[k] === '/' && line[k + 1] === '*') { inComment = true; k++; continue }
      if (inComment && line[k] === '*' && line[k + 1] === '/') { inComment = false; k++; continue }
      if (!inComment) out += line[k]
    }
    line = out
    if (/^\s*\/\//.test(line)) continue
    if (inScript) {
      /* B. script 区：中文字符串字面量违法（键名走 strings.ts） */
      if (/\bhint:\s*['"`]/.test(line)) continue                  /* 音频缺失兜底 toast=家长向 */
      if (/^\s*import\s/.test(line)) continue
      for (const m of line.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)) {
        const s = m[1] ?? m[2] ?? m[3] ?? ''
        if (HAN.test(s)) fail(`✗ ${f}:${i + 1} 中文字面量未入文案层（strings.ts）：'${s.slice(0, 40)}'`)
      }
      continue
    }
    /* A. 模板区：注释/合法通道豁免后不允许残留中文 */
    if (/<!--/.test(lines[i])) continue
    if (/<Speak\s/.test(line) || /<ruby\s/.test(line)) continue    /* Speak/Ruby 组件整体注音 */
    if (/\bhint:\s*'/.test(line) || /\bhint:\s+"/.test(line)) continue
    if (/aria-/.test(line)) continue                               /* a11y 属性（读屏向） */
    for (const m of line.matchAll(/\{([^{}]*)\}/g)) {
      const inner = m[1]
      if (!HAN.test(inner)) continue
      /* t('key')/T(data) 包裹段安全：先把 t(/T( 调用占位掉再查残留字面量 */
      const stripped = inner.replace(/\b[tT]\(\s*(tRaw\()?\s*'[^']*'\s*\)/g, '').replace(/\b[tT]\(\s*"[^"]*"\s*\)/g, '')
      const leftover = [...stripped.matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => x[1] || x[2]).filter((x) => HAN.test(x))
      if (leftover.length) fail(`✗ ${f}:${i + 1} 中文串未过注音通道：{${inner.trim().slice(0, 70)}}`)
    }
  }
}

/* stores/lib（数据层 *.json 之外的运行时代码） */
for (const f of globSync('src/stores/*.ts').concat(['src/lib/audio.ts', 'src/lib/ruby.ts', 'src/lib/quizEngine.ts'])) {
  const src = fs.readFileSync(f, 'utf8')
  /* 剥块注释与行注释 */
  const noCmt = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  let ln = 1
  for (const raw of noCmt.split('\n')) {
    ln++
    if (/\bhint:\s*['"`]/.test(raw)) continue
    for (const m of raw.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)) {
      const s = m[1] ?? m[2] ?? m[3] ?? ''
      if (HAN.test(s)) fail(`✗ ${f}:${ln} 中文字面量未入文案层（strings.ts）：'${s.slice(0, 40)}'`)
    }
  }
}

if (warn) {
  console.warn(`\n✗ ${warn} 处文案层违规（唯一真相=src/text/strings.ts；家长向诊断可走 hint: 豁免）`)
  process.exit(2)
}
console.log('✓ 文案层收口：组件/stores 零中文字面量，模板中文全走 Speak/t() 注音通道')
