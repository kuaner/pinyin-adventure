<script lang="ts">
  /* 笔顺动画：四线三格 + 分笔 stroke-dashoffset 逐笔绘制 + 笔序编号 + 起笔点标记。
     数据源 src/data/strokes.json（人教版一年级课本笔顺规范）。
     static >= 0 时静态渲染前 static 笔（自检/逐步讲解用），否则自动播放。
     用法：<StrokeAnim unit="b" bind:this={sa} /> ；sa.replay() 重播 */
  import strokesData from '../../data/strokes.json'

  const LETTERS = (strokesData as any).letters as Record<string, { strokes: { n: string; d: string }[] }>
  const UNITS = (strokesData as any).units as Record<string, string[]>

  let {
    unit, cell = 116, static: staticN = -1, speed = 1, autostart = true,
    ondone, onstroke,
  }: {
    unit: string; cell?: number; static?: number; speed?: number; autostart?: boolean
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
        if (st.n === '点') {
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
        placed.push([cx, cy])
        row.push([cx - sx, cy - sy])
      }
      out[li] = row
    })
    return out
  })

  let inkEls: (SVGPathElement | undefined)[] = []
  let cur = $state(-1)        // 正在画的笔（-1 未开始，total 画完）
  let timer: ReturnType<typeof setTimeout> | null = null
  let token = 0

  function startOf(d: string): [number, number] {
    const m = /M\s*([\d.]+)[ ,]([\d.]+)/.exec(d)
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : [50, 60]
  }
  const durOf = (len: number) => Math.max(320, Math.min(1300, len * 4.4)) / speed

  function stopAnim() { if (timer) clearTimeout(timer); token++ }

  export function replay() { play() }

  function play() {
    stopAnim()
    const my = ++token
    cur = -1
    inkEls.forEach((p) => { if (p) { const L = p.getTotalLength(); p.style.transition = 'none'; p.style.strokeDasharray = L + ' ' + L; p.style.strokeDashoffset = String(L) } })
    const step = (k: number) => {
      if (my !== token) return
      if (k >= total) { cur = total; ondone?.(); return }
      const p = inkEls[k]
      if (!p) return
      cur = k
      onstroke?.(k, allStrokes()[k]?.n || '')
      const L = p.getTotalLength()
      p.style.transition = 'none'
      p.style.strokeDasharray = L + ' ' + L
      p.style.strokeDashoffset = String(L)
      void p.getBoundingClientRect()   // reflow，确保起点状态生效
      requestAnimationFrame(() => {
        if (my !== token) return
        const d = durOf(L)
        p.style.transition = `stroke-dashoffset ${d}ms cubic-bezier(.42,.05,.55,.95)`
        p.style.strokeDashoffset = '0'
        timer = setTimeout(() => step(k + 1), d + 340 / speed)
      })
    }
    step(0)
  }

  function allStrokes() {
    const out: { n: string; d: string }[] = []
    for (const l of letters) out.push(...LETTERS[l].strokes)
    return out
  }

  $effect(() => {
    unit, staticN
    inkEls.length = total   /* bind:this 已按新 DOM 重绑，只裁掉多余尾巴 */
    if (staticN >= 0) { stopAnim(); cur = -1 }
    else if (autostart) play()
    else { stopAnim(); cur = -1 }
    return () => stopAnim()
  })

  /* static 模式下直接把前 N 笔设为可见 */
  $effect(() => {
    if (staticN >= 0) {
      const st = allStrokes()
      inkEls.forEach((p, i) => { if (p) { p.style.transition = 'none'; p.style.strokeDashoffset = i < staticN ? '0' : '2000' } })
      void st
    }
  })
</script>

<svg
  class="strokeanim"
  viewBox="0 0 {viewBoxW} 160"
  width={cell * letters.length}
  style="max-width:100%;height:auto"
  role="img" aria-label="{unit} 笔顺演示">
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
          class:act={staticN < 0 && cur === gi}
          class:p-done={staticN < 0 ? cur > gi : gi < staticN}
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
        {#if staticN < 0 && cur === gi}
          <circle cx={sx} cy={sy} r="4.8" fill="none" stroke="#E76F51" stroke-width="2.6" />
        {/if}
        {#if (staticN < 0 && cur >= gi) || (staticN >= 0 && gi < staticN)}
          {@const bo = badgeOff[li]?.[k] || [7.5, -9.5]}
          {@const bx = sx + bo[0]}
          {@const by = sy + bo[1]}
          <circle cx={bx} cy={by} r="7.4" class="numbg" />
          <text x={bx} y={by + 2.9} class="numtx" text-anchor="middle">{gi + 1}</text>
        {/if}
      {/each}
    </g>
  {/each}
</svg>

<style>
  .strokeanim { display: block; margin: 0 auto; }
  .grid { stroke: #ded4c3; stroke-width: 1.5; }
  .grid2 { stroke: #c9bca6; stroke-width: 2.2; }
  .ghost { fill: none; stroke: #e9e1d3; stroke-width: 8; stroke-linecap: round; stroke-linejoin: round; }
  path:not(.ghost) {
    fill: none; stroke: #264653; stroke-width: 8; stroke-linecap: round; stroke-linejoin: round;
    stroke-dasharray: 2000; stroke-dashoffset: 2000;
  }
  .act { stroke: #E76F51; }
  .p-done { stroke: #264653; }
  .numbg { fill: #E76F51; }
  .numtx { font-size: 10px; font-weight: 800; fill: #fff; }
</style>
