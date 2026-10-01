/* v4.2 识字表闯关·解锁门（Bug#35 上半）：按学习进度分层解锁——先解锁已学字母相关的字。
   规则：字 z 可练 ⇔ 声母已学 且 韵母可由已学单元拼出（韵母本身已学，或可切分为已学
   韵母/单韵母序列，如 ian=i+an、uang=u+ang）——绝不超纲出未学的拼音。
   练习排序加权：错多的字（pinyin_v2 Z: 权重）排前面——识字题的错误账本=字级 Z: 权重
   （pinyin_game_v1 是字母账本，汉字题不适用）。 */
import { ZI } from '../data'
import type { ZiItem } from './types'
import { learnedLetters } from './gameEngine'
import { getW } from '../stores/weights.svelte'

const TONEV = 'āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ'
const BASEV = 'aoeiuv'

/* 去声调（bā→ba） */
function clean(py: string): string {
  let out = ''
  for (const ch of py) {
    const i = TONEV.indexOf(ch)
    out += i >= 0 ? BASEV[Math.floor(i / 4)] : ch
  }
  return out
}

const PYINITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']

/* 声母/韵母拆分（与 gameEngine.splitPy 同规则，此处输入已去声调） */
function splitClean(py: string): [string, string] {
  for (const ini of PYINITIALS) {
    if (py.indexOf(ini) === 0) return [ini, py.slice(ini.length)]
  }
  return ['', py]
}

/* 韵母覆盖判定：本身已学，或可切分为一串已学单元（贪心最长匹配） */
function coveredFinal(f: string, learned: Set<string>): boolean {
  if (!f) return true
  if (learned.has(f)) return true
  let i = 0
  while (i < f.length) {
    let matched = false
    for (let len = Math.min(3, f.length - i); len >= 1; len--) {
      if (learned.has(f.slice(i, i + len))) { i += len; matched = true; break }
    }
    if (!matched) return false
  }
  return true
}

/* 当前已解锁的字（学习进度派生，调用时实算——180 字开销可忽略） */
export function ziUnlocked(): ZiItem[] {
  const learned = new Set(learnedLetters())
  return ZI.filter((z) => {
    const [ini, fin] = splitClean(clean(z.p))
    if (ini && !learned.has(ini)) return false
    return coveredFinal(fin, learned)
  })
}

/* 已解锁池的练习顺序：弱字（Z: 权重高=错多/久未练）先出，其余按字表顺序 */
export function ziDrillOrder(pool: ZiItem[]): ZiItem[] {
  return pool
    .map((z, i) => ({ z, i, w: getW('Z:' + z.h) }))
    .sort((a, b) => (b.w - a.w) || (a.i - b.i))
    .map((x) => x.z)
}
