/* v4.0 游戏岛出题引擎：已学字母派生 + 错误账本加权抽样 + 每日挑战（日期种子，每日一换）
   铁律：只用已学字母（学习进度派生，绝不超纲）；读音全部 hyp 真人库；零错误信息（选项全为正确形态） */
import { LETTERS, ZI } from '../data'
import lessonsData from '../data/lessons.json'
import { quizPassed } from '../stores/learn.svelte'
import { GD, dayNum, type LetterStat } from '../stores/game.svelte'

/* ---------- 已学字母（学习进度派生）：课级小测通过 = 该课字母已学；全空回落第 1 课 ---------- */
const LESSONS = (lessonsData as any).lessons as { n: number; letters: { k: string }[] }[]
const LESSON_LETTERS: Record<number, string[]> = {}
for (const l of LESSONS) LESSON_LETTERS[l.n] = l.letters.map((e) => e.k)

export function learnedLetters(): string[] {
  const set = new Set<string>()
  for (let n = 1; n <= 12; n++) {
    if (quizPassed(n)) for (const k of LESSON_LETTERS[n] || []) set.add(k)
  }
  if (!set.size) for (const k of LESSON_LETTERS[1] || []) set.add(k)
  return [...set]
}

/* 镜像对组（b d p q 病灶优先）：learned ∩ {b,d,p,q} 的搭档关系 */
const MIRROR: Record<string, string> = { b: 'd', d: 'b', p: 'q', q: 'p' }
export function mirrorOf(k: string): string | null { return MIRROR[k] || null }

export function mirrorPairLearned(pool: string[]): [string, string] | null {
  for (const k of pool) { const m = MIRROR[k]; if (m && pool.includes(m)) return [k, m] }
  return null
}

/* ---------- 错误账本加权：弱项（错多）+ 久未练 加权，镜像字母再乘 1.5 ---------- */
export function ledgerWeight(k: string): number {
  const r: LetterStat | undefined = GD.letters[k]
  let w = 1
  if (r) {
    w += Math.min(r.err, 6) * 1.6
    if (r.ok + r.err >= 3 && r.err / (r.ok + r.err) >= 0.4) w += 2
    const stale = dayNum() - r.last
    if (stale >= 3) w += 1.5
  }
  if (MIRROR[k]) w *= 1.5
  return w
}

export function ledgerPick(pool: string[], rng: () => number): string {
  const items = pool.map((k) => ({ k, w: ledgerWeight(k) }))
  let tot = 0
  for (const it of items) tot += it.w
  let r = rng() * tot
  for (const it of items) { r -= it.w; if (r <= 0) return it.k }
  return items[items.length - 1].k
}

