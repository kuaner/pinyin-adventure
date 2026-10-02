/* UI 壳路由 store 单测（src/stores/ui.svelte.ts）：视图切换/toast 自动散场/课号深链 clamp/辨析卡弹窗。 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

let ui!: typeof import('../../../src/stores/ui.svelte')
let ruby!: typeof import('../../../src/lib/ruby')

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  vi.useFakeTimers()
  ruby = await import('../../../src/lib/ruby')
  ui = await import('../../../src/stores/ui.svelte')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('show / openLesson（壳路由）', () => {
  it('show 切视图 + 回页顶', () => {
    ui.show('levels')
    expect(ui.ui.view).toBe('levels')
  })
  it('openLesson：课号+初始字母下标带入（Bug#12：不再永远从第一个字母起）', () => {
    ui.openLesson(3, 2)
    expect(ui.ui.lessonN).toBe(3)
    expect(ui.ui.lessonLi).toBe(2)
    expect(ui.ui.view).toBe('lesson')
  })
  it('openLesson：负下标 clamp 0', () => {
    ui.openLesson(2, -5)
    expect(ui.ui.lessonLi).toBe(0)
  })
})

describe('toast（统一走 T 注音层）', () => {
  it('弹 toast：正文写入 + 可见', () => {
    ui.toast('测试提示啦')
    expect(ui.ui.toastOn).toBe(true)
    expect(ui.ui.toastMsg.length).toBeGreaterThan(0)
  })
  it('2.6s 自动散场；连发重置计时器（后一条顶前一条）', () => {
    ui.toast('第一条')
    vi.advanceTimersByTime(2000)
    ui.toast('第二条')
    vi.advanceTimersByTime(2500)
    expect(ui.ui.toastOn).toBe(true)   // 第二条的 2.6s 未满
    expect(ui.ui.toastMsg).toContain('二')   // toastMsg=T() 注音后的 HTML，汉字仍在
    vi.advanceTimersByTime(200)
    expect(ui.ui.toastOn).toBe(false)
  })
})

describe('辨析卡弹窗', () => {
  it('openPair/closePair：开合状态', () => {
    ui.openPair(3)
    expect(ui.ui.pairIdx).toBe(3)
    ui.closePair()
    expect(ui.ui.pairIdx).toBe(-1)
  })
})

describe('TAB_VIEWS 壳契约', () => {
  it('三个 tab 视图常驻清单', () => {
    expect(ui.TAB_VIEWS).toEqual(['learn', 'practice', 'mine'])
  })
})
