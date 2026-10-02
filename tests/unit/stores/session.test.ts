/* 答题会话 store 单测（src/stores/session.svelte.ts）：
   两段式试听（arm→answer 状态流，Bug#37）/ 反馈层与计分 / 侦探镜像联动 / 结算星档与解锁文案
   / 历史入账 / 徽章汇查。10 题会话是闯关/侦探/快拼/专练的共用骨架。 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Question, SessionCfg } from '../../../src/lib/types'

type Session = typeof import('../../../src/stores/session.svelte')
let session!: Session
let progress!: typeof import('../../../src/stores/progress.svelte')
let weights!: typeof import('../../../src/stores/weights.svelte')
let game!: typeof import('../../../src/stores/game.svelte')
let growth!: typeof import('../../../src/stores/growth.svelte')
let ui!: typeof import('../../../src/stores/ui.svelte')

const listenQ = (over: Partial<any> = {}): Question => ({
  type: 'listen', key: 'L:b', hint: '', A: 'b', B: 'd',
  opts: ['b', 'd', 'p', 'm'], ans: 0, ...over,
} as Question)
const lookQ = (): Question => ({
  type: 'look', key: 'L:b', hint: '', A: 'b', B: 'd',
  opts: ['b', 'd', 'p', 'm'], ans: 0,
} as Question)

function startWith(qs: Question[], cfg: Partial<SessionCfg> = {}) {
  session.newSession({ name: '测试会话', qs, ...cfg })
}

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  vi.useFakeTimers()
  progress = await import('../../../src/stores/progress.svelte')
  weights = await import('../../../src/stores/weights.svelte')
  game = await import('../../../src/stores/game.svelte')
  growth = await import('../../../src/stores/growth.svelte')
  ui = await import('../../../src/stores/ui.svelte')
  session = await import('../../../src/stores/session.svelte')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('newSession / 各模式入口', () => {
  it('会话态归零：i/score/miss/armed/reveal/fb/result、代数推进', () => {
    startWith([listenQ()])
    session.answer(0)
    vi.advanceTimersByTime(900)
    const tk = session.QZ.tk
    startWith([listenQ()])
    expect(session.QZ.i).toBe(0)
    expect(session.QZ.score).toBe(0)
    expect(session.QZ.miss).toEqual({})
    expect(session.QZ.armed).toBe(-1)
    expect(session.QZ.reveal).toBeNull()
    expect(session.QZ.fb).toBeNull()
    expect(session.QZ.tk).toBe(tk + 1)
    expect(ui.ui.view).toBe('quiz')
  })
  it('startLevel：构真实第 1 关 10 题', () => {
    session.startLevel(1)
    expect(ui.ui.view).toBe('quiz')
    expect(session.QZ.cfg!.qs).toHaveLength(10)
    expect(session.QZ.q).toBeTruthy()
  })
  it('startDet/startZi/startPractice/startPairGroup 入口齐活', () => {
    session.startDet()
    expect(session.QZ.cfg!.det).toBe(true)
    expect(session.QZ.cfg!.qs).toHaveLength(10)
    session.startZi()
    expect(session.QZ.cfg!.zi).toBe(true)
    session.startPractice('all')
    expect(session.QZ.cfg!.pkind).toBe('all')
    session.startPairGroup('mirror')
    expect(session.QZ.cfg!.qs).toHaveLength(10)
  })
})

describe('两段式试听（armOpt）——v4.5 适用矩阵版（Bug#38）', () => {
  it('listen 题（选项=已学单字母）一点即答：首点即判分', () => {
    startWith([listenQ()])
    vi.advanceTimersByTime(500)   // v4.7 守卫：进题宽限 450ms 后首击可收
    session.armOpt(0)   // 一点即答（不再有试听段）
    expect(session.QZ.reveal).not.toBeNull()
    expect(session.QZ.score).toBe(1)
  })
  it('look 题（音节串选项，读不出）两段式保留：首点=试听高亮不判分', () => {
    startWith([lookQ()])
    vi.advanceTimersByTime(500)
    session.armOpt(1)
    expect(session.QZ.armed).toBe(1)
    expect(session.QZ.score).toBe(0)
    expect(session.QZ.reveal).toBeNull()
  })
  it('look 题再点同项=作答（arm→answer）；点别项=切试听', () => {
    startWith([lookQ()])
    vi.advanceTimersByTime(500)
    session.armOpt(1)
    session.armOpt(2)   // 切试听
    expect(session.QZ.armed).toBe(2)
    session.armOpt(0)   // 切到正确项
    vi.advanceTimersByTime(500)   // P1-3 确认间隔 ≥400ms
    session.armOpt(0)   // 再点=作答
    expect(session.QZ.score).toBe(1)
    expect(session.QZ.armed).toBe(-1)   // 试听态交还 reveal 态
  })
  it('zi 题选项读音走 hyp 音节键（缺失仅高亮不播——立法明许）', () => {
    const ziQ: Question = {
      type: 'zi', key: 'Z:爸', hint: '', z: { h: '爸', p: 'bà', f: 'zi_ba_44' },
      opts: ['bà', 'mā', 'pà', 'dà'], ans: 0,
    } as Question
    startWith([ziQ])
    vi.advanceTimersByTime(500)
    session.armOpt(1)   // 'mā' → ma1 在 hyp 库
    expect(session.QZ.armed).toBe(1)
    vi.advanceTimersByTime(500)
    session.armOpt(1)
    expect(session.QZ.score).toBe(0)   // 答错不计分
    expect(session.QZ.reveal!.correct).toBe(0)
    expect(session.QZ.reveal!.wrong).toContain(1)
  })
})

describe('answer 计分与反馈层', () => {
  it('答对：score+1、good 反馈、字母题双记账（权重 streak + 游戏账本 ok）', () => {
    startWith([listenQ()])
    session.answer(0)
    expect(session.QZ.score).toBe(1)
    expect(session.QZ.fb!.good).toBe(true)
    expect(session.QZ.fb!.glyph).toBe('b')
    expect(game.GD.letters['b'].ok).toBe(1)
    expect(session.QZ.star).toBe(1)
  })
  it('答错：miss 记账 + wrong reveal + cheer 反馈（零错误信息：不自动播错误项）', () => {
    startWith([listenQ()])
    session.answer(2)
    expect(session.QZ.miss['L:b']).toBe(1)
    expect(session.QZ.fb!.good).toBe(false)
    expect(session.QZ.reveal!.wrong).toContain(2)
    expect(weights.getW('L:b')).toBe(2)   // 错×2
  })
  it('djudge 答错联动：镜像易混对同步加权（闯关多练它）', () => {
    const dj: Question = {
      type: 'djudge', key: 'M:b', hint: '', X: 'b', flipped: true, ans: 1,
    } as Question
    startWith([dj], { det: true })
    session.answer(0)   // 判「没写反」=错
    expect(weights.getW('M:b')).toBe(2)
    expect(weights.getW('b|d')).toBe(2)   // 联动加权（PMAP 有 b|d）
    expect(growth.G.det).toBe(0)          // 答错不计入侦探答对
  })
  it('djudge 答对 → addDetCorrect 计数（徽章数据源）', () => {
    const dj: Question = { type: 'djudge', key: 'M:b', hint: '', X: 'b', flipped: false, ans: 0 } as Question
    startWith([dj], { det: true })
    session.answer(0)
    expect(growth.G.det).toBe(1)
  })
  it('reveal 态再答忽略（v4.5 单答锁：一点即答后反馈期连点不得重复计分）', () => {
    startWith([listenQ(), listenQ({ key: 'L:d', A: 'd', ans: 1 })])
    session.answer(0)
    const s = session.QZ.score
    session.answer(0)   // 反馈期内连点（幽灵/双击）
    session.answer(0)
    expect(session.QZ.score).toBe(s)
    expect(session.QZ.i).toBe(0)   // 也不推进
  })
  it('反馈层自动散场：对 0.8s / 错 1.6s 后进下一题（v4.5 Bug#38 定档）', () => {
    startWith([listenQ(), listenQ({ key: 'L:d', A: 'd', ans: 1 })])
    session.answer(0)   // 对：800ms
    vi.advanceTimersByTime(799)
    expect(session.QZ.fb).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(session.QZ.fb).toBeNull()
    expect(session.QZ.i).toBe(1)
    session.answer(0)   // 错（q2 ans=1）：1600ms
    vi.advanceTimersByTime(1599)
    expect(session.QZ.fb).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(session.QZ.i).toBe(2)
  })
  it('fbSkip：点击跳过反馈立即推进（定时器作废）', () => {
    startWith([listenQ(), listenQ({ A: 'd', ans: 1 })])
    session.answer(0)
    session.fbSkip()
    expect(session.QZ.fb).toBeNull()
    expect(session.QZ.i).toBe(1)
    vi.advanceTimersByTime(5000)   // 旧定时器不再二次推进
    expect(session.QZ.i).toBe(1)
  })
})

describe('endQuiz 结算', () => {
  it('星档：9-10→3 / 7-8→2 / 6→1 / <6→0；无星无解锁文案', () => {
    const cases: [number, number][] = [[10, 3], [9, 3], [8, 2], [7, 2], [6, 1], [5, 0], [0, 0]]
    for (const [correct, stars] of cases) {
      const qs: Question[] = []
      for (let i = 0; i < 10; i++) qs.push(listenQ({ key: 'L:b' + i, A: 'b', ans: 0 }))
      startWith(qs, { levelNo: 3 })
      for (let i = 0; i < 10; i++) {
        session.answer(i < correct ? 0 : 2)
        session.fbSkip()
      }
      expect(session.QZ.result!.stars).toBe(stars)
      expect(ui.ui.view).toBe('result')
    }
  })
  it('过关写星入账 + 解锁文案（第 8 关→大师关、第 9 关→毕业）', () => {
    const qs: Question[] = Array.from({ length: 10 }, (_, i) => listenQ({ key: 'L:x' + i, A: 'b', ans: 0 }))
    startWith(qs, { levelNo: 8 })
    for (let i = 0; i < 10; i++) { session.answer(0); session.fbSkip() }
    expect(progress.S.stars[8]).toBe(3)
    expect(session.QZ.result!.unlockMsg.length).toBeGreaterThan(0)
    startWith(qs, { levelNo: 9 })
    for (let i = 0; i < 10; i++) { session.answer(0); session.fbSkip() }
    startWith(qs, { levelNo: 2 })
    for (let i = 0; i < 10; i++) { session.answer(0); session.fbSkip() }
    expect(session.QZ.result!.lvNo).toBe(2)
  })
  it('最弱项标签：Z:/W:/对键/L: 键各自格式化；历史入账（≤30 条）', () => {
    const qs: Question[] = Array.from({ length: 10 }, (_, i) => listenQ({ key: i === 0 ? 'Z:爸' : 'L:o' + i, A: 'o', ans: 0 }))
    startWith(qs, { levelNo: 1 })
    session.answer(2)   // 第一题答错（Z:爸）
    session.fbSkip()
    for (let i = 1; i < 10; i++) { session.answer(0); session.fbSkip() }
    expect(session.QZ.result!.wlabel).toContain('爸')
    expect(session.QZ.result!.wlabel).toContain('bà')
    expect(progress.S.hist).toHaveLength(1)
    expect(progress.S.hist[0].sc).toBe(9)
  })
  it('quitQuiz：作废反馈定时器回练习 tab', () => {
    startWith([listenQ(), listenQ()])
    session.answer(0)
    session.quitQuiz()
    expect(ui.ui.view).toBe('practice')
    vi.advanceTimersByTime(5000)
    expect(session.QZ.i).toBe(0)   // 旧定时器已作废不推进
  })
  it('showResult：视觉验收直达结算', () => {
    session.showResult({ sc: 8, stars: 2, unlockMsg: '', wlabel: '', lvNo: null })
    expect(ui.ui.view).toBe('result')
  })
})
