/* 声音两层架构单测（src/lib/audio.ts）：
   mp3 播放器（缓存/hyp 映射/BUGS#23 .mp3 后缀/Bug#15 静默矩阵/mimo 回落一次/R3 单通道锁）
   + WebAudio 反馈音（mute 总开关/合成路径）+ 预载（幂等/Cache API 直写/降级 fetch）。
   硬约束 1：全仓禁 speechSynthesis——本模块是纯 mp3 层，jsdom 用真降级路径（无 AudioContext）。 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

type AudioMod = typeof import('../../../src/lib/audio')
let A!: AudioMod
let progress: typeof import('../../../src/stores/progress.svelte')

/* 缓存 API 假体（preloadOne 直写 SW 运行时缓存路径） */
function fakeCaches() {
  const store = new Map<string, Response>()
  const fake = {
    open: async () => ({
      match: async (u: string) => store.get(u),
      put: async (u: string, r: Response) => { store.set(u, r) },
    }),
  }
  ;(globalThis as any).caches = fake
  return store
}

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  delete (globalThis as any).caches
  delete (window as any).__AUDIO_LOG
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 200 })))
  progress = await import('../../../src/stores/progress.svelte')
  A = await import('../../../src/lib/audio')
  void realFetch
})

describe('letterAudio / kjAudio（ASCII 安全名映射，硬约束 2）', () => {
  it('ü 系映射 v/vn/ve；普通字母原样', () => {
    expect(A.letterAudio('ü')).toBe('v')
    expect(A.letterAudio('ün')).toBe('vn')
    expect(A.letterAudio('üe')).toBe('ve')
    expect(A.letterAudio('b')).toBe('b')
    expect(A.letterAudio('zh')).toBe('zh')
  })
  it('kjAudio：lessons/kj_ 前缀 + 安全名（63 条口诀全覆盖的读取约定）', () => {
    expect(A.kjAudio('b')).toBe('lessons/kj_b')
    expect(A.kjAudio('ü')).toBe('lessons/kj_v')
  })
})

describe('audioURL（hyp 映射 + BUGS#23 .mp3 后缀剥离）', () => {
  it('hyp 命中 → audio/hyp/{文件名}.mp3', () => {
    expect(A.audioURL('a')).toBe('/audio/hyp/a.mp3')
  })
  it('manifest 风格名自带 .mp3 → 无条件剥一次（不再 .mp3.mp3）', () => {
    expect(A.audioURL('ui/tab-learn.mp3')).toBe('/audio/ui/tab-learn.mp3')
  })
  it('无 hyp 条目 → audio/{name}.mp3（mimo 同名回落约定）', () => {
    expect(A.audioURL('nonexist')).toBe('/audio/nonexist.mp3')
  })
})

describe('hasRiddle / riddleAudio（v4.5 Bug#39 口诀地鼠谜面制）', () => {
  it('riddleAudio：riddle/ 前缀 + ASCII 安全名（ü→v）', () => {
    expect(A.riddleAudio('b')).toBe('riddle/b')
    expect(A.riddleAudio('zh')).toBe('riddle/zh')
    expect(A.riddleAudio('ü')).toBe('riddle/v')
  })
  it('hasRiddle：标准口诀（谜面 X X X）=true——字母词元去重 ≤1 种', () => {
    expect(A.hasRiddle('b')).toBe(true)      /* 右下半圆 b b b */
    expect(A.hasRiddle('ei')).toBe(true)     /* 用力砍树 ei ei ei */
    expect(A.hasRiddle('m')).toBe(true)      /* 两个门洞 m m m */
  })
  it('hasRiddle：组合式口诀（字母词元 >1 种）=false——谜面即答案构成，出题侧跳过', () => {
    expect(A.hasRiddle('ai')).toBe(false)    /* a 和 i 挨在一起 ai */
    expect(A.hasRiddle('un')).toBe(false)    /* u 加 n 组成 un */
    expect(A.hasRiddle('ün')).toBe(false)    /* ü 加 n 组成 ün */
  })
})

