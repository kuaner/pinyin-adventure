<script lang="ts">
  /* ✍️ 声调专练（v4.3 练习馆，Bug#35 下半）：两种题型混编高密度刷题——
     ① 听音选声调符号（播 má → 选 ˉ/´/ˇ/`，出题自动读音=声音先行制）
     ② 同调归类（看音节大字 → 归入第几声，看题不播=播了报答案）
     无限刷+连击+结算（结束按钮出结算卡）；条目账本加权（itemWeight，听错的调多出）。
     四声符号几何走 lib/toneMarks（与课内听调题同一套图形）。零错误信息：选项全为四个调类本体 */
  import { untrack } from 'svelte'
  import { GD, recordItem } from '../stores/game.svelte'
  import { learnedToneRows, pickWeighted, itemWeight, type ToneRow } from '../lib/gameEngine'
  import { TONE_MARKS, TONE_COLORS } from '../lib/toneMarks'
  import { show } from '../stores/ui.svelte'
  import { playAudio, stopAll, sndOk, sndNo } from '../lib/audio'
  import { tRaw } from '../text/strings'
  import Speak from './Speak.svelte'
  import Icon from './Icon.svelte'

  type QType = 'l2t' | 'cls'
  interface TItem { base: string; display: string; file: string; t: number; row: ToneRow }
  const flat: TItem[] = learnedToneRows().flatMap((r) => r.tones.map((x) => ({ base: r.base, display: x.display, file: x.file, t: x.t, row: r })))
  const MARK_NAMES = TONE_MARKS.map((m) => tRaw('toneName' + m.t))

  let n = $state(0)
  let okN = $state(0)
  let streak = $state(0)
  let best = $state(0)
  let qtype = $state<QType>('l2t')
  let a = $state<TItem | null>(null)
  let ansIdx = $state(0)
  let armed = $state(-1)   /* v4.2c Bug#37 两段式试听 */
  let reveal = $state<{ correct: number; wrong: number[] } | null>(null)
  let done = $state(false)
  let tid: ReturnType<typeof setTimeout> | null = null
  let alive = true

  function next() {
    /* untrack：出题读 GD.items 账本不得订阅进挂载 effect（答题写账本重触发出题的老坑） */
    untrack(() => {
      qtype = Math.random() < 0.5 ? 'l2t' : 'cls'   /* 两型混编交错 */
      const it = pickWeighted(flat, (x) => itemWeight(x.file), Math.random)
      a = it
      ansIdx = it.t - 1                 /* 选项固定=四个调类本体（ˉ´ˇ`），答案位=调号-1 */
      armed = -1
      reveal = null
      if (qtype === 'l2t') {
        stopAll()
        playAudio(it.file)              /* 出题自动读音（听音题专属） */
      }
    })
  }

  function replay() {
    if (a && qtype === 'l2t') playAudio(a.file)
  }

  /* v4.2c Bug#37 两段式试听：首点=播当前音节该调的读音（孩子对比听到的调）→ 再点同项=作答 */
  function arm(idx: number) {
    if (armed === idx) { answer(idx); return }
    if (reveal || !a) return
    const toneFile = a.row.tones.find((x) => x.t === idx + 1)
    armed = idx
    if (toneFile) playAudio(toneFile.file)
  }

  function answer(idx: number) {
    if (reveal || !a) return
    armed = -1
    const good = idx === ansIdx
    reveal = { correct: ansIdx, wrong: good ? [] : [idx] }
    recordItem(a.file, good)            /* 条目账本：听错的调下次多出 */
    n++
    if (good) {
      okN++
      streak++
      if (streak > best) best = streak
      sndOk()
    } else {
      streak = 0
      sndNo()
    }
    tid = setTimeout(() => { if (alive) next() }, good ? 520 : 1200)
  }

  function finish() {
    if (tid) { clearTimeout(tid); tid = null }
    stopAll()
    done = true
  }

  function again() {
    n = 0; okN = 0; streak = 0; best = 0; done = false
    next()
  }

  $effect(() => {
    alive = true
    next()
    return () => {
      alive = false
      if (tid) { clearTimeout(tid); tid = null }
      stopAll()
    }
  })
