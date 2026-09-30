/* Ruby 自动注音 v2.1：pinyin-pro 引擎（kuaner 指定的架构升级）。
   T('答对啦，你真棒') → 逐字 <ruby>汉<rt>pīn</rt></ruby>，拉丁/数字/emoji/标点原样通过。
   多音字三层兜底：
     1. pinyin-pro 内置分词消歧（句级上下文，整 run 一次调用保语境）
     2. OVERRIDES 全局覆盖表（scripts/check-pinyin.mjs 对照 v1 人工核对注音的回归校验产出）
     3. 调用方逃生口 T(text, { '长得': 'zhǎng de' })
   词边界：pinyin-dict.json 的 words 键（v1 DSL 提取的 UI 词表）——命中词包 <span class="rw">
   防止行尾把词拆断（儿童可读性：词组连续注音不拆行）。
   读音一律来自 pinyin-pro / 覆盖表；词典不供读音。输出带全量 memo 缓存。 */
import { pinyin } from 'pinyin-pro'
import dict from '../data/pinyin-dict.json'
import overrides from '../data/pinyin-overrides.json'

/* ---------- 多音字全局覆盖表（src/data/pinyin-overrides.json，与校验脚本同源） ---------- */
export const OVERRIDES: Record<string, string[]> = overrides.words
const IN_WORD_TONE: Record<string, string> = overrides.inWordTone

/* UI 已知词表（仅取词边界，读音走引擎） */
const WORD_KEYS: string[] = Object.keys((dict as { words: Record<string, string[]> }).words)
  .sort((a, b) => b.length - a.length)

const RE_HAN = /[一-鿿]+/g
const cache = new Map<string, string>()

function parsePy(v: string | string[] | undefined): string[] | null {
  if (v == null) return null
  return Array.isArray(v) ? v : String(v).trim().split(/\s+/)
}

/* 汉字 run 注音：pinyin-pro 基线 + 覆盖表打补丁 + 词组 nowrap 分组 */
function annotate(run: string, py?: Record<string, string>): string {
  const chars = [...run]
  const base = (pinyin as any)(run, { type: 'array', tone: true }) as string[]
  const pys: string[] = chars.map((_, i) => base[i] || '')
  const groups: { w: string; from: number; to: number }[] = []
  let i = 0
  while (i < chars.length) {
    let hit: { w: string; to: number; override: string[] | null } | null = null
    // 覆盖表（调用方 py > OVERRIDES）优先命中，且总是视为词组
    for (const tbl of [py ?? {}, OVERRIDES]) {
      for (const w in tbl) {
        if (startsWithAt(chars, i, w)) {
          const o = parsePy(tbl[w])
          if (o) { hit = { w, to: i + [...w].length, override: o }; break }
        }
      }
      if (hit) break
    }
    if (!hit) {
      for (const w of WORD_KEYS) {
        if (startsWithAt(chars, i, w) && [...w].length > 1) { hit = { w, to: i + [...w].length, override: null }; break }
      }
    }
    if (hit) {
      if (hit.override) hit.override.forEach((p, k) => { pys[i + k] = p })
      else {
        /* 词表词命中：词内逐位 override 子匹配 + 语气字白名单 */
        let j = i
        while (j < hit.to) {
          const sub = overrideAt(chars, j, py)
          if (sub) { sub.pys.forEach((p, k) => { pys[j + k] = p }); j += sub.len }
          else {
            const t = IN_WORD_TONE[chars[j]]
            if (t) pys[j] = t
            j++
          }
        }
      }
      groups.push({ w: hit!.w, from: i, to: hit!.to })
      i = hit.to
    } else {
      i++
    }
  }
  // 渲染：词组包 <span class="rw">（white-space:nowrap，词组连续注音不拆行）
  const inGroup = new Array(chars.length).fill(-1)
  groups.forEach((g, gi) => { for (let k = g.from; k < g.to; k++) inGroup[k] = gi })
  let out = ''
  let k = 0
  while (k < chars.length) {
    const g = inGroup[k]
    if (g >= 0) {
      const gr = groups[g]
      let inner = ''
      for (let j = gr.from; j < gr.to; j++) inner += ruby(chars[j], pys[j])
      out += gr.to - gr.from > 1 ? `<span class="rw">${inner}</span>` : inner
      k = gr.to
    } else {
      out += ruby(chars[k], pys[k])
      k++
    }
  }
  return out
}

function ruby(h: string, p: string): string {
  return p ? `<ruby>${h}<rt>${p}</rt></ruby>` : h
}

/* 词内 override 子匹配：词表条目常含整句（gen-dict 收录），句内多音字词组
   （说得/关卡/来得及…）会被整句词吞掉——词命中时对词内每个位置再跑一次
   覆盖表最长匹配，命中则改读音（nowrap 分组边界仍保持词表词）。 */
function overrideAt(chars: string[], at: number, py?: Record<string, string>): { len: number; pys: string[] } | null {
  const ordered = Object.keys(py ?? {}).concat(Object.keys(OVERRIDES)).sort((a, b) => b.length - a.length)
  for (const w of ordered) {
    if (startsWithAt(chars, at, w)) {
      const src = py && py[w] !== undefined ? py[w] : OVERRIDES[w]
      const o = parsePy(src)
      if (o) return { len: [...w].length, pys: o }
    }
  }
  return null
}

function startsWithAt(chars: string[], at: number, w: string): boolean {
  const ws = [...w]
  if (at + ws.length > chars.length) return false
  return ws.every((c, j) => chars[at + j] === c)
}

/** 注音主入口：纯文本进，ruby HTML 出 */
const SYS_SET: Set<string> = new Set([]) /* populated by strings.ts via registerSys */
export function registerSys(msgs: string[]) { msgs.forEach(m => SYS_SET.add(m)) }

export function T(s: string, py?: Record<string, string>): string {
  s = String(s)
  if (py) return s.replace(RE_HAN, (run) => annotate(run, py))
  /* 系统消息不加注音（kuaner：注音朗读维护在一个组件——决策在 T 层非调用点）
     SYS_SET=src/text/strings.ts 导出的系统 key 集，T 收到系统 key 的值时直接返回纯文本 */
  if (SYS_SET.has(s)) return s
  const hit = cache.get(s)
  if (hit !== undefined) return hit
  const out = s.replace(RE_HAN, (run) => annotate(run))
  cache.set(s, out)
  return out
}

/* 剥掉 DSL 标记 → 纯文本（历史遗留防漏网） */
export function stripDSL(s: string): string {
  return String(s).replace(/([一-鿿])\{([^{}]*)\}/g, '$1')
}
