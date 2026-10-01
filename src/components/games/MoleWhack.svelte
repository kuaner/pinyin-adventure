<script lang="ts">
  /* 🔨 打地鼠：地鼠举字母探头（3×3 洞口），打到听到的那只；镜像对当陷阱
     （目标有镜像搭档时搭档必探头）。v4.1 声音先行制：每轮目标音自动播，
     播声 320ms 后地鼠才探头（先听再看再动手）；超时未击=miss 清连击绝不静默推进；
     🔊=随时重听。回合链 setTimeout 全部带会话代数守卫，phase 退出/unmount 全清 */
  import { GS, askTarget, listenTarget, gameHit } from '../../stores/game.svelte'
  import { learnedLetters, pickGameTarget } from '../../lib/gameEngine'
  import Icon from '../Icon.svelte'
  import Speak from '../Speak.svelte'

  interface Mole { hole: number; k: string; up: boolean; hit: boolean; bad: boolean }
  let moles = $state<Mole[]>([])
  let roundTid: ReturnType<typeof setTimeout> | null = null
  const pool = learnedLetters()
  const playing = $derived(GS.phase === 'play')

  $effect(() => {
    if (!playing) return
    moles = []
    const e = GS.epoch
    roundTid = setTimeout(() => { if (GS.epoch === e) round() }, 500)
    return () => { if (roundTid) { clearTimeout(roundTid); roundTid = null } }
  })

  /* 一个回合：目标音自动播（声音先行）→ 320ms 后目标+陷阱（镜像搭档）+干扰鼠探头，限时敲 */
  function round() {
    if (GS.phase !== 'play') return
    const target = pickGameTarget(pool, moles.length ? [GS.target] : [])
    askTarget(target)
    /* 干扰鼠：镜像陷阱必上，其余从池里随机补（有限次——gameDistractor 镜像优先会重复返回搭档，禁无限循环） */
    const want = 2 + Math.floor(Math.random() * 2)
    const decoys: string[] = []
    const mirror = { b: 'd', d: 'b', p: 'q', q: 'p' }[target]
    if (mirror && pool.includes(mirror)) decoys.push(mirror)
    const others = shuffle(pool.filter((x) => x !== target && !decoys.includes(x)))
    while (decoys.length < want && others.length) decoys.push(others.pop()!)
    const holes = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, decoys.length + 1)
    const next: Mole[] = [{ hole: holes[0], k: target, up: false, hit: false, bad: false }]
    decoys.forEach((k, i) => next.push({ hole: holes[i + 1], k, up: false, hit: false, bad: false }))
    moles = next
    const e = GS.epoch
    roundTid = setTimeout(() => {
      if (GS.epoch !== e) return
      for (const m of moles) m.up = true   /* 声音开播 320ms 后才探头——元素挂在声音之后 */
      const upMs = Math.max(950, 1550 - Math.min(GS.combo, 8) * 65)
      roundTid = setTimeout(() => {
        if (GS.epoch !== e) return
        let escaped = false
        for (const m of moles) {
          m.up = false
          if (m.k === target && !m.hit) escaped = true
        }
        if (escaped) gameHit(target, false)   /* v4.1：超时未击=miss（清连击记错题），绝不静默推进 */
        roundTid = setTimeout(() => { if (GS.epoch === e) round() }, 420)
      }, upMs)
    }, 320)
  }

  function whack(m: Mole) {
    if (!playing || !m.up || m.hit || m.bad) return
    if (m.k === GS.target) {
      m.hit = true
      gameHit(GS.target, true)
      if (roundTid) { clearTimeout(roundTid); roundTid = null }
      const e = GS.epoch
      for (const x of moles) x.up = false
      roundTid = setTimeout(() => { if (GS.epoch === e) round() }, 380)
    } else {
      m.bad = true
      gameHit(m.k, false)
    }
  }

  function shuffle<T>(a: T[]): T[] {
    const r = a.slice()
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = r[i]; r[i] = r[j]; r[j] = t
    }
    return r
  }
</script>

