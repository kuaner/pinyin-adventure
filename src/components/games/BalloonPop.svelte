<script lang="ts">
  /* 🎈 气球大作战：气球带字母升空，听音 pop 对的（DOM+CSS transform+rAF）。
     漏掉目标（已点听过）/错 pop → 清连击；连对加速一档（心流适配）。
     rAF 循环与 spawn 计时在 phase!=='play' 或 unmount 时全清 */
  import { GS, askTarget, listenTarget, gameHit } from '../../stores/game.svelte'
  import { learnedLetters, pickGameTarget } from '../../lib/gameEngine'
  import { untrack } from 'svelte'
  import Icon from '../Icon.svelte'
  import Speak from '../Speak.svelte'

  interface Balloon { id: number; k: string; x: number; y: number; hue: string; popped: boolean; wrong: boolean }
  const HUES = ['#f4a6a4', '#889df0', '#7fc8a9', '#f5c31c', '#b58cff', '#f0a35c']
  const RISE = 0.085          /* 每秒上升的舞台高度比例（连对加速） */
  let balloons = $state<Balloon[]>([])
  let uid = 0
  let raf = 0
  let last = 0
  let spawnAt = 0
  let spawnTid: ReturnType<typeof setTimeout> | null = null
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
      askTarget(pickGameTarget(pool, []))
      spawnAt = performance.now() + 500
      last = performance.now()
      spawn(true)   /* 开局先出一只目标球 */
    })
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      if (spawnTid) { clearTimeout(spawnTid); spawnTid = null }
      void e
    }
  })

  function tick(now: number) {
    if (GS.phase !== 'play') return
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const speed = RISE + Math.min(GS.combo, 8) * 0.007
    const gone: number[] = []
    for (const b of balloons) {
      if (b.popped || b.wrong) continue
      b.y -= speed * dt * (b.id % 2 ? 1.12 : 0.92)   /* 升空：自底向上 */
      if (b.y < -0.12) {
        gone.push(b.id)
        /* 漏掉已听过的目标球 → 清连击 */
        if (b.k === GS.target && GS.listened) gameHit(GS.target, false)
      }
    }
    if (gone.length) balloons = balloons.filter((b) => !gone.includes(b.id))
    if (now >= spawnAt) {
      spawnAt = now + Math.max(640, 1150 - Math.min(GS.combo, 8) * 55)
      if (balloons.length < 6) spawn()
    }
    raf = requestAnimationFrame(tick)
  }

  /* 舞台上始终保底一个目标球（孩子听过音就一定有得拍） */
  function targetOnStage(): boolean {
    return balloons.some((b) => !b.popped && !b.wrong && b.k === GS.target)
  }

  function spawn(forceTarget = false) {
    const k = forceTarget || (GS.target && !targetOnStage()) || Math.random() < 0.4 ? GS.target : pickGameTarget(pool, [])
    balloons.push({ id: ++uid, k, x: 7 + Math.random() * 72, y: 1.06, hue: HUES[uid % HUES.length], popped: false, wrong: false })
  }

  function pop(b: Balloon) {
    if (!playing || b.popped || b.wrong) return
    if (b.k === GS.target) {
      b.popped = true
      gameHit(GS.target, true)
      setTimeout(() => { balloons = balloons.filter((x) => x.id !== b.id) }, 320)
      askTarget(pickGameTarget(pool, [GS.target]))
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

  @media (prefers-reduced-motion: reduce) {
    .balloon.popped { animation-duration: .01s; }
  }
</style>
