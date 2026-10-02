/* 自适应权重边界单测（src/stores/weights.svelte.ts，与 weights.test.ts 互补）：
   wpick 兜底返回防御行、pickDet 同字母不连续的 12 次尝试兜底。 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

let w!: typeof import('../../../src/stores/weights.svelte')

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  w = await import('../../../src/stores/weights.svelte')
})

afterEach(() => vi.restoreAllMocks())

describe('wpick 兜底返回（防御行）', () => {
  it('随机数注入 >1 使 r 永不归零 → 兜底末项（不 undefined）', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(1.0000001)
    try {
      const it = w.wpick([{ k: 'x', w: 5 }, { k: 'y', w: 3 }])
      expect(it.k).toBe('y')
    } finally {
      spy.mockRestore()
    }
  })
})

describe('pickDet 连续上限兜底（12 次尝试后放行）', () => {
  it('Math.random 恒 0 → 恒抽首项：used 末位=首项时 12 次尝试全失败仍返回（不死循环）', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0)   // wpick 恒返回 DETSET 首项
    try {
      const first = w.pickDet([])
      const again = w.pickDet([first, first, first, first])
      expect(again).toBe(first)   // 兜底放行（防死循环保险丝）
    } finally {
      spy.mockRestore()
    }
  })
  it('正常流：同字母不连续（used 末位相同时重抽）', () => {
    const used: string[] = []
    for (let i = 0; i < 40; i++) {
      const c = w.pickDet(used)
      if (used.length) expect(c).not.toBe(used[used.length - 1])
      used.push(c)
    }
  })
})
