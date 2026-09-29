/* pinyin-dict.json 自动构建（v2.1 Ruby 自动注音）
   源：① 全仓 T('汉{pīn}') DSL 标记（数据 JSON + 组件 + stores）
       ② 组件里手写 <ruby>汉<rt>pīn</rt></ruby> 序列
       ③ zi180.json（180 字逐字核对，chars 最高权威）
       ④ pinyin.json 锚点表（h→p）
       ⑤ words.json 双字词（w→p 拆字）
   规则：连续汉字 run ≥2 字整词进 words（多音字靠词上下文消歧）；
         单字 run 进 chars 投票；zi180/anchors 覆盖投票结果。
   自验证：对全部源 run，用生成的词典重注音，与原 DSL/ruby 输出逐字对比，
         差异自动回填 words（多字 run）或报警（单字 run，需人工裁决）。
   用法：node scripts/gen-dict.mjs   */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

/* ---------- 手动裁决表（生成时合并，最高优先级） ----------
   多音字词条：整词注音（词内消歧）；单字裁决：chars 最终音 */
const MANUAL_WORDS = {
  // 轻声/变调在 UI 文案里的实际读法（DSL 已正确标注，此处兜底歧义词）
}
const MANUAL_CHARS = {
  了: 'le', 得: 'de', 的: 'de', 地: 'dì', 一: 'yī', 不: 'bù',
  长: 'cháng', 着: 'zhe', 中: 'zhōng', 只: 'zhǐ', 还: 'hái',
}

/* ---------- 0. 枚举源文件 ---------- */
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(json|svelte|ts)$/.test(f) && !f.endsWith('.d.ts')) out.push(p)
  }
  return out
}
const files = walk(SRC).filter((p) => !p.includes('pinyin-dict.json'))

/* ---------- 1. 提取 DSL / ruby 手写 runs ---------- */
const RE_DSL = /([一-鿿])\{([^{}]*)\}/g
const RE_RUBY = /<ruby>([一-鿿])<rt>([^<]*)<\/rt><\/ruby>/g
/** @type {Array<{file:string,line:number,hans:string,pys:string[],from:string}>} */
const runs = []
function pushRun(list, file, line, from) {
  if (!list.length) return
  runs.push({ file: file.replace(ROOT + '/', ''), line, hans: list.map((x) => x[0]).join(''), pys: list.map((x) => x[1]), from })
}
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  const lines = text.split('\n')
  lines.forEach((ln, i) => {
    for (const [re, from] of [[RE_DSL, 'dsl'], [RE_RUBY, 'ruby']]) {
      re.lastIndex = 0
      /** @type {string[][]} */
      let cur = []
      let lastEnd = -1
      let m
      while ((m = re.exec(ln))) {
        if (lastEnd >= 0 && m.index !== lastEnd) { pushRun(cur, f, i + 1, from); cur = [] } // 中断 → 断词
        cur.push([m[1], m[2]])
        lastEnd = m.index + m[0].length
      }
      pushRun(cur, f, i + 1, from)
    }
  })
}

/* ---------- 2. 汇总 ---------- */
/** @type {Record<string,string[]>} */
const words = {}
const wordsSrc = {} // 词 → 来源标记（json=words.json / dsl / manual）
/** @type {Record<string,Record<string,number>>} */
const charVotes = {}
const conflicts = []
for (const r of runs) {
  if (r.hans.length >= 2) {
    const prev = words[r.hans]
    if (prev && prev.join(' ') !== r.pys.join(' ')) conflicts.push({ word: r.hans, a: prev, b: r.pys, file: r.file, line: r.line })
    else if (!prev) { words[r.hans] = r.pys; wordsSrc[r.hans] = 'dsl' }
  } else {
    const h = r.hans
    charVotes[h] = charVotes[h] || {}
    charVotes[h][r.pys[0]] = (charVotes[h][r.pys[0]] || 0) + 1
  }
}

/* words.json：双字词拼音（长度对齐才收） */
const wordsData = JSON.parse(readFileSync(join(SRC, 'data/words.json'), 'utf8'))
for (const w of wordsData) {
  const pys = String(w.p).trim().split(/\s+/)
  if (pys.length === [...w.w].length && !words[w.w]) { words[w.w] = pys; wordsSrc[w.w] = 'json' }
}

/* zi180：chars 权威 */
const ziData = JSON.parse(readFileSync(join(SRC, 'data/zi180.json'), 'utf8'))
/** @type {Record<string,string>} */
const chars = {}
const ziFrom = {}
for (const z of ziData) { chars[z.h] = z.p; ziFrom[z.h] = 'zi180' }

/* pinyin.json：锚点（h→p 权威） */
const pyData = JSON.parse(readFileSync(join(SRC, 'data/pinyin.json'), 'utf8'))
for (const k in pyData.anchors) {
  const A = pyData.anchors[k]
  if (!chars[A.h]) { chars[A.h] = A.p; ziFrom[A.h] = 'anchor' }
}

/* DSL 单字投票兜底（zi180/anchor 未覆盖的字）。
   注意必须先于 letters.han：整体认读 shi 的直注字"是"tts=shī（呼读音），
   但"是"在文案里读 shì —— letters.han 只填最后的空洞 */
const votePicked = []
for (const h in charVotes) {
  if (chars[h]) continue
  const votes = Object.entries(charVotes[h]).sort((a, b) => b[1] - a[1])
  chars[h] = votes[0][0]
  ziFrom[h] = 'dsl-vote'
  if (votes.length > 1) votePicked.push(h + ':' + votes.map((v) => v[0] + '×' + v[1]).join('/'))
}