describe('pyAudio（v4.2c 两段式试听的音节键换算）', () => {
  it('声母+带调韵母 → 声母+基母+调号（bà→ba4）', () => {
    expect(A.pyAudio('bà')).toBe('ba4')
    expect(A.pyAudio('mā')).toBe('ma1')
    expect(A.pyAudio('mǎ')).toBe('ma3')
  })
  it('zh/ch/sh 双字母声母优先（zhuāng→zhuang1）', () => {
    expect(A.pyAudio('zhuāng')).toBe('zhuang1')
    expect(A.pyAudio('sh' + String.fromCharCode(0xec))).toBe('shi4')   // shì（运行时构符，避开字面量 NFD）
  })
  it('ü → v（ASCII 安全名，lǜ→lv4 / nǚ→nv3）', () => {
    expect(A.pyAudio('lǜ')).toBe('lv4')
    expect(A.pyAudio('nǚ')).toBe('nv3')
  })
  it('无调号 → 调号空串（ma→ma）', () => {
    expect(A.pyAudio('ma')).toBe('ma')
  })
})

describe('playAudio（mp3 播放器主路径）', () => {
  it('正常播放：元素入 AUDIO_CACHE、挂 __AUDIO_LOG、返回元素、isPlaying=true', async () => {
    ;(window as any).__AUDIO_LOG = []
    const el = A.playAudio('a')
    expect(el).toBeTruthy()
    expect(A.AUDIO_CACHE['a']).toBe(el)
    expect(A.isPlaying()).toBe(true)
    expect((window as any).__AUDIO_LOG).toEqual([{ name: 'a', t: expect.any(Number) }])
  })
  it('静音总开关：返回 null + onerror 回调（R4）', async () => {
    progress.S.mute = true
    const onerror = vi.fn()
    expect(A.playAudio('a', { onerror })).toBeNull()
    expect(onerror).toHaveBeenCalledTimes(1)
  })
  it('缓存命中复用同一元素（二次播放不新建）', () => {
    const e1 = A.playAudio('a')
    const e2 = A.playAudio('a')
    expect(e2).toBe(e1)
  })
  it('Bug#15：AbortError（被 stopAll 停）静默——不 toast 不回落', async () => {
    /* hint 是纯文案串非 spy——静默断言走 toast 层的可观察态（toastOn，真失败用例同款面） */
    const ui = await import('../../../src/stores/ui.svelte')
    const onerror = vi.fn()
    const err = new DOMException('aborted', 'AbortError')
    const fake: any = { play: () => Promise.reject(err), dataset: {} }
    A.AUDIO_CACHE['a'] = fake
    A.playAudio('a', { hint: '语音没准备好', onerror })
    await new Promise((r) => setTimeout(r, 0))   // 宏任务： rejection catch 链已全部冲刷
    expect(ui.ui.toastOn).toBe(false)
    expect(onerror).not.toHaveBeenCalled()
    expect(fake.dataset.mimoFb).toBeUndefined()
  })
  it('Bug#15：NotAllowedError（iOS 手势时序）同样静默', async () => {
    const ui = await import('../../../src/stores/ui.svelte')
    const onerror = vi.fn()
    const err = new DOMException('denied', 'NotAllowedError')
    A.AUDIO_CACHE['b'] = { play: () => Promise.reject(err), dataset: {} } as any
    A.playAudio('b', { hint: '语音没准备好', onerror })
    await new Promise((r) => setTimeout(r, 0))
    expect(ui.ui.toastOn).toBe(false)
    expect(onerror).not.toHaveBeenCalled()
    expect(A.AUDIO_CACHE['b'].dataset.mimoFb).toBeUndefined()
  })
  it('真加载失败 + hyp 条目 → mimo 同名回落一次（dataset.mimoFb 防环）；回落也败才提示', async () => {
    const onerror = vi.fn()
    const proto = window.HTMLMediaElement.prototype
    const origPlay = proto.play
    proto.play = () => Promise.reject(new DOMException('net', 'OperaError')) as any   // playMimo 的新元素也失败
    const err = new DOMException('decode', 'NotSupportedError')
    const main: any = { play: () => Promise.reject(err), dataset: {} }
    A.AUDIO_CACHE['a'] = main
    try {
      A.playAudio('a', { hint: '语音没准备好', onerror })
      await vi.waitFor(() => { expect(onerror).toHaveBeenCalledTimes(1) })
      expect(main.dataset.mimoFb).toBe('1')   // 只回落一次的防环旗
    } finally {
      proto.play = origPlay
    }
  })
  it('真加载失败 + 无 hyp → 直接 toast + onerror', async () => {
    const ui = await import('../../../src/stores/ui.svelte')
    const onerror = vi.fn()
    const err = new DOMException('decode', 'NotSupportedError')
    A.AUDIO_CACHE['nonexist'] = { play: () => Promise.reject(err), dataset: {} } as any
    A.playAudio('nonexist', { hint: '语音没准备好', onerror })
    await vi.waitFor(() => { expect(onerror).toHaveBeenCalledTimes(1) })
    expect(ui.ui.toastOn).toBe(true)
  })
  it('stopAll：单通道锁清 CUR（R3 新声音停旧声）', () => {
    A.playAudio('a')
    A.stopAll()
    expect(A.isPlaying()).toBe(false)
    A.stopAll()   // 幂等
    expect(A.isPlaying()).toBe(false)
  })
  it('onended：播完回调清 CUR；非当前路的 onended 不误清', async () => {
    const onend = vi.fn()
    const onendB = vi.fn()
    const a = A.playAudio('a', { onend })        // CUR=a
    const b = A.playAudio('b', { onend: onendB }) // R3 stopAll → CUR=b
    expect(A.isPlaying()).toBe(true)
    ;(a as any).onended!()                        // a 的结束回调：CUR 是 b → 不误清
    expect(onend).toHaveBeenCalledTimes(1)
    expect(onendB).not.toHaveBeenCalled()
    expect(A.isPlaying()).toBe(true)
    ;(b as any).onended!()                        // 当前路结束 → 清
    expect(onendB).toHaveBeenCalledTimes(1)
    expect(A.isPlaying()).toBe(false)
  })
  it('new Audio 构造抛错（隐私模式极端面）→ hint+onerror 兜底返回 null', () => {
    const onerror = vi.fn()
    const Orig = window.Audio
    ;(window as any).Audio = class { constructor() { throw new Error('blocked') } }
    try {
      expect(A.playAudio('nevercached', { hint: 'x', onerror })).toBeNull()
      expect(onerror).toHaveBeenCalledTimes(1)
    } finally {
      ;(window as any).Audio = Orig
    }
  })
  it('say：字母呼读音（缺字母静默；ü 走 v）', () => {
    A.say('b')
    expect(A.AUDIO_CACHE['b']).toBeTruthy()
    A.say('ü')
    expect(A.AUDIO_CACHE['v']).toBeTruthy()
    A.say('不存在')   // 非字母 → no-op
  })
})