/* ---------- 可种子随机（每日挑战按日期换题：同一天题面稳定） ---------- */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function daySeed(ds: string): number {
  let h = 2166136261
  for (let i = 0; i < ds.length; i++) { h ^= ds.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}

/* ---------- 干扰项：镜像搭档优先，不足回落同 cat（都是正确形态——零错误信息铁律） ---------- */
export function gameDistractor(k: string, pool: string[]): string {
  const m = MIRROR[k]
  if (m && pool.includes(m) && m !== k) return m
  const cat = LETTERS[k].cat
  const same = pool.filter((x) => x !== k && LETTERS[x] && LETTERS[x].cat === cat)
  if (same.length) return same[Math.floor(Math.random() * same.length)]
  const any = pool.filter((x) => x !== k)
  if (any.length) return any[Math.floor(Math.random() * any.length)]
  /* 池里只有自己：从全字母表同 cat 捞一个（仍是正确形态，且不超纲风险=干扰项仅在选项中） */
  const all = Object.keys(LETTERS).filter((x) => x !== k && LETTERS[x].cat === cat)
  return all[Math.floor(Math.random() * all.length)] || k
}

/* 游戏内加权抽目标（Math.random——游戏每轮不同） */
export function pickGameTarget(pool: string[], exclude: string[]): string {
  const cand = pool.filter((k) => !exclude.includes(k))
  const src = cand.length ? cand : pool
  return ledgerPick(src, Math.random)
}

/* ---------- 每日挑战 10 题：弱项字母听写 + 镜像对 + 口诀回忆 + 识字表看字选拼音 ---------- */
export interface DailyQ {
  type: 'blisten' | 'bkj' | 'zi'
  key: string            // 账本/权重键：字母题=字母本身，zi 题='Z:字'
  A: string              // 字母题：目标字母
  sound: string          // 字母题：播放的字母
  stmt: string           // bkj：口诀
  opts: string[]         // 字母题=字母；zi 题=拼音全拼
  ans: number
  z?: { h: string; p: string }   // zi 题：汉字+拼音
}

const PYINITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']
const TONEV = 'āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ'

export function splitPy(py: string): [string, string] {
  for (const ini of PYINITIALS) {
    if (py.indexOf(ini) === 0) return [ini, py.slice(ini.length)]
  }
  return ['', py]
}

function toneFlip(py: string, rng: () => number): string | null {
  for (let i = 0; i < py.length; i++) {
    const idx = TONEV.indexOf(py[i])
    if (idx >= 0) {
      const vi = Math.floor(idx / 4), t0 = idx % 4
      let t = t0
      while (t === t0) t = Math.floor(rng() * 4)
      return py.slice(0, i) + TONEV[t * 4 + vi] + py.slice(i + 1)
    }
  }
  return null
}

/* 看字选拼音（识字表，无多音歧义字表 zi180）：正确拼音 + 3 干扰（错调/同韵/同声母——均为真实字音） */
function ziQ(rng: () => number): DailyQ {
  const z = ZI[Math.floor(rng() * ZI.length)]
  const pool = ZI.map((x) => x.p).filter((p) => p !== z.p)
  const s = splitPy(z.p)
  const d: string[] = []
  const add = (x: string | null) => { if (x && x !== z.p && d.indexOf(x) < 0) d.push(x) }
  add(toneFlip(z.p, rng))
  const rhym = pool.filter((p) => splitPy(p)[1] === s[1])
  if (rhym.length) add(rhym[Math.floor(rng() * rhym.length)])
  const allit = pool.filter((p) => splitPy(p)[0] === s[0] && splitPy(p)[1] !== s[1])
  if (allit.length) add(allit[Math.floor(rng() * allit.length)])
  const sp = seededShuffle(pool, rng)
  let i = 0
  while (d.length < 3 && i < sp.length) { add(sp[i]); i++ }
  const opts = seededShuffle([z.p].concat(d.slice(0, 3)), rng)
  return { type: 'zi', key: 'Z:' + z.h, A: '', sound: '', stmt: '', opts, ans: opts.indexOf(z.p), z: { h: z.h, p: z.p } }
}

/* 字母听写/口诀题（混淆搭档做干扰项，与闪电 blisten/bkj 同构） */
function letterQ(type: 'blisten' | 'bkj', A: string, pool: string[], rng: () => number): DailyQ {
  const B = gameDistractor(A, pool)
  const opts = seededShuffle([A, B], rng)
  return { type, key: A, A, sound: A, stmt: LETTERS[A].kj, opts, ans: opts.indexOf(A) }
}

export function buildDailyQs(): DailyQ[] {
  const rng = mulberry32(daySeed(dayStr()))
  const pool = learnedLetters()
  const mirror = mirrorPairLearned(pool)
  const qs: DailyQ[] = []
  const used: string[] = []
  /* 弱项加权抽 1 个（未用过的优先；小字母池允许重复出现——绝不因池小崩题） */
  const pick = (): string => {
    const rest = pool.filter((x) => !used.includes(x))
    return ledgerPick(rest.length ? rest : pool, rng)
  }
  /* 4 听写（弱项加权） + 2 镜像对 + 2 口诀 + 2 识字 = 10 */
  for (let i = 0; i < 4; i++) {
    const k = pick()
    used.push(k)
    qs.push(letterQ('blisten', k, pool, rng))
  }
  if (mirror) {
    qs.push(letterQ('blisten', mirror[0], pool, rng))
    qs.push(letterQ('blisten', mirror[1], pool, rng))
  } else {
    for (let i = 0; i < 2; i++) {
      const k = pick()
      used.push(k)
      qs.push(letterQ('blisten', k, pool, rng))
    }
  }
  for (let i = 0; i < 2; i++) {
    const k = pick()
    used.push(k)
    qs.push(letterQ('bkj', k, pool, rng))
  }
  const ziSeen = new Set<string>()
  for (let i = 0; i < 2; i++) {
    let q = ziQ(rng)
    let guard = 0
    while (ziSeen.has(q.key) && guard++ < 12) q = ziQ(rng)
    ziSeen.add(q.key)
    qs.push(q)
  }
  /* 位置混排（interleaving）：不按题型块状排列 */
  return seededShuffle(qs, rng)
}

function dayStr(): string {
  const d = new Date()
  const m = d.getMonth() + 1, dd = d.getDate()
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' + dd : '' + dd)
}

/* 镜像对决快问题（listen 看形态二选一 / 口诀正向回忆，错误账本加权出题） */
export function duelQ(pool: string[]): { A: string; opts: string[]; ans: number; kj: boolean; stmt: string } {
  const A = ledgerPick(pool, Math.random)
  const B = gameDistractor(A, pool)
  const kj = Math.random() < 0.35
  const opts = Math.random() < 0.5 ? [A, B] : [B, A]
  return { A, opts, ans: opts.indexOf(A), kj, stmt: LETTERS[A].kj }
}
