<script lang="ts">
  /* 🥚 拼音蛋合并（v4.3 游戏岛第 5 摊位，拼读·构造式）：
     蛋分两半——上半声母、下半韵母。听到目标音节（自动播，hyp 拼读合成音）+ 看到目标卡，
     从散落的蛋半里点出声母半+韵母半拼出目标：拼对 → 蛋合并+裂壳+小鸡+得分；
     拼错 → 蛋半晃动不合 + 清连击。题源=已学课 blends（绝不超纲），账本条目级加权（itemWeight）。
     声音先行制（v4.1）：目标音自动播 → 蛋半挂声音开播 300ms 闸门后出现；🔊=重听。
     rAF/timeout 链 unmount 全清；舞台 touch-action:none 由 GameShell 承担 */
  import { untrack } from 'svelte'
  import { GS, askTarget, listenTarget, gameHit, recordLetter, recordItem } from '../../stores/game.svelte'
  import { learnedBlends, pickWeighted, itemWeight, type Blend } from '../../lib/gameEngine'
  import { LETTERS } from '../../data'
  import { sndStar } from '../../lib/audio'
  import Icon from '../Icon.svelte'
  import Speak from '../Speak.svelte'

  interface Half { id: number; kind: 'ini' | 'fin'; k: string; hue: string }
  const HUES = ['#f4a6a4', '#889df0', '#7fc8a9', '#f5c31c', '#b58cff', '#f0a35c']
  const GATE = 320          /* 声音先行闸门：目标音开播 300ms 后蛋半才出现 */
  const pool = learnedBlends()

  let halves = $state<Half[]>([])
  let target = $state<Blend | null>(null)
  let ready = $state(false)          /* 闸门放行前不渲染蛋半 */
  let selI = $state('')              /* 已选中的声母半 */
  let selF = $state('')              /* 已选中的韵母半 */
  let stage = $state<'pick' | 'merge' | 'crack' | 'chick'>('pick')
  let shakeId = $state(0)            /* 拼错晃动的蛋半 id */
  let uid = 0
  let tids: ReturnType<typeof setTimeout>[] = []
  let alive = true

  const playing = $derived(GS.phase === 'play')

  $effect(() => {
    /* 依赖仅 phase+epoch（开局/重玩/退出重建）；题源读取一律 untrack——答题写账本不得重置舞台 */
    alive = true
    if (!playing) return
    const e = GS.epoch
    untrack(() => newRound())
    return () => {
      alive = false
      clearTimers()
      void e
    }
  })

  /* 多槽定时器：合并→裂壳→小鸡→下一轮是串行动画链，单槽互清会吞步（验收实锤过） */
  function later(fn: () => void, ms: number) {
    const e0 = GS.epoch
    tids.push(setTimeout(() => { if (alive && GS.phase === 'play' && GS.epoch === e0) fn() }, ms))
  }
  function clearTimers() {
    for (const t of tids) clearTimeout(t)
    tids = []
  }

  function newRound() {
    clearTimers()
    const b = pickWeighted(pool, (x) => itemWeight(x.syl), Math.random)
    target = b
    halves = []
    ready = false
    selI = ''
    selF = ''
    stage = 'pick'
    shakeId = 0
    askTarget(b.syl, b.file)          /* 自动播拼读合成音（hyp 真人库） */
    later(() => {
      ready = true                    /* 闸门放行：蛋半出现在声音之后 */
      buildHalves(b)
    }, GATE)
  }

  /* 蛋半阵容：目标声母/韵母各 1 + 干扰各 3（全部正确形态——零错误信息铁律）。
     v4.2c 共存立法（Bug#36）：半堆必含错半块（不能只给对的两块）——
     已学池唯一声母/韵母时从全字母表同 cat 借正确形态干扰（gameDistractor 回落同款） */
  function decoyKeys(kind: 'ini' | 'fin', exclude: string, n: number): string[] {
    const src = [...new Set(pool.map((x) => (kind === 'ini' ? x.ini : x.fin)))].filter((k) => k !== exclude)
    if (src.length >= n) return src
    const cat = kind === 'ini' ? 'sm' : 'ym'
    const all = Object.keys(LETTERS).filter((k) => k !== exclude && !src.includes(k) && (LETTERS as any)[k] && (LETTERS as any)[k].cat === cat)
    return src.concat(all.slice(0, n - src.length))
  }

  function buildHalves(b: Blend) {
    const pickI = [b.ini, ...decoyKeys('ini', b.ini, 3)]
    const pickF = [b.fin, ...decoyKeys('fin', b.fin, 3)]
    shuffle(pickI); shuffle(pickF)
    const out: Half[] = []
    for (const k of pickI) out.push({ id: ++uid, kind: 'ini', k, hue: HUES[uid % HUES.length] })
    for (const k of pickF) out.push({ id: ++uid, kind: 'fin', k, hue: HUES[uid % HUES.length] })
    halves = out
  }

  function shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = a[i]; a[i] = a[j]; a[j] = t
    }
    return a
  }

  function tapHalf(h: Half) {
    if (!target || !ready || stage !== 'pick') return
    const good = h.kind === 'ini' ? h.k === target.ini : h.k === target.fin
    if (!good) {
      /* 拼错：蛋半晃动不合 + 清连击（gameHit 内 sndNo），selections 不动——孩子换一片再试 */
      shakeId = h.id
      gameHit(h.k, false)
      later(() => { shakeId = 0 }, 620)
      return
    }
    if (h.kind === 'ini') selI = h.k
    else selF = h.k
    if (selI && selF) success()
  }

  function success() {
    if (!target) return
    stage = 'merge'
    /* 双记账：字母账本记声母+韵母（连击/得分走 gameHit 一次），条目账本记拼读对 */
    gameHit(target.ini, true)
    recordLetter(target.fin, true)
    recordItem(target.syl, true)
    later(() => { stage = 'crack' }, 480)
    later(() => { stage = 'chick'; sndStar() }, 980)
    later(() => newRound(), 1750)
  }
