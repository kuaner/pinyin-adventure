/* 升级体系（src/stores/growth.svelte.ts）单测：
   小鸡五阶段阈值（0/50/150/300/500）/ 签到连击（S.days 派生）/ 卡片图鉴（课级解锁派生）
   / 10 枚徽章条件 / 庆祝状态机（epoch 作废过期定时器）/ 进化记账 / 学习过关+5/+2 / 闪电事件。 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import lessonsData from '../../src/data/lessons.json'

type Growth = typeof import('../../src/stores/growth.svelte')
type ProgMod = typeof import('../../src/stores/progress.svelte')
type LearnMod = typeof import('../../src/stores/learn.svelte')
let g: Growth
let prog: ProgMod
let learn: LearnMod

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  g = await import('../../src/stores/growth.svelte')
  prog = await import('../../src/stores/progress.svelte')
  learn = await import('../../src/stores/learn.svelte')
})
afterEach(() => {
  vi.useRealTimers()
})

function passLessons(n: number) {
  for (let i = 1; i <= n; i++) learn.L.stars[i] = 3
}

/* 往回数 n 天的日期串（todayStr 同格式） */
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const m = d.getMonth() + 1, dd = d.getDate()
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' + dd : '' + dd)
}

describe('stageOf 五阶段阈值（0/50/150/300/500）', () => {
  it('边界全表：-1/0→0 档，49→0，50→1，149→1，150→2，299→2，300→3，499→3，500→4，9999→4', () => {
    const cases: [number, number][] = [
      [0, 0], [49, 0], [50, 1], [149, 1], [150, 2], [299, 2], [300, 3], [499, 3], [500, 4], [9999, 4],
    ]
    for (const [stars, stage] of cases) expect(g.stageOf(stars), 'stars=' + stars).toBe(stage)
  })
  it('阶段名键 stageName0..4', () => {
    expect(g.stageNameKey(3)).toBe('stageName3')
  })
})

describe('卡片图鉴（学会即解锁=课级进度派生）', () => {
  it('CARD_KEYS=12 课字母全集（63 张）', () => {
    const total = (lessonsData as any).lessons.flatMap((l: any) => l.letters).length
    expect(g.CARD_KEYS).toHaveLength(total)
    expect(g.CARD_KEYS.length).toBeGreaterThan(50)
  })
  it('未过课 → 卡未解锁；过该课 → 该课字母卡全解锁', () => {
    expect(g.cardUnlocked('a')).toBe(false)
    learn.L.stars[1] = 3
    expect(g.cardUnlocked('a')).toBe(true)
    expect(g.cardUnlocked('o')).toBe(true)
    expect(g.cardUnlocked('b')).toBe(false)     // 课 3 未过
  })
  it('unlockedCardCount 随过课数累加', () => {
    expect(g.unlockedCardCount()).toBe(0)
    learn.L.stars[1] = 3
    learn.L.stars[2] = 2
    expect(g.unlockedCardCount()).toBe(6)       // aoe + iuü
  })
})

describe('签到连击 streakOf（今天没学不打断）', () => {
  it('连续 3 天（含今天）→ 3', () => {
    for (const d of [0, 1, 2].map(daysAgo)) prog.S.days[d] = 1
    expect(g.streakOf()).toBe(3)
  })
  it('今天没学但昨天学了 → 连击延续（不打断）', () => {
    for (const d of [1, 2, 3].map(daysAgo)) prog.S.days[d] = 1
    expect(g.streakOf()).toBe(3)
  })
  it('昨天断了（2 天前最后学）→ 归零', () => {
    for (const d of [2, 3].map(daysAgo)) prog.S.days[d] = 1
    expect(g.streakOf()).toBe(0)
  })
  it('空账 → 0', () => {
    expect(g.streakOf()).toBe(0)
  })
  it('activeDayCount=活动日总数', () => {
    for (const d of [0, 1, 5].map(daysAgo)) prog.S.days[d] = 1
    expect(g.activeDayCount()).toBe(3)
  })
})

