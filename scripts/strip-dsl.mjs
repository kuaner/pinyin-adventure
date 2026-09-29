/* 一次性迁移（v2.1）：全仓 DSL 注音标记剥离为纯汉字。
   - 数据 JSON：'听{tīng}' → '听'；'<ruby>听<rt>tīng</rt></ruby>' → '听'（注音改由 T() 查词典自动补）
   - svelte/ts：T('…{…}…') 内 DSL 剥离（正则收紧到纯拼音体，避免误伤 {expr} 插值）
   排除 pinyin-dict.json（词典本体）。svelte 手写 <ruby> 序列留给人工重构（→ Ruby 组件）。 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PY = 'a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹ'
const RE_DSL = new RegExp(`([一-鿿])\\{[${PY}]+\\}`, 'g')
const RE_RUBY_JSON = /<ruby>([一-鿿])<rt>[^<]*<\/rt><\/ruby>/g

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(json|svelte|ts)$/.test(f) && !f.endsWith('.d.ts')) out.push(p)
  }
  return out
}
let nDsl = 0
let nRuby = 0
for (const f of walk(join(ROOT, 'src'))) {
  if (f.includes('pinyin-dict.json')) continue
  let t = readFileSync(f, 'utf8')
  const before = t
  if (f.endsWith('.json')) {
    t = t.replace(RE_RUBY_JSON, (_, h) => { nRuby++; return h })
  }
  t = t.replace(RE_DSL, (_, h) => { nDsl++; return h })
  if (t !== before) {
    writeFileSync(f, t)
    console.log('stripped:', f.replace(ROOT + '/', ''))
  }
}
console.log(`done: DSL ${nDsl} 处、ruby 标签 ${nRuby} 处`)
/* 残留检查 */
import { execSync } from 'node:child_process'
const left = execSync(`grep -rnE "([一-鿿])\\\\{[${PY}]+\\\\}|<ruby>" src --include='*.json' | wc -l`).toString().trim()
console.log('JSON 残留 DSL/ruby:', left)
