/* 学习页序推导单测（src/lib/lessonUnits.ts）：
   v3.0 结构反转的页序契约——每字母 [学一学, 声调?] → 拼读? → 小测；
   声调行数=字母数 → 按位置对应；不等 → 按 base 匹配（L12 整体认读 16 字母 6 行）。
   历次 bug 住点：v2.9 clamp 行为放错音（chi 页播 yi 的四声）。 */
import { describe, it, expect } from 'vitest'
import lessonsJson from '../../../src/data/lessons.json'
import {
  lessonHasBlend, toneRowOf, lessonPages, unitCountOf, unitIndexOf,
  type LessonLike,
} from '../../../src/lib/lessonUnits'

const LESSONS = (lessonsJson as any).lessons as any[]
const byN = (n: number) => LESSONS.find((l) => l.n === n) as LessonLike

describe('lessonHasBlend', () => {
  it('hasBlend 显式优先；blends/ztlist 非空派生 true', () => {
    expect(lessonHasBlend({ letters: [{ k: 'a' }], hasBlend: true, blends: [] })).toBe(true)
    expect(lessonHasBlend({ letters: [{ k: 'a' }], hasBlend: false, blends: [{}] })).toBe(false)
    expect(lessonHasBlend({ letters: [{ k: 'a' }], blends: [{}] })).toBe(true)
    expect(lessonHasBlend({ letters: [{ k: 'a' }], ztlist: [{}] })).toBe(true)
  })
  it('无拼读数据 → false；undefined/null 同判', () => {
    expect(lessonHasBlend({ letters: [{ k: 'a' }] })).toBe(false)
    expect(lessonHasBlend({ letters: [{ k: 'a' }], blends: null, ztlist: null })).toBe(false)
  })
  it('真实数据：L1 无拼读，L3（bpmf）有拼读，L12 整体认读有 ztlist', () => {
    expect(lessonHasBlend(byN(1))).toBe(false)
    expect(lessonHasBlend(byN(3))).toBe(true)
    expect(lessonHasBlend(byN(12))).toBe(true)
  })
})

describe('toneRowOf 声调行定位', () => {
  it('行数=字母数 → 按位置对应（L1：a/o/e → 0/1/2）', () => {
    const l = byN(1)
    expect(l.tones!.length).toBe(l.letters.length)
    expect(toneRowOf(l, 0)).toBe(0)
    expect(toneRowOf(l, 2)).toBe(2)
  })
  it('行数不等 → 按 base 精确匹配（L12：16 字母 6 行）', () => {
    const l = byN(12)
    expect(l.letters.length).toBe(16)
    expect(l.tones!.length).toBe(6)
    const bases = l.tones!.map((r) => r.base)
    const idx = l.letters.findIndex((e) => e.k === bases[0])
    expect(toneRowOf(l, idx)).toBe(0)
  })
  it('L12 无声调行的字母（非 6 行 base）→ -1，不设声调页', () => {
    const l = byN(12)
    const letterKeys = l.letters.map((e) => e.k)
    const noToneIdx = letterKeys.findIndex((k) => !l.tones!.some((r) => r.base === k))
    expect(noToneIdx).toBeGreaterThanOrEqual(0)
    expect(toneRowOf(l, noToneIdx)).toBe(-1)
  })
  it('无声调数据 → -1', () => {
    expect(toneRowOf({ letters: [{ k: 'a' }] }, 0)).toBe(-1)
  })
})

describe('lessonPages 页序（一个脚印的落地顺序）', () => {
  it('有拼读课（L3）：字母×(学一学+声调) → 拼读 → 小测', () => {
    const pages = lessonPages(byN(3))
    expect(pages[0]).toEqual({ t: 'learn', li: 0 })
    expect(pages[1]).toEqual({ t: 'tone', li: 0 })
    expect(pages[2]).toEqual({ t: 'learn', li: 1 })
    expect(pages.filter((p) => p.t === 'blend')).toHaveLength(1)
    expect(pages[pages.length - 1]).toEqual({ t: 'quiz' })
    expect(pages.length).toBe(4 * 2 + 1 + 1)   // bpmf 4 字母
  })
  it('无声调字母只设学一学页', () => {
    const pages = lessonPages(byN(12))
    const learns = pages.filter((p) => p.t === 'learn')
    expect(learns).toHaveLength(16)
    expect(pages.filter((p) => p.t === 'tone')).toHaveLength(6)
    expect(pages.filter((p) => p.t === 'blend')).toHaveLength(1)
  })
  it('最小课：单字母无声调无拼读 = [learn, quiz]', () => {
    expect(lessonPages({ letters: [{ k: 'a' }] })).toEqual([
      { t: 'learn', li: 0 }, { t: 'quiz' },
    ])
  })
})

describe('unitCountOf / unitIndexOf（进度指示口径）', () => {
  it('单元数 = 字母数 + 拼读? + 1（小测）', () => {
    expect(unitCountOf(byN(3))).toBe(4 + 1 + 1)
    expect(unitCountOf(byN(1))).toBe(3 + 0 + 1)
    expect(unitCountOf({ letters: [{ k: 'a' }] })).toBe(2)
  })
  it('unitIndexOf：learn/tone→li；blend→letters.length；quiz→+1', () => {
    const l = byN(3)
    const pages = lessonPages(l)
    const blendIdx = pages.findIndex((p) => p.t === 'blend')
    const quizIdx = pages.length - 1
    expect(unitIndexOf(l, 0)).toBe(0)
    expect(unitIndexOf(l, 1)).toBe(0)          // a 的声调页仍是字母单元
    expect(unitIndexOf(l, blendIdx)).toBe(4)   // 拼读 = letters.length
    expect(unitIndexOf(l, quizIdx)).toBe(5)
  })
  it('越界页号 clamp 到有效范围（0 与尾页）', () => {
    const l = byN(3)
    expect(unitIndexOf(l, -5)).toBe(0)
    expect(unitIndexOf(l, 999)).toBe(5)
  })
})
