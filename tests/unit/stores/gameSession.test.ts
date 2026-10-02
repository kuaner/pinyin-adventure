/* 游戏岛会话单测（src/stores/game.svelte.ts 的会话面，账本面由 ledger.test.ts 覆盖）：
   连击倍率/得分/comboTone 阶梯、60 秒计时与结算（星星上限/最佳/成长产星/庆祝）、
   3-2-1 倒计时链、听音目标（askTarget/listenTarget）、每日挑战会话（两段式+结算+换日重置）、
   账本 normalize 损坏兜底（版本不符/字段脏数据）。 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

type Game = typeof import('../../../src/stores/game.svelte')
let game!: Game
let progress!: typeof import('../../../src/stores/progress.svelte')
let growth!: typeof import('../../../src/stores/growth.svelte')
let ui!: typeof import('../../../src/stores/ui.svelte')

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  vi.useFakeTimers()
  progress = await import('../../../src/stores/progress.svelte')
  growth = await import('../../../src/stores/growth.svelte')
  ui = await import('../../../src/stores/ui.svelte')
  game = await import('../../../src/stores/game.svelte')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('账本 normalize（损坏兜底，读侧）', () => {
  it('版本不符/损坏 JSON → 全新空账', async () => {
    localStorage.setItem('pinyin_game_v1', JSON.stringify({ v: 2, letters: { a: { ok: 5 } } }))
    vi.resetModules()
    const g2 = await import('../../../src/stores/game.svelte')
    expect(Object.keys(g2.GD.letters)).toHaveLength(0)
    localStorage.setItem('pinyin_game_v1', '{broken')
    vi.resetModules()
    const g3 = await import('../../../src/stores/game.svelte')
    expect(g3.GD.daily.done).toBe(false)
  })
  it('字段脏数据钳制：非数 ok/err 归 0、daily 字符串化', async () => {
    localStorage.setItem('pinyin_game_v1', JSON.stringify({
      v: 1,
      letters: { a: { ok: 'x', err: true, last: null }, bad: 'garbage' },
      games: { balloon: { best: '12', starsToday: null, lastPlayDay: 5 } },
      daily: { day: 7, best: '3', done: 1 },
    }))
    vi.resetModules()
    const g2 = await import('../../../src/stores/game.svelte')
    expect(g2.GD.letters['a']).toEqual({ ok: 0, err: 1, last: 0 })
    expect(g2.GD.letters['bad']).toBeUndefined()
    expect(g2.GD.games['balloon']).toEqual({ best: 12, starsToday: 0, lastPlayDay: '5' })
    expect(g2.GD.daily).toEqual({ day: '7', best: 3, done: true })
  })
})

describe('comboMult / starsFor（纯档位函数）', () => {
  it('连击倍率：x1 / 3 连 x2 / 6 连 x3', () => {
    expect(game.comboMult(0)).toBe(1)
    expect(game.comboMult(2)).toBe(1)
    expect(game.comboMult(3)).toBe(2)
    expect(game.comboMult(5)).toBe(2)
    expect(game.comboMult(6)).toBe(3)
    expect(game.comboMult(99)).toBe(3)
  })
  it('星星档：得分→星五档', () => {
    expect(game.starsFor(0)).toBe(0)
    expect(game.starsFor(69)).toBe(0)
    expect(game.starsFor(70)).toBe(1)
    expect(game.starsFor(140)).toBe(2)
    expect(game.starsFor(220)).toBe(3)
    expect(game.starsFor(300)).toBe(4)
    expect(game.starsFor(400)).toBe(5)
  })
})

describe('startGame 会话（3-2-1 倒计时→play）', () => {
  it('frozen=true：定格 count 相位（截图/自动化）', () => {
    game.startGame('balloon', true)
    expect(ui.ui.view).toBe('game')
    expect(game.GS.phase).toBe('count')
    expect(game.GS.countN).toBe(3)
    expect(game.GS.left).toBe(60)
    expect(game.GS.game).toBe('balloon')
  })
  it('frozen=false：3→2→1→play 倒计时链（epoch 作废旧链）', () => {
    game.startGame('balloon')
    vi.advanceTimersByTime(900)
    expect(game.GS.countN).toBe(2)
    vi.advanceTimersByTime(1800)
    expect(game.GS.countN).toBe(0)
    expect(game.GS.phase).toBe('play')
    // 60s 计时随 play 挂上
    vi.advanceTimersByTime(5000)
    expect(game.GS.left).toBe(55)
  })
  it('地鼠=口诀路径（GS.kj）；气球=呼读音', () => {
    game.startGame('mole', true)
    expect(game.GS.kj).toBe(true)
    game.startGame('balloon', true)
    expect(game.GS.kj).toBe(false)
  })
  it('倒计时中途 quitGame：epoch 作废、不再自动进 play', () => {
    game.startGame('balloon')
    game.quitGame()
    expect(game.GS.phase).toBe('')
    vi.advanceTimersByTime(5000)
    expect(game.GS.phase).toBe('')
  })
})

describe('gameHit 计分链', () => {
  beforeEach(() => { game.startGame('balloon'); game.toPlay() })
  it('连对计分走倍率：10+10+20（combo 3 起 x2）', () => {
    game.gameHit('a', true); game.gameHit('a', true); game.gameHit('a', true)
    expect(game.GS.score).toBe(40)
    expect(game.GS.combo).toBe(3)
    expect(game.GS.maxCombo).toBe(3)
  })
  it('答错清连击+嘟声；tries 只计答对（作答计数语义）', () => {
    game.gameHit('a', true)
    game.gameHit('a', false)
    expect(game.GS.combo).toBe(0)
    expect(game.GS.tries).toBe(1)   // tries=答对数（ok 分支推进）
    expect(game.GD.letters['a'].err).toBe(1)
  })
  it('非 play 相位忽略（结算层误触不入账）', () => {
    game.endGame()
    const s = game.GS.score
    game.gameHit('a', true)
    expect(game.GS.score).toBe(s)
  })
  it('ledger=item 记条目账本（v4.3 拼读/声调）', () => {
    game.gameHit('ba1', true, 'item')
    expect(game.GD.items['ba1'].ok).toBe(1)
    expect(game.GD.letters['ba1']).toBeUndefined()
  })
})

describe('endGame 结算', () => {
  it('产星入成长+庆祝；best/lastPlayDay 入账；record 旗', () => {
    game.startGame('balloon', true)
    game.toPlay()
    for (let i = 0; i < 12; i++) game.gameHit('a', true)   // 10+10+20×3+30×7 = 290
    expect(game.GS.score).toBe(290)
    game.endGame()
    expect(game.GS.phase).toBe('result')
    expect(game.GS.stars).toBe(3)   // 290 ∈ [220,300) → 3 星
    expect(growth.G.stars).toBe(3)
    expect(game.gameRec('balloon').best).toBe(290)
    expect(game.gameRec('balloon').starsToday).toBe(3)
    expect(game.GS.record).toBe(true)
  })
  it('每日产星上限 10：连玩 4 局 3 星局，第 4 局只补差额（3+3+3+1）', () => {
    for (let round = 0; round < 4; round++) {
      game.startGame('balloon', true)
      game.toPlay()
      for (let i = 0; i < 12; i++) game.gameHit('a', true)
      game.endGame()
    }
    expect(game.gameRec('balloon').starsToday).toBe(10)   // 封顶
    expect(growth.G.stars).toBe(10)
  })
  it('拔河胜利奖励 +100（win=1）', () => {
    game.startGame('duel', true)
    game.toPlay()
    game.gameHit('b', true)
    game.endGame(1)
    expect(game.GS.score).toBe(110)
    expect(game.GS.win).toBe(1)
  })
  it('跨天滚存：昨日 starsToday 结算时归零重计', () => {
    const rec = game.gameRec('fish')
    rec.starsToday = 10
    rec.lastPlayDay = '2026-09-30'
    game.startGame('fish', true)
    game.toPlay()
    for (let i = 0; i < 12; i++) game.gameHit('o', true)
    game.endGame()
    expect(game.gameRec('fish').starsToday).toBe(3)   // 换日后重新起算（290 分=3 星）
  })
})

describe('askTarget / listenTarget（声音先行制）', () => {
  it('askTarget：目标登记+已听旗+播目标音（地鼠 kj / 其他呼读 / afile 直通）', () => {
    ;(window as any).__AUDIO_LOG = []
    game.startGame('mole', true)
    game.askTarget('b')
    expect(game.GS.target).toBe('b')
    expect(game.GS.listened).toBe(true)
    game.listenTarget()
    expect((window as any).__AUDIO_LOG.some((e: any) => e.name === 'lessons/kj_b')).toBe(true)
    game.startGame('balloon', true)
    game.askTarget('o')
    game.listenTarget()
    expect((window as any).__AUDIO_LOG.some((e: any) => e.name === 'o')).toBe(true)
    game.askTarget('ba1', 'ba1')
    game.listenTarget()
    expect((window as any).__AUDIO_LOG.some((e: any) => e.name === 'ba1')).toBe(true)
  })
  it('listenTarget 无目标时 no-op', () => {
    game.startGame('fish', true)
    game.GS.target = ''
    expect(() => game.listenTarget()).not.toThrow()
  })
})

describe('gameTitle / fakeResult', () => {
  it('gameTitle：未知游戏空串；已知游戏返回摊位名', () => {
    game.startGame('balloon', true)
    expect(game.gameTitle().length).toBeGreaterThan(0)
    game.GS.game = 'nope'
    expect(game.gameTitle()).toBe('')
  })
  it('fakeResult：直接落结算态、best 同步抬升（视觉验收路径）', () => {
    game.fakeResult('egg', 180)
    expect(game.GS.phase).toBe('result')
    expect(game.GS.score).toBe(180)
    expect(game.gameBest('egg')).toBe(180)
    expect(game.dailyView().done).toBe(false)
  })
})

describe('每日挑战会话（DC）', () => {
  it('startDaily：10 题就位、出题自动读音（字母题播、zi 题不播=播了报答案）', () => {
    ;(window as any).__AUDIO_LOG = []
    game.startDaily()
    expect(ui.ui.view).toBe('daily')
    expect(game.DC.qs).toHaveLength(10)
    const q = game.DC.qs[0]
    if (q.type !== 'zi') {
      expect((window as any).__AUDIO_LOG.length).toBeGreaterThan(0)
    }
  })
  it('v4.5 适用矩阵：字母选项题一点即答；zi 题两段式保留（首点试听高亮、再点作答、切换试听）', () => {
    game.startDaily()
    const q0 = game.DC.qs[0]
    if (q0.type !== 'zi') {
      /* 字母选项（blisten/bkj）→ 一点即答 */
      game.dailyArm(0)
      expect(game.DC.reveal).toBeTruthy()
    } else {
      game.dailyArm(0)
      expect(game.DC.armed).toBe(0)
      expect(game.DC.reveal).toBeNull()
      game.dailyArm(1)
      expect(game.DC.armed).toBe(1)
      game.dailyArm(0)
      expect(game.DC.armed).toBe(0)
      game.dailyAnswer(0)
      expect(game.DC.reveal).toBeTruthy()
      expect(game.DC.armed).toBe(-1)
    }
  })
  it('答题计分连击走倍率；答错清连击+记账（字母题走游戏账本；reveal 态需 dailyNext 交还）', () => {
    game.startDaily()
    const q0 = game.DC.qs[0]
    game.dailyAnswer(q0.ans)
    expect(game.DC.ok).toBe(1)
    expect(game.DC.score).toBe(10)
    if (q0.type !== 'zi') expect(game.GD.letters[q0.A].ok).toBe(1)
    game.dailyNext()   // 清 reveal → 下一题
    const q1 = game.DC.qs[1]
    game.dailyAnswer((q1.ans + 1) % q1.opts.length)
    expect(game.DC.combo).toBe(0)
  })
  it('reveal 态忽略再答；dailyNext 推进到 endDaily（done+stars 档+换日重置）', () => {
    game.startDaily()
    game.dailyAnswer(game.DC.qs[0].ans)
    game.dailyAnswer(0)   // reveal 中忽略
    expect(game.DC.ok).toBe(1)
    // 推完全部 10 题
    game.dailyNext()
    for (let i = 1; i < 10; i++) {
      game.dailyAnswer(game.DC.qs[i].ans)
      game.dailyNext()
    }
    expect(game.DC.done).toBe(true)
    expect(game.DC.stars).toBe(5)   // 10/10 全对=5 星
    expect(game.dailyView().done).toBe(true)
    expect(game.dailyView().best).toBe(game.DC.score)
  })
  it('quitDaily：作废反馈定时器回练习 tab', () => {
    game.startDaily()
    game.dailyAnswer(game.DC.qs[0].ans)
    game.quitDaily()
    expect(ui.ui.view).toBe('practice')
    expect(game.DC.done).toBe(true)
    vi.advanceTimersByTime(5000)   // 旧定时器不推进
    expect(game.DC.i).toBe(0)
  })
})

