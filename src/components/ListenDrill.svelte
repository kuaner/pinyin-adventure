<script lang="ts">
  /* ✍️ 听写专练（v4.2 练习馆，Bug#35 上半）：听音选字母无限刷（听→形），二选一
     （干扰项=混淆搭档——b↔d、n↔l…与闪电 blisten 同构）。出题自动读音（v4.1 声音先行制
     同样适用），🔊=重听。"只练弱项"开关=错误账本 err>0 的字母池（pinyin_game_v1 加权抽样
     ledgerPick：错多/久未练更高频）。答题双记账：GD recordLetter（游戏账本）+ markResult
     L: 权重（自适应出题层）。零错误信息：答错只高亮正确项+其读音不自动重播 */
  import { untrack } from 'svelte'
  import { GD, recordLetter } from '../stores/game.svelte'
  import { learnedLetters, ledgerPick, gameDistractor } from '../lib/gameEngine'
  import { markResult } from '../stores/weights.svelte'
  import { show } from '../stores/ui.svelte'
  import { playAudio, letterAudio, stopAll, sndOk, sndNo } from '../lib/audio'
  import { openQuestion, judgeHold, answerOpen } from '../lib/inputGuard'
  import Speak from './Speak.svelte'
  import Icon from './Icon.svelte'

  const pool = learnedLetters()

  let n = $state(0)
  let okN = $state(0)
  let streak = $state(0)
  let best = $state(0)
  let weakOnly = $state(false)
  let a = $state('')
  let opts = $state<[string, string]>(['', ''])
  let ansIdx = $state(0)
  let armed = $state(-1)   /* v4.2c Bug#37 两段式试听 */
  let reveal = $state<{ correct: number; wrong: number[] } | null>(null)
  let tid: ReturnType<typeof setTimeout> | null = null

  function weakPool(): string[] {
    return pool.filter((k) => (GD.letters[k]?.err || 0) > 0)
  }

  function next() {
    /* untrack：出题读 GD 账本/weakOnly 不得订阅进挂载 effect——答题 recordLetter 写账本
       会重触发出题效果（双跳题+音题错位，Svelte 5 游戏效果老坑） */
    untrack(() => {
      const weak = weakPool()
      const use = weakOnly && weak.length ? weak : pool
      a = ledgerPick(use, Math.random)
      const b = gameDistractor(a, pool)
      opts = Math.random() < 0.5 ? [a, b] : [b, a]
      ansIdx = opts.indexOf(a)
      armed = -1
      reveal = null
      openQuestion()              /* P1-2 进题宽限 */
      stopAll()
      playAudio(letterAudio(a))   /* 出题自动读音（失败/静音静默） */
    })
  }

  function replay() {
    if (a) playAudio(letterAudio(a))
  }

  /* v4.5 两段式适用矩阵（Bug#38）：听写选项=已学单字母（视觉即身份）→ 一点即答 */
  function arm(idx: number) {
    if (reveal || !a || !answerOpen()) return
    answer(idx)
  }

  function answer(idx: number) {
    if (reveal || !a) return
    judgeHold()
    armed = -1
    const good = idx === ansIdx
    reveal = { correct: ansIdx, wrong: good ? [] : [idx] }
    recordLetter(a, good)
    markResult('L:' + a, good)
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
    tid = setTimeout(() => { if (alive) next() }, good ? 480 : 1150)
  }

  function toggleWeak() {
    weakOnly = !weakOnly
  }

  let alive = true
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

