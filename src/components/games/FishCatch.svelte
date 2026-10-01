<script lang="ts">
  /* 🎣 小猫钓鱼：鱼带字母横向游过（双泳道双向），钓"指定读音"的鱼。
     v4.1 声音先行制：目标音自动播，鱼在声音开播 300ms 后才入场（先听再看再动手）；
     漏掉目标/钓错鱼 → miss 清连击，漏掉即换新目标（自动播新音）绝不静默推进；
     🔊=随时重听。rAF 循环 + spawn 计时 phase 退出/unmount 全清 */
  import { GS, askTarget, listenTarget, gameHit } from '../../stores/game.svelte'
  import { learnedLetters, pickGameTarget } from '../../lib/gameEngine'
  import { untrack } from 'svelte'
  import Icon from '../Icon.svelte'
  import Speak from '../Speak.svelte'

  interface Fish { id: number; k: string; x: number; lane: number; dir: 1 | -1; hue: string; caught: boolean; scare: boolean }
  const HUES = ['#2a9d8f', '#889df0', '#f0a35c', '#f4a6a4', '#b58cff', '#7fc8a9']
  const SWIM = 0.16           /* 每秒游过的舞台宽度比例（连对加速） */
  let fish = $state<Fish[]>([])
  let uid = 0
  let raf = 0
  let last = 0
  let spawnAt = 0
  let noSpawnBefore = 0       /* 声音先行闸门：目标音开播 300ms 内不出元素 */
  const pool = learnedLetters()
  const playing = $derived(GS.phase === 'play')

  $effect(() => {
    /* 依赖仅 phase + epoch；实体/账本读写全部 untrack（同 BalloonPop 教训） */
    if (!playing) return
    const e = GS.epoch
    untrack(() => {
      fish = []
      askTarget(pickGameTarget(pool, []))   /* 开局自动播第一轮目标音（声音先行） */
      const t0 = performance.now()
      noSpawnBefore = t0 + 300
      spawnAt = t0 + 300
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
    const speed = SWIM + Math.min(GS.combo, 8) * 0.012
    const gone: number[] = []
    let missedTarget = false
    for (const f of fish) {
      if (f.caught || f.scare) continue
      f.x += speed * dt * 100 * f.dir * (f.id % 2 ? 1.1 : 0.9)
      if (f.x > 118 || f.x < -18) {
        gone.push(f.id)
        if (f.k === GS.target) missedTarget = true
      }
    }
    if (gone.length) fish = fish.filter((f) => !gone.includes(f.id))
    if (missedTarget) {
      /* v4.1：目标鱼游走=miss（清连击记错题）→ 换新目标自动播新音，绝不静默推进 */
      gameHit(GS.target, false)
      askTarget(pickGameTarget(pool, [GS.target]))
      purgeStale(GS.target)
      noSpawnBefore = performance.now() + 300
    }
    if (now >= spawnAt && now >= noSpawnBefore) {
      spawnAt = now + Math.max(750, 1250 - Math.min(GS.combo, 8) * 55)
      if (fish.length < 5) spawn()
    }
    raf = requestAnimationFrame(tick)
  }

  /* 水里始终保底一条目标鱼（听过音就一定有得钓） */
  function targetInPond(): boolean {
    return fish.some((f) => !f.caught && !f.scare && f.k === GS.target)
  }

  function spawn(forceTarget = false) {
    const dir: 1 | -1 = uid % 2 ? 1 : -1
    const k = forceTarget || (GS.target && !targetInPond()) || Math.random() < 0.4 ? GS.target : pickGameTarget(pool, [])
    fish.push({
      id: ++uid, k, lane: uid % 2, dir,
      x: dir === 1 ? -14 : 114,
      hue: HUES[uid % HUES.length], caught: false, scare: false,
    })
  }

  /* v4.1 声音先行：换目标后清掉与新目标同字母的在场鱼（陈旧干扰鱼）——
     保证新目标鱼必在新声音开播 300ms 后才入场 */
  function purgeStale(k: string) {
    fish = fish.filter((f) => f.caught || f.scare || f.k !== k)
  }

  function hook(f: Fish) {
    if (!playing || f.caught || f.scare) return
    if (f.k === GS.target) {
      f.caught = true
      gameHit(GS.target, true)
      setTimeout(() => { fish = fish.filter((x) => x.id !== f.id) }, 450)
      askTarget(pickGameTarget(pool, [GS.target]))   /* 换目标自动播新音 */
      purgeStale(GS.target)
      noSpawnBefore = performance.now() + 300        /* 新目标鱼等声音开播 300ms 后才入场 */
    } else {
      f.scare = true
      gameHit(f.k, false)
      setTimeout(() => { fish = fish.filter((x) => x.id !== f.id) }, 800)
    }
  }
</script>

<div class="fill" id="v-fish">
  <div class="prompt" data-prompt data-target={GS.target}>
    <button class="bigsound small" class:live={GS.listened} data-listen onclick={listenTarget}>
      <Icon name="headphones" size={34} />
    </button>
    <div class="ptip"><Speak k="listenThenAct" plain={GS.listened} /></div>
    <div class="cat"><Icon name="cat" size={34} /></div>
  </div>
  <div class="pond">
    {#each fish as f (f.id)}
      <button
        class="fishwrap"
        class:caught={f.caught}
        class:scare={f.scare}
        data-letter={f.k}
        style="left:{f.x}%; top:{18 + f.lane * 40}%; --hue:{f.hue}; --flip:{f.dir === 1 ? -1 : 1}; --lx:{f.dir === 1 ? 36 : 2}px"
        onpointerdown={() => hook(f)}
        aria-label="fish"
      >
        <svg viewBox="0 0 88 52">
          <path d="M8 26 C 12 12 32 6 46 12 C 60 18 60 34 46 40 C 32 46 12 40 8 26 Z" fill="var(--hue)" />
          <path d="M62 26 L 82 12 L 82 40 Z" fill="var(--hue)" />
          <path d="M62 26 L 78 18 L 78 34 Z" fill="rgba(255,255,255,.35)" />
          <circle cx="20" cy="23" r="3.4" fill="#fff" />
          <circle cx="20" cy="23" r="1.6" fill="#3d3428" />
          <path d="M12 30 Q 16 33 20 31" stroke="rgba(61,52,40,.4)" stroke-width="1.6" fill="none" />
        </svg>
        <span class="fk">{f.k}</span>
      </button>
    {/each}
    <div class="wave w1"></div>
    <div class="wave w2"></div>
  </div>
</div>

<style>
  .fill { position: absolute; inset: 0; display: flex; flex-direction: column; touch-action: none; }
  .prompt { flex: none; display: flex; align-items: center; justify-content: center; gap: var(--sp-3);
    padding: var(--sp-2) 0 0; min-height: 64px; }
  .ptip { font-size: var(--fs-xs); font-weight: 700; color: var(--animal-text-2); white-space: nowrap; }
  .bigsound.live { border-color: #7fc8a9; background: #eaf9f0; }
  .cat { position: absolute; right: 6%; top: 4px; transform: scaleX(-1); opacity: .9; }
  .pond { position: relative; flex: 1 1 0; min-height: 0; overflow: hidden;
    background: linear-gradient(180deg, #d8f2fb, #bfe6f5 55%, #a8d9ee); }
  .wave { position: absolute; left: 0; right: 0; height: 5px; border-radius: 3px; background: rgba(255, 255, 255, .5); }
  .wave.w1 { top: 38%; }
  .wave.w2 { top: 78%; }
  .fishwrap { position: absolute; width: 88px; height: 52px; margin: -26px 0 0 -44px; border: none; background: none;
    padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .fishwrap svg { width: 100%; display: block; transform: scaleX(var(--flip)); filter: drop-shadow(0 2px 1px rgba(30, 80, 100, .18)); }
  .fishwrap .fk { position: absolute; left: var(--lx, 2px); top: 8px; width: 50px; text-align: center; font-size: 26px; font-weight: 900;
    color: #fff; text-shadow: 0 2px 0 rgba(30, 80, 100, .3); line-height: 1.3; }
  .fishwrap.caught { transition: transform .45s ease-out, opacity .45s; transform: translateY(-72px) rotate(-14deg); opacity: 0; pointer-events: none; }
  .fishwrap.scare { transition: transform .6s ease-in, opacity .6s; opacity: .3; filter: grayscale(.8); pointer-events: none; }

  @media (prefers-reduced-motion: reduce) {
    .fishwrap.caught, .fishwrap.scare { transition-duration: .01s; }
  }
</style>