describe('WebAudio 反馈音（tone 家族）', () => {
  it('jsdom 无 AudioContext → 全家族静默降级不抛（产品同款 try/catch 路径）', () => {
    expect(() => {
      A.tone(784, 0, 0.12)
      A.sndOk(); A.sndNo(); A.sndStar(); A.sndFanfare(); A.sndMini(); A.sndEvolve(); A.sndGrad()
    }).not.toThrow()
  })
  it('mute=true 时 tone 直接返回（R4 总开关在合成层生效）', () => {
    progress.S.mute = true
    expect(() => A.sndOk()).not.toThrow()
  })
  it('stub AudioContext 后合成路径全链执行（osc/gain/connect/start/stop）', () => {
    const calls: string[] = []
    const node = () => ({
      connect: () => calls.push('connect'),
      start: () => calls.push('start'),
      stop: () => calls.push('stop'),
    })
    const ctx: any = {
      currentTime: 1.5,
      state: 'running',
      destination: 'dest',
      createOscillator: () => ({ ...node(), type: '', frequency: { value: 0 } }),
      createGain: () => ({ ...node(), gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }),
      resume: async () => {},
    }
    ;(window as any).AudioContext = function () { return ctx }
    A.sndOk()
    expect(calls.filter((c) => c === 'start').length).toBeGreaterThanOrEqual(2)
    delete (window as any).AudioContext
  })
})

