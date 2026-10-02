/* 动态探针单测（src/lib/probe.ts）：probe= / open= 两族验收自动化钩子。
   jsdom 无 App 壳 DOM——探针的容错路径（元素缺失→PROBE-FAIL banner 不崩）本身就是验收契约；
   __PJ 钩子集逐个调用（e2e 回归包的依赖面）。正常使用零开销=无参数不挂载。 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

type Probe = typeof import('../../../src/lib/probe')
let probe!: Probe
let ui!: typeof import('../../../src/stores/ui.svelte')

function setSearch(q: string) {
  window.history.replaceState(null, '', '/' + (q ? '?' + q : ''))
}

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  vi.useFakeTimers()
  setSearch('')
  delete (window as any).__PJ
  delete (window as any).__AUDIO_LOG
  ui = await import('../../../src/stores/ui.svelte')
  probe = await import('../../../src/lib/probe')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('initApp 零开销契约', () => {
  it('无参数：不挂 __PJ、不设任何定时器路径（view 不动）', () => {
    probe.initApp()
    vi.advanceTimersByTime(5000)
    expect((window as any).__PJ).toBeUndefined()
    expect(ui.ui.view).toBe('learn')
  })
  it('?open= 挂 __PJ（验收钩子面）', () => {
    setSearch('open=history')
    probe.initApp()
    vi.advanceTimersByTime(500)
    expect((window as any).__PJ).toBeTruthy()
    expect(ui.ui.view).toBe('history')
  })
})

describe('?probe= 动态探针（容错路径：无壳 DOM 时 banner 报 PROBE-FAIL 不崩）', () => {
  it('probe=1：进第1关失败 → PROBE-FAIL banner，流程不死循环', () => {
    setSearch('probe=1')
    probe.initApp()
    vi.advanceTimersByTime(500 + 400 + 800 + 100)
    expect(ui.ui.probeOn).toBe(true)
    expect(ui.ui.probeText).toContain('PROBE')
    vi.advanceTimersByTime(10000)   // 无残留定时器崩溃
    expect(ui.ui.probeText).toContain('PROBE-FAIL')
  })
  it('probe=full：40 步 tick 兜底 → PROBE-FAIL 步数超限', () => {
    setSearch('probe=full')
    probe.initApp()
    vi.advanceTimersByTime(500 + 300 + 600 + 41 * 300 + 500)
    expect(ui.ui.probeText).toContain('步数超限')
  })
  it('probe=det：startDet 真会话 + 首题作答链 + M: 权重断言 banner', () => {
    setSearch('probe=det')
    probe.initApp()
    vi.advanceTimersByTime(500 + 300 + 700 + 1200 + 100)
    expect(ui.ui.probeText).toContain('PROBE-DET-OK')
    expect(ui.ui.view).toBe('quiz')
  })
  it('probe=bolt：冻结计时两连答链 + 正确率 banner', () => {
    setSearch('probe=bolt')
    probe.initApp()
    vi.advanceTimersByTime(500 + 300 + 700 + 700 + 900 + 100)
    expect(ui.ui.probeText).toContain('PROBE-BOLT-OK')
  })
  it('probe=zi：startZi 两段式作答链 + Z:/W: 权重 banner', () => {
    setSearch('probe=zi')
    probe.initApp()
    vi.advanceTimersByTime(500 + 300 + 700 + 350 + 1200 + 100)
    expect(ui.ui.probeText).toContain('PROBE-ZI-OK')
  })
  it('probe=flash：renderFlash+flip 翻面链', () => {
    setSearch('probe=flash')
    probe.initApp()
    vi.advanceTimersByTime(500 + 400 + 600 + 100)
    expect(ui.ui.probeText).toContain('闪卡')
    expect(ui.ui.view).toBe('flash')
  })
})

describe('?open= 视觉验收直达（每视图分支）', () => {
  const plain: string[] = ['learn', 'practice', 'mine', 'radio', 'sound', 'settings', 'levels', 'pairs', 'history', 'album', 'ldrill', 'zihall', 'blenddrill', 'tonedrill', 'island']
  it('纯 show 类视图逐个直达', () => {
    const expected: Record<string, string> = {
      ldrill: 'listendrill', blenddrill: 'blendquiz', tonedrill: 'tonequiz', island: 'practice',
    }
    for (const v of plain) {
      setSearch('open=' + v)
      probe.initApp()
      vi.advanceTimersByTime(500)
      expect((window as any).__PJ).toBeTruthy()
      expect(ui.ui.view).toBe(expected[v] || v)
    }
  })
  it('open=free（旧参 practice）→ 自由练习配置页', () => {
    setSearch('open=free')
    probe.initApp()
    vi.advanceTimersByTime(500)
    expect(ui.ui.view).toBe('free')
  })
  it('open=lesson&learn=N：课号 clamp 1..12', () => {
    setSearch('open=lesson&learn=50')
    probe.initApp()
    vi.advanceTimersByTime(500)
    expect(ui.ui.view).toBe('lesson')
    expect(ui.ui.lessonN).toBe(12)
  })
  it('open=result：假结算渲染', () => {
    setSearch('open=result')
    probe.initApp()
    vi.advanceTimersByTime(500)
    expect(ui.ui.view).toBe('result')
  })
  it('open=quiz：构真实闯关会话（重试到 listen 首题）', () => {
    setSearch('open=quiz')
    probe.initApp()
    vi.advanceTimersByTime(500)
    expect(ui.ui.view).toBe('quiz')
  })
  it('open=detect / dfix：小侦探会话（dfix 首题=写反的 b 修复题）', () => {
    for (const v of ['detect', 'dfix']) {
      setSearch('open=' + v)
      probe.initApp()
      vi.advanceTimersByTime(500)
      expect(ui.ui.view).toBe('quiz')
    }
  })
  it('open=bolt / zi / ziword：闪电冻结 + 快拼会话', () => {
    setSearch('open=bolt')
    probe.initApp()
    vi.advanceTimersByTime(500)
    expect(ui.ui.view).toBe('bolt')
    setSearch('open=zi')
    probe.initApp()
    vi.advanceTimersByTime(500)
    expect(ui.ui.view).toBe('quiz')
    setSearch('open=ziword')
    probe.initApp()
    vi.advanceTimersByTime(500)
    expect(ui.ui.view).toBe('quiz')
  })
  it('open=game：count/play/result 三态（冻结计时）', () => {
    for (const st of ['count', 'play', 'result']) {
      setSearch(`open=game&g=fish&st=${st}`)
      probe.initApp()
      vi.advanceTimersByTime(500)
      expect(ui.ui.view).toBe('game')
    }
  })
  it('open=daily：每日挑战直达（自动读音链不崩）', () => {
    setSearch('open=daily')
    probe.initApp()
    vi.advanceTimersByTime(500)
    expect(ui.ui.view).toBe('daily')
  })
  it('open=celeb*：四庆祝模式 + evolve（overlay 不切视图；含自动散场定时器）', async () => {
    const growth = await import('../../../src/stores/growth.svelte')
    for (const v of ['celebgame', 'celebquiz', 'celebletter', 'celebgrad', 'evolve']) {
      setSearch('open=' + v)
      probe.initApp()
      vi.advanceTimersByTime(500)
      expect(growth.CE.mode, v).not.toBe('')   // 庆祝 overlay 在播（视图不动=overlay 语义）
      vi.advanceTimersByTime(6000)             // 庆祝自动散场（startCe→dismissCe）
      expect(growth.CE.mode).toBe('')
    }
  })
})

describe('__PJ 钩子集（回归包依赖面，逐个调用）', () => {
  it('show/startLevel/hall/ldrill 族', async () => {
    setSearch('open=history')
    probe.initApp()
    vi.advanceTimersByTime(500)
    const PJ = (window as any).__PJ
    PJ.show('levels')
    expect(ui.ui.view).toBe('levels')
    PJ.startLevel(1)
    expect(ui.ui.view).toBe('quiz')
    expect(PJ.Q().q).toBeTruthy()
    PJ.hall('drill')
    expect(ui.ui.hall).toBe('drill')
    expect(ui.ui.view).toBe('practice')
    PJ.hall('game')
    expect(ui.ui.hall).toBe('game')
    PJ.ldrill(); expect(ui.ui.view).toBe('listendrill')
    PJ.zihall(); expect(ui.ui.view).toBe('zihall')
    PJ.bdrill(); expect(ui.ui.view).toBe('blendquiz')
    PJ.tdrill(); expect(ui.ui.view).toBe('tonequiz')
  })
  it('游戏岛钩子：startGame/quitGame/gameRec/dailyRec/recordLetter/toPlay/fakeResult/endGame/startDaily', async () => {
    setSearch('open=history')
    probe.initApp()
    vi.advanceTimersByTime(500)
    const PJ = (window as any).__PJ
    PJ.startGame('duel', true)
    expect(PJ.GS().phase).toBe('count')
    PJ.toPlay(true)
    expect(PJ.GS().phase).toBe('play')
    PJ.recordLetter('b', false)
    expect(PJ.GD().letters['b'].err).toBe(1)
    PJ.gameRec('balloon')
    expect(PJ.gameRec('balloon').best).toBe(0)
    PJ.dailyRec()
    PJ.endGame()   // 非 play 相位守卫：phase=play 时才结算——此处已 play，会真结算
    expect(PJ.GS().phase).toBe('result')
    PJ.startGame('fish', true)
    PJ.fakeResult('fish', 100)
    expect(PJ.GS().phase).toBe('result')
    expect(PJ.gameRec('fish').best).toBe(100)
    PJ.startDaily()
    expect(ui.ui.view).toBe('daily')
    expect(PJ.DC().qs).toHaveLength(10)
    PJ.quitGame()
    expect(ui.ui.view).toBe('practice')
    expect(PJ.GS().phase).toBe('')
  })
  it('itemW/blendPool/tonePool/wpick（v4.3 加权复算钩子）', async () => {
    setSearch('open=history')
    probe.initApp()
    vi.advanceTimersByTime(500)
    const PJ = (window as any).__PJ
    expect(PJ.itemW('ba1')).toBe(1)
    const game = await import('../../../src/stores/game.svelte')
    game.GD.items['ba1'] = { ok: 0, err: 3, last: game.dayNum() }
    expect(PJ.itemW('ba1')).toBe(1 + 3 * 1.8 + 2)   // 3 笔全错：错误率 ≥40% 加成 +2
    expect(PJ.blendPool().length).toBeGreaterThan(0)
    expect(PJ.tonePool().length).toBeGreaterThan(0)
    expect(PJ.tonePool().every((f: string) => /^[a-z]+\d$/.test(f))).toBe(true)
    const picks = PJ.wpick(['ba1', 'ma2'], 42)
    expect(picks).toHaveLength(200)
    expect(picks.every((k: string) => ['ba1', 'ma2'].includes(k))).toBe(true)
  })
  it('FC/S/AUDIO 引用暴露', () => {
    setSearch('open=history')
    probe.initApp()
    vi.advanceTimersByTime(500)
    const PJ = (window as any).__PJ
    expect(PJ.FC).toBeTruthy()
    expect(PJ.S).toBeTruthy()
    expect(PJ.AUDIO).toBeTruthy()
    expect(typeof PJ.BT).toBe('function')
  })
})
