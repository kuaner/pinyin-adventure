/* 自适应权重层（src/stores/weights.svelte.ts）单测：
   错×2 封顶 8 / 连对 2 次衰减 / 易混对 hot×3、毕业关镜像×2 / 正反 70/30 先验+同字母不连续。 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

type W = typeof import('../../src/stores/weights.svelte')
type ProgMod = typeof import('../../src/stores/progress.svelte')
let w: W
let prog: ProgMod

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  w = await import('../../src/stores/weights.svelte')
  prog = await import('../../src/stores/progress.svelte')
})

describe('getW / markResult 自适应权重', () => {
  it('无记录 → 权重 1', () => {
    expect(w.getW('b|d')).toBe(1)
  })
  it('答错 ×2：1→2→4→8，封顶 8 不再翻倍', () => {
    w.markResult('b|d', false)
    expect(w.getW('b|d')).toBe(2)
    w.markResult('b|d', false)
    expect(w.getW('b|d')).toBe(4)
    w.markResult('b|d', false)
    expect(w.getW('b|d')).toBe(8)
    w.markResult('b|d', false)
    expect(w.getW('b|d')).toBe(8)      // cap
  })
  it('连对 2 次衰减减半 + streak 清零；对 1 次不动', () => {
    w.markResult('n|l', false)
    w.markResult('n|l', false)          // w=4
    w.markResult('n|l', true)           // streak 1，w 不变
    expect(w.getW('n|l')).toBe(4)
    w.markResult('n|l', true)           // streak 2 → w=2, streak 0
    expect(w.getW('n|l')).toBe(2)
    w.markResult('n|l', true)
    w.markResult('n|l', true)           // 2→1（下限 1）
    expect(w.getW('n|l')).toBe(1)
  })
  it('答错重置 streak（错前的一次对不计入衰减窗口）', () => {
    w.markResult('b|d', false)          // w=2, streak=0
    w.markResult('b|d', true)           // streak=1
    w.markResult('b|d', false)          // w=4 且 streak 清零——若不清零，下一步就衰减
    w.markResult('b|d', true)           // streak=1（不衰减）
    expect(w.getW('b|d')).toBe(4)
  })
  it('markResult 持久化进 pinyin_v2', () => {
    w.markResult('f|h', false)
    const raw = JSON.parse(localStorage.getItem('pinyin_v2')!)
    expect(raw.weights['f|h'].w).toBe(2)
  })
})

describe('pairW 易混对关卡权重', () => {
  it('非易混对键 = 自适应权重原样', () => {
    w.markResult('L:b', false)
    expect(w.pairW('L:b', null)).toBe(2)
  })
  it('hot 关卡内该对 ×3', () => {
    const level = { name: 't', pool: null, pairs: null, hot: ['n|l'] }
    expect(w.pairW('n|l', level)).toBe(3)
  })
  it('毕业关镜像组 ×2（与 hot 不叠加时=2）', () => {
    const boss = { name: 't', pool: null, pairs: null, boss: true }
    expect(w.pairW('b|d', boss)).toBe(2)          // b|d=mirror 组
  })
  it('hot ×3 与 boss 镜像 ×2 叠加（n|l=nasal 组非镜像：boss 不乘）', () => {
    const lvl = { name: 't', pool: null, pairs: null, hot: ['b|d'], boss: true }
    expect(w.pairW('b|d', lvl)).toBe(6)           // 1 ×3(hot) ×2(mirror boss)
  })
})

describe('pickDet 正反小侦探抽样（70/30 先验）', () => {
  it('只从 DETSET 取；核心组高频（统计占比≈70%）', () => {
    const counts: Record<string, number> = {}
    let core = 0, total = 2000
    for (let i = 0; i < total; i++) {
      const k = w.pickDet([])
      counts[k] = (counts[k] || 0) + 1
      if (['b', 'd', 'p', 'q', 't', 'f'].includes(k)) core++
    }
    const ratio = core / total
    expect(ratio).toBeGreaterThan(0.55)   // 核心基数 5:1 → 约 70%，统计口径宽松防抖
    expect(ratio).toBeLessThan(0.85)
    expect(Object.keys(counts).every((k) => ['b','d','p','q','t','f','j','l','r','s','z','e','c','g','y','u','n','h','a'].includes(k))).toBe(true)
  })
  it('同字母不连续出现（used 尾部去重，12 次重抽保底）', () => {
    for (let i = 0; i < 200; i++) {
      const first = w.pickDet([])
      const second = w.pickDet([first])
      expect(second).not.toBe(first)
    }
  })
})