describe('持久化与首装迁移', () => {
  it('损坏数据 → 回默认（stars=0 badges=[] seenStage=-1）', async () => {
    localStorage.setItem('pinyin_growth_v1', '{bad')
    vi.resetModules()
    g = await import('../../src/stores/growth.svelte')
    expect(g.G.stars).toBe(0)
    expect(g.G.badges).toEqual([])
    expect(g.G.seenStage).toBe(-1)
  })
  it('首装建账迁移既有星星（练习关星+学习岛课星）', async () => {
    localStorage.setItem('pinyin_v2', JSON.stringify({ stars: { '1': 3, '2': 2 }, days: {} }))
    localStorage.setItem('pinyin_learn', JSON.stringify({ u: 3, stars: { '1': 3, '2': 2, '3': 3 }, best: {}, step: {} }))
    vi.resetModules()
    g = await import('../../src/stores/growth.svelte')
    expect(g.G.stars).toBe(13)                  // 3+2 练习 + 3+2+3 学习
  })
  it('saveG → reload 往返一致（badges 非字符串项被滤掉）', async () => {
    g.G.stars = 66
    g.G.badges = ['first', 42 as unknown as string]
    g.saveG()
    vi.resetModules()
    g = await import('../../src/stores/growth.svelte')
    expect(g.G.stars).toBe(66)
    expect(g.G.badges).toEqual(['first'])       // normalize 滤非字符串
  })
})

describe('成就徽章', () => {
  it('徽章定义 ≥10 枚且 id 唯一', () => {
    expect(g.BADGE_DEFS.length).toBeGreaterThanOrEqual(10)
    expect(new Set(g.BADGE_DEFS.map((b) => b.id)).size).toBe(g.BADGE_DEFS.length)
  })
  it('checkBadges：首关星 → first 徽章入账并持久化', () => {
    prog.S.stars['1'] = 2
    g.checkBadges()
    expect(g.G.badges).toContain('first')
    expect(JSON.parse(localStorage.getItem('pinyin_growth_v1')!).badges).toContain('first')
  })
  it('streak7：连续 7 天 → streak7 徽章', () => {
    for (let i = 0; i < 7; i++) prog.S.days[daysAgo(i)] = 1
    g.checkBadges()
    expect(g.G.badges).toContain('streak7')
  })
  it('allcards/grad：12 课全过 → 全收集+毕业徽章', () => {
    passLessons(12)
    g.checkBadges()
    expect(g.G.badges).toContain('allcards')
    expect(g.G.badges).toContain('grad')
  })
  it('coll30：过 9 课 ≥30 张卡（8 课=29 张不够）', () => {
    passLessons(9)
    g.checkBadges()
    expect(g.unlockedCardCount()).toBeGreaterThanOrEqual(30)
    expect(g.G.badges).toContain('coll30')
  })
  it('det/tone/days30 条件线', () => {
    for (let i = 0; i < 30; i++) prog.S.days[daysAgo(i)] = 1
    for (let i = 0; i < 30; i++) g.addDetCorrect()
    for (let i = 0; i < 30; i++) g.addToneCorrect()
    g.checkBadges()
    expect(g.G.badges).toContain('det')
    expect(g.G.badges).toContain('tone')
    expect(g.G.badges).toContain('days30')
  })
  it('徽章不重复授予', () => {
    prog.S.stars['1'] = 2
    g.checkBadges()
    g.checkBadges()
    expect(g.G.badges.filter((x) => x === 'first')).toHaveLength(1)
  })
})

