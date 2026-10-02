/* gameEngine 边界补测（T2，与 gameEngine.test.ts 互补）：
   pickWeighted 兜底返回（浮点不整除防御行）、gameDistractor rng 注入（Bug#38 修复面）、
   pickGameTarget 排除语义。 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

type Eng = typeof import('../../../src/lib/gameEngine')
let eng!: Eng
let game!: typeof import('../../../src/stores/game.svelte')

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  eng = await import('../../../src/lib/gameEngine')
  game = await import('../../../src/stores/game.svelte')
})

describe('pickWeighted 兜底返回（防御行）', () => {
  it('rng 返回值使 r 永不为 ≤0（rng>1 的注入边界）→ 兜底末项', () => {
    const items = [{ k: 'x', w: 5 }, { k: 'y', w: 3 }]
    expect(eng.pickWeighted(items, (i) => i.w, () => 1.0000001).k).toBe('y')
  })
})

describe('gameDistractor rng 注入（Bug#38 修复面）', () => {
  it('缺省 rng=Math.random：行为与注入前一致（镜像搭档优先）', () => {
    expect(eng.gameDistractor('b', ['b', 'd', 'a'])).toBe('d')
    const pool = ['b', 'p', 'm', 'f']
    expect(['p', 'm', 'f']).toContain(eng.gameDistractor('b', pool))
  })
  it('注入种子 rng → 干扰项完全确定（同日题面逐字节稳定的机制面）', () => {
    const pool = ['a', 'o', 'e', 'i', 'u', 'ü']
    const d1 = eng.gameDistractor('a', pool, eng.mulberry32(eng.daySeed('2026-10-02')))
    const d2 = eng.gameDistractor('a', pool, eng.mulberry32(eng.daySeed('2026-10-02')))
    const d3 = eng.gameDistractor('a', pool, eng.mulberry32(eng.daySeed('2026-10-03')))
    expect(d1).toBe(d2)
    expect(d1).toBe('i')   // 确定性：写死断言（同 cat 池的种子抽签可复算）
    expect(typeof d3).toBe('string')
  })
  it('池中只有自己 → 全表同 cat 捞正确形态；全 cat 只剩自己 → 回落自身', () => {
    const d = eng.gameDistractor('a', ['a'], eng.mulberry32(1))
    expect(d).not.toBe('a')
    expect(d).toBeTruthy()   // ym 全表捞（如 o/e/i/u/ü 之一）
  })
})

describe('pickGameTarget（游戏每轮目标）', () => {
  it('排除项不出现；全排除时回落全池', () => {
    game.GD.letters['a'] = { ok: 0, err: 9, last: game.dayNum() }   // a 重病号
    for (let i = 0; i < 20; i++) {
      expect(eng.pickGameTarget(['a', 'o', 'e'], ['o', 'e'])).toBe('a')
    }
    const fallback = eng.pickGameTarget(['a', 'o'], ['a', 'o'])
    expect(['a', 'o']).toContain(fallback)
  })
})
