<script lang="ts">
  /* v2.4 横向翻页容器（REDESIGN 三）：拖拽跟手 + 55px 阈值吸附 + 边界橡皮筋；
     右缘露边条 = 可滑可供性；children 为各页数组（<div class="hspage">），页点/步骤条由父级同步 */
  let { n, cur = $bindable(0), onchange, swipeOn = true, children }:
    { n: number; cur?: number; onchange?: (i: number) => void; swipeOn?: boolean; children?: any } = $props()

  let wrap: HTMLDivElement
  let track: HTMLDivElement
  let x0: number | null = null
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

  function down(e: PointerEvent) {
    if (!swipeOn || n <= 1) return
    x0 = e.clientX
    dx = 0
    track.style.transition = 'none'
    wrap.setPointerCapture(e.pointerId)
  }
  function move(e: PointerEvent) {
    if (x0 === null) return
    dx = e.clientX - x0
    let off = -cur * W + dx
    if (off > 0) off /= 3
    if (off < -(n - 1) * W) off = (-(n - 1) * W) + (off + (n - 1) * W) / 3
    track.style.transform = `translateX(${off}px)`
  }
  function up() {
    if (x0 === null) return
    if (Math.abs(dx) > 55) go(cur + (dx < 0 ? 1 : -1))
    else go(cur)
    x0 = null
  }
</script>

<div class="hswrap" class:end={cur === n - 1} bind:this={wrap}>
  <div class="hstage" bind:this={track} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
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
  .hstage :global(.hspage) { flex: 0 0 100%; min-width: 0; padding-right: 12px; display: flex; flex-direction: column; min-height: 0; }
</style>