describe('Bug#39：$state 首建分支 raw 视图——账本首笔写入必须落库（失败测试先行，T2）', () => {
  /* Svelte5 $state 的 `GD.x[k] = r = {...}` 会把字面量包装成新代理存入图，
     局部 r 仍指孤儿原对象——首笔 ok/err/best 写在孤儿上=静默丢失（第一次读 GD 才是代理视图）。
     修复=写后二次读取存内记录再返回/续写（与 memory svelte5-state-creation-branch-raw-view 同源）。 */
  it('recordLetter 首笔：新字母的第一笔 ok/err 不丢', () => {
    game.recordLetter('b', false)
    expect(game.GD.letters['b'].err).toBe(1)   // 修复前=0（写在孤儿上）
    game.recordLetter('b', true)
    expect(game.GD.letters['b']).toEqual({ ok: 1, err: 1, last: game.dayNum() })
  })
  it('recordItem 首笔同修（v4.3 条目账本）', () => {
    game.recordItem('ba1', true)
    expect(game.GD.items['ba1'].ok).toBe(1)    // 修复前=0
  })
  it('gameRec 首建返回存内记录：fakeResult 的 best 抬升生效', () => {
    game.fakeResult('egg', 180)
    expect(game.gameBest('egg')).toBe(180)     // 修复前=0（孤儿写入）
  })
})

