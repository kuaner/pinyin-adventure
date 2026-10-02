/* 连击计算 + 结算（src/stores/game.svelte.ts）单测：
   comboMult x2/x3 倍率与清零、starsFor 星星档、gameHit 记账+连击、endGame 每日 10 星上限/破纪录/星星入成长。
   历次 bug 住点：连击清零时机、星星上限防刷、错一次清零。 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

type GameMod = typeof import('../../src/stores/game.svelte')
type GrowthMod = typeof import('../../src/stores/growth.svelte')
let m: GameMod
let growth: GrowthMod

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  m = await import('../../src/stores/game.svelte')
  growth = await import('../../src/stores/growth.svelte')
})
afterEach(() => {
  vi.useRealTimers()
})

/* 进入 play 态：走 app 真实链 startGame(frozen)+toPlay(frozen)——保证 gameRec 已有首建调用
   （endGame 内的二次调用才是代理视图；直接置 phase 会踩 Svelte5 raw 首建视图，与 app 不符） */
function inPlay(id = 'balloon') {
  m.startGame(id, true)
  m.toPlay(true)
}

describe('comboMult 连击倍率', () => {
  it('0-2 连 → x1；3-5 连 → x2；6+ 连 → x3', () => {
    expect([0, 1, 2].map(m.comboMult)).toEqual([1, 1, 1])
    expect([3, 4, 5].map(m.comboMult)).toEqual([2, 2, 2])
    expect([6, 7, 20].map(m.comboMult)).toEqual([3, 3, 3])
  })
})

describe('starsFor 星星档', () => {
  it('0/70/140/220/300/400 分 → 0/1/2/3/4/5 星（边界值）', () => {
    expect(m.starsFor(0)).toBe(0)
    expect(m.starsFor(69)).toBe(0)
    expect(m.starsFor(70)).toBe(1)
    expect(m.starsFor(139)).toBe(1)
    expect(m.starsFor(140)).toBe(2)
    expect(m.starsFor(219)).toBe(2)
    expect(m.starsFor(220)).toBe(3)
    expect(m.starsFor(299)).toBe(3)
    expect(m.starsFor(300)).toBe(4)
    expect(m.starsFor(399)).toBe(4)
    expect(m.starsFor(400)).toBe(5)
    expect(m.starsFor(9999)).toBe(5)
  })
})

describe('gameHit 连击记账', () => {
  it('连对计分走倍率（10 分底数）+ maxCombo 跟踪', () => {
    inPlay()
    m.gameHit('b', true)      // combo1 mult1 → 10
    m.gameHit('b', true)      // combo2 mult1 → 20
    m.gameHit('d', true)      // combo3 mult2 → 40
    m.gameHit('d', true)      // combo4 mult2 → 60
    m.gameHit('p', true)      // combo5 mult2 → 80
    m.gameHit('p', true)      // combo6 mult3 → 110
    expect(m.GS.combo).toBe(6)
    expect(m.GS.maxCombo).toBe(6)
    expect(m.GS.score).toBe(110)
    expect(m.GS.tries).toBe(6)
  })

  it('答错清零连击（高分连击后错 1 次 → combo 0，再对从 x1 重计）', () => {
    inPlay()
    for (let i = 0; i < 4; i++) m.gameHit('b', true)
    expect(m.GS.combo).toBe(4)
    expect(m.GS.score).toBe(60)     // 10+10+20+20
    m.gameHit('d', false)
    expect(m.GS.combo).toBe(0)
    expect(m.GS.maxCombo).toBe(4)   // maxCombo 保留
    m.gameHit('d', true)
    expect(m.GS.combo).toBe(1)
    expect(m.GS.score).toBe(70)     // 60 + 10（x1 重计）
  })

  it('ledger=item 记条目账本，不串字母账本', () => {
    inPlay()
    m.gameHit('ba', true, 'item')
    m.gameHit('ba', false, 'item')
    expect(m.GD.items['ba']).toMatchObject({ ok: 1, err: 1 })
    expect(m.GD.letters).toEqual({})
  })

  it('非 play 态记账无效（防结算后误触）', () => {
    m.gameHit('b', true)            // phase=''
    expect(m.GD.letters).toEqual({})
    expect(m.GS.score).toBe(0)
  })
})

