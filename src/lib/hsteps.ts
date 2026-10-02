/* HSteps 横向翻页的纯判定逻辑（T2 可测性抽取，2026-10-02）：
   从 HSteps.svelte 的 dragMove/dragEnd 中原样提出——轴锁（纵向还给滚动）与翻页阈值，
   零 DOM 依赖、零状态。行为与抽取前逐字节等价（deadzone 6px、横向=|dx|≥|dy|、阈值 55px），
   HSteps.svelte 改为调用本模块（组件测=纯函数单测 + 组件交互测两层）。 */

/** 死区：位移小于该值不判轴（点按不误翻页） */
export const AXIS_DEADZONE = 6
/** 翻页阈值：横向位移超过该值松手才吸附翻页（v2.4 立的 55px 手感） */
export const FLIP_THRESHOLD = 55

/** 轴锁判定：'' = 未出死区；'x' = 横向拖拽（跟手翻页）；'y' = 纵向（还给页面滚动） */
export function pickAxis(ddx: number, ddy: number): '' | 'x' | 'y' {
  if (Math.abs(ddx) < AXIS_DEADZONE && Math.abs(ddy) < AXIS_DEADZONE) return ''
  return Math.abs(ddx) >= Math.abs(ddy) ? 'x' : 'y'
}

/** 松手是否翻页：flip=true 且位移超阈值（方向由调用方按符号定） */
export function flipsPage(dx: number, flip: boolean): boolean {
  return flip && Math.abs(dx) > FLIP_THRESHOLD
}

/** 跟手位移：基础 = -cur*W + dx，两端橡皮筋（越界 1/3 阻尼）——HSteps dragMove 同式 */
export function dragOffset(cur: number, dx: number, W: number, n: number): number {
  let off = -cur * W + dx
  if (off > 0) off /= 3
  if (off < -(n - 1) * W) off = (-(n - 1) * W) + (off + (n - 1) * W) / 3
  return off
}
