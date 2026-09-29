/* 出题引擎：闯关混编 / 正反小侦探 / 常见字快拼 / ⚡闪电刷题（与 v1 行为正本逐行对照移植） */
import { LETTERS, PAIRS, LEVELS, DETSET, ZI, ZWORDS, PH, keysOf } from '../data'
import { getW, wpick, pairW, pickDet } from '../stores/weights.svelte'
import { levelUnlocked } from '../stores/progress.svelte'
import type { QuizScope, Question, BoltQ, DfixQ, ZiQ, ZwordQ } from './types'

const H = PH.hints as Record<string, string>
const HV5 = PH.hintsV5 as Record<string, string>

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}

export function partnerOf(letter: string): string | null {
  for (const p of PAIRS) {
    if (p.a === letter) return p.b
    if (p.b === letter) return p.a
  }
  return null
}

export function sameCatOthers(letter: string, n: number, exclude: string[], scope: string[] | null): string[] {
  const cat = LETTERS[letter].cat
  const pool: string[] = []
  if (scope && scope.length) {
    for (const k of scope) {
      if (LETTERS[k] && LETTERS[k].cat === cat && exclude.indexOf(k) < 0 && pool.indexOf(k) < 0) pool.push(k)
    }
  }
  if (pool.length < n) {
    for (const k in LETTERS) {
      if (LETTERS[k].cat === cat && exclude.indexOf(k) < 0 && pool.indexOf(k) < 0) pool.push(k)
    }
  }
  return shuffle(pool).slice(0, n)
}

/* ---------- 闯关出题（自适应加权：同键连续上限 2 次） ---------- */
function pickKey(level: QuizScope, usedKeys: string[]): string {
  const items: { k: string; w: number }[] = []
  const covered: Record<string, 1> = {}
  if (level.pairs && level.pairs.length) {
    for (const k of level.pairs) {
      covered[k.split('|')[0]] = 1
      covered[k.split('|')[1]] = 1
      items.push({ k, w: pairW(k, level) })
    }
  }
  if (level.pool) {
    for (const l of level.pool) {
      if (!covered[l]) items.push({ k: 'L:' + l, w: getW('L:' + l) })
    }
  }
  if (!items.length) items.push({ k: 'L:' + level.pool![0], w: 1 })
  let cand = ''
  for (let t = 0; t < 12; t++) {
    cand = wpick(items).k
    const n = usedKeys.length
    if (!(n >= 2 && usedKeys[n - 1] === cand && usedKeys[n - 2] === cand)) return cand
  }
  return cand
}

function makeQ(level: QuizScope, key: string, type: string): Question {
  const q: any = { type, key }
  let A: string, B: string
  const isPair = key.indexOf('|') >= 0
  if (isPair) {
    const s = key.split('|')
    A = s[0]; B = s[1]
    if (Math.random() < 0.5) { A = s[1]; B = s[0] }
  } else {
    A = key.slice(2)
    B = partnerOf(A) || sameCatOthers(A, 1, [A], level.pool)[0]
  }
  q.A = A; q.B = B; q.hint = H[type]
  if (type === 'listen' || type === 'look') {
    q.opts = shuffle([A, B].concat(sameCatOthers(A, 2, [A, B], level.pool)))
    q.ans = q.opts.indexOf(A)
  } else if (type === 'll') {
    q.same = Math.random() < 0.5
    q.sound = q.same ? A : B
    q.ans = q.same ? 0 : 1
  } else { /* rule */
    q.true = Math.random() < 0.5
    q.stmt = q.true ? LETTERS[A].kj : LETTERS[A].kjf
    q.ans = q.true ? 0 : 1
  }
  return q as Question
}

export function buildQuestions(level: QuizScope): Question[] {
  const mix = shuffle(['listen', 'listen', 'listen', 'look', 'look', 'll', 'll', 'll', 'rule', 'rule'])
  const qs: Question[] = []
  const keys: string[] = []
  for (let i = 0; i < 10; i++) {
    const key = pickKey(level, keys)
    keys.push(key)
    qs.push(makeQ(level, key, mix[i]))
  }
  return qs
}