</script>

<div class="fill" id="v-egg" data-stage={stage}>
  <div class="prompt" data-prompt data-target={GS.target} data-afile={GS.afile} data-ini={target ? target.ini : ''} data-fin={target ? target.fin : ''}>
    <button class="bigsound small" class:live={GS.listened} data-listen onclick={listenTarget}>
      <Icon name="headphones" size={34} />
    </button>
    <div class="tcard" data-tcard>{target ? target.display : ''}</div>
  </div>

  <div class="nestzone">
    <!-- 巢窝：空蛋虚影 → 合体蛋 → 裂纹 → 小鸡破壳 -->
    <div class="nest" data-nest data-neststage={stage}>
      {#if stage === 'pick'}
        <svg viewBox="0 0 64 60" class="eggsvg ghost" aria-hidden="true">
          <path d="M32 4 C 15 4 8 18 8 32 C 8 46 19 56 32 56 C 45 56 56 46 56 32 C 56 18 49 4 32 4 Z"
            fill="none" stroke="#d8cfbc" stroke-width="2.5" stroke-dasharray="5 4" />
        </svg>
      {:else}
        <svg viewBox="0 0 64 60" class="eggsvg" class:wob={stage === 'merge'} aria-hidden="true">
          <path d="M32 4 C 15 4 8 18 8 32 C 8 46 19 56 32 56 C 45 56 56 46 56 32 C 56 18 49 4 32 4 Z" fill="#fff3d6" stroke="#e9d8ae" stroke-width="2" />
          <ellipse cx="22" cy="20" rx="5" ry="7" fill="rgba(255,255,255,.6)" />
          {#if stage === 'crack' || stage === 'chick'}
            <path d="M20 26 L27 32 L23 38 L31 42" stroke="#c9a24b" stroke-width="2.2" fill="none" stroke-linecap="round" />
            <path d="M31 42 L28 50 L38 46" stroke="#c9a24b" stroke-width="2.2" fill="none" stroke-linecap="round" />
          {/if}
        </svg>
        {#if stage === 'chick'}
          <svg viewBox="0 0 64 60" class="chick" aria-hidden="true">
            <circle cx="32" cy="34" r="16" fill="#ffd94d" stroke="#e9b64f" stroke-width="2" />
            <circle cx="26" cy="30" r="2.2" fill="#3d3428" />
            <circle cx="38" cy="30" r="2.2" fill="#3d3428" />
            <path d="M29 36 L35 36 L32 40 Z" fill="#f0a35c" />
            <path d="M46 26 C 50 22 54 22 56 24" stroke="#e9b64f" stroke-width="2" fill="none" stroke-linecap="round" />
          </svg>
        {/if}
      {/if}
      {#if stage === 'chick'}<div class="cheer"><Speak k="eggHatched" /></div>{/if}
    </div>
  </div>

  <div class="halves" data-halves data-ready={ready ? '1' : '0'}>
    {#if ready && target}
      <div class="hrow">
        <div class="htag"><Speak k="catSm" plain /></div>
        {#each halves.filter((h) => h.kind === 'ini') as h (h.id)}
          <button class="hhalf ini" class:sel={selI === h.k} class:shake={shakeId === h.id}
            style="--hue:{h.hue}" data-half data-kind={h.kind} data-key={h.k} onclick={() => tapHalf(h)} aria-label="initial">
            <svg viewBox="0 0 64 56" class="hsvg" aria-hidden="true">
              <path d="M36 4 C 19 4 12 17 12 28 C 12 40 23 50 36 50 L36 4 Z" fill="var(--hue)" />
              <ellipse cx="24" cy="18" rx="4" ry="6" fill="rgba(255,255,255,.5)" />
            </svg>
            <span class="hk">{h.k}</span>
          </button>
        {/each}
      </div>
      <div class="hrow">
        <div class="htag"><Speak k="catYm" plain /></div>
        {#each halves.filter((h) => h.kind === 'fin') as h (h.id)}
          <button class="hhalf fin" class:sel={selF === h.k} class:shake={shakeId === h.id}
            style="--hue:{h.hue}" data-half data-kind={h.kind} data-key={h.k} onclick={() => tapHalf(h)} aria-label="final">
            <svg viewBox="0 0 64 56" class="hsvg" aria-hidden="true">
              <path d="M28 4 C 45 4 52 17 52 28 C 52 40 41 50 28 50 L28 4 Z" fill="var(--hue)" />
              <ellipse cx="40" cy="18" rx="4" ry="6" fill="rgba(255,255,255,.5)" />
            </svg>
            <span class="hk">{h.k}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .fill { position: absolute; inset: 0; display: flex; flex-direction: column; touch-action: none; }
  .prompt { flex: none; display: flex; align-items: center; justify-content: center; gap: var(--sp-3);
    padding: var(--sp-2) 0 0; min-height: 64px; }
  /* 指令语由 GameShell ghint 承担——prompt 只放 🔊+目标卡（双份提示语目验打回） */
  .bigsound.live { border-color: #7fc8a9; background: #eaf9f0; }
  .tcard { min-width: 72px; height: 52px; border-radius: 14px; background: #fff; border: 2.5px solid #e9d8ae;
    box-shadow: 0 2px 0 rgba(61, 52, 40, .08); display: flex; align-items: center; justify-content: center;
    font-size: 30px; font-weight: 900; color: var(--animal-text); padding: 0 var(--sp-2); }

  .nestzone { flex: none; display: flex; justify-content: center; padding: var(--sp-1) 0; }
  .nest { position: relative; width: 96px; height: 76px; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(ellipse at 50% 88%, #e8d9b0 42%, transparent 46%); border-radius: 50% 50% 46% 46%; }
  .eggsvg { width: 62px; height: 58px; }
  .eggsvg.ghost { opacity: 1; }
  .eggsvg.ghost path { stroke: #c9b98f; }
  .eggsvg.wob { animation: wob .5s ease; }
  @keyframes wob { 30% { transform: rotate(-6deg) scale(1.06); } 65% { transform: rotate(5deg); } }
  .chick { position: absolute; width: 58px; height: 54px; animation: hatch .5s cubic-bezier(.25, 1.5, .4, 1); }
  @keyframes hatch { from { transform: translateY(14px) scale(.3); } }
  .cheer { position: absolute; top: -6px; left: 50%; transform: translateX(-50%); font-size: var(--fs-xs);
    font-weight: 900; color: #2a9d8f; white-space: nowrap; animation: cheerup 0.75s ease forwards; }
  .cheer :global(rt) { font-size: var(--fs-rt); }
  @keyframes cheerup { 0% { opacity: 0; margin-top: 6px; } 25% { opacity: 1; } 100% { opacity: 0; margin-top: -14px; } }

  .halves { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; justify-content: space-evenly;
    padding: var(--sp-1) var(--sp-2) var(--sp-2); gap: var(--sp-2); }
  .hrow { flex: 1 1 0; min-height: 0; display: flex; align-items: stretch; gap: var(--sp-2); }
  .htag { flex: none; width: 30px; display: flex; align-items: center; justify-content: center;
    font-size: var(--fs-xs); font-weight: 900; color: var(--animal-text-2);
    writing-mode: vertical-rl; letter-spacing: 2px; }
  .htag :global(rt) { font-size: 10px; }
  .hhalf { position: relative; flex: 1 1 0; min-width: 0; border: none; background: none; padding: 0;
    cursor: pointer; -webkit-tap-highlight-color: transparent; display: flex; align-items: center; justify-content: center; }
  .hsvg { position: absolute; inset: 0; width: 100%; height: 100%; filter: drop-shadow(0 3px 2px rgba(61, 52, 40, .12)); }
  .hk { position: relative; z-index: 1; font-size: 26px; font-weight: 900; color: #fff;
    text-shadow: 0 2px 0 rgba(61, 52, 40, .18); }
  .hhalf.fin .hk { color: #4b3f2d; text-shadow: 0 1px 0 rgba(255, 255, 255, .5); }
  .hhalf.sel { transform: translateY(-4px); }
  .hhalf.sel::after { content: ''; position: absolute; inset: 8% 14%; border: 3px solid #2a9d8f; border-radius: 50% 50% 46% 46%; }
  .hhalf.shake { animation: hshake .6s; }
  @keyframes hshake { 20% { transform: translateX(-6px) rotate(-4deg); } 45% { transform: translateX(6px) rotate(4deg); }
    70% { transform: translateX(-4px); } }

  @media (prefers-reduced-motion: reduce) {
    .eggsvg.wob, .chick, .hhalf.shake, .cheer { animation-duration: .01s; }
  }
</style>