describe('unlockMedia（v4.1 开局手势解锁）', () => {
  it('静音元素试播 + ac() 调用，双调幂等不抛', () => {
    expect(() => { A.unlockMedia(); A.unlockMedia() }).not.toThrow()
  })
})

describe('preload 家族（BUGS#23 智能预载）', () => {
  it('preloadAudios：star/duila/fanla 三元素入缓存', () => {
    A.preloadAudios()
    for (const n of ['star', 'duila', 'fanla']) expect(A.AUDIO_CACHE[n]).toBeTruthy()
  })
  it('preloadAudioList：Cache API 直写 + 幂等去重（重调用零新任务）', async () => {
    const store = fakeCaches()
    const r1 = await A.preloadAudioList(['a', 'b', ''])
    expect(r1).toHaveLength(2)
    expect(store.size).toBe(2)
    expect(A.AUDIO_CACHE['a']).toBeTruthy()
    const r2 = await A.preloadAudioList(['a', 'b'])
    expect(r2).toHaveLength(0)   // PRELOADED 幂等跳过
  })
  it('单条失败静默（allSettled 语义：响应不 ok → rejected，不阻塞其余）', async () => {
    fakeCaches()
    vi.stubGlobal('fetch', vi.fn(async (u: any) => new Response('x', { status: String(u).includes('bad') ? 404 : 200 })))
    const r = await A.preloadAudioList(['badfile', 'a'])
    expect(r).toHaveLength(2)
    expect(r[0].status).toBe('rejected')
    expect(r[1].status).toBe('fulfilled')
  })
  it('无 Cache API 环境 → 退回纯 fetch 暖缓存路径', async () => {
    const f = vi.fn(async () => new Response('x', { status: 200 }))
    vi.stubGlobal('fetch', f)
    const r = await A.preloadAudioList(['c'])
    expect(r[0].status).toBe('fulfilled')
    expect(f).toHaveBeenCalledTimes(1)
  })
})

describe('playSerial 串行播放（v4.7 P1-4：声调名→音节，绝不叠播）', () => {
  beforeEach(() => {
    (window as any).__AUDIO_LOG = []
  })
  afterEach(() => { delete (window as any).__AUDIO_LOG })

  it('两段串行：第一段 onended 后第二段才起播（顺序断言）', async () => {
    A.playSerial(['tone-name1', 'a1'])
    expect((window as any).__AUDIO_LOG.map((x: any) => x.name)).toEqual(['tone-name1'])
    /* 手动触发第一段 ended（jsdom 无真实媒体）→ 第二段起播 */
    A.AUDIO_CACHE['tone-name1']!.onended!(new Event('ended'))
    expect((window as any).__AUDIO_LOG.map((x: any) => x.name)).toEqual(['tone-name1', 'a1'])
  })
  it('首段缺失（manifest/hyp 无值）→ 直接播次段不空转', () => {
    A.playSerial(['', 'a2'])
    expect((window as any).__AUDIO_LOG.map((x: any) => x.name)).toEqual(['a2'])
  })
  it('次段缺失 → 只播首段（缺失静默，不抛错）', () => {
    A.playSerial(['a3', ''])
    expect((window as any).__AUDIO_LOG.map((x: any) => x.name)).toEqual(['a3'])
    expect(() => A.AUDIO_CACHE['a3']!.onended!(new Event('ended'))).not.toThrow()
  })
  it('静音总开关注：playSerial 整链静默', () => {
    progress.S.mute = true
    A.playSerial(['tone-name1', 'a1'])
    expect((window as any).__AUDIO_LOG).toHaveLength(0)
    progress.S.mute = false
  })
})

