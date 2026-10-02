// 冒烟：runes store（.svelte.ts 模块级 $state）能否在 vitest+jsdom 下编译执行
import { describe, it, expect } from 'vitest'

describe('vitest 基建冒烟', () => {
  it('runes store 可导入且 $state 生效', async () => {
    const m = await import('../../src/stores/game.svelte')
    expect(typeof m.comboMult).toBe('function')
    expect(m.comboMult(3)).toBe(2)
    expect(m.comboMult(6)).toBe(3)
    expect(m.comboMult(2)).toBe(1)
  })
})