describe('Bug#40：复合单元（üe/er/ong/yi/wu/yu）不在 LETTERS——过 L10 后每日挑战/对决必崩（失败测试先行）', () => {
  /* learnedLetters 含 L10 的 üe/er、L11 的 ong、L12 的 yi/wu/yu——letterQ/gameDistractor/duelQ
     对它们裸读 LETTERS[k].cat/.kj → TypeError。孩子过完第 10 课后每日挑战 100% 崩、镜像对决 ~10% 崩。
     修复=防御读 + 无口诀字母不出口诀题（零错误信息不受影响）。 */
  it('gameDistractor 对非 LETTERS 单元返回池内搭档（不崩）', async () => {
    const eng = await import('../../../src/lib/gameEngine')
    const l = await import('../../../src/stores/learn.svelte')
    for (let i = 1; i <= 12; i++) l.L.stars[i] = 3
    const pool = eng.learnedLetters()
    for (const u of ['üe', 'er', 'yi', 'wu', 'yu']) {
      expect(pool, '单元 ' + u + ' 应已学').toContain(u)
      const d = eng.gameDistractor(u, pool)
      expect(d).not.toBe(u)
      expect(pool).toContain(d)
    }
  })
  it('buildDailyQs 30 连跑零崩；bkj 题的 stmt 恒非空（无口诀字母不出口诀题）', async () => {
    const eng = await import('../../../src/lib/gameEngine')
    const l = await import('../../../src/stores/learn.svelte')
    for (let i = 1; i <= 12; i++) l.L.stars[i] = 3
    for (let i = 0; i < 30; i++) {
      const qs = eng.buildDailyQs()
      for (const q of qs) if (q.type === 'bkj') expect(q.stmt.length, q.A).toBeGreaterThan(0)
    }
  })
  it('duelQ 200 连跑零崩；kj=true 的题 stmt 恒非空', async () => {
    const eng = await import('../../../src/lib/gameEngine')
    const l = await import('../../../src/stores/learn.svelte')
    for (let i = 1; i <= 12; i++) l.L.stars[i] = 3
    const pool = eng.learnedLetters()
    for (let i = 0; i < 200; i++) {
      const q = eng.duelQ(pool)
      if (q.kj) expect(q.stmt.length, q.A).toBeGreaterThan(0)
    }
  })
})

describe('GAME_DEFS 摊位注册表', () => {
  it('6 摊位定格（气球/口诀地鼠/镜像/钓鱼/蛋/音乐会）', () => {
    expect(Object.keys(game.GAME_DEFS).sort()).toEqual(['balloon', 'duel', 'egg', 'fish', 'mole', 'tone'])
  })
})
