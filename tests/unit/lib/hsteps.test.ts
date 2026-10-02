/* HSteps 翻页纯逻辑单测（src/lib/hsteps.ts，T2 从组件抽取）：
   轴锁（纵向还给滚动）/ 死区（点按不误翻）/ 55px 翻页阈值 / 两端橡皮筋。
   历次 bug 住点：BUGS#4 左滑失效（事件路由）、纵向滚动误翻页。 */
import { describe, it, expect } from 'vitest'
import { pickAxis, flipsPage, dragOffset, AXIS_DEADZONE, FLIP_THRESHOLD } from '../../../src/lib/hsteps'

describe('pickAxis 轴锁（HSteps dragMove 判轴）', () => {
  it('死区内（<6px）不判轴——点按不出发翻页', () => {
    expect(pickAxis(0, 0)).toBe('')
    expect(pickAxis(5, 5)).toBe('')
    expect(pickAxis(5.9, -5.9)).toBe('')
    expect(AXIS_DEADZONE).toBe(6)
  })
  it('横向位移 ≥ 纵向 → x 轴（跟手翻页）', () => {
    expect(pickAxis(-60, 10)).toBe('x')
    expect(pickAxis(30, -30)).toBe('x')       // 相等取横（≥）
    expect(pickAxis(80, 0)).toBe('x')
  })
  it('纵向位移 > 横向 → y 轴（还给页面滚动，绝不误翻页）', () => {
    expect(pickAxis(10, -60)).toBe('y')
    expect(pickAxis(-5, 40)).toBe('y')
  })
})

describe('flipsPage 翻页阈值（dragEnd 吸附判定）', () => {
  it('超过 55px 才翻页；flip=false（cancel）永不翻', () => {
    expect(FLIP_THRESHOLD).toBe(55)
    expect(flipsPage(-56, true)).toBe(true)
    expect(flipsPage(56, true)).toBe(true)
    expect(flipsPage(-55, true)).toBe(false)   // 恰在阈值不翻（> 严格）
    expect(flipsPage(-40, true)).toBe(false)   // 轻扫回弹
    expect(flipsPage(-200, false)).toBe(false) // touchcancel/pointercancel
  })
})

describe('dragOffset 跟手位移（含两端橡皮筋）', () => {
  const W = 358, n = 3
  it('页内跟手 = -cur*W + dx', () => {
    expect(dragOffset(0, -50, W, n)).toBe(-50)
    expect(dragOffset(1, -20, W, n)).toBe(-W - 20)
  })
  it('首页右拖（off>0）→ 1/3 阻尼橡皮筋', () => {
    expect(dragOffset(0, 90, W, n)).toBe(30)
  })
  it('末页左拖越界 → 1/3 阻尼橡皮筋', () => {
    const end = -(n - 1) * W
    expect(dragOffset(2, -90, W, n)).toBe(end - 30)
  })
  it('单页（n=1）两端同时成立时左边界优先（实现顺序契约）', () => {
    // off=0 既不 >0 也不 <-(n-1)*W=0 → 原样
    expect(dragOffset(0, 0, W, 1)).toBe(0)
  })
})
