<script lang="ts">
  /* 🎈 气球大作战：气球带字母升空，听音 pop 对的（DOM+CSS transform+rAF）。
     v4.1 声音先行制：目标音自动播，气球在声音开播 300ms 后才升空（先听再看再动手）；
     漏掉目标/错 pop → miss 清连击，漏掉即换新目标（自动播新音）绝不静默推进；
     🔊=随时重听。rAF 循环与 spawn 计时在 phase!=='play' 或 unmount 时全清。
     v4.2c 共存立法（Bug#36）：成波生成——每波 3-4 只同时升空（目标+已学干扰[镜像/近音
     优先、账本加权]），波间重叠空中常驻 ≥3 只、可多目标同时在空；旧球换目标后不清场
     （全部转为新目标的合法干扰），purgeStale"清到只剩目标"的退化策略废除——正确答案
     只能由"听到的音↔字母内容"匹配得出，绝不能由出现时机/位置/唯一性推出 */
  import { GS, askTarget, listenTarget, gameHit } from '../../stores/game.svelte'
  import { learnedLetters, pickGameTarget, mirrorOf, ledgerPick } from '../../lib/gameEngine'
  import { untrack } from 'svelte'
  import Icon from '../Icon.svelte'
  import Speak from '../Speak.svelte'

  interface Balloon { id: number; k: string; x: number; y: number; hue: string; popped: boolean; wrong: boolean; leaving: boolean; leaveAt: number }
  const HUES = ['#f4a6a4', '#889df0', '#7fc8a9', '#f5c31c', '#b58cff', '#f0a35c']
  const RISE = 0.085          /* 每秒上升的舞台高度比例（连对加速） */
  /* P1-11 场上界（提示卡之下）：球到顶线即淡出退场——不再飘进提示卡后方"钻进去消失"。
     0.17 = 球底离 sky 顶 17%（球高 ~84px ≈ sky 高的 17%）：全程完整可见，退场有动画 */
  const TOP_LINE = 0.17
  const LEAVE_MS = 380
  const MAX_ALIVE = 6         /* P1-11 同屏密度上限 */
  /* P1-11 间距用泳道制：6 条固定横向泳道（间距 17%≈66px ≥ 球宽 64px）——
     泳道占位即天然最小间距（随机重采样会把 ≥3 同批波拆成碎波，威胁 Bug#36 共存立法） */
  const LANES_X = [5, 22, 39, 56, 73, 90]
  let balloons = $state<Balloon[]>([])
  let uid = 0
  let raf = 0
  let last = 0
  let waveAt = 0
  let noSpawnBefore = 0       /* 声音先行闸门：目标音开播 300ms 内不出新目标元素 */
  const pool = learnedLetters()

  const playing = $derived(GS.phase === 'play')

  $effect(() => {
    /* 依赖仅 phase + epoch——开局/重玩/退出都会重建循环。
       其余读写（GD 账本/balloons/GS.target）一律 untrack：答题写账本不得重置舞台，
       spawn 读 balloons 不得自触发 effect（effect_update_depth_exceeded 教训） */
    if (!playing) return
    const e = GS.epoch
    untrack(() => {
      balloons = []
      askTarget(pickGameTarget(pool, []))      /* 开局自动播第一轮目标音（声音先行） */
      const t0 = performance.now()
      noSpawnBefore = t0 + 300
      waveAt = t0 + 300
      last = t0
    })
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      void e
    }
  })

  function tick(now: number) {
    if (GS.phase !== 'play') return
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const speed = RISE + Math.min(GS.combo, 8) * 0.007
    const gone: number[] = []
    let missedTarget = false
    for (const b of balloons) {
      if (b.popped || b.wrong) continue
      if (b.leaving) {
        if (now - b.leaveAt > LEAVE_MS) gone.push(b.id)   /* 淡出动画期后移除 */
        continue
      }
      b.y -= speed * dt * (b.id % 2 ? 1.12 : 0.92)   /* 升空：自底向上 */
      if (b.y < TOP_LINE) {
        /* P1-11：到场上界即淡出退场（不再穿进提示卡后方）；目标球到线=miss 照旧 */
        b.leaving = true
        b.leaveAt = now
        if (b.k === GS.target) missedTarget = true
      }
    }
    if (gone.length) balloons = balloons.filter((b) => !gone.includes(b.id))
    if (missedTarget) {
      /* v4.1：目标球飘走=miss（清连击记错题）→ 换新目标自动播新音，绝不静默推进；
         v4.2c：不清场——在场旧球全部转为新目标的干扰（共存立法） */
      gameHit(GS.target, false)
      askTarget(pickGameTarget(pool, [GS.target]))
      noSpawnBefore = performance.now() + 300
    }
    /* P1-11×Bug#36 联合生成策略：
       - 整波（恒 3）：仅当 ≥3 空泳道时按波节拍发——同批性质确定（共存立法批观察）；
         错峰退场的 1-2 空泳道不再「见缝插针」拆碎波。
       - 目标救援：目标不在场即单发 1 球（孩子听过音必有得拍，不等波节拍） */
    if (now >= noSpawnBefore) {
      if (!targetOnStage()) {
        spawnSingleTarget()
        waveAt = now + Math.max(1900, 2600 - Math.min(GS.combo, 8) * 90)
      } else if (now >= waveAt && freeLaneCount() >= 3) {
        waveAt = now + Math.max(1900, 2600 - Math.min(GS.combo, 8) * 90)
        spawnWave()
      }
    }
    raf = requestAnimationFrame(tick)
  }

  /* 空泳道数（P1-11 泳道制） */
  function freeLaneCount(): number {
    const busy = new Set(balloons.filter((b) => !b.popped && !b.wrong && !b.leaving).map((b) => nearestLane(b.x)))
    return LANES_X.length - busy.size
  }

  /* 目标救援单球（目标不在场=孩子听过音没得拍，即时补） */
  function spawnSingleTarget() {
    if (aliveN() >= MAX_ALIVE) return
    const busy = new Set(balloons.filter((b) => !b.popped && !b.wrong && !b.leaving).map((b) => nearestLane(b.x)))
    const free = LANES_X.map((_, i) => i).filter((i) => !busy.has(i))
    if (!free.length) return
    const lane = free[Math.floor(Math.random() * free.length)]
    balloons.push({ id: ++uid, k: GS.target, x: LANES_X[lane], y: 1.04 + Math.random() * 0.08, hue: HUES[uid % HUES.length], popped: false, wrong: false, leaving: false, leaveAt: 0 })
  }

  /* 空中始终保底目标球（孩子听过音就一定有得拍）——由波次生成保证 */
  function targetOnStage(): boolean {
    return balloons.some((b) => !b.popped && !b.wrong && !b.leaving && b.k === GS.target)
  }
  /* P1-11：活球数（不含已爆/已错/退场中）——同屏密度上限口径 */
  function aliveN(): number {
    return balloons.filter((b) => !b.popped && !b.wrong && !b.leaving).length
  }
  /* 泳道最近邻（活球 x 恒为泳道值；浮点容差归位） */
  function nearestLane(x: number): number {
    let best = 0
    for (let i = 1; i < LANES_X.length; i++) if (Math.abs(LANES_X[i] - x) < Math.abs(LANES_X[best] - x)) best = i
    return best
  }

  /* v4.2c 成波生成：目标+已学干扰同时升空（镜像搭档优先、账本加权）。
     P1-11：波大小受同屏密度上限约束（先扣存活余量）；x 全域重采样保最小间距，放不进就弃（宁少勿叠） */
  function spawnWave() {
    /* P1-11×Bug#36 联合裁定：波大小恒 3（6 泳道 2 波占满，整波退场整波补位——
       ≥3 同批全波节拍确定，共存立法的批观察性质不被碎波稀释） */
    const n = Math.min(3, MAX_ALIVE - aliveN())
    if (n <= 0) return
    const ks: string[] = []
    /* 目标球：空中没有就必给；已有也可再给一只（多目标同时在空合法） */
    if (!targetOnStage() || Math.random() < 0.5) ks.push(GS.target)
    const mirror = mirrorOf(GS.target)
    if (mirror && pool.includes(mirror) && !ks.includes(mirror) && Math.random() < 0.8) ks.push(mirror)
    let guard = 0
    while (ks.length < n && guard++ < 30) {
      const k = ledgerPick(pool, Math.random)
      /* P1-11×Bug#36：干扰补位不得抽中当前目标——目标只从 ks[0] 入批（首入），
         批内新增序末位恒为干扰 → 「点最新出现的球」结构性无信号（盲点策略硬条款） */
      if (!ks.includes(k) && k !== GS.target) ks.push(k)
    }
    const slots: number[] = []
    for (let i = 0; i < ks.length; i++) slots.push(i)
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = slots[i]; slots[i] = slots[j]; slots[j] = t }
    /* P1-11 泳道分配：空闲泳道洗乱后一对一分配（ks[0]=目标先行不变——盲点策略性质：
       新增序最后一位恒为干扰，出现时机零信号） */
    const busy = new Set(balloons.filter((b) => !b.popped && !b.wrong && !b.leaving).map((b) => nearestLane(b.x)))
    const free = LANES_X.map((_, i) => i).filter((i) => !busy.has(i))
    for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = free[i]; free[i] = free[j]; free[j] = t }
    ks.forEach((k, i) => {
      if (i >= free.length) return   /* 泳道耗尽=弃球（宁少勿叠） */
      const x = LANES_X[free[i]]
      balloons.push({ id: ++uid, k, x, y: 1.04 + Math.random() * 0.08, hue: HUES[uid % HUES.length], popped: false, wrong: false, leaving: false, leaveAt: 0 })
    })
  }

  function pop(b: Balloon) {
    if (!playing || b.popped || b.wrong || b.leaving) return
    if (b.k === GS.target) {
      b.popped = true
      gameHit(GS.target, true)
      setTimeout(() => { balloons = balloons.filter((x) => x.id !== b.id) }, 320)
      askTarget(pickGameTarget(pool, [GS.target]))   /* 换目标自动播新音 */
      noSpawnBefore = performance.now() + 300        /* 新目标球等声音开播 300ms 后才升空 */
    } else {
      b.wrong = true
      gameHit(b.k, false)
      setTimeout(() => { balloons = balloons.filter((x) => x.id !== b.id) }, 600)
    }
  }