/* ---------- 正反小侦探 ---------- */
export function makeDfix(X: string): DfixQ {
  /* 选项全部正常字形且互不相同（镜像字形会和正常字形撞形，孩子无法分辨）；
     镜像只出现在题面大字上——孩子要把"写反的字"修复成正确写法 */
  const cat = LETTERS[X].cat
  const P = partnerOf(X)
  const opts = [X]
  const excl = [X]
  if (P) { opts.push(P); excl.push(P) }
  const detPool = shuffle(DETSET.filter((dk) => excl.indexOf(dk) < 0 && LETTERS[dk].cat === cat))
  while (opts.length < 4 && detPool.length) {
    const c = detPool.pop()!
    if (excl.indexOf(c) < 0) { opts.push(c); excl.push(c) }
  }
  for (const k in LETTERS) {
    if (opts.length >= 4) break
    if (LETTERS[k].cat === cat && excl.indexOf(k) < 0) { opts.push(k); excl.push(k) }
  }
  const shuffled = shuffle(opts)
  let ans = 0
  for (let i = 0; i < shuffled.length; i++) { if (shuffled[i] === X) { ans = i; break } }
  return { type: 'dfix', key: 'M:' + X, X, opts: shuffled, ans, hint: H.dfix }
}

export function buildDetQs(force: boolean): Question[] {
  let types = ['djudge', 'djudge', 'dfix', 'djudge', 'dfix', 'djudge', 'djudge', 'dfix', 'djudge', 'dfix']
  if (!force) types = shuffle(types)
  const qs: Question[] = []
  const used: string[] = []
  const judjFlips = shuffle([true, true, true, false, false, false])
  let fi = 0
  for (let i = 0; i < 10; i++) {
    const X = pickDet(used)
    used.push(X)
    if (types[i] === 'djudge') {
      let fl = judjFlips[fi++]
      if (force && i === 0) fl = true /* 验收截图：首题固定为写反的 b */
      qs.push({ type: 'djudge', key: 'M:' + X, X, flipped: fl, ans: fl ? 1 : 0, hint: H.djudge })
    } else {
      qs.push(makeDfix(X))
    }
  }
  return qs
}

/* ---------- 常见字快拼（一年级 180 字 + 30 词） ---------- */
const PYINITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']

export function splitPy(py: string): [string, string] {
  for (const ini of PYINITIALS) {
    if (py.indexOf(ini) === 0) return [ini, py.slice(ini.length)]
  }
  return ['', py]
}

const TONEV = 'āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ'

function toneFlip(py: string): string | null {
  for (let i = 0; i < py.length; i++) {
    const idx = TONEV.indexOf(py[i])
    if (idx >= 0) {
      const vi = Math.floor(idx / 4), t0 = idx % 4
      let t = t0
      while (t === t0) t = Math.floor(Math.random() * 4)
      return py.slice(0, i) + TONEV[t * 4 + vi] + py.slice(i + 1)
    }
  }
  return null
}

function ziDistractors(ans: string): { opts: string[]; ans: number } {
  const s = splitPy(ans)
  const pool = ZI.map((z) => z.p).filter((p) => p !== ans)
  const d: string[] = []
  const add = (x: string | null) => { if (x && x !== ans && d.indexOf(x) < 0) d.push(x) }
  add(toneFlip(ans))
  const rhym = pool.filter((p) => splitPy(p)[1] === s[1])
  if (rhym.length) add(rhym[Math.floor(Math.random() * rhym.length)])
  const allit = pool.filter((p) => splitPy(p)[0] === s[0] && splitPy(p)[1] !== s[1])
  if (allit.length) add(allit[Math.floor(Math.random() * allit.length)])
  const shuffledPool = shuffle(pool)
  let i = 0
  while (d.length < 3 && i < shuffledPool.length) { add(shuffledPool[i]); i++ }
  const opts = shuffle([ans].concat(d.slice(0, 3)))
  let a = 0
  for (let j = 0; j < opts.length; j++) { if (opts[j] === ans) { a = j; break } }
  return { opts, ans: a }
}

function wordDistractors(z: { w: string; p: string }): { opts: string[]; ans: number } {
  const d: string[] = []
  let guard = 0
  while (d.length < 3 && guard++ < 60) {
    const o = ZWORDS[Math.floor(Math.random() * ZWORDS.length)]
    if (o.w !== z.w && d.indexOf(o.p) < 0) d.push(o.p)
  }
  const opts = shuffle([z.p].concat(d))
  let a = 0
  for (let j = 0; j < opts.length; j++) { if (opts[j] === z.p) { a = j; break } }
  return { opts, ans: a }
}