describe('endGame 结算', () => {
  it('星星按分档入账 + 入小鸡成长（G.stars）', () => {
    inPlay()
    m.GS.score = 220
    m.GS.tries = 10
    m.endGame()
    expect(m.GS.stars).toBe(3)
    expect(growth.G.stars).toBe(3)
    expect(m.GD.games['balloon'].best).toBe(220)
    expect(m.GS.phase).toBe('result')
  })

  it('每游戏每日上限 10 星：今日已 10 星 → 0 星入账', () => {
    m.GD.games['balloon'] = { best: 0, starsToday: 10, lastPlayDay: m2.todayStr() }
    inPlay()
    m.GS.score = 400
    m.GS.tries = 10
    m.endGame()
    expect(m.GS.stars).toBe(0)
    expect(growth.G.stars).toBe(0)
    expect(m.GD.games['balloon'].best).toBe(400)   // best 照记
  })

  it('部分余量：今日 8 星 + 5 星结算 → 只进 2 星', () => {
    m.GD.games['balloon'] = { best: 0, starsToday: 8, lastPlayDay: m2.todayStr() }
    inPlay()
    m.GS.score = 400
    m.GS.tries = 10
    m.endGame()
    expect(m.GS.stars).toBe(2)
    expect(m.GD.games['balloon'].starsToday).toBe(10)
  })

  it('破纪录置 record 旗；拔河胜利 +100 分后再算星', () => {
    m.GD.games['duel'] = { best: 50, starsToday: 0, lastPlayDay: m2.todayStr() }
    m.GS.game = 'duel'
    m.toPlay(true)
    m.GS.score = 100
    m.GS.tries = 10
    m.endGame(1)
    expect(m.GS.score).toBe(200)     // 100 + 100 胜利奖
    expect(m.GS.record).toBe(true)
    expect(m.GD.games['duel'].best).toBe(200)
  })

  it('拔河战败（win=-1）不加胜利分照常结算', () => {
    inPlay()
    m.GS.score = 80
    m.GS.tries = 8
    m.endGame(-1)
    expect(m.GS.score).toBe(80)
    expect(m.GS.win).toBe(-1)
    expect(m.GS.stars).toBe(1)
  })

  it('重复 endGame 幂等（result 态再调不再结算）', () => {
    inPlay()
    m.GS.score = 100
    m.GS.tries = 10
    m.endGame()
    const stars = growth.G.stars
    m.endGame()
    expect(growth.G.stars).toBe(stars)
  })
})

describe('会话计时（toPlay/quitGame）', () => {
  it('toPlay 起倒计时，60 秒归零自动结算', async () => {
    vi.useFakeTimers()
    m.GS.game = 'balloon'
    m.toPlay()
    expect(m.GS.phase).toBe('play')
    expect(m.GS.left).toBe(60)
    vi.advanceTimersByTime(59500)
    expect(m.GS.phase).toBe('play')
    vi.advanceTimersByTime(1000)
    expect(m.GS.phase).toBe('result')
  })

  it('quitGame 清计时器出会话，回练习视图', () => {
    vi.useFakeTimers()
    m.GS.game = 'balloon'
    m.toPlay()
    m.quitGame()
    expect(m.GS.phase).toBe('')
    vi.advanceTimersByTime(120000)
    expect(m.GS.phase).toBe('')      // 计时器已清：不会被结算
  })
})

/* progress 引用（同代次，todayStr 用于构造当日星账） */
let m2: typeof import('../../src/stores/progress.svelte')
beforeEach(async () => {
  m2 = await import('../../src/stores/progress.svelte')
})
