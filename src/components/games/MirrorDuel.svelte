<script lang="ts">
  /* ⚔️ 镜像大对决：b/d/p/q 快问快答拔河——答对推绳、答错被推，绳过中线判负。
     出题加权错误账本（弱项字母高频重现）；听写+口诀正向回忆混出（零错误信息：选项全为正确形态）。
     敌方定时拉绳制造时间压力；推绳过敌方线=提前胜利；rAF/interval unmount 全清 */
  import { GS, gameHit, endGame } from '../../stores/game.svelte'
  import { learnedLetters, duelQ } from '../../lib/gameEngine'
  import { playAudio, letterAudio } from '../../lib/audio'
  import { stageOf, G } from '../../stores/growth.svelte'
  import { untrack } from 'svelte'
  import Icon from '../Icon.svelte'
  import Speak from '../Speak.svelte'
  import ChickGrowth from '../growth/ChickGrowth.svelte'

  interface DQ { A: string; opts: string[]; ans: number; kj: boolean; stmt: string }
  let q = $state<DQ | null>(null)
  let pos = $state(50)          /* 绳结位置 0(我方线)~100(敌方线)，50=中线 */
  let reveal = $state(false)
  let nextTid: ReturnType<typeof setTimeout> | null = null
  let pullTid: ReturnType<typeof setInterval> | null = null
  const pool = learnedLetters().filter((k) => k.length === 1)
  const playing = $derived(GS.phase === 'play')
  const knotLeft = $derived(8 + (pos / 100) * 84)
  const myStage = $derived(stageOf(G.stars))

  $effect(() => {
    /* 依赖仅 phase + epoch；开局重置/出题（读 GD 账本）untrack——答题写账本不得重置绳子 */
    if (!playing) return
    const e = GS.epoch
    untrack(() => {
      pos = 50
      newQ()
    })
    /* 敌方拉绳：每 1.6s 拉一格（连击越高压力略增） */
    pullTid = setInterval(() => {
      if (GS.phase !== 'play') return
      pos = Math.max(0, pos - (1.4 + Math.min(GS.combo, 6) * 0.12))
      checkEnd()
    }, 1600)
    return () => {
      if (nextTid) { clearTimeout(nextTid); nextTid = null }
      if (pullTid) { clearInterval(pullTid); pullTid = null }
      void e
    }
  })

  function newQ() {
    reveal = false
    if (pool.length >= 2) q = duelQ(pool)
    else q = null
  }

  function checkEnd() {
    if (GS.phase !== 'play') return
    if (pos <= 6) endGame(-1)
    else if (pos >= 94) endGame(1)
  }

  function answer(idx: number) {
    if (!playing || !q || reveal) return
    const ok = idx === q.ans
    reveal = true
    gameHit(q.A, ok)
    if (ok) {
      pos = Math.min(100, pos + 7 + Math.min(GS.combo, 5))
      nextTid = setTimeout(() => { if (GS.phase === 'play') { checkEnd(); if (GS.phase === 'play') newQ() } }, 320)
    } else {
      pos = Math.max(0, pos - 9)
      nextTid = setTimeout(() => { if (GS.phase === 'play') { checkEnd(); if (GS.phase === 'play') newQ() } }, 1050)
    }
  }

  function hear() { if (q) playAudio(letterAudio(q.A), { hint: '' }) }
</script>

<div class="fill" id="v-duel">
  <div class="arena">
    <div class="enemy" data-enemy><Icon name="dog" size={44} /></div>
    <div class="track">
      <div class="post me"><ChickGrowth stage={myStage} cheer /></div>
      <div class="ropebox">
        <div class="rope"></div>
        <div class="midline"></div>
        <div class="goalline l"></div>
        <div class="goalline r"></div>
        <div class="knot" data-rope style="left:{knotLeft}%"><Icon name="flag" size={26} /></div>
      </div>
      <div class="post foe"></div>
    </div>
  </div>

  {#if q}
    <div class="qwrap" data-q data-target={q.A}>
      {#if q.kj}
        <div class="kjline">「<Speak text={q.stmt} />」</div>
      {:else}
        <button class="bigsound" data-listen onclick={hear}>
          <Icon name="headphones" size={44} />
          <span class="bslabel"><Speak k="listenAgain" plain /></span>
        </button>
      {/if}
      <div class="opts" data-opts>
        {#each q.opts as k, idx (idx)}
          <button class="duelopt" class:correct={reveal && idx === q!.ans} class:wrong={reveal && idx !== q!.ans}
            data-letter={k} data-qkey={q.ans === idx ? k : ''} onpointerdown={() => answer(idx)}>
            <span class="dg">{k}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .fill { position: absolute; inset: 0; display: flex; flex-direction: column; touch-action: none;
    background: linear-gradient(180deg, #fff8e0, #fdeee7); padding: var(--sp-2); gap: var(--sp-2); }
  .arena { flex: none; }
  .enemy { position: absolute; right: 4%; top: 0; transform: scaleX(-1); }
  .track { position: relative; height: 84px; display: flex; align-items: center; gap: var(--sp-1); margin-top: var(--sp-2); }
  .post.me { width: 56px; height: 56px; flex: none; }
  .post.foe { width: 44px; height: 44px; flex: none; border-radius: 50%; background: #d9c8b4; border: 3px solid #b59a7c; }
  .ropebox { position: relative; flex: 1 1 0; height: 64px; }
  .rope { position: absolute; left: 0; right: 0; top: 30px; height: 7px; border-radius: 4px;
    background: repeating-linear-gradient(90deg, #c99b6a 0 12px, #b5834f 12px 24px); }
  .midline { position: absolute; left: 50%; top: 4px; bottom: 4px; width: 0;
    border-left: 3px dashed rgba(231, 111, 81, .55); }
  .goalline { position: absolute; top: 0; bottom: 0; width: 5px; border-radius: 3px; }
  .goalline.l { left: 8%; background: rgba(42, 157, 143, .4); }
  .goalline.r { right: 8%; background: rgba(231, 111, 81, .4); }
  .knot { position: absolute; top: 50%; transform: translate(-50%, -50%); transition: left .3s ease-out;
    background: #fff; border-radius: 50%; padding: 4px; box-shadow: 0 2px 0 #e3d9c8; }

  .qwrap { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: var(--sp-4); }
  .kjline { font-size: var(--fs-lg); font-weight: 900; color: var(--animal-text); text-align: center;
    line-height: 2; max-width: 92%; }
  .kjline :global(rt) { font-size: var(--fs-rt); }
  .bslabel { font-size: var(--fs-sm); font-weight: 900; color: var(--animal-primary-active); white-space: nowrap; }
  .opts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); width: min(100%, 360px); }
  .duelopt { min-height: 96px; border: 3px solid var(--animal-border-light); border-radius: 20px; background: #fff;
    font-family: inherit; cursor: pointer; box-shadow: 0 4px 0 var(--edge-cream); -webkit-tap-highlight-color: transparent; }
  .duelopt:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--edge-cream); }
  .duelopt .dg { font-size: 56px; font-weight: 800; color: var(--animal-text); line-height: 1.2; }
  .duelopt.correct { border-color: var(--animal-success); background: #eef8e2; box-shadow: 0 4px 0 #bfe0a2; }
  .duelopt.wrong { border-color: var(--animal-error); background: #fdecec; }
</style>