describe('庆祝状态机（CE）', () => {
  it('celebrateQuiz 置模式与星星数，2.6s 自动散场', async () => {
    vi.useFakeTimers()
    g.celebrateQuiz(5)
    expect(g.CE.mode).toBe('quiz')
    expect(g.CE.gain).toBe(5)
    vi.advanceTimersByTime(2600)
    expect(g.CE.mode).toBe('')
  })
  it('epoch 作废：新庆祝启动后旧定时器不再散场', async () => {
    vi.useFakeTimers()
    g.celebrateQuiz(5)
    vi.advanceTimersByTime(1000)
    g.celebrateGame(2)                      // epoch++，旧 2.6s 定时器作废
    vi.advanceTimersByTime(1600)            // 到达旧截止点
    expect(g.CE.mode).toBe('game')
    vi.advanceTimersByTime(600)             // 新截止（2.2s）
    expect(g.CE.mode).toBe('')
  })
  it('dismissCe 立即散场可跳过', () => {
    g.celebrateLetter('b')
    expect(g.CE.mode).toBe('letter')
    g.dismissCe()
    expect(g.CE.mode).toBe('')
  })
  it('celebrateGrad/celebrateEvolve 各置其模式', () => {
    g.celebrateGrad()
    expect(g.CE.mode).toBe('grad')
    g.dismissCe()
    g.celebrateEvolve(2)
    expect(g.CE.mode).toBe('evolve')
    expect(g.CE.stage).toBe(2)
  })
})

describe('进化记账', () => {
  it('evolvePending：未看档 > 已看档 → 待播档；播后 -1', () => {
    g.G.stars = 160                          // stage 2
    g.G.seenStage = 0
    expect(g.evolvePending()).toBe(2)
    g.commitEvolve(2)
    expect(g.evolvePending()).toBe(-1)
  })
  it('commitEvolve 只前进不回退', () => {
    g.commitEvolve(3)
    g.commitEvolve(1)
    expect(g.G.seenStage).toBe(3)
  })
})

describe('触发点接线', () => {
  it('onLearnQuizPass 首过 +5 星；复玩 +2 星（防刷）', () => {
    expect(g.onLearnQuizPass(false, false)).toBe(5)
    expect(g.G.stars).toBe(5)
    expect(g.onLearnQuizPass(true, false)).toBe(2)
    expect(g.G.stars).toBe(7)
  })
  it('最后一课首过 → 毕业典礼+grad 徽章（不重放：复玩 wasAll）', () => {
    passLessons(12)                          // 产品流：LessonPage 先 submitQuiz 记第 12 课过，再调接线
    g.onLearnQuizPass(false, false)          // wasAll=false=过这课之前没全通
    expect(g.CE.mode).toBe('grad')
    expect(g.G.badges).toContain('grad')
    g.dismissCe()
    g.onLearnQuizPass(true, true)            // 复玩毕业课：不放毕业典礼，只放普通 quiz 庆祝（复玩+2）
    expect(g.CE.mode).toBe('quiz')
    expect(g.CE.mode).not.toBe('grad')
  })
  it('首过也给 first 徽章', () => {
    g.onLearnQuizPass(false, false)
    expect(g.G.badges).toContain('first')
  })
  it('addToneCorrect/addDetCorrect 累计并持久化', () => {
    g.addToneCorrect()
    g.addDetCorrect()
    g.addDetCorrect()
    expect(g.G.tone).toBe(1)
    expect(g.G.det).toBe(2)
    expect(JSON.parse(localStorage.getItem('pinyin_growth_v1')!).det).toBe(2)
  })
  it('onBoltEnd：≥10 题记签到；≥20 全对=满分旗+徽章；≥40 速读徽章', () => {
    vi.useFakeTimers()
    g.onBoltEnd(20, 20)
    expect(g.G.boltPerf).toBe(true)
    expect(g.G.badges).toContain('boltperfect')
    expect(prog.S.days[prog.todayStr()]).toBe(1)
    g.onBoltEnd(40, 38)                      // 速度徽章（不要求全对）
    expect(g.G.badges).toContain('speed')
  })
  it('onBoltEnd：9 题不记签到不满分旗', () => {
    g.onBoltEnd(9, 9)
    expect(g.G.boltPerf).toBe(false)
    expect(g.G.badges).not.toContain('boltperfect')
  })
  it('allLessonsPassed：未全过 false，全过 true', () => {
    expect(g.allLessonsPassed()).toBe(false)
    passLessons(12)
    expect(g.allLessonsPassed()).toBe(true)
  })
})
