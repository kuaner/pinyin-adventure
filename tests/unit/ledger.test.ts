/* 错误账本 game_stats_v1（src/stores/game.svelte.ts）单测：
   读写往返 / normalize 容错 / recordLetter / recordItem / gameRec 跨天滚存 / dailyRec / 读侧无副作用。
   历次 bug 住点：账本结构带版本号、旧数据 items 缺失向后兼容、读侧函数禁止写副作用（进 $derived 会炸）。 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

type GameMod = typeof import('../../src/stores/game.svelte')
let m: GameMod

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  m = await import('../../src/stores/game.svelte')
})

describe('账本初始化与 normalize', () => {
  it('空数据 → 默认空账本（letters/games/items 空，daily 未做）', () => {
    expect(m.GD.v).toBe(1)
    expect(Object.keys(m.GD.letters)).toHaveLength(0)
    expect(Object.keys(m.GD.games)).toHaveLength(0)
    expect(Object.keys(m.GD.items)).toHaveLength(0)
    expect(m.GD.daily).toEqual({ day: '', best: 0, done: false })
  })

  it('损坏 JSON → 回退默认账本不抛错', async () => {
    localStorage.setItem('pinyin_game_v1', '{broken json!!')
    vi.resetModules()
    m = await import('../../src/stores/game.svelte')
    expect(Object.keys(m.GD.letters)).toHaveLength(0)
  })

  it('v 不符（0）→ 整体弃用回默认', async () => {
    localStorage.setItem('pinyin_game_v1', JSON.stringify({ v: 0, letters: { b: { ok: 9, err: 1, last: 1 } } }))
    vi.resetModules()
    m = await import('../../src/stores/game.svelte')
    expect(Object.keys(m.GD.letters)).toHaveLength(0)
  })

  it('合法数据载入 + 字段矫正（非数字 ok/err 归 0，缺失 items 向后兼容）', async () => {
    localStorage.setItem('pinyin_game_v1', JSON.stringify({
      v: 1,
      letters: { b: { ok: '3', err: true, last: 'x' }, d: { ok: 2, err: 5, last: 999 } },
      games: { balloon: { best: '120', starsToday: 3, lastPlayDay: 45 } },
      daily: { day: '2026-10-01', best: '55', done: 1 },
    }))
    vi.resetModules()
    m = await import('../../src/stores/game.svelte')
    expect(m.GD.letters['b']).toEqual({ ok: 3, err: 1, last: 0 })   // 'x' → NaN → 0
    expect(m.GD.letters['d']).toEqual({ ok: 2, err: 5, last: 999 })
    expect(m.GD.games['balloon']).toEqual({ best: 120, starsToday: 3, lastPlayDay: '45' })
    expect(m.GD.daily).toEqual({ day: '2026-10-01', best: 55, done: true })
    expect(m.GD.items).toEqual({})   // 旧数据无 items → 空表
  })

  it('saveGD → reload 往返一致', async () => {
    m.recordLetter('b', true)
    m.recordLetter('b', false)
    vi.resetModules()
    m = await import('../../src/stores/game.svelte')
    expect(m.GD.letters['b']).toMatchObject({ ok: 1, err: 1 })
  })
})

describe('recordLetter / recordItem 记账', () => {
  it('记对/记错各自累加，last=今天 dayNum', () => {
    m.recordLetter('b', true)
    m.recordLetter('b', true)
    m.recordLetter('b', false)
    expect(m.GD.letters['b']).toEqual({ ok: 2, err: 1, last: m.dayNum() })
    // 空键防御：不建账不抛错
    m.recordLetter('', true)
    expect(Object.keys(m.GD.letters)).toEqual(['b'])
  })

  it('条目账本（拼读对/声调音节）独立记账', () => {
    m.recordItem('ba', false)
    m.recordItem('ma2', true)
    expect(m.GD.items['ba']).toMatchObject({ ok: 0, err: 1 })
    expect(m.GD.items['ma2']).toMatchObject({ ok: 1, err: 0 })
    expect(m.GD.letters).toEqual({})   // 不串账本
    m.recordItem('', true)
    expect(Object.keys(m.GD.items)).toHaveLength(2)
  })
})

describe('gameRec 跨天滚存（starsToday 每日重置）', () => {
  it('昨日星账 → 今天读起清零 starsToday，best 保留', async () => {
    localStorage.setItem('pinyin_game_v1', JSON.stringify({
      v: 1,
      games: { balloon: { best: 250, starsToday: 10, lastPlayDay: '2000-01-01' } },
    }))
    vi.resetModules()
    m = await import('../../src/stores/game.svelte')
    const rec = m.gameRec('balloon')
    expect(rec.starsToday).toBe(0)
    expect(rec.best).toBe(250)
    expect(rec.lastPlayDay).toBe(m2.todayStr())   // 写侧覆盖为今天
  })

  it('同日重复读不重复清账（滚存幂等；写入走二次调用的代理视图=app 真实路径）', () => {
    m.gameRec('fish')                       // 首建（app 的 startGame 路径）
    const r2 = m.gameRec('fish')            // 二次读=代理视图（app 的 endGame 路径）
    r2.starsToday = 6
    const r3 = m.gameRec('fish')            // 同日三读：不得清账
    expect(r3.starsToday).toBe(6)
  })

  it('新游戏 → 建空档（同日滚存不覆盖当日星账）', () => {
    const r = m.gameRec('mole')
    expect(r).toEqual({ best: 0, starsToday: 0, lastPlayDay: m2.todayStr() })
  })
})

describe('dailyRec / 读侧（纯读零写副作用）', () => {
  it('昨日 daily → 今天重置 done/best', async () => {
    localStorage.setItem('pinyin_game_v1', JSON.stringify({
      v: 1,
      daily: { day: '2000-01-01', best: 88, done: true },
    }))
    vi.resetModules()
    m = await import('../../src/stores/game.svelte')
    const d = m.dailyRec()
    expect(d.day).not.toBe('2000-01-01')
    expect(d).toMatchObject({ best: 0, done: false })
  })

  it('gameBest：无记录 → 0；有记录 → best', () => {
    expect(m.gameBest('balloon')).toBe(0)
    m.GD.games['balloon'] = { best: 300, starsToday: 1, lastPlayDay: '' }
    expect(m.gameBest('balloon')).toBe(300)
  })

  it('dailyView：当日已做/未做透传；跨日 → 未做 0 分（不写账）', () => {
    m.GD.daily = { day: '2000-01-01', best: 88, done: true }
    expect(m.dailyView()).toEqual({ done: false, best: 0 })
    // 跨日视图读不触发滚存（dailyRec 才有写副作用）
    expect(m.GD.daily.day).toBe('2000-01-01')
    // 精确构造当日：todayStr 与 game 模块同代次
    m.GD.daily = { day: m2.todayStr(), best: 66, done: true }
    expect(m.dailyView()).toEqual({ done: true, best: 66 })
  })

  it('dayNum：epoch 天数换算稳定', () => {
    expect(m.dayNum(new Date(0))).toBe(0)
    expect(m.dayNum(new Date(86400000))).toBe(1)
  })
})

/* progress.svelte 同代次引用（beforeEach 顺序执行：resetModules → game → progress，同一代次） */
let m2: typeof import('../../src/stores/progress.svelte')
beforeEach(async () => {
  m2 = await import('../../src/stores/progress.svelte')
})
