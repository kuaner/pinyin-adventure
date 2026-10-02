/* 每日挑战会话（DC）+ 目标音（askTarget/listenTarget）单测：
   10 题流程/计分/星星结算、Bug#37 两段式试听（首点=播音高亮不判分，再点同项才作答）、
   quitDaily 清理、fakeResult 探针态。走真实出题（buildDailyQs，默认回落池）+ fake timers。 */
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

/** 开挑战并连答 n 题（ansIdxPerQ 自定义作答；默认全对） */
function play(n: number, wrongAt: number[] = []) {
  for (let i = 0; i < n; i++) {
    const q = m.DC.qs[m.DC.i]
    const wrong = wrongAt.includes(i)
    m.dailyAnswer(wrong ? (q.ans + 1) % q.opts.length : q.ans)
    vi.advanceTimersByTime(wrong ? 1400 : 750)   // 反馈窗（错=1.4s 对=0.75s）后 dailyNext
  }
}

describe('每日挑战流程', () => {
  it('开局 10 题、零起点、当日 dailyRec 记账', () => {
    vi.useFakeTimers()
    m.startDaily()
    expect(m.DC.qs).toHaveLength(10)
    expect(m.DC.i).toBe(0)
    expect(m.DC.score).toBe(0)
    expect(m.DC.done).toBe(false)
    expect(m.dailyRec().done).toBe(false)
  })

  it('连对计分走倍率 + maxCombo；答错清零', () => {
    vi.useFakeTimers()
    m.startDaily()
    play(3)
    expect(m.DC.ok).toBe(3)
    expect(m.DC.combo).toBe(3)
    expect(m.DC.score).toBe(40)          // 10+10+20
    play(1, [0])                          // 第 4 题答错
    expect(m.DC.combo).toBe(0)
    expect(m.DC.maxCombo).toBe(3)
    expect(m.DC.ok).toBe(3)
    expect(m.DC.score).toBe(40)
  })

  it('答错账本记 err，答对记 ok（字母题）', () => {
    vi.useFakeTimers()
    m.startDaily()
    const q0 = m.DC.qs[0]
    const q1 = m.DC.qs[1]
    m.dailyAnswer(q0.ans)
    vi.advanceTimersByTime(750)
    m.dailyAnswer((q1.ans + 1) % q1.opts.length)
    vi.advanceTimersByTime(1400)
    if (q0.type !== 'zi') expect(m.GD.letters[q0.A].ok).toBe(1)
    if (q1.type !== 'zi') expect(m.GD.letters[q1.A].err).toBe(1)
  })

  it('答完 10 题自动结算：全对=5 星入成长+done+签到', () => {
    vi.useFakeTimers()
    m.startDaily()
    play(10)
    expect(m.DC.done).toBe(true)
    expect(m.DC.ok).toBe(10)
    expect(m.DC.stars).toBe(5)
    expect(growth.G.stars).toBe(5)
    expect(m.dailyRec().done).toBe(true)
  })

  it('星档：9 对=4 星', () => {
    vi.useFakeTimers()
    m.startDaily()
    play(10, [8])           // 10 答错 1 → 9 对
    expect(m.DC.ok).toBe(9)
    expect(m.DC.stars).toBe(4)
  })

  it('星档：4 对=1 星（不满 6 对无 2 星）', () => {
    vi.useFakeTimers()
    m.startDaily()
    play(10, [0, 1, 2, 3, 4, 5])   // 10 答错 6 → 4 对
    expect(m.DC.ok).toBe(4)
    expect(m.DC.stars).toBe(1)
  })

  it('星档：3 对=0 星且不入成长', () => {
    vi.useFakeTimers()
    m.startDaily()
    play(10, [0, 1, 2, 3, 4, 5, 6])
    expect(m.DC.ok).toBe(3)
    expect(m.DC.stars).toBe(0)
    expect(growth.G.stars).toBe(0)
  })

  it('reveal 窗口内再答无效（防连点双计）', () => {
    vi.useFakeTimers()
    m.startDaily()
    const q = m.DC.qs[0]
    m.dailyAnswer(q.ans)
    const score = m.DC.score
    m.dailyAnswer(q.ans)      // reveal 未清，二次作答忽略
    expect(m.DC.score).toBe(score)
  })

  it('quitDaily 立即终局且回练习视图', () => {
    vi.useFakeTimers()
    m.startDaily()
    m.quitDaily()
    expect(m.DC.done).toBe(true)
  })
})