export function makeZiQ(z: { h?: string; w?: string; p: string; f: string }, isWord: boolean): ZiQ | ZwordQ {
  const dz = isWord ? wordDistractors(z as any) : ziDistractors(z.p)
  const base: any = {
    type: isWord ? 'zword' : 'zi',
    key: (isWord ? 'W:' : 'Z:') + (isWord ? z.w : z.h),
    z,
    opts: dz.opts,
    ans: dz.ans,
    hint: isWord ? HV5.zword : HV5.zi,
  }
  return base
}

export function ziQs(): Question[] {
  const pool = shuffle(ZI)
  const qs: Question[] = []
  for (let i = 0; i < 8; i++) qs.push(makeZiQ(pool[i], false))
  qs.push(Math.random() < 0.5
    ? makeZiQ(ZWORDS[Math.floor(Math.random() * ZWORDS.length)], true)
    : makeZiQ(pool[8], false))
  qs.push(makeZiQ(ZWORDS[Math.floor(Math.random() * ZWORDS.length)], true))
  return qs
}

/* ---------- ⚡闪电刷题（题源=已解锁关卡字母池+易混对，同键连续上限 2 次） ---------- */
function boltPoolItems(): { k: string; w: number }[] {
  const seen: Record<string, 1> = {}
  const items: { k: string; w: number }[] = []
  const addP = (k: string) => { if (!seen[k]) { seen[k] = 1; items.push({ k, w: pairW(k, null) }) } }
  const addL = (x: string) => { const k = 'L:' + x; if (!seen[k]) { seen[k] = 1; items.push({ k, w: getW(k) }) } }
  let any = false
  for (let i = 1; i <= 8; i++) {
    if (levelUnlocked(i)) {
      any = true
      const L = LEVELS[i - 1]
      ;(L.pairs || []).forEach(addP)
      ;(L.pool || []).forEach(addL)
    }
  }
  if (!any) LEVELS[0].pool!.forEach(addL)
  return items
}

export function boltPickKey(keys: string[]): string {
  const items = boltPoolItems()
  let c = ''
  const n = keys.length
  for (let t = 0; t < 12; t++) {
    c = wpick(items).k
    if (!(n >= 2 && keys[n - 1] === c && keys[n - 2] === c)) break
  }
  keys.push(c)
  return c
}

export function makeBoltQ(): BoltQ {
  const key = boltPickKey(BT_KEYS)
  const r = Math.random()
  let A: string, B: string
  const isPair = key.indexOf('|') >= 0
  if (isPair) {
    const s = key.split('|')
    A = s[0]; B = s[1]
    if (Math.random() < 0.5) { A = s[1]; B = s[0] }
  } else {
    A = key.slice(2)
    B = partnerOf(A) || sameCatOthers(A, 1, [A], null)[0]
  }
  const canDet = DETSET.indexOf(A) >= 0
  if (canDet && r < 0.18) {
    const fl = Math.random() < 0.5
    return { type: 'bdjudge', key: 'M:' + A, A, flipped: fl, ans: fl ? 1 : 0, hint: HV5.bdjudge }
  }
  const opts = shuffle([A, B])
  const ans = opts.indexOf(A)
  if (r < 0.58) {
    return { type: 'blisten', key: isPair ? key : 'L:' + A, A, sound: A, opts, ans, hint: HV5.blisten }
  }
  return { type: 'blook', key: isPair ? key : 'L:' + A, A, opts, ans, hint: HV5.blook }
}

/* bolt 会话的已答题键序列（供连续上限判定；由 bolt store 重置） */
export const BT_KEYS: string[] = []

/* 自由练习出题域 */
export function practiceScope(kind: string): QuizScope {
  const p = (PH.practice as any[]).find((x) => x.kind === kind)!
  const pairs = p.pairs || (kind === 'all' ? PAIRS.map((x) => x.a + '|' + x.b) : null)
  const pool = p.cat ? keysOf(p.cat) : keysOf('sm').concat(keysOf('ym'), keysOf('zt'))
  return { name: p.name, pool, pairs }
}
