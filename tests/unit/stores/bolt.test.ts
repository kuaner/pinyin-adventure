/* ⚡闪电刷题 store 单测（src/stores/bolt.svelte.ts）：
   5 分钟计时/连对/今日与历史最佳（≥10 题才入账）/答题双记账（pinyin_v2 权重 + 游戏账本）/
   提前结束/结算文案三档/v3.2 徽章事件（满分+速读）。 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

type Bolt = typeof import('../../../src/stores/bolt.svelte')
let bolt!: Bolt
let progress!: typeof import('../../../src/stores/progress.svelte')
let game!: typeof import('../../../src/stores/game.svelte')
let quizEngine!: typeof import('../../../src/lib/quizEngine')
let ui!: typeof import('../../../src/stores/ui.svelte')

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  vi.useFakeTimers()
  progress = await import('../../../src/stores/progress.svelte')
  game = await import('../../../src/stores/game.svelte')
  quizEngine = await import('../../../src/lib/quizEngine')
  bolt = await import('../../../src/stores/bolt.svelte')
  ui = await import('../../../src/stores/ui.svelte')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function answer(q: { ans: number }, correct: boolean) {
  bolt.boltAnswer(correct ? q.ans : 1 - q.ans)
  vi.advanceTimersByTime(310)   // v4.7 守卫：判定冷却 300ms（立法 300-500 带内短窗）
  vi.advanceTimersByTime(correct ? 220 : 1000)   // 反馈窗→下一题
  vi.advanceTimersByTime(310)   // 进题宽限 300ms
}

describe('startBolt 开局', () => {
  it('重置会话态 + 首题就位 + 视图 bolt + BT_KEYS 清零', () => {
    quizEngine.BT_KEYS.push('x', 'y')
    bolt.startBolt(true)
    expect(bolt.BT.done).toBe(false)
    expect(bolt.BT.left).toBe(300)
    expect(bolt.BT.n).toBe(0)
    expect(bolt.BT.q).toBeTruthy()
    expect(quizEngine.BT_KEYS).toHaveLength(1)   // 首题键已入
    expect(progress.S.stars).toEqual({})
  })
  it('freeze=true 不挂计时器；freeze=false 挂 1s tick', () => {
    bolt.startBolt(true)
    vi.advanceTimersByTime(5000)
    expect(bolt.BT.left).toBe(300)
    bolt.startBolt(false)
    vi.advanceTimersByTime(3000)
    expect(bolt.BT.left).toBe(297)
  })
  it('倒计时归零自动结算（endBolt）', () => {
    bolt.startBolt(false)
    vi.advanceTimersByTime(300000)
    expect(bolt.BT.done).toBe(true)
    expect(bolt.BT.resultOn).toBe(true)
  })
})

describe('boltAnswer 计分/连击/双记账', () => {
  it('答对：n/ok/streak/best 推进 + 权重 streak + 游戏账本 ok', () => {
    bolt.startBolt(true)
    const q = bolt.BT.q!
    answer(q, true)
    expect(bolt.BT.n).toBe(1)
    expect(bolt.BT.ok).toBe(1)
    expect(bolt.BT.streak).toBe(1)
    expect(bolt.BT.best).toBe(1)
    expect(progress.S.weights[q.key].w).toBeGreaterThanOrEqual(1)
    expect(game.GD.letters[q.A].ok).toBe(1)
  })
  it('答错：streak 清零 + reveal 高亮正确项（零错误信息：不播错误读音）+ 账本 err', () => {
    bolt.startBolt(true)
    const q = bolt.BT.q!
    answer(q, true)
    const q2 = bolt.BT.q!
    answer(q2, false)
    expect(bolt.BT.streak).toBe(0)
    expect(bolt.BT.ok).toBe(1)
    expect(bolt.BT.n).toBe(2)
    expect(game.GD.letters[q2.A].err).toBe(1)
  })
  it('连对 5 → best=5；反馈窗后自动出下一题（reveal 清空）', () => {
    bolt.startBolt(true)
    for (let i = 0; i < 5; i++) answer(bolt.BT.q!, true)
    expect(bolt.BT.streak).toBe(5)
    expect(bolt.BT.best).toBe(5)
    expect(bolt.BT.reveal).toBeNull()
  })
  it('done 后答题直接忽略（结算页误触不记分）', () => {
    bolt.startBolt(true)
    bolt.BT.done = true
    bolt.boltAnswer(0)
    expect(bolt.BT.n).toBe(0)
  })
})

describe('endBolt 结算与纪录', () => {
  it('<10 题：不入账（S.bolt 不动，无纪录）', () => {
    bolt.startBolt(true)
    for (let i = 0; i < 3; i++) answer(bolt.BT.q!, true)
    bolt.endBolt()
    expect(bolt.BT.record).toBe(false)
    expect(progress.S.bolt.acc).toBe(0)
    expect(bolt.BT.resultOn).toBe(true)
  })
  it('≥10 题：正确率入今日/历史最佳；破纪录置 record + confetti', () => {
    bolt.startBolt(true)
    for (let i = 0; i < 12; i++) answer(bolt.BT.q!, true)
    bolt.endBolt()
    expect(bolt.BT.ok).toBe(12)
    expect(progress.S.bolt.acc).toBe(100)
    expect(progress.S.bolt.tacc).toBe(100)
    expect(bolt.BT.record).toBe(true)
    expect(bolt.BT.confetti).toHaveLength(14)
  })
  it('当日二次结算：历史最佳不被低分覆盖、今日最佳取高', () => {
    bolt.startBolt(true)
    for (let i = 0; i < 12; i++) answer(bolt.BT.q!, true)
    bolt.endBolt()
    bolt.startBolt(true)
    for (let i = 0; i < 10; i++) {
      answer(bolt.BT.q!, i < 8)   // 8 对 2 错 = 80%
    }
    bolt.endBolt()
    expect(progress.S.bolt.acc).toBe(100)   // 历史最佳保留
    expect(progress.S.bolt.tacc).toBe(100)
    expect(bolt.BT.record).toBe(false)
  })
  it('≥20 题全对 → 闪电满分徽章旗（v3.2 事件型，持久化）', () => {
    bolt.startBolt(true)
    for (let i = 0; i < 20; i++) answer(bolt.BT.q!, true)
    bolt.endBolt()
    const raw = JSON.parse(localStorage.getItem('pinyin_growth_v1') || '{}')
    expect(raw.boltPerf).toBe(true)
    expect(raw.badges).toContain('boltperfect')
  })
})

describe('结算文案与工具', () => {
  it('boltTitle 三档：未答题/≥90 神速/≥75 飞快/正常', () => {
    expect(bolt.boltTitle()).toBeTruthy()   // n=0
    bolt.startBolt(true)
    for (let i = 0; i < 10; i++) answer(bolt.BT.q!, true)
    expect(bolt.boltAcc()).toBe(100)
    expect(bolt.boltAvg()).toBeGreaterThanOrEqual(0)
  })
  it('boltAvg：平均秒数=总时长/题数/1000', () => {
    bolt.startBolt(true)
    vi.advanceTimersByTime(1000)
    answer(bolt.BT.q!, true)
    expect(bolt.boltAvg()).toBeGreaterThan(0.9)
    expect(bolt.boltAvg()).toBeLessThan(2.2)
  })
  it('boltQuit：进行中=提前结算；已结算=回练习 tab', () => {
    bolt.startBolt(true)
    bolt.boltQuit()
    expect(bolt.BT.done).toBe(true)
    bolt.boltQuit()
    expect(ui.ui.view).toBe('practice')
  })
})