<div class="fill" id="v-mole">
  <div class="prompt" data-prompt data-target={GS.target}>
    <button class="bigsound small" class:live={GS.listened} data-listen onclick={listenTarget}>
      <Icon name="headphones" size={34} />
    </button>
    <div class="ptip"><Speak k="listenThenAct" plain={GS.listened} /></div>
  </div>
  <div class="lawn">
    {#each Array(9) as _, h (h)}
      <div class="hole" data-hole={h}>
        <div class="dirt"></div>
        {#if moles.find((m) => m.hole === h)}
          {@const m = moles.find((m) => m.hole === h)!}
          <button
            class="mole"
            class:up={m.up}
            class:hit={m.hit}
            class:bad={m.bad}
            data-letter={m.k}
            onpointerdown={() => whack(m)}
            aria-label="mole"
          >
            <svg viewBox="0 0 72 64">
              <path d="M14 62 C 14 34 20 22 36 22 C 52 22 58 34 58 62 Z" fill="#a97c50" />
              <path d="M20 62 C 20 40 25 30 36 30 C 47 30 52 40 52 62 Z" fill="#c99b6a" />
              <path d="M12 24 C 12 16 22 16 22 24 L22 34 L12 34 Z" fill="#c99b6a" />
              <path d="M60 24 C 60 16 50 16 50 24 L50 34 L60 34 Z" fill="#c99b6a" />
              <circle cx="28" cy="44" r="3" fill="#3d3428" />
              <circle cx="44" cy="44" r="3" fill="#3d3428" />
              <ellipse cx="36" cy="53" rx="4.5" ry="3.4" fill="#e77" />
              <path d="M31 49 Q 36 51 41 49" stroke="#3d3428" stroke-width="1.6" fill="none" />
            </svg>
            <span class="mk">{m.k}</span>
          </button>
        {/if}
        <div class="bush"></div>
      </div>
    {/each}
  </div>
</div>

<style>
  .fill { position: absolute; inset: 0; display: flex; flex-direction: column; touch-action: none;
    background: linear-gradient(180deg, #f0fbf0, #dff3d9); }
  .prompt { flex: none; display: flex; align-items: center; justify-content: center; gap: var(--sp-3);
    padding: var(--sp-2) 0 0; min-height: 64px; }
  .ptip { font-size: var(--fs-xs); font-weight: 700; color: var(--animal-text-2); white-space: nowrap; }
  .bigsound.live { border-color: #7fc8a9; background: #eaf9f0; }
  .lawn { flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr 1fr;
    gap: var(--sp-1); padding: var(--sp-2) var(--sp-2) var(--sp-3); }
  .hole { position: relative; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; }
  .dirt { position: absolute; bottom: 6%; width: 82%; height: 26%; border-radius: 50%; background: #8b5e3c;
    box-shadow: inset 0 -5px 0 rgba(61, 52, 40, .22); }
  .bush { position: absolute; bottom: 20%; width: 96%; height: 14%; border-radius: 50%; background: rgba(111, 186, 44, .35); }
  .mole { position: absolute; bottom: 16%; width: 68%; max-width: 96px; border: none; background: none; padding: 0;
    transform: translateY(105%); transition: transform .22s cubic-bezier(.3, 1.2, .4, 1); cursor: pointer;
    -webkit-tap-highlight-color: transparent; }
  .mole.up { transform: translateY(6%); }
  .mole svg { width: 100%; display: block; filter: drop-shadow(0 2px 1px rgba(61, 52, 40, .18)); }
  .mole .mk { position: absolute; left: 0; right: 0; top: 22%; text-align: center; font-size: 26px; font-weight: 900;
    color: #fff; text-shadow: 0 2px 0 rgba(61, 52, 40, .3); line-height: 1.2; }
  .mole.hit { animation: mbonk .38s ease-out forwards; }
  @keyframes mbonk { 40% { transform: translateY(6%) scale(1.08, .82); } 100% { transform: translateY(105%); } }
  .mole.bad { animation: mshake .4s; filter: grayscale(.6); }

  @media (prefers-reduced-motion: reduce) {
    .mole { transition-duration: .01s; }
    .mole.hit, .mole.bad { animation-duration: .01s; }
  }
</style>
