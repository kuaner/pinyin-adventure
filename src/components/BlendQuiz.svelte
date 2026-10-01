<script lang="ts">
  /* ✍️ 拼读专练（v4.3 练习馆，Bug#35 下半）：两种题型混编高密度刷题——
     ① 听合成音选拆分（播 bā → 选 b+a / d+o…，出题自动读音=声音先行制）
     ② 看拆分选读音（显示 b+a → 选 bā/pō…，看题不播=播了报答案，识字表边界同款）
     无限刷+连击+结算（结束按钮出结算卡）；条目账本加权（拼错的对子多出，itemWeight）
     + markResult L: 双记账。零错误信息：答错只高亮正确项，不展示错误配对陈述 */
  import { untrack } from 'svelte'
  import { GD, recordItem } from '../stores/game.svelte'
  import { learnedBlends, pickWeighted, itemWeight, type Blend } from '../lib/gameEngine'
  import { markResult } from '../stores/weights.svelte'
  import { show } from '../stores/ui.svelte'
  import { playAudio, stopAll, sndOk, sndNo } from '../lib/audio'
  import Speak from './Speak.svelte'
  import Icon from './Icon.svelte'

  type QType = 'l2s' | 's2l'
  const pool = learnedBlends()

  let n = $state(0)
  let okN = $state(0)
  let streak = $state(0)
  let best = $state(0)
  let qtype = $state<QType>('l2s')
  let a = $state<Blend | null>(null)
  let opts = $state<string[]>([])
  let ansIdx = $state(0)
  let armed = $state(-1)   /* v4.2c Bug#37 两段式试听 */
  let reveal = $state<{ correct: number; wrong: number[] } | null>(null)
  let done = $state(false)
  let tid: ReturnType<typeof setTimeout> | null = null
  let alive = true

  function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t
    }
    return arr
  }

  const split = (b: Blend) => b.ini + ' + ' + b.fin

  function next() {
    /* untrack：出题读 GD.items 账本不得订阅进挂载 effect——答题 recordItem 写账本会重触发出题（Svelte 5 老坑） */
    untrack(() => {
      qtype = Math.random() < 0.5 ? 'l2s' : 's2l'   /* 两型混编交错 */
      const b = pickWeighted(pool, (x) => itemWeight(x.syl), Math.random)
      a = b
      /* 干扰项全为正确拼读的拆分/读音（零错误信息）：同声母/同韵母优先，拆分串去重 */
      const others = shuffle(pool.filter((x) => x.syl !== b.syl))
      const picks: Blend[] = []
      const sameIni = others.filter((x) => x.ini === b.ini)
      const sameFin = others.filter((x) => x.fin === b.fin)
      const push = (x?: Blend) => {
        if (!x) return
        if (qtype === 'l2s') { if (!picks.some((p) => split(p) === split(x))) picks.push(x) }
        else if (!picks.some((p) => p.display === x.display)) picks.push(x)
      }
      push(sameIni[0]); push(sameFin[0]); push(sameIni[1]); push(sameFin[1])
      for (const x of others) { if (picks.length >= 3) break; push(x) }
      const correct = qtype === 'l2s' ? split(b) : b.display
      const ds = picks.slice(0, 3).map((x) => (qtype === 'l2s' ? split(x) : x.display))
      const all = shuffle([correct, ...ds])
      opts = all
      ansIdx = all.indexOf(correct)
      armed = -1
      reveal = null
      if (qtype === 'l2s') {
        stopAll()
        playAudio(b.file)            /* 出题自动读音（听音题专属） */
      }
    })
  }

  function replay() {
    if (a && qtype === 'l2s') playAudio(a.file)
  }

  /* v4.2c Bug#37 两段式试听：首点=播该选项拼出的音节（hyp，缺失仅高亮）→ 再点同项=作答 */
  function arm(idx: number) {
    if (armed === idx) { answer(idx); return }
    if (reveal || !a) return
    armed = idx
    const o = opts[idx]
    const b = pool.find((x) => (qtype === 'l2s' ? split(x) === o : x.display === o))
    if (b) playAudio(b.file)
  }

  function answer(idx: number) {
    if (reveal || !a) return
    armed = -1
    const good = idx === ansIdx
    reveal = { correct: ansIdx, wrong: good ? [] : [idx] }
    recordItem(a.syl, good)                       /* 条目账本：拼错的对子下次多出 */
    markResult('L:' + a.ini, good)                /* 自适应权重层双记账 */
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

<section id="v-bquiz" class="view on" data-screen="blendquiz">
  <div class="ltop">
    <button class="cbtn" data-back="bquizquit" onclick={() => show('practice')} aria-label="exit"><Icon name="close" size={20} /></button>
    <div class="ltt"><Speak k="hallBlend" /></div>
    <button class="fbtn pressable" data-finish onclick={finish}><Speak k="finishRun" plain /></button>
  </div>
  <div class="dhud">
    <span data-answered={n}><Speak k="hudAnswered" plain />{n}</span>
    <span data-acc><Speak k="hudAcc" plain />{n ? Math.round(okN * 100 / n) + '%' : '--'}</span>
    <span class="hspacer"></span>
    <span data-streak class:hot={streak >= 5}><Icon name="flame" size={18} /> {streak}</span>
  </div>

  <div class="qcard" data-q data-target={a ? a.syl : ''} data-qtype={qtype} data-ans={ansIdx} data-reveal={reveal ? '1' : '0'}>
    {#if qtype === 'l2s'}
      <button class="bigsound" data-listen onclick={replay}><Icon name="headphones" size={44} /><span class="bslabel"><Speak k="listenAgain" plain /></span></button>
      <div class="qtip"><Speak k="whichSplit" /></div>
    {:else}
      <div class="splitshow" data-split>{a ? split(a) : ''}</div>
      <div class="qtip"><Speak k="whichRead" /></div>
    {/if}
    <div class="optgrid" data-opts>
      {#each opts as o, idx}
        <button class="opt" class:armed={armed === idx} class:correct={reveal && idx === reveal.correct} class:wrong={reveal && reveal.wrong.includes(idx)}
          data-opt={o} data-idx={idx} onclick={() => arm(idx)}>
          <span class="og">{o}</span>
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
  #v-bquiz { padding: calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-3); position: relative; }
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
  .splitshow { min-height: 84px; display: flex; align-items: center; justify-content: center;
    font-size: 56px; font-weight: 900; color: var(--animal-text); line-height: 1.2; }
  .optgrid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); width: 100%; }
  .opt { min-height: 72px; border: 3px solid var(--animal-border-light); border-radius: var(--animal-r-lg);
    background: var(--animal-bg); cursor: pointer; font-family: inherit; display: flex; align-items: center;
    justify-content: center; box-shadow: var(--animal-shadow-sm); padding: var(--sp-2); }
  .opt:active { transform: translateY(2px); box-shadow: none; }
  .opt.armed { border-color: #6c86e8; background: #eef1ff; box-shadow: 0 4px 0 #c3cdf5; }
  .opt .og { font-size: 30px; font-weight: 900; color: var(--animal-text); line-height: 1.25; white-space: nowrap; }
  .opt.correct { border-color: var(--animal-success); background: #e8f5e8; }
  .opt.wrong { border-color: var(--animal-error); background: #fdeeee; animation: dshake .4s; }
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
    .opt.wrong { animation-duration: .01s; }
  }
</style>
