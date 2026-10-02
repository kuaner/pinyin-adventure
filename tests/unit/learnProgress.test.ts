/* 学习进度 + 基础进度（learn.svelte.ts / progress.svelte.ts / storage.ts）单测：
   小测 4/5 掌握式门槛（历次 bug 住点：3 对不开门）/ 课序解锁 / 星星档（5对=3星 4对=2星）
   / 闯关解锁链（9=毕业关需全通）/ 历史封顶 30 条 / 闪卡到期。 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

type LearnMod = typeof import('../../src/stores/learn.svelte')
type ProgMod = typeof import('../../src/stores/progress.svelte')
let learn: LearnMod
let prog: ProgMod

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  learn = await import('../../src/stores/learn.svelte')
  prog = await import('../../src/stores/progress.svelte')
})

describe('submitQuiz 掌握式门槛（4/5）', () => {
  it('3 对不过门：不解锁不记星', () => {
    expect(learn.submitQuiz(1, 3, 12)).toBe(false)
    expect(learn.quizPassed(1)).toBe(false)
    expect(learn.lessonUnlocked(2)).toBe(false)
    expect(learn.L.best['1']).toBe(3)            // best 照记
  })
  it('4 对过门：2 星+解锁下一课', () => {
    expect(learn.submitQuiz(1, 4, 12)).toBe(true)
    expect(learn.L.stars['1']).toBe(2)
    expect(learn.lessonUnlocked(2)).toBe(true)
    expect(learn.L.u).toBe(2)
  })
  it('5 对=3 星', () => {
    learn.submitQuiz(1, 5, 12)
    expect(learn.L.stars['1']).toBe(3)
  })
  it('复玩低分不降星；复玩高分升星', () => {
    learn.submitQuiz(1, 5, 12)                   // 3 星
    learn.submitQuiz(1, 4, 12)                   // 2 星 < 3 星：不降
    expect(learn.L.stars['1']).toBe(3)
    // 课 1 已是 3 星封顶；用课 2 验证升档
    learn.submitQuiz(2, 4, 12)
    learn.submitQuiz(2, 5, 12)
    expect(learn.L.stars['2']).toBe(3)
  })
  it('末课通过不再越界解锁（u 停在 12）', () => {
    for (let i = 1; i < 12; i++) learn.submitQuiz(i, 5, 12)
    learn.submitQuiz(12, 5, 12)
    expect(learn.L.u).toBe(12)
    expect(learn.currentLesson(12)).toBe(12)
  })
  it('learnDoneCount / learnStarSum 统计', () => {
    learn.submitQuiz(1, 5, 12)
    learn.submitQuiz(2, 4, 12)
    expect(learn.learnDoneCount()).toBe(2)
    expect(learn.learnStarSum()).toBe(5)
  })
})

describe('progress 解锁链/历史/闪卡', () => {
  it('levelUnlocked：第 1 关常开；顺序门；第 9 关=毕业关需 1-8 全通', () => {
    expect(prog.levelUnlocked(1)).toBe(true)
    expect(prog.levelUnlocked(2)).toBe(false)
    prog.S.stars['1'] = 2
    expect(prog.levelUnlocked(2)).toBe(true)
    expect(prog.levelUnlocked(9)).toBe(false)
    for (let i = 1; i <= 8; i++) prog.S.stars[i] = 2
    expect(prog.levelUnlocked(9)).toBe(true)
  })
  it('addHist 封顶 30 条+记活动日', () => {
    for (let i = 0; i < 35; i++) prog.addHist({ d: 'x', lv: '1', sc: i, st: 1, wp: '' })
    expect(prog.S.hist).toHaveLength(30)
    expect(prog.S.hist[0].sc).toBe(34)           // unshift 最新在前
    expect(prog.S.days[prog.todayStr()]).toBe(1)
  })
  it('cardRec 建档与 dueToday', () => {
    expect(prog.dueToday(prog.cardRec('b'))).toBe(true)   // 无 due=到期
    prog.S.cards['b'] = { box: 2, due: '2000-01-01' }
    expect(prog.dueToday(prog.S.cards['b'])).toBe(true)   // 过期=到期
    prog.S.cards['c'] = { box: 1, due: '2999-12-31' }
    expect(prog.dueToday(prog.S.cards['c'])).toBe(false)  // 未到期
  })
  it('totalStars 练习关星求和（1-9）', () => {
    prog.S.stars['1'] = 3
    prog.S.stars['9'] = 1
    prog.S.stars['10'] = 9                        // 越界键不计
    expect(prog.totalStars()).toBe(4)
  })
  it('storage loadS 容错：损坏 JSON → 默认结构', async () => {
    localStorage.setItem('pinyin_v2', '!!!')
    vi.resetModules()
    prog = await import('../../src/stores/progress.svelte')
    expect(prog.S.hist).toEqual([])
    expect(prog.S.weights).toEqual({})
  })
})

describe('互动证据持久化（v4.7 P1-7：首页进度只计有效完成）', () => {
  it('recordEvidence 写入 L.ev[课号]（去重），hasEvidence 可查', () => {
    learn.recordEvidence(1, 'a')
    learn.recordEvidence(1, 'a')   // 去重
    learn.recordEvidence(1, 'o')
    expect(learn.hasEvidence(1, 'a')).toBe(true)
    expect(learn.hasEvidence(1, 'o')).toBe(true)
    expect(learn.hasEvidence(1, 'e')).toBe(false)
    expect(learn.L.ev['1']).toEqual(['a', 'o'])
  })
  it('ev 持久化：写后重载模块仍在（localStorage pinyin_learn）', async () => {
    learn.recordEvidence(2, 'b')
    vi.resetModules()
    learn = await import('../../src/stores/learn.svelte')
    expect(learn.hasEvidence(2, 'b')).toBe(true)
  })
  it('旧档无 ev 字段：读取归一化为空表（向后兼容）', async () => {
    localStorage.setItem('pinyin_learn', JSON.stringify({ u: 3, stars: {}, best: {}, step: {} }))
    vi.resetModules()
    learn = await import('../../src/stores/learn.svelte')
    expect(learn.L.ev).toBeDefined()
    expect(learn.hasEvidence(1, 'a')).toBe(false)
  })
})
