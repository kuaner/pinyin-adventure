/* HSteps 横向翻页容器组件测：轴锁（纵向还滚动）/ 死区 / 55px 阈值翻页 / 边界钳制 / 右缘示能条。
   纯判定逻辑在 tests/unit/lib/hsteps.test.ts——本文件验「事件接线」：touch/pointer 事件流
   正确驱动 go()/onchange（BUGS#4 的事件路由病根在此回归）。 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import HSteps from '../../src/components/HSteps.svelte'

afterEach(cleanup)

/* jsdom 无 TouchEvent/PointerEvent 构造器——手造带 changedTouches/指针字段的合成事件
   （Svelte 的 on* 只读字段，事件类型名决定走哪条处理链） */
function touch(type: string, x: number, y: number): TouchEvent {
  const e = new window.Event(type, { bubbles: true, cancelable: true }) as any
  e.changedTouches = [{ clientX: x, clientY: y }]
  return e
}
function pointer(type: string, x: number, y: number, pointerType = 'mouse', pointerId = 1): PointerEvent {
  const e = new window.Event(type, { bubbles: true, cancelable: true }) as any
  e.clientX = x; e.clientY = y; e.pointerType = pointerType; e.pointerId = pointerId
  return e
}

function mount(n = 3) {
  const onchange = vi.fn()
  const { container } = render(HSteps, { n, onchange })
  const track = container.querySelector('.hstage') as HTMLElement
  return { container, track, onchange }
}

describe('翻页接线（拖拽 → go → onchange）', () => {
  it('左滑 70px（>55 阈值）→ 翻下一页；transform 跟手', () => {
    const { track, onchange } = mount(3)
    track.dispatchEvent(touch('touchstart', 100, 300))
    track.dispatchEvent(touch('touchmove', 30, 300))
    expect(track.style.transform).toContain('translateX(')   // 跟手位移已上墙
    track.dispatchEvent(touch('touchend', 30, 300))
    expect(onchange).toHaveBeenLastCalledWith(1)
  })
  it('右滑回上一页；第 0 页再右滑被钳制在 0', () => {
    const { track, onchange } = mount(3)
    track.dispatchEvent(touch('touchstart', 100, 300))
    track.dispatchEvent(touch('touchmove', 30, 300))
    track.dispatchEvent(touch('touchend', 30, 300))
    expect(onchange).toHaveBeenLastCalledWith(1)
    track.dispatchEvent(touch('touchstart', 100, 300))
    track.dispatchEvent(touch('touchmove', 180, 300))
    track.dispatchEvent(touch('touchend', 180, 300))
    expect(onchange).toHaveBeenLastCalledWith(0)
    track.dispatchEvent(touch('touchstart', 100, 300))
    track.dispatchEvent(touch('touchmove', 200, 300))
    track.dispatchEvent(touch('touchend', 200, 300))
    expect(onchange).toHaveBeenLastCalledWith(0)   // 边界钳制
  })
})

describe('轴锁与死区（误触防线）', () => {
  it('纵向滑动 → 还给滚动，绝不翻页', () => {
    const { track, onchange } = mount(3)
    track.dispatchEvent(touch('touchstart', 100, 100))
    track.dispatchEvent(touch('touchmove', 104, 200))
    track.dispatchEvent(touch('touchend', 104, 200))
    expect(onchange).not.toHaveBeenCalled()
  })
  it('死区内微动（<6px）不判轴不翻页（点按吸附回原页 0）', () => {
    const { track, onchange } = mount(3)
    track.dispatchEvent(touch('touchstart', 100, 100))
    track.dispatchEvent(touch('touchmove', 103, 102))
    track.dispatchEvent(touch('touchend', 103, 102))
    expect(onchange).toHaveBeenLastCalledWith(0)
  })
  it('45px 轻扫（<55 阈值）回弹不翻页（吸附回原页）', () => {
    const { track, onchange } = mount(3)
    track.dispatchEvent(touch('touchstart', 100, 100))
    track.dispatchEvent(touch('touchmove', 55, 100))
    track.dispatchEvent(touch('touchend', 55, 100))
    expect(onchange).toHaveBeenLastCalledWith(0)
  })
})

describe('鼠标/笔路径（pointer 事件）', () => {
  it('横向拖拽松手 → 翻页（capture 路径不阻断 click 落点）', () => {
    const { track, onchange } = mount(3)
    track.dispatchEvent(pointer('pointerdown', 200, 100))
    track.dispatchEvent(pointer('pointermove', 120, 100))
    track.dispatchEvent(pointer('pointerup', 120, 100))
    expect(onchange).toHaveBeenLastCalledWith(1)
  })
  it('touch/pen 之外的 pointerType 走 touch 链（触屏双路径回归）', () => {
    const { track, onchange } = mount(3)
    track.dispatchEvent(pointer('pointerdown', 200, 100, 'touch'))
    track.dispatchEvent(pointer('pointermove', 120, 100, 'touch'))
    track.dispatchEvent(pointer('pointerup', 120, 100, 'touch'))
    expect(onchange).not.toHaveBeenCalled()   // pDown 只接 mouse/pen——触屏走 touch 事件
  })
  it('pointercancel 不翻页（系统打断吸附回原页）', () => {
    const { track, onchange } = mount(3)
    track.dispatchEvent(pointer('pointerdown', 200, 100))
    track.dispatchEvent(pointer('pointermove', 120, 100))
    track.dispatchEvent(pointer('pointercancel', 120, 100))
    expect(onchange).toHaveBeenLastCalledWith(0)
  })
})

describe('单页/禁滑', () => {
  it('n=1 无翻页（拖拽不启用，吸附原页）', () => {
    const { track, onchange } = mount(1)
    track.dispatchEvent(touch('touchstart', 100, 100))
    track.dispatchEvent(touch('touchmove', 20, 100))
    track.dispatchEvent(touch('touchend', 20, 100))
    expect(onchange).not.toHaveBeenCalled()   // dragStart 直接拒绝：x0 未置位
  })
  it('swipeOn=false 关滑动（翻页只走外部 cur）', () => {
    const onchange = vi.fn()
    const { container } = render(HSteps, { n: 3, onchange, swipeOn: false })
    const track = container.querySelector('.hstage') as HTMLElement
    track.dispatchEvent(touch('touchstart', 100, 100))
    track.dispatchEvent(touch('touchmove', 20, 100))
    track.dispatchEvent(touch('touchend', 20, 100))
    expect(onchange).not.toHaveBeenCalled()
  })
})

describe('右缘露边示能条（可滑可供性）', () => {
  it('非末页不隐藏；末页（cur=n-1）隐藏（.end 类）', () => {
    const { container } = render(HSteps, { n: 2 })
    const wrap = container.querySelector('.hswrap') as HTMLElement
    expect(wrap.className).not.toContain('end')
    cleanup()
    const { container: c2 } = render(HSteps, { n: 2, cur: 1 })
    expect((c2.querySelector('.hswrap') as HTMLElement).className).toContain('end')
  })
})
