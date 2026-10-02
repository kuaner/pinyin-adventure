<script lang="ts">
  /* v2.4 横向翻页容器（REDESIGN 三）：拖拽跟手 + 55px 阈值吸附 + 边界橡皮筋；
     右缘露边条 = 可滑可供性；children 为各页数组（<div class="hspage">），页点/步骤条由父级同步。
     v2.4.1 修左滑失效（BUGS#4）：v2.4 在 wrap 上 setPointerCapture，后续 pointer 事件
     被重定向到父级 wrap，挂在 track 上的 move/up 永不触发 → 触屏/鼠标滑动全死。
     现改双路径：触屏走 touch 事件（真机主路径，无 capture 依赖）；
     鼠标/笔走 pointer 事件且 capture 在 track 自身。轴锁防纵向滚动误翻页。 */
  import { pickAxis, flipsPage, dragOffset } from '../lib/hsteps'

  let { n, cur = $bindable(0), onchange, swipeOn = true, children }:
    { n: number; cur?: number; onchange?: (i: number) => void; swipeOn?: boolean; children?: any } = $props()

  let wrap: HTMLDivElement
  let track: HTMLDivElement
  let x0: number | null = null
  let y0 = 0
  let axis: '' | 'x' | 'y' = ''
  let dx = 0
  let W = 358

  $effect(() => {
    const ro = new ResizeObserver(() => { if (wrap) W = wrap.clientWidth })
    ro.observe(wrap)
    W = wrap.clientWidth
    return () => ro.disconnect()
  })

  export function go(i: number) {
    cur = Math.max(0, Math.min(n - 1, i))
    track.style.transition = 'transform .28s cubic-bezier(.3,.8,.3,1)'
    track.style.transform = `translateX(${-cur * W}px)`
    onchange?.(cur)
  }

  /* 外部 cur 变化（点步骤条等）→ 吸附过去 */
  $effect(() => {
    const i = cur
    if (!track) return
    track.style.transition = 'transform .28s cubic-bezier(.3,.8,.3,1)'
    track.style.transform = `translateX(${-i * W}px)`
  })

  /* ---------- 公共拖拽逻辑 ---------- */
  function dragStart(x: number, y: number): boolean {
    if (!swipeOn || n <= 1) return false
    x0 = x
    y0 = y
    dx = 0
    axis = ''
    track.style.transition = 'none'
    return true
  }
  function dragMove(x: number, y: number) {
    if (x0 === null) return
    const ddx = x - x0
    const ddy = y - y0
    if (!axis) {
      axis = pickAxis(ddx, ddy)
      if (axis === '') return
      if (axis === 'y') { x0 = null; track.style.transition = ''; return }   // 纵向 → 还给滚动
    }
    dx = ddx
    track.style.transform = `translateX(${dragOffset(cur, dx, W, n)}px)`
  }
  function dragEnd(flip: boolean) {
    if (x0 === null) { dx = 0; return }
    x0 = null
    axis = ''
    ptrId = null
    if (flipsPage(dx, flip)) go(cur + (dx < 0 ? 1 : -1))
    else go(cur)
    dx = 0
  }

  /* 触屏主路径（真机）：touch 事件，事件始终以起始元素为目标，无 capture 问题 */
  function tStart(e: TouchEvent) {
    const t = e.changedTouches[0]
    if (t) dragStart(t.clientX, t.clientY)
  }
  function tMove(e: TouchEvent) {
    const t = e.changedTouches[0]
    if (t) dragMove(t.clientX, t.clientY)
  }
  function tEnd() { dragEnd(true) }
  function tCancel() { dragEnd(false) }

  /* 鼠标/笔路径：轴锁定（确认横向拖拽）后才 setPointerCapture 到 track——
     立即 capture 会把后续 pointer 事件重定向，click 随之落到 track，页内按钮全部失灵 */
  let ptrId: number | null = null
  function pDown(e: PointerEvent) {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
    if (!dragStart(e.clientX, e.clientY)) return
    ptrId = e.pointerId
  }
  function pMove(e: PointerEvent) {
    if (x0 === null) return
    const wasAxis = axis
    dragMove(e.clientX, e.clientY)
    if (axis === 'x' && wasAxis !== 'x' && ptrId !== null) {
      try { track.setPointerCapture(ptrId) } catch { /* 无 capture 环境退化为元素内拖拽 */ }
    }
  }
  function pUp(e: PointerEvent) {
    if (x0 === null) return
    if (ptrId !== null) { try { track.releasePointerCapture(ptrId) } catch { /* 已释放 */ } ptrId = null }
    dragEnd(true)
  }
  function pCancel() { ptrId = null; dragEnd(false) }
</script>

<div class="hswrap" class:end={cur === n - 1} bind:this={wrap}>
  <div
    class="hstage" bind:this={track}
    ontouchstart={tStart} ontouchmove={tMove} ontouchend={tEnd} ontouchcancel={tCancel}
    onpointerdown={pDown} onpointermove={pMove} onpointerup={pUp} onpointercancel={pCancel}
  >
    {@render children?.()}
  </div>
</div>

<style>
  .hswrap { position: relative; height: 100%; min-height: 0; }
  .hswrap::after { content: ''; position: absolute; right: -2px; top: 14px; bottom: 14px; width: 12px;
    border-radius: 0 20px 20px 0; background: #fff; box-shadow: 0 3px 10px rgba(61,52,40,.1); opacity: .7;
    transition: opacity .2s; pointer-events: none; }
  .hswrap.end::after { opacity: 0; }
  .hstage { position: absolute; inset: 0; display: flex; height: 100%; will-change: transform;
    touch-action: pan-y; }
  .hstage :global(.hspage) { flex: 0 0 100%; min-width: 0; padding-right: var(--sp-3); display: flex; flex-direction: column; min-height: 0; }
</style>