for (const k in pyData.letters) {
  const L = pyData.letters[k]
  const tts = String(L.tts || '')
  if ([...String(L.han || '')].length === 1 && /^[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+$/.test(tts) && !chars[L.han]) {
    chars[L.han] = tts
    ziFrom[L.han] = 'letter-han'
  }
}
/* 手动裁决最高优先 */
for (const w in MANUAL_WORDS) { words[w] = MANUAL_WORDS[w].split(' '); wordsSrc[w] = 'manual' }
for (const h in MANUAL_CHARS) chars[h] = MANUAL_CHARS[h]

/* ---------- 3. annotate（与 src/lib/ruby.ts 同逻辑，验证用） ---------- */
const WORD_KEYS = Object.keys(words).sort((a, b) => b.length - a.length)
function annotate(s, py) {
  s = String(s)
  let out = ''
  let i = 0
  const n = s.length
  while (i < n) {
    const c = s[i]
    if (!/[一-鿿]/.test(c)) { out += c === '<' ? '&lt;' : c; i++; continue }
    let hit = null
    if (py) for (const w in py) { if (s.startsWith(w, i)) { hit = { w, pys: [...w].map((x) => py[w] || chars[x] || '') }; break } }
    if (!hit) for (const w of WORD_KEYS) { if (s.startsWith(w, i)) { hit = { w, pys: words[w] }; break } }
    if (hit) {
      const hs = [...hit.w]
      out += hs.map((h, j) => `<ruby>${h}<rt>${hit.pys[j] || ''}</rt></ruby>`).join('')
      i += hit.w.length
    } else {
      const p = chars[c]
      out += p ? `<ruby>${c}<rt>${p}</rt></ruby>` : c
      i++
    }
  }
  return out
}

/* ---------- 4. 自验证：每个源 run 重注音 vs 原 DSL ---------- */
let mismatch = 0
const fixes = {}
for (const r of runs) {
  const expect = [...r.hans].map((h, j) => `<ruby>${h}<rt>${r.pys[j]}</rt></ruby>`).join('')
  const got = annotate(r.hans)
  if (expect !== got) {
    mismatch++
    if (r.hans.length >= 2) fixes[r.hans] = r.pys // 多字 run 强制回填词表
    else console.log(`  单字歧义 ${r.hans} 期望=${r.pys[0]} 实得=${got} @${r.file}:${r.line}`)
  }
}
let fixed = 0
for (const w in fixes) { if (words[w] !== fixes[w] || wordsSrc[w] !== 'manual') { words[w] = fixes[w]; wordsSrc[w] = 'manual'; fixed++ } }
/* 回填后重验一遍 */
const WORD_KEYS2 = Object.keys(words).sort((a, b) => b.length - a.length)
let mismatch2 = 0
const badRuns = []
{
  const wk = WORD_KEYS2
  const ann = (s) => {
    let out = ''
    let i = 0
    while (i < s.length) {
      const c = s[i]
      if (!/[一-鿿]/.test(c)) { out += c === '<' ? '&lt;' : c; i++; continue }
      let hit = null
      for (const w of wk) { if (s.startsWith(w, i)) { hit = { w, pys: words[w] }; break } }
      if (hit) { out += [...hit.w].map((h, j) => `<ruby>${h}<rt>${hit.pys[j] || ''}</rt></ruby>`).join(''); i += hit.w.length }
      else { const p = chars[c]; out += p ? `<ruby>${c}<rt>${p}</rt></ruby>` : c; i++ }
    }
    return out
  }
  for (const r of runs) {
    const expect = [...r.hans].map((h, j) => `<ruby>${h}<rt>${r.pys[j]}</rt></ruby>`).join('')
    if (expect !== ann(r.hans)) { mismatch2++; badRuns.push(`${r.hans}→${r.pys.join(' ')} @${r.file}:${r.line}`) }
  }
}

/* ---------- 5. 输出 ---------- */
const dict = {
  _meta: {
    built: new Date().toISOString(),
    chars: Object.keys(chars).length,
    words: Object.keys(words).length,
    sources: 'dsl-runs + zi180 + anchors + words.json + manual',
  },
  chars,
  words,
}
writeFileSync(join(SRC, 'data/pinyin-dict.json'), JSON.stringify(dict, null, 1))
console.log(`dict: ${Object.keys(chars).length} 字 / ${Object.keys(words).length} 词`)
console.log(`源 runs: ${runs.length}（dsl/ruby 提取）`)
console.log(`词冲突（取先见）: ${conflicts.length}`)
conflicts.forEach((c) => console.log(`  ! ${c.word}: ${c.a.join(' ')} vs ${c.b.join(' ')} @${c.file}:${c.line}`))
console.log(`投票多音字（取最高频）: ${votePicked.length}`)
votePicked.forEach((v) => console.log('  ~ ' + v))
console.log(`第一轮差异: ${mismatch} → 回填词表 ${fixed} 条 → 复验差异: ${mismatch2}`)
badRuns.forEach((b) => console.log('  ✗ ' + b))
if (mismatch2 > 0) { console.log('!! 存在无法自动消歧的 run，需人工处理'); process.exit(1) }
console.log('✓ 全部源 run 注音与原 DSL 一致（零回退）')
