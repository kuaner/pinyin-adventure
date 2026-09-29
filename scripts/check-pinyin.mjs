/* v2.1 注音回归校验：全仓 UI 文案 run，pinyin-pro 引擎输出 vs v1 DSL 人工核对注音（ground truth）
   逐字对比。差集 = 多音字覆盖表（OVERRIDES）的录入候选，逐条人工裁决。
   用法：node scripts/check-pinyin.mjs [--all 打印全部一致项] */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'
import overrides from '../src/data/pinyin-overrides.json' with { type: 'json' }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

/* ground truth：v1 DSL 提取的人工核对词典（gen-dict.mjs 产物） */
const dict = JSON.parse(readFileSync(join(SRC, 'data/pinyin-dict.json'), 'utf8'))
const WORDS = dict.words

/* OVERRIDES 与运行时同源（src/data/pinyin-overrides.json） */
const OVERRIDES = overrides.words
const IN_WORD_TONE = overrides.inWordTone

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(json|svelte|ts)$/.test(f) && !f.endsWith('.d.ts')) out.push(p)
  }
  return out
}

/* 从源码提取全部文案 run：T('…') / "…" JSON 字符串字段的汉字段 */
function extractRuns() {
  const runs = new Set()
  for (const f of walk(SRC)) {
    if (f.endsWith('pinyin-dict.json') || f.endsWith('pinyin-overrides.json')) continue
    const t = readFileSync(f, 'utf8')
    if (f.endsWith('.json')) {
      for (const m of t.matchAll(/"([^"\\]*)"/g)) {
        for (const h of m[1].matchAll(/[一-鿿]{1,}/g)) runs.add(h[0])
      }
    } else {
      for (const m of t.matchAll(/T\(\s*'([^']*)'/g)) {
        for (const h of m[1].matchAll(/[一-鿿]{1,}/g)) runs.add(h[0])
      }
      for (const m of t.matchAll(/text="([^"]*)"/g)) {
        for (const h of m[1].matchAll(/[一-鿿]{1,}/g)) runs.add(h[0])
      }
    }
  }
  return [...runs]
}

/* ground truth 注音（词级锁定 + chars 兜底） */
function truth(run) {
  const chars = [...run]
  const out = new Array(chars.length).fill(null)
  let i = 0
  const keys = Object.keys(WORDS).sort((a, b) => b.length - a.length)
  while (i < chars.length) {
    let hit = null
    for (const w of keys) {
      if ([...w].length > 1 && startsAt(chars, i, w)) { hit = { w, pys: WORDS[w] }; break }
    }
    if (!hit) {
      const c = chars[i]
      if (dict.chars[c]) hit = { w: c, pys: [dict.chars[c]] }
    }
    if (hit) {
      ;[...hit.w].forEach((_, k) => { out[i + k] = hit.pys[k] ?? null })
      i += [...hit.w].length
    } else i++
  }
  return out
}
function startsAt(chars, at, w) {
  const ws = [...w]
  return at + ws.length <= chars.length && ws.every((c, j) => chars[at + j] === c)
}

/* 引擎侧：pinyin-pro + OVERRIDES（与 ruby.ts annotate 同逻辑，无 dict 读音） */
function engine(run) {
  const chars = [...run]
  const base = pinyin(run, { type: 'array', tone: true })
  const pys = chars.map((_, i) => base[i] || '')
  let i = 0
  const keys = Object.keys(OVERRIDES).sort((a, b) => b.length - a.length)
  const wkeys = Object.keys(WORDS).sort((a, b) => b.length - a.length)
  while (i < chars.length) {
    let hit = null
    for (const w of keys) if (startsAt(chars, i, w)) { hit = { w, pys: Array.isArray(OVERRIDES[w]) ? OVERRIDES[w] : String(OVERRIDES[w]).trim().split(/\s+/) }; break }
    if (!hit) for (const w of wkeys) if ([...w].length > 1 && startsAt(chars, i, w)) { hit = { w, pys: null, to: i + [...w].length }; break }
    if (hit) {
      if (hit.pys) hit.pys.forEach((p, k) => { pys[i + k] = p })
      else {
        /* 词表词（常为整句）命中：词内逐位 override 子匹配 + 语气字白名单（与 ruby.ts 同步） */
        let j = i
        while (j < hit.to) {
          const sub = (() => { for (const w of keys) if (startsAt(chars, j, w)) return OVERRIDES[w]; return null })()
          if (sub) { sub.forEach((p, k) => { pys[j + k] = p }); j += sub.length }
          else {
            const t = overrides.inWordTone[chars[j]]
            if (t) pys[j] = t
            j++
          }
        }
      }
      i += [...hit.w].length
    } else i++
  }
  return pys
}

/* ---- 主流程 ---- */
const runs = extractRuns().sort((a, b) => b.length - a.length)
let nRun = 0, nChar = 0
const diffs = []
for (const run of runs) {
  const tr = truth(run), en = engine(run)
  nRun++; nChar += tr.length
  for (let i = 0; i < tr.length; i++) {
    if (tr[i] && tr[i] !== en[i]) {
      diffs.push({ run, i, char: [...run][i], want: tr[i], got: en[i] })
    }
  }
}
console.log(`runs=${nRun} chars=${nChar} 差异字=${diffs.length}`)
for (const d of diffs) {
  console.log(`  「${d.run}」 第${d.i + 1}字 ${d.char}: truth=${d.want} engine=${d.got}`)
}