</script>

<div class="fill" id="v-balloon">
  <div class="prompt" data-prompt data-target={GS.target}>
    <button class="bigsound small" class:live={GS.listened} data-listen onclick={listenTarget}>
      <Icon name="headphones" size={34} />
    </button>
    <div class="ptip"><Speak k="listenThenAct" plain={GS.listened} /></div>
  </div>
  <div class="sky">
    {#each balloons as b (b.id)}
      <button
        class="balloon"
        class:popped={b.popped}
        class:wrong={b.wrong}
        data-letter={b.k}
        data-bid={b.id}
        style="left:{b.x}%; top:{b.y * 100}%; --hue:{b.hue}"
        onpointerdown={() => pop(b)}
        aria-label="balloon"
      >
        <svg viewBox="0 0 64 84">
          <path d="M32 4 C 15 4 8 17 8 28 C 8 42 20 52 32 52 C 44 52 56 42 56 28 C 56 17 49 4 32 4 Z" fill="var(--hue)" />
          <path d="M27 52 L37 52 L32 59 Z" fill="var(--hue)" />
          <path d="M32 59 C 26 64 38 68 32 76" stroke="#c9bca6" stroke-width="2" fill="none" />
          <ellipse cx="21" cy="18" rx="5" ry="7" fill="rgba(255,255,255,.5)" />
        </svg>
        <span class="bg">{b.k}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .fill { position: absolute; inset: 0; display: flex; flex-direction: column; touch-action: none; }
  .prompt { flex: none; display: flex; align-items: center; justify-content: center; gap: var(--sp-3);
    padding: var(--sp-2) 0 0; min-height: 64px; }
  .ptip { font-size: var(--fs-xs); font-weight: 700; color: var(--animal-text-2); white-space: nowrap; }
  .bigsound.live { border-color: #7fc8a9; background: #eaf9f0; }
  .sky { position: relative; flex: 1 1 0; min-height: 0; overflow: hidden;
    background: linear-gradient(180deg, #e8f6ff, #f3fbff 60%, #eaf9f0); }
  .balloon { position: absolute; width: 64px; height: 84px; margin: 0; padding: 0; border: none; background: none;
    transform: translate(-50%, -100%); cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .balloon svg { width: 100%; height: 100%; display: block; filter: drop-shadow(0 3px 2px rgba(61, 52, 40, .12)); }
  .balloon .bg { position: absolute; left: 0; right: 0; top: 18px; text-align: center; font-size: 30px; font-weight: 900;
    color: #fff; text-shadow: 0 2px 0 rgba(61, 52, 40, .18); line-height: 1.2; }
  .balloon.popped { animation: bpop .32s ease-out forwards; pointer-events: none; }
  @keyframes bpop { 40% { transform: translate(-50%, -100%) scale(1.25); opacity: 1; } 100% { transform: translate(-50%, -100%) scale(1.6); opacity: 0; } }
  .balloon.wrong { transition: top .7s ease-in, opacity .7s; opacity: .35; filter: grayscale(.9); pointer-events: none; }
  /* P1-11：到场上界的退场淡出（有退场动画，不再"钻进卡里消失"） */
  .balloon.leaving { transition: opacity .38s ease, transform .38s ease; opacity: 0; transform: translate(-50%, -100%) scale(.82); pointer-events: none; }

  @media (prefers-reduced-motion: reduce) {
    .balloon.popped { animation-duration: .01s; }
  }
</style>