describe('Bug#37 两段式试听（dailyArm）——单测级回归样例', () => {
  it('首点=高亮试听不判分不推进；再点同项才作答', () => {
    vi.useFakeTimers()
    m.startDaily()
    const q = m.DC.qs[0]
    m.dailyArm(q.ans)
    expect(m.DC.armed).toBe(q.ans)
    expect(m.DC.reveal).toBeNull()      // 未判分
    expect(m.DC.score).toBe(0)          // 未计分
    expect(m.DC.i).toBe(0)              // 未推进
    m.dailyArm(q.ans)                    // 再点同项 → 判分
    expect(m.DC.reveal).not.toBeNull()
    expect(m.DC.reveal!.correct).toBe(q.ans)
    expect(m.DC.ok).toBe(1)
  })

  it('切点别项=切试听（armed 换位），仍不判分', () => {
    vi.useFakeTimers()
    m.startDaily()
    const q = m.DC.qs[0]
    expect(q.opts.length).toBeGreaterThan(1)
    m.dailyArm(q.ans)
    const other = (q.ans + 1) % q.opts.length
    m.dailyArm(other)
    expect(m.DC.armed).toBe(other)
    expect(m.DC.reveal).toBeNull()
  })

  it('zi 题两段式：试听走拼音音节路径（无音频仅高亮不炸）', () => {
    vi.useFakeTimers()
    m.startDaily()
    const ziIdx = m.DC.qs.findIndex((q) => q.type === 'zi')
    expect(ziIdx).toBeGreaterThanOrEqual(0)
    // 直达该题
    m.DC.i = ziIdx
    const q = m.DC.qs[ziIdx]
    m.dailyArm(q.ans)
    expect(m.DC.armed).toBe(q.ans)
    expect(m.DC.reveal).toBeNull()
    m.dailyArm(q.ans)
    expect(m.DC.reveal!.correct).toBe(q.ans)
  })
})

describe('听音目标（askTarget/listenTarget）', () => {
  it('askTarget 置目标+已听旗；listenTarget 需有目标', () => {
    m.GS.game = 'balloon'
    m.askTarget('b')
    expect(m.GS.target).toBe('b')
    expect(m.GS.listened).toBe(true)
    m.listenTarget()                     // 有目标重听：置旗不炸
    expect(m.GS.listened).toBe(true)
    m.GS.target = ''
    m.GS.listened = false
    m.listenTarget()
    expect(m.GS.listened).toBe(false)   // 无目标不置旗
  })

  it('口诀地鼠 kj 旗在 startGame 置位（认知路径=口诀→形）', () => {
    m.startGame('mole', true)
    expect(m.GS.kj).toBe(true)
    m.startGame('balloon', true)
    expect(m.GS.kj).toBe(false)
  })
})

describe('fakeResult 探针态 + gameTitle', () => {
  it('fakeResult 直落结算态（探针专用；best 不持久化=首建视图 nuance，见报告）', () => {
    m.fakeResult('fish', 180)
    expect(m.GS.phase).toBe('result')
    expect(m.GS.score).toBe(180)
    expect(m.GS.maxCombo).toBe(6)
    expect(m.GS.stars).toBe(2)      // starsFor(180)=2（140-219 档）
  })

  it('gameTitle：已知游戏=文案键翻译；未知=空串', () => {
    m.GS.game = 'balloon'
    expect(m.gameTitle().length).toBeGreaterThan(0)
    m.GS.game = 'nope'
    expect(m.gameTitle()).toBe('')
  })
})
