<script lang="ts">
  /* 笔顺动画 v2.4.4：机制与节奏移植自 lasagoo/letter-writing（render.js demo 层 + app.js startDemo/stepDemo）。
     逐笔 stroke-dashoffset 渐进绘制；当前笔橙高亮+呼吸起笔圈+笔尖跟随圆点（rAF+getPointAtLength）；
     完成笔定格深色；笔间停顿 420ms；durOf=max(650,min(2200,len*4.2))、点笔 450ms（其节奏参数）。
     底部笔名清单随当前笔同步高亮。
     播放由 play 属性驱动（LessonPage 传 step===2）：只有翻到写法页才播——修复 HSteps 全量挂载下
     动画在第 1 页就偷偷播完、孩子滑到写法页只见静态编号的时机 bug（BUGS #6b）。
     static >= 0 时仍为静态帧模式（?static=K 深链自检用）。
     idleDone（BUGS#31①）：play=false 且 static<0 时定格「完整字模」态（全部笔画深色、零编号徽章）——
     笔顺动画本身就是字模：空闲=写好的字，进页/重播=它把自己再写一遍。不设则空闲清场只留浅描边。
     用法：<StrokeAnim unit="b" play={step === 2} bind:this={sa} /> ；sa.replay() 重播 */
  import strokesData from '../../data/strokes.json'
  import Speak from '../Speak.svelte'
  import { STROKE_DOT, t } from '../../text/strings'

  const LETTERS = (strokesData as any).letters as Record<string, { strokes: { n: string; d: string }[] }>
  const UNITS = (strokesData as any).units as Record<string, string[]>

  let {
    unit, cell = 116, static: staticN = -1, speed = 1, play = true, showList = true, glyph = false,
    idleDone = false,
    ondone, onstroke,
  }: {
    unit: string; cell?: number; static?: number; speed?: number; play?: boolean; showList?: boolean; glyph?: boolean
    idleDone?: boolean
    ondone?: () => void; onstroke?: (n: number, name: string) => void
  } = $props()

  const W = 76
  const letters = $derived(unit in LETTERS ? [unit] : (UNITS[unit] || []))
  /* 全局笔索引：第 li 个字母之前有多少笔 */
  const before = $derived.by(() => {
    const acc = [0]
    for (let i = 0; i < letters.length; i++) acc.push(acc[i] + LETTERS[letters[i]].strokes.length)
    return acc
  })
  const total = $derived(before[letters.length] || 0)
  const viewBoxW = $derived(Math.max(letters.length, 1) * W)
  const all = $derived.by(() => {
    const out: { n: string; d: string }[] = []
    for (const l of letters) out.push(...LETTERS[l].strokes)
    return out
  })
  /* 全局笔 gi → 字母下标 li（跟随圆点要加各字母格的 x 偏移） */
  function liOf(gi: number): number {
    for (let i = 0; i < letters.length; i++) if (gi < before[i + 1]) return i
    return Math.max(letters.length - 1, 0)
  }

  /* 笔序编号位置：默认放在笔画行进方向左侧；点笔画放左侧偏左；
     编号圆在全单元范围（含跨字格）内相互避让，近距则依次右移错开 */
  const badgeOff = $derived.by(() => {
    const out: [number, number][][] = letters.map(() => [])
    const placed: [number, number][] = []
    letters.forEach((l, li) => {
      const row: [number, number][] = []
      for (const st of LETTERS[l].strokes) {
        const m = /M\s*([\d.]+)[ ,]([\d.]+)/.exec(st.d)
        const lx = m ? +m[1] : 50, ly = m ? +m[2] : 60
        const sx = lx + li * W, sy = ly
        let cx: number, cy: number
        if (st.n === STROKE_DOT) {
          cx = sx - 13; cy = sy - 4
        } else {
          const rest = st.d.slice(m![0].length).trim()
          const l2 = /^[LQC]\s*([\d.-]+)[ ,]([\d.-]+)/.exec(rest)
          if (l2 && (Math.abs(+l2[1] - lx) + Math.abs(+l2[2] - ly) > 2)) {
            const dx = +l2[1] - lx, dy = +l2[2] - ly
            const len = Math.hypot(dx, dy) || 1
            if (Math.abs(dy) > Math.abs(dx)) { cx = sx - 11; cy = sy }        /* 竖笔：徽章放左侧空白 */
            else { cx = sx + (dy / len) * 11; cy = sy - (dx / len) * 11 }
          } else { cx = sx + 7.5; cy = sy - 9.5 }
        }
        while (placed.some(([px, py]) => Math.hypot(px - cx, py - cy) < 17.5)) cx += 16
        cx = Math.min(cx, viewBoxW - 8)   /* 避让右移后越出格子则回推（防徽章被裁半圆） */
        placed.push([cx, cy])
        row.push([cx - sx, cy - sy])
      }
      out[li] = row
    })
    return out
  })

  let inkEls: (SVGPathElement | undefined)[] = []
  let markerEl: SVGGElement | undefined
  let cur = $state(-1)        // 正在画的笔（-1 未开始，total 画完）
  let idleHold = $state(false) // BUGS#31①：空闲定格态（=完整字模；徽章/呼吸点隐藏）
  let timer: ReturnType<typeof setTimeout> | null = null
  let raf = 0
  let token = 0

  function startOf(d: string): [number, number] {
    const m = /M\s*([\d.]+)[ ,]([\d.]+)/.exec(d)
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : [50, 60]
  }
  /* letter-writing 节奏（app.js durOf）：点笔定 450ms，其余按路径长度 4.2ms/单位，限 650–2200ms */
  const durOf = (len: number, isDot: boolean) => (isDot ? 450 : Math.max(650, Math.min(2200, len * 4.2))) / speed
  const GAP = () => 420 / speed   // 笔间停顿（任务定 300–500ms，取中值偏舒适）

  function hideMarker() { if (markerEl) markerEl.style.opacity = '0' }

  function stopAnim() {
    if (timer) clearTimeout(timer)
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    token++
    hideMarker()
  }

  export function replay() { playAll() }

  function playAll() {
    stopAnim()
    const my = ++token
    cur = -1
    idleHold = false
    inkEls.forEach((p) => { if (p) { const L = p.getTotalLength(); p.style.transition = 'none'; p.style.strokeDasharray = L + ' ' + L; p.style.strokeDashoffset = String(L) } })
    const step = (k: number) => {
      if (my !== token) return
      if (k >= total) { cur = total; hideMarker(); ondone?.(); return }
      const p = inkEls[k]
      if (!p) return
      cur = k
      onstroke?.(k, all[k]?.n || '')
      const L = p.getTotalLength()
      const d = durOf(L, all[k]?.n === STROKE_DOT)
      p.style.transition = 'none'
      p.style.strokeDasharray = L + ' ' + L
      p.style.strokeDashoffset = String(L)
      void p.getBoundingClientRect()   // reflow，确保起点状态生效
      requestAnimationFrame(() => {
        if (my !== token) return
        const t0 = performance.now()
        p.style.transition = `stroke-dashoffset ${d}ms cubic-bezier(.42,.05,.55,.95)`
        p.style.strokeDashoffset = '0'
        followDot(p, L, t0, d, k, my)
        timer = setTimeout(() => step(k + 1), d + (k + 1 < total ? GAP() : 0))
      })
    }
    step(0)
  }

  /* letter-writing 标志性的“跟着走的小圆点”（render.js demo）：rAF + getPointAtLength 沿当前笔推进，
     带淡晕圈；笔尖走到即隐。坐标在字母格局部系内，需加该格的 x 偏移 */
  function followDot(p: SVGPathElement, L: number, t0: number, d: number, gi: number, my: number) {
    if (!markerEl) return
    const ox = liOf(gi) * W
    markerEl.style.opacity = '1'
    const tick = (now: number) => {
      if (my !== token || !markerEl) return
      const t = Math.min(1, (now - t0) / d)
      const pt = p.getPointAtLength(t * L)
      markerEl.setAttribute('transform', `translate(${pt.x + ox},${pt.y})`)
      if (t < 1) raf = requestAnimationFrame(tick)
      else hideMarker()
    }
    raf = requestAnimationFrame(tick)
  }

  $effect(() => {
    unit, staticN, play
    if (glyph) return   /* glyph 档=纯静态字模 SVG，无动画无副作用（四线三格坐标系与动画档同源） */
    inkEls.length = total   /* bind:this 已按新 DOM 重绑，只裁掉多余尾巴 */
    if (staticN >= 0) { stopAnim(); cur = -1; idleHold = false }
    else if (play) playAll()
    else {
      /* 空闲态：idleDone=定格完整字模（全部笔画显形，BUGS#31①）；否则清场只留浅描边。
         dashoffset 必须显式落值——默认 CSS 把笔画藏在 offset=2000，cur/p-done 只管颜色不管显形 */
      stopAnim()
      idleHold = idleDone
      cur = idleDone ? total : -1
      inkEls.forEach((p) => { if (p) { p.style.transition = 'none'; p.style.strokeDashoffset = idleDone ? '0' : '2000' } })
    }
    return () => stopAnim()
  })

  /* static 模式下直接把前 N 笔设为可见 */
  $effect(() => {
    if (staticN >= 0) {
      inkEls.forEach((p, i) => { if (p) { p.style.transition = 'none'; p.style.strokeDashoffset = i < staticN ? '0' : '2000' } })
      void all
    }
  })
