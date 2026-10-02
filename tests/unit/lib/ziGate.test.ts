/* 识字表解锁门单测（src/lib/ziGate.ts，v4.2 Bug#35 上半）：
   解锁规则=声母已学 且 韵母可由已学单元拼出（贪心最长切分）——绝不超纲；
   练习排序=弱字（Z: 权重）先出。 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import ziData from '../../../src/data/zi180.json'

type ZG = typeof import('../../../src/lib/ziGate')
let zg!: ZG
let learn!: typeof import('../../../src/stores/learn.svelte')
let progress!: typeof import('../../../src/stores/progress.svelte')

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  progress = await import('../../../src/stores/progress.svelte')
  learn = await import('../../../src/stores/learn.svelte')
  zg = await import('../../../src/lib/ziGate')
})

describe('ziUnlocked 解锁门', () => {
  it('新生（全空回落第 1 课 a o e）→ 只有零声母单韵母字解锁（饿/鹅——独立复算的精确集）', () => {
    const hs = zg.ziUnlocked().map((z) => z.h)
    /* 声母均未学 → 有声母的字全锁；韵母 ai/an 等切分为 a+i / a+n 时 i/n 未学 → 也锁。
       仅零声母且读 a/o/e 的字开门。识字表必须随学习进度开门（防超纲的极端面）。 */
    expect(hs).toEqual(['饿', '鹅'])
  })
  it('过课 3（b p m f 已学）→ b 声母、单韵母拼式的字解锁（爸 bà）', () => {
    for (let i = 1; i <= 3; i++) learn.L.stars[i] = 3
    const hs = zg.ziUnlocked().map((z) => z.h)
    expect(hs).toContain('爸')     // bà：声母 b 已学、韵母 a 已学
    expect(ziData.find((z) => z.h === '爸')!.p).toBe('bà')
  })
  it('韵母可切分即解锁：L1-5 后 光 guāng 开（uang=u+a+n 链，贪心最长匹配）；声母 x 未学前 西 锁', () => {
    for (let i = 1; i <= 5; i++) learn.L.stars[i] = 3   // a o e i u ü + bpmf + dtnl + gkh
    const hs = new Set(zg.ziUnlocked().map((z) => z.h))
    expect(hs.has('光')).toBe(true)    // u(已学)+a(已学)+n(L4 已学)
    expect(hs.has('西')).toBe(false)   // x 未学（L6 j q x）
    for (let i = 6; i <= 6; i++) learn.L.stars[i] = 3
    expect(new Set(zg.ziUnlocked().map((z) => z.h)).has('西')).toBe(true)
  })
  it('全 12 课通过 → 180 字全解锁', () => {
    for (let i = 1; i <= 12; i++) learn.L.stars[i] = 3
    expect(zg.ziUnlocked()).toHaveLength(180)
  })
  it('单调递增：进度增加不回收任何已解锁字（解锁门只开不关）', () => {
    const sets: number[] = []
    for (let n = 0; n <= 12; n++) {
      for (let i = 1; i <= n; i++) learn.L.stars[i] = 3
      sets.push(zg.ziUnlocked().length)
    }
    for (let n = 1; n < sets.length; n++) expect(sets[n]).toBeGreaterThanOrEqual(sets[n - 1])
    expect(sets[12]).toBe(180)
  })
})

describe('ziDrillOrder 弱字优先排序', () => {
  it('Z: 权重高（错多）的字排池首；无权重按字表原序稳定', () => {
    for (let i = 1; i <= 12; i++) learn.L.stars[i] = 3
    const pool = zg.ziUnlocked()
    progress.S.weights['Z:水'] = { w: 8, streak: 0 }
    const ordered = zg.ziDrillOrder(pool)
    expect(ordered[0].h).toBe('水')
    // 其余保持相对原序（稳定排序契约：等权不乱序）
    const rest = ordered.slice(1).map((z) => z.h)
    const origin = pool.filter((z) => z.h !== '水').map((z) => z.h)
    expect(rest).toEqual(origin)
  })
})
