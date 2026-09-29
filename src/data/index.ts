/* 数据层统一出口：全部内容数据来自 src/data/*.json，代码里不内联大数组 */
import pinyinData from './pinyin.json'
import confusion from './confusion.json'
import zi from './zi180.json'
import words from './words.json'
import phrases from './phrases.json'
import hypMap from './hyp.json'
import type { Letter, Anchor, LevelDef, Pair, ZiItem, ZWord } from '../lib/types'

/* hyp 音频映射（hanyu-pinyin-audio 数据集）：播放名 → audio/hyp/ 文件名（无扩展名）。
   拼音点读与常见字读音优先走 hyp，缺失回落 mimo 同名文件（见 lib/audio.ts） */
export const HYP = hypMap as unknown as Record<string, string>

export const LETTERS = pinyinData.letters as unknown as Record<string, Letter>
export const ANCHORS = pinyinData.anchors as unknown as Record<string, Anchor>
export const LEVELS = pinyinData.levels as unknown as LevelDef[]
export const DETSET: string[] = pinyinData.detSet
export const COREDET: string[] = pinyinData.coreDet

export const PAIRS = confusion.pairs as unknown as Pair[]
export const GRPNAME = confusion.groupNames as Record<string, string>
export const GRPS: string[] = confusion.groupOrder

export const ZI = zi as unknown as ZiItem[]
export const ZWORDS = words as unknown as ZWord[]

const ZIBYB: Record<string, ZiItem> = {}
ZI.forEach((z) => { ZIBYB[z.h] = z })
export const ZIBY = ZIBYB

const PMAPB: Record<string, number> = {}
PAIRS.forEach((p, i) => { PMAPB[p.a + '|' + p.b] = i; PMAPB[p.b + '|' + p.a] = i })
export const PMAP = PMAPB

export const PH = phrases

export function keysOf(cat: string): string[] {
  return Object.keys(LETTERS).filter((k) => LETTERS[k].cat === cat)
}