</script>

<div class="sawrap">
  <div class="svgfit">
  {#if glyph}
    <!-- BUGS#22②：静态大字模档——与动画档同源同坐标系（同 viewBox 76×160/字母、同四线三格背景线、
       同 path 数据）。PinyinCard 大字模复用它之后，同一字母在任何大小/任何页面占格完全一致。 -->
    <svg
      class="strokeanim saglyph"
      viewBox="0 0 {viewBoxW} 160"
      width={cell * letters.length}
      style="max-width:100%;max-height:100%;width:auto;height:100%"
      role="img" aria-label="{unit} {t('ariaStroke')}">
      {#each [20, 60, 100, 140] as gy (gy)}
        <line x1="0" y1={gy} x2={viewBoxW} y2={gy} class="grid" class:grid2={gy === 60 || gy === 100} />
      {/each}
      {#each letters as l, li (l + li)}
        <g transform="translate({li * W}, 0)">
          {#each LETTERS[l].strokes as st, k (l + '-' + k)}
            <path class="glink" d={st.d} />
          {/each}
        </g>
      {/each}
    </svg>
  {:else}
  <svg
    class="strokeanim"
    viewBox="0 0 {viewBoxW} 160"
    width={cell * letters.length}
    style="max-width:100%;max-height:100%;width:auto;height:100%"
    role="img" aria-label="{unit} {t('ariaStroke')}">
    {#each [20, 60, 100, 140] as gy (gy)}
      <line x1="0" y1={gy} x2={viewBoxW} y2={gy} class="grid" class:grid2={gy === 60 || gy === 100} />
    {/each}

    {#each letters as l, li (l + li)}
      <g transform="translate({li * W}, 0)">
        {#each LETTERS[l].strokes as st, k (l + '-' + k)}
          {@const gi = before[li] + k}
          <path class="ghost" d={st.d} />
          <path
            bind:this={inkEls[gi]}
            d={st.d}
            class:act={staticN < 0 && !idleHold && cur === gi}
            class:p-done={staticN < 0 ? (idleHold || cur > gi) : gi < staticN}
          />
        {/each}
      </g>
    {/each}

    <!-- 标记层：全部笔画之后再画，避免被后画的笔画盖住 -->
    {#each letters as l, li (l + li)}
      <g transform="translate({li * W}, 0)">
        {#each LETTERS[l].strokes as st, k (l + '-m-' + k)}
          {@const gi = before[li] + k}
          {@const [sx, sy] = startOf(st.d)}
          {#if staticN < 0 && !idleHold && cur === gi}
            <circle cx={sx} cy={sy} r="4.8" fill="none" stroke="#E76F51" stroke-width="2.6" class="sdot" />
          {/if}
          {#if (staticN < 0 && !idleHold && cur >= gi) || (staticN >= 0 && gi < staticN)}
            {@const bo = badgeOff[li]?.[k] || [7.5, -9.5]}
            {@const bx = sx + bo[0]}
            {@const by = sy + bo[1]}
            <circle cx={bx} cy={by} r="7.4" class="numbg" class:numbg-cur={staticN < 0 && cur === gi} />
            <text x={bx} y={by + 2.9} class="numtx" text-anchor="middle">{gi + 1}</text>
          {/if}
        {/each}
      </g>
    {/each}

    <!-- 笔尖跟随圆点（letter-writing demo 小球移植）：g transform 由 rAF 驱动 -->
    <g bind:this={markerEl} class="marker" style="opacity:0">
      <circle r="7" class="mhalo" />
      <circle r="3.6" class="mdot" />
    </g>
  </svg>
  {/if}
  </div>

  <!-- 底部笔名清单：随当前笔同步高亮，完成笔定格深色（showList=false 供紧凑预览位隐藏——
     v2.9.1：认识页卡内预算装不下清单，曾把 svg 挤到 0 高、清单溢出叠上重播键） -->
  {#if staticN < 0 && showList && !glyph}
    <div class="slist" role="list" aria-label="笔顺清单">
      {#each all as st, i (unit + '-' + i)}
        <span class="sit" class:is-cur={cur === i} class:is-done={cur > i || cur >= total} role="listitem">
          <i class="sn">{i + 1}</i>
          <span class="sname"><Speak text={st.n} /></span>
        </span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sawrap { display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--sp-1); width: 100%; height: 100%; min-height: 0; }
  .svgfit { flex: 1; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; }
  .strokeanim { display: block; margin: 0 auto; }
  .grid { stroke: #ded4c3; stroke-width: 1.5; }
  .grid2 { stroke: #c9bca6; stroke-width: 2.2; }
  /* glyph 档：纯静态字模——笔画作主体色（与原 .pc-big 大字模同色系），保留玩具感投影；
     坐标系/四线格/笔画路径与动画档逐字节同源（BUGS#22②） */
  .saglyph { filter: drop-shadow(0 3px 0 rgba(18, 157, 143, .16)); }
  /* dash 覆盖必须显式：全局 path:not(.ghost) 规则会把非动画路径 dashoffset 藏掉 */
  .saglyph .glink { fill: none; stroke: var(--animal-primary); stroke-width: 8; stroke-linecap: round; stroke-linejoin: round;
    stroke-dasharray: none; stroke-dashoffset: 0; }
  .ghost { fill: none; stroke: #e9e1d3; stroke-width: 8; stroke-linecap: round; stroke-linejoin: round; }
  path:not(.ghost) {
    fill: none; stroke: #264653; stroke-width: 8; stroke-linecap: round; stroke-linejoin: round;
    stroke-dasharray: 2000; stroke-dashoffset: 2000;
  }
  .act { stroke: #E76F51; }
  .p-done { stroke: #264653; }
  .numbg { fill: #E76F51; opacity: .55; }
  .numbg-cur { opacity: 1; }
  .numtx { font-size:var(--fs-xs); font-weight: 800; fill: #fff; }
  /* 当前笔起笔点呼吸（letter-writing numberDot pulse 的 CSS 化） */
  .sdot { animation: breathe 1.1s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes breathe { 0%, 100% { transform: scale(1); opacity: .95 } 50% { transform: scale(1.45); opacity: .5 } }
  /* 笔尖跟随小球 */
  .marker { transition: opacity .18s; pointer-events: none; }
  .mhalo { fill: #E76F51; opacity: .25; }
  .mdot { fill: #E76F51; stroke: #fff; stroke-width: 1.1; }

  /* 底部笔名清单 */
  /* 笔名清单=长内容允许换行（v2.9.4 换行立法豁免类） */
  .slist { display: flex; flex-wrap: wrap; gap: var(--sp-1) var(--sp-2); justify-content: center; flex: none;
    max-width: 100%; padding: 0 var(--sp-2); }
  .sit { display: inline-flex; align-items: center; gap: var(--sp-1); padding: var(--sp-1) var(--sp-3) var(--sp-1) var(--sp-1); border-radius: 999px;
    background: #f4ede0; color: #8a7a63; font-size:var(--fs-xs); font-weight: 700;
    box-shadow: inset 0 0 0 1.5px transparent; transition: background .25s, color .25s, box-shadow .25s; }
  .sit.is-cur { background: #fdeee7; color: #E76F51; box-shadow: inset 0 0 0 1.5px #E76F51; }
  .sit.is-done { background: #eef2ee; color: #264653; }
  .sn { width: 19px; height: 19px; border-radius: 50%; background: #d9cdb8; color: #fff;
    font-size:var(--fs-xs); font-weight: 800; font-style: normal; display: grid; place-items: center; flex: none; }
  .is-cur .sn { background: #E76F51; }
  .is-done .sn { background: #264653; }
  .sname { line-height: 1.15; }
</style>