</script>

<section id="v-tquiz" class="view on" data-screen="tonequiz">
  <div class="ltop">
    <button class="cbtn" data-back="tquizquit" onclick={() => show('practice')} aria-label="exit"><Icon name="close" size={20} /></button>
    <div class="ltt"><Speak k="hallTone" /></div>
    <button class="fbtn pressable" data-finish onclick={finish}><Speak k="finishRun" plain /></button>
  </div>
  <div class="dhud">
    <span data-answered={n}><Speak k="hudAnswered" plain />{n}</span>
    <span data-acc><Speak k="hudAcc" plain />{n ? Math.round(okN * 100 / n) + '%' : '--'}</span>
    <span class="hspacer"></span>
    <span data-streak class:hot={streak >= 5}><Icon name="flame" size={18} /> {streak}</span>
  </div>

  <div class="qcard" data-q data-target={a ? a.file : ''} data-qtype={qtype} data-ans={ansIdx} data-reveal={reveal ? '1' : '0'}>
    {#if qtype === 'l2t'}
      <button class="bigsound" data-listen onclick={replay}><Icon name="headphones" size={44} /><span class="bslabel"><Speak k="listenAgain" plain /></span></button>
      <div class="qtip"><Speak k="whichTone" /></div>
    {:else}
      <div class="sylshow" data-syl>{a ? a.display : ''}</div>
      <div class="qtip"><Speak k="seeWhichTone" /></div>
    {/if}
    <div class="topts" data-opts>
      {#each TONE_MARKS as m, idx}
        <button class="topt" class:armed={armed === idx} class:correct={reveal && idx === reveal.correct} class:wrong={reveal && reveal.wrong.includes(idx)}
          data-toneopt={idx + 1} onclick={() => arm(idx)}>
          <svg viewBox="0 0 56 30"><path d={m.d} stroke={TONE_COLORS[idx]} stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg>
          <span>{MARK_NAMES[idx]}</span>
        </button>
      {/each}
    </div>
  </div>

  {#if done}
    <div class="reslay" data-done="1">
      <div class="rcard">
        <div class="rtitle"><Speak k="runDone" /></div>
        <div class="rstats">
          <div class="rstat"><div class="rv" data-rn>{n}</div><div class="rk"><Speak k="runN" /></div></div>
          <div class="rstat"><div class="rv" data-racc>{n ? Math.round(okN * 100 / n) : 0}%</div><div class="rk"><Speak k="hudAcc" plain /></div></div>
          <div class="rstat"><div class="rv" data-rstreak>{best}</div><div class="rk"><Speak k="maxCombo" /></div></div>
        </div>
      </div>
      <div class="rbtns">
        <button class="btn teal" data-again onclick={again}><Icon name="refresh" size={22} /> <Speak k="runAgain" plain /></button>
        <button class="btn ghost" data-home onclick={() => show('practice')}><Speak k="backHall" plain /></button>
      </div>
    </div>
  {/if}
</section>

<style>
  #v-tquiz { padding: calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-3); position: relative; }
  .ltop { display: flex; align-items: center; gap: var(--sp-2); height: 44px; flex: none; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
  .ltt { flex: 1; text-align: center; font-size: var(--fs-md); font-weight: 900; white-space: nowrap; }
  .fbtn { min-height: 44px; border: 2px solid var(--animal-border-light); border-radius: 999px; background: #fff;
    font-family: inherit; font-size: var(--fs-xs); font-weight: 900; color: var(--animal-text-2);
    padding: 0 var(--sp-3); cursor: pointer; white-space: nowrap; box-shadow: 0 2px 0 var(--animal-border-light); }
  .fbtn :global(rt) { font-size: var(--fs-rt); }
  .dhud { flex: none; display: flex; align-items: center; gap: var(--sp-2); margin-top: var(--sp-1);
    background: #fff; border-radius: 999px; padding: 6px var(--sp-3); box-shadow: var(--animal-shadow-sm);
    font-size: var(--fs-sm); font-weight: 900; color: var(--animal-text-2); white-space: nowrap; }
  .hspacer { flex: 1; }
  [data-streak] { display: inline-flex; align-items: center; gap: 3px; color: var(--animal-text-2); }
  [data-streak].hot { color: #e76f51; }

  .qcard { flex: 1 1 0; min-height: 0; margin-top: var(--sp-2); background: #fff; border-radius: var(--animal-r-lg);
    box-shadow: var(--animal-shadow); display: flex; flex-direction: column; align-items: center;
    justify-content: space-evenly; padding: var(--sp-3); gap: var(--sp-2); }
  .qtip { font-size: var(--fs-md); font-weight: 900; color: var(--animal-text); white-space: nowrap; }
  .qtip :global(rt) { font-size: var(--fs-rt); }
  .bslabel { font-size: var(--fs-xs); font-weight: 800; color: var(--animal-text-2); white-space: nowrap; }
  .bslabel :global(rt) { font-size: var(--fs-rt); }
  .sylshow { min-height: 96px; display: flex; align-items: center; justify-content: center;
    font-size: 68px; font-weight: 900; color: var(--animal-text); line-height: 1.2; }
  .topts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); width: 100%; }
  .topt { min-height: 78px; border: 3px solid var(--animal-border-light); border-radius: var(--animal-r-lg);
    background: var(--animal-bg); cursor: pointer; font-family: inherit; display: flex; align-items: center;
    justify-content: center; gap: var(--sp-2); box-shadow: var(--animal-shadow-sm); }
  .topt:active { transform: translateY(2px); box-shadow: none; }
  .topt.armed { border-color: #6c86e8; background: #eef1ff; box-shadow: 0 4px 0 #c3cdf5; }
  .topt svg { width: 46px; height: 26px; flex: none; }
  .topt span { font-size: var(--fs-md); font-weight: 800; color: var(--animal-text); white-space: nowrap; }
  .topt span :global(rt) { font-size: var(--fs-rt); }
  .topt.correct { border-color: var(--animal-success); background: #e8f5e8; }
  .topt.wrong { border-color: var(--animal-error); background: #fdeeee; animation: dshake .4s; }
  @keyframes dshake { 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }

  .reslay { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: var(--sp-4); background: rgba(255, 251, 240, .92); padding: var(--sp-4); }
  .rcard { background: #fff; border-radius: var(--animal-r-lg); box-shadow: var(--animal-shadow-lg);
    border: 2px solid var(--animal-border-light); padding: var(--sp-4) var(--sp-5); text-align: center; width: min(88%, 340px); }
  .rtitle { font-size: var(--fs-lg); font-weight: 900; color: #b07a1f; line-height: 1.8; white-space: nowrap; }
  .rtitle :global(rt) { font-size: var(--fs-rt); }
  .rstats { display: flex; justify-content: center; gap: var(--sp-5); margin-top: var(--sp-2); }
  .rstat .rv { font-size: var(--fs-xl); font-weight: 900; color: var(--animal-text); line-height: 1.5; }
  .rstat .rk { font-size: var(--fs-xs); font-weight: 700; color: var(--animal-text-2); white-space: nowrap; }
  .rstat .rk :global(rt) { font-size: var(--fs-rt); }
  .rbtns { display: flex; flex-direction: column; gap: var(--sp-2); width: min(88%, 340px); }

  @media (prefers-reduced-motion: reduce) {
    .topt.wrong { animation-duration: .01s; }
  }
</style>