/* v4.8.1 ended 只做加速，绝不做唯一闸门（真机卡死 hotfix 的回归锁）：
   iOS Safari/PWA 缓存元素 ended 不触发时，看门狗（时长+400ms/未知 2500ms）兜底放行 */
describe('ended 看门狗（v4.8.1：onend 永不悬挂）', () => {
  beforeEach(() => {
    (window as any).__AUDIO_LOG = []
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    delete (window as any).__AUDIO_LOG
  })

  it('ended 永不触发（iOS 缓存元素故障模式）→ 看门狗 2500ms 兜底放行 onend', () => {
    const onend = vi.fn()
    A.playAudio('a', { onend })
    expect(onend).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2499)
    expect(onend).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onend).toHaveBeenCalledTimes(1)
  })

  it('ended 先到 → onend 立即一次，看门狗不再补发（ended=加速主路）', () => {
    const onend = vi.fn()
    const a = A.playAudio('a', { onend })
    a!.onended!(new Event('ended'))
    expect(onend).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(onend).toHaveBeenCalledTimes(1)
  })

  it('同元素重播：旧看门狗不得误发新轮回调（seq 守卫）', () => {
    const onend1 = vi.fn()
    const onend2 = vi.fn()
    A.playAudio('a', { onend: onend1 })
    A.playAudio('a', { onend: onend2 })   /* 重播同元素（缓存复用） */
    vi.advanceTimersByTime(2500)
    expect(onend2).toHaveBeenCalledTimes(1)
    expect(onend1).not.toHaveBeenCalled()
  })

  it('无 onend 的播放清除 onended 属性（ended 事件不再触发旧回调）；看门狗仍保底推进不悬挂', () => {
    const onend = vi.fn()
    A.playAudio('a', { onend })
    A.playAudio('a')   /* 🔊重听类：无 onend——不得取消旧看门狗（否则 iOS 上地鼠永不探头） */
    expect(A.AUDIO_CACHE['a']!.onended).toBeNull()
    vi.advanceTimersByTime(2500)
    expect(onend).toHaveBeenCalledTimes(1)   /* 看门狗兜底=游戏继续的保证 */
  })

  it('audioDurMs：jsdom 无元数据=0（未知时长走 2500 封顶；真时长由 loadedmetadata 登记）', () => {
    expect(A.audioDurMs('neverloaded')).toBe(0)
  })

  it('被 stopAll 中途暂停（paused 且已播过且非近结尾）→ 看门狗不放行（RadioPage 停止/跳播不顶链）', () => {
    const onend = vi.fn()
    const fake: any = {
      play: () => Promise.resolve(), paused: false, currentTime: 0, duration: 2.0,
      addEventListener() {}, dataset: {},
    }
    A.AUDIO_CACHE['stopcase'] = fake
    A.playAudio('stopcase', { onend })
    fake.paused = true            /* 播放中途 stopAll()：暂停在半途 */
    fake.currentTime = 0.8
    vi.advanceTimersByTime(5000)
    expect(onend).not.toHaveBeenCalled()
  })

  it('播完但 ended 丢失（iOS 形态：currentTime≈duration）→ 看门狗照常放行', () => {
    const onend = vi.fn()
    const fake: any = {
      play: () => Promise.resolve(), paused: false, currentTime: 0, duration: 1.824,
      addEventListener() {}, dataset: {},
    }
    A.AUDIO_CACHE['lostend'] = fake
    A.playAudio('lostend', { onend })
    fake.paused = true            /* 播放自然跑完：paused 自动转 true，ended 事件却丢了 */
    fake.currentTime = 1.82
    vi.advanceTimersByTime(2500)
    expect(onend).toHaveBeenCalledTimes(1)
  })

  it('playSerial 链：ended 不到也由看门狗逐段推进（调名→音节链不悬挂）', () => {
    A.playSerial(['tone-name1', 'a1'])
    expect((window as any).__AUDIO_LOG.map((x: any) => x.name)).toEqual(['tone-name1'])
    vi.advanceTimersByTime(2500)
    expect((window as any).__AUDIO_LOG.map((x: any) => x.name)).toEqual(['tone-name1', 'a1'])
  })
})
