/* 闪卡三盒 store 单测（src/stores/flash.svelte.ts）：
   Leitner 到期优先牌堆/分类过滤/自评移动盒子（当天/明天/三天）/翻面读音/空牌堆 toast。 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LETTERS } from '../../../src/data'

type Flash = typeof import('../../../src/stores/flash.svelte')
let flash!: Flash
let progress!: typeof import('../../../src/stores/progress.svelte')
let audio!: typeof import('../../../src/lib/audio')
let ui!: typeof import('../../../src/stores/ui.svelte')

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  progress = await import('../../../src/stores/progress.svelte')
  audio = await import('../../../src/lib/audio')
  ui = await import('../../../src/stores/ui.svelte')
  flash = await import('../../../src/stores/flash.svelte')
})

describe('牌堆构建（renderFlash/setCat）', () => {
  it('all 类：全 57 字母入堆、序号归零、未翻面', () => {
    flash.setCat('all')
    expect(flash.FC.deck).toHaveLength(57)
    expect(flash.FC.idx).toBe(0)
    expect(flash.FC.flipped).toBe(false)
    expect(flash.FC.cat).toBe('all')
  })
  it('分类过滤：sm 只含声母、ym 只含韵母', () => {
    flash.setCat('sm')
    expect(flash.FC.deck.length).toBeGreaterThan(0)
    for (const k of flash.FC.deck) expect(LETTERS[k].cat).toBe('sm')
    flash.setCat('ym')
    for (const k of flash.FC.deck) expect(LETTERS[k].cat).toBe('ym')
  })
  it('到期优先：到期/未设 due 的排前（洗牌），未到期按 due 升序在后', () => {
    const today = progress.todayStr()
    const d = (offset: number) => {
      const t = new Date(); t.setDate(t.getDate() + offset)
      return progress.todayStr(t)
    }
    progress.S.cards['b'] = { box: 2, due: d(5) }    // 未到期，较晚
    progress.S.cards['p'] = { box: 2, due: d(1) }    // 未到期，较早
    // a/m 不设卡 → 默认到期
    flash.setCat('sm')
    const deck = flash.FC.deck
    const dueZone = deck.slice(0, deck.findIndex((k) => k === 'b' || k === 'p'))
    const restZone = deck.slice(deck.findIndex((k) => k === 'b' || k === 'p'))
    expect(deck.indexOf('p')).toBeGreaterThan(-1)
    expect(restZone).toContain('b')
    expect(restZone.indexOf('p')).toBeLessThan(restZone.indexOf('b'))   // p(明天…+1) 在 b(+5) 前
    expect(dueZone).not.toContain('b')
    expect(today).toBeTruthy()
  })
})

describe('翻面与自评', () => {
  beforeEach(() => flash.setCat('all'))
  it('flip：翻面 + 读音点播（say→缓存当前字母读音）', () => {
    const k = flash.currentKey()
    flash.flip()
    expect(flash.FC.flipped).toBe(true)
    expect(audio.AUDIO_CACHE[audio.letterAudio(k)]).toBeTruthy()
    flash.flip()
    expect(flash.FC.flipped).toBe(false)
  })
  it('rate=2（快会了）：盒子 2、due=明天、推进下一张且回到正面', () => {
    const k = flash.currentKey()
    flash.flip()
    flash.rate(2)
    const today = new Date(); today.setDate(today.getDate() + 1)
    expect(progress.S.cards[k]).toEqual({ box: 2, due: progress.todayStr(today) })
    expect(flash.FC.idx).toBe(1)
    expect(flash.FC.flipped).toBe(false)
  })
  it('rate=3（会了）：盒子 3、due=三天后、星星音', () => {
    const k = flash.currentKey()
    flash.rate(3)
    const t = new Date(); t.setDate(t.getDate() + 3)
    expect(progress.S.cards[k]).toEqual({ box: 3, due: progress.todayStr(t) })
  })
  it('rate=1（还不会）：留盒 1、due=今天（明天再出现）', () => {
    const k = flash.currentKey()
    flash.rate(1)
    expect(progress.S.cards[k]).toEqual({ box: 1, due: progress.todayStr() })
  })
  it('未翻面直接 rate 也合法（跳过不读）', () => {
    const k = flash.currentKey()
    flash.rate(2)
    expect(flash.FC.idx).toBe(1)
    expect(progress.S.cards[k].box).toBe(2)
  })
  it('牌堆答完：flip→toast、rate 不再推进', () => {
    const n = flash.FC.deck.length
    for (let i = 0; i < n; i++) flash.rate(2)
    expect(flash.FC.idx).toBe(n)
    flash.flip()
    expect(ui.ui.toastOn).toBe(true)
    const idx = flash.FC.idx
    flash.rate(2)
    expect(flash.FC.idx).toBe(idx)   // 越界 rate no-op
  })
})

describe('deckInfo 信息行', () => {
  it('进行中=到期数+第几张；答完=还有到期/全部完成', () => {
    flash.setCat('all')
    const info = flash.deckInfo()
    expect(info).toContain('1')
    for (let i = 0; i < flash.FC.deck.length; i++) flash.rate(2)
    const done = flash.deckInfo()
    expect(done.length).toBeGreaterThan(0)
  })
})