<section id="v-ldrill" class="view on" data-screen="ldrill">
  <div class="ltop">
    <button class="cbtn" data-back="ldrillquit" onclick={() => show('practice')} aria-label="exit"><Icon name="close" size={20} /></button>
    <div class="ltt"><Speak k="drillListen" /></div>
    <div class="lprog" data-answered={n}><Speak k="hudAnswered" plain />{n}</div>
  </div>
  <div class="dhud">
    <span data-acc><Speak k="hudAcc" plain />{n ? Math.round(okN * 100 / n) + '%' : '--'}</span>
    <span class="hspacer"></span>
    <span data-streak class:hot={streak >= 5}><Icon name="flame" size={18} /> {streak}</span>
  </div>

  {#key a}<!-- v4.5 Bug#38：切题滑入过渡（题目键重挂触发） -->
  <div class="qcard qslide" data-q data-target={a} data-reveal={reveal ? '1' : '0'}>
    <button class="bigsound" data-listen onclick={replay}><Icon name="headphones" size={44} /><span class="bslabel"><Speak k="listenAgain" plain /></span></button>
    <div class="optrow" data-opts>
      {#each opts as k, idx}
        <button class="opt" class:armed={armed === idx} class:correct={reveal && idx === reveal.correct} class:wrong={reveal && reveal.wrong.includes(idx)}
          data-opt={k} data-idx={idx} onclick={() => arm(idx)}>
          <div class="og">{k}</div>
        </button>
      {/each}
    </div>
  </div>
  {/key}

  <button class="weaktoggle pressable" data-weaktoggle class:on={weakOnly} onclick={toggleWeak}
    aria-pressed={weakOnly}>
    <span class="wtk"><Icon name="flame" size={18} /> <Speak k="weakOnly" /></span>
    <span class="wball" data-weakball></span>
  </button>
  {#if weakOnly}
    <div class="weaknote" data-weaknote><Speak k={weakPool().length ? 'weakOnlyOn' : 'weakEmpty'} /></div>
  {/if}
</section>

<style>
  #v-ldrill { padding: calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-3); }
  .ltop { display: flex; align-items: center; gap: var(--sp-2); height: 44px; flex: none; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
  .ltt { flex: 1; text-align: center; font-size: var(--fs-md); font-weight: 900; white-space: nowrap; }
  .lprog { font-size: var(--fs-xs); font-weight: 900; color: var(--animal-primary-active); background: var(--animal-primary-bg);
    padding: var(--sp-2) var(--sp-3); border-radius: 999px; white-space: nowrap; }
  .dhud { flex: none; display: flex; align-items: center; gap: var(--sp-2); margin-top: var(--sp-1);
    background: #fff; border-radius: 999px; padding: 6px var(--sp-3); box-shadow: var(--animal-shadow-sm);
    font-size: var(--fs-sm); font-weight: 900; color: var(--animal-text-2); }
  .hspacer { flex: 1; }
  [data-streak] { display: inline-flex; align-items: center; gap: 3px; color: var(--animal-text-2); }
  [data-streak].hot { color: #e76f51; }

  .qcard { flex: 1 1 0; min-height: 0; margin-top: var(--sp-2); background: #fff; border-radius: var(--animal-r-lg);
    box-shadow: var(--animal-shadow); display: flex; flex-direction: column; align-items: center;
    justify-content: space-evenly; padding: var(--sp-3); gap: var(--sp-2); }
  .bslabel { font-size: var(--fs-xs); font-weight: 800; color: var(--animal-text-2); white-space: nowrap; }
  .bslabel :global(rt) { font-size: var(--fs-rt); }
  .optrow { display: flex; gap: var(--sp-3); width: 100%; justify-content: center; }
  .opt { flex: 1; max-width: 150px; min-height: 96px; border: 3px solid var(--animal-border-light); border-radius: var(--animal-r-lg);
    background: var(--animal-bg); cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center;
    box-shadow: var(--animal-shadow-sm); padding: var(--sp-2); }
  .opt:active { transform: translateY(2px); box-shadow: none; }
  .opt.armed { border-color: #6c86e8; background: #eef1ff; box-shadow: 0 4px 0 #c3cdf5; }
  .opt .og { font-size: var(--fs-hero); font-weight: 900; color: var(--animal-text); line-height: 1.2; }
  .opt.correct { border-color: var(--animal-success); background: #e8f5e8; }
  .opt.wrong { border-color: var(--animal-error); background: #fdeeee; animation: dshake .4s; }
  @keyframes dshake { 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }

  .weaktoggle { flex: none; margin-top: var(--sp-2); min-height: 48px; border: 2px solid var(--animal-border-light);
    border-radius: 999px; background: #fff; font-family: inherit; cursor: pointer; display: flex; align-items: center;
    justify-content: space-between; gap: var(--sp-3); padding: 4px var(--sp-2) 4px var(--sp-4); width: 100%;
    box-shadow: 0 2px 0 var(--animal-border-light); }
  .weaktoggle.on { border-color: #e9b64f; background: #fff3d6; }
  .wtk { display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-sm); font-weight: 900;
    color: var(--animal-text); white-space: nowrap; }
  .wtk :global(rt) { font-size: var(--fs-rt); }
  .wball { width: 34px; height: 34px; border-radius: 50%; background: #e3ded2; flex: none;
    box-shadow: inset 0 2px 2px rgba(61, 52, 40, .15); transition: background .15s; position: relative; }
  .weaktoggle.on .wball { background: #f5c31c; }
  .weaktoggle.on .wball::after { content: ''; position: absolute; left: 12px; top: 8px; width: 8px; height: 14px;
    border: solid #7a5b00; border-width: 0 3px 3px 0; transform: rotate(42deg); }
  .weaknote { flex: none; text-align: center; font-size: var(--fs-xs); font-weight: 700; color: var(--animal-text-2);
    line-height: 1.7; white-space: nowrap; }
  .weaknote :global(rt) { font-size: var(--fs-rt); }

  @media (prefers-reduced-motion: reduce) {
    .opt.wrong { animation-duration: .01s; }
  }
</style>
