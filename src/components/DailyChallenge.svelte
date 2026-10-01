<script lang="ts">
  /* v4.0 每日挑战：10 题智能混编（错误账本加权抽样：弱项字母+镜像对+久未练+识字表看字选拼音），
     连击计分（复用全局连击：x2/x3 倍率+火焰+音阶升调），每日一换（按日期种子）。
     结算=得分+星星+今日最佳（破纪录礼花）；星星入小鸡成长体系 */
  import { DC, dailyAnswer, quitDaily, startDaily, comboMult } from '../stores/game.svelte'
  import { GD } from '../stores/game.svelte'
  import { say } from '../lib/audio'
  import Speak from './Speak.svelte'
  import Icon from './Icon.svelte'

  const q = $derived(DC.qs[DC.i])
  const mult = $derived(comboMult(DC.combo))
  const rec = $derived(GD.daily)
  const acc = $derived(DC.ok * 10)

  function hear() { if (q && q.type !== 'zi') say(q.sound) }
</script>

<section id="v-daily" class="view on" data-screen="daily">
  <div class="ltop">
    <button class="cbtn" data-back="dailyquit" onclick={quitDaily} aria-label="exit"><Icon name="close" size={20} /></button>
    <div class="ltt"><Speak k="dailyTitle" /></div>
    <div class="lprog" id="dprog"><Speak k="dailyQProg" vars={{ n: Math.min(DC.i + 1, 10) }} /></div>
  </div>
  <div class="gamehud">
    <span id="dscore" data-score>{DC.score}</span>
    <span class="hlabel"><Speak k="gameScore" plain /></span>
    <span class="hspacer"></span>
    {#if mult > 1}<span class="gmult" data-mult={mult}><Speak k={mult === 3 ? 'comboMult3' : 'comboMult2'} /></span>{/if}
    <span id="dcombo" class:hot={DC.combo >= 3} data-combo={DC.combo} style="transform:scale({1 + Math.min(DC.combo, 8) * 0.05})">
      <Icon name="flame" size={20} /> {DC.combo}
    </span>
  </div>

  {#if !DC.done && q}
    <div class="qcard" id="dqcard" data-qtype={q.type} data-target={q.type === 'zi' ? '' : q.A}>
      {#key DC.i}
        <div class="qhint">
          {#if q.type === 'blisten'}
            <Speak k="listenChoose" />
          {:else if q.type === 'bkj'}
            <Speak k="fbKjAbout" />
          {:else}
            <Speak k="lookHowRead" />
          {/if}
        </div>
        {#if q.type === 'blisten'}
          <div class="glyphbox">
            <button class="bigsound" data-listen onclick={hear}>
              <Icon name="headphones" size={44} />
              <span class="bslabel"><Speak k="listenAgain" plain /></span>
            </button>
          </div>
          <div class="opts two" data-opts>
            {#each q.opts as k, idx (idx)}
              <button class="opt" class:correct={DC.reveal && idx === DC.reveal.correct} class:wrong={DC.reveal && DC.reveal.wrong.includes(idx)}
                data-letter={k} onclick={() => dailyAnswer(idx)}>
                <div class="og">{k}</div>
              </button>
            {/each}
          </div>
        {:else if q.type === 'bkj'}
          <div class="glyphbox"><div class="kjbig">「<Speak text={q.stmt} />」</div></div>
          <div class="opts two" data-opts>
            {#each q.opts as k, idx (idx)}
              <button class="opt" class:correct={DC.reveal && idx === DC.reveal.correct} class:wrong={DC.reveal && DC.reveal.wrong.includes(idx)}
                data-letter={k} onclick={() => dailyAnswer(idx)}>
                <div class="og">{k}</div>
              </button>
            {/each}
          </div>
        {:else if q.z}
          <div class="glyphbox"><div class="zibig">{q.z.h}</div></div>
          <div class="opts four" data-opts>
            {#each q.opts as p, idx (idx)}
              <button class="opt" class:correct={DC.reveal && idx === DC.reveal.correct} class:wrong={DC.reveal && DC.reveal.wrong.includes(idx)}
                data-letter={p} onclick={() => dailyAnswer(idx)}>
                <div class="og small popt">{p}</div>
              </button>
            {/each}
          </div>
        {/if}
      {/key}
    </div>
  {:else if DC.done}
    <div class="qcard dresult" id="dresult" data-result>
      {#if DC.record}
        {#each Array(10) as _, i (i)}
          <div class="rfire" style="left:{6 + i * 9.5}%; animation-delay:{i * 0.13}s"><Icon name={['star', 'balloon', 'heart', 'flower'][i % 4]} size={30} /></div>
        {/each}
      {/if}
      <div class="rtitle"><Speak k="dailyAllDone" /></div>
      <div class="rscore" id="drscore" data-rscore>{DC.score}</div>
      <div class="rstats">
        <div class="rstat"><div class="rv">{acc}%</div><div class="rk"><Speak k="accLabel" /></div></div>
        <div class="rstat"><div class="rv" id="dcombo2">{DC.maxCombo}</div><div class="rk"><Speak k="maxCombo" /></div></div>
        <div class="rstat"><div class="rv rstars" data-stars={DC.stars}>
          {#each Array(DC.stars) as _, i (i)}<svg viewBox="0 0 24 24" class="rstar"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z" fill="#f5c31c" stroke="#dba90e" stroke-width="1.4" /></svg>{/each}
        </div><div class="rk"><Speak k="starsGot" /></div></div>
      </div>
      <div class="rbest" id="dbest" data-best={rec.best}>
        <Speak k={DC.record ? 'dailyRecord' : 'dailyBestN'} vars={DC.record ? {} : { n: rec.best }} />
      </div>
      <div class="rbtns">
        <button class="btn red" id="dagain" data-again onclick={() => startDaily()}><Icon name="rocket" size={24} /> <Speak k="playAgainGame" plain /></button>
        <button class="btn ghost" id="dhome" data-home onclick={quitDaily}><Speak k="backGameIsland" plain /></button>
      </div>
    </div>
  {/if}
</section>

<style>
  #v-daily { background: linear-gradient(180deg, #fdf7ea, #fbeee0); }
  .ltop { display: flex; align-items: center; gap: var(--sp-2); height: 44px; flex: none; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
  .ltt { flex: 1; text-align: center; font-size: var(--fs-md); font-weight: 900; white-space: nowrap; }
  .lprog { font-size: var(--fs-xs); font-weight: 900; color: var(--animal-primary-active); background: var(--animal-primary-bg);
    padding: var(--sp-2) var(--sp-3); border-radius: 999px; white-space: nowrap; }

  .gamehud { flex: none; display: flex; align-items: center; gap: var(--sp-2); margin-top: var(--sp-1);
    background: #fff; border-radius: 999px; padding: 6px var(--sp-3); box-shadow: var(--animal-shadow-sm); }
  #dscore { font-size: var(--fs-lg); font-weight: 900; color: var(--animal-primary-active); min-width: 44px; line-height: 1.4; }
  .hlabel { font-size: var(--fs-xs); font-weight: 800; color: var(--animal-text-2); white-space: nowrap; }
  .hspacer { flex: 1; }
  .gmult { font-size: var(--fs-xs); font-weight: 900; color: #fff; background: #f5a35c; border-radius: 999px;
    padding: 3px 10px; white-space: nowrap; }
  #dcombo { display: inline-flex; align-items: center; gap: 3px; font-size: var(--fs-md); font-weight: 900;
    color: var(--animal-text-2); min-height: 24px; }
  #dcombo.hot { color: #e76f51; }

  .qcard { flex: 1 1 0; min-height: 0; margin-top: var(--sp-2); display: flex; flex-direction: column; gap: var(--sp-2); }
  .qhint { font-size: var(--fs-lg); font-weight: 800; color: var(--animal-text); text-align: center; line-height: 2; flex: none; }
  .glyphbox { flex: none; display: flex; align-items: center; justify-content: center; min-height: 0; }
  .kjbig { font-size: var(--fs-lg); font-weight: 900; color: var(--animal-text); text-align: center; line-height: 2;
    max-width: 92%; }
  .kjbig :global(rt) { font-size: var(--fs-rt); }
  .zibig { font-size: 96px; font-weight: 900; color: var(--animal-text); line-height: 1.2; }
  .bslabel { font-size: var(--fs-sm); font-weight: 900; color: var(--animal-primary-active); white-space: nowrap; }
  .opts { flex: 1 1 0; min-height: 0; display: grid; gap: var(--sp-2); padding-bottom: var(--sp-2);
    align-content: center; }
  .opts.two { grid-template-rows: repeat(2, minmax(96px, 136px)); }
  .opts.four { grid-template-columns: 1fr 1fr; grid-template-rows: repeat(2, minmax(88px, 124px)); }
  .opts .opt { min-height: 0; height: 100%; max-height: 136px; }
  .popt { font-size: var(--fs-glyph-sm); }
  .rstats { display: flex; justify-content: center; gap: var(--sp-5); margin-top: var(--sp-2); flex-wrap: wrap; }
  .rstat .rv { font-size: var(--fs-xl); font-weight: 900; color: var(--animal-text); line-height: 1.5; min-height: 42px;
    display: flex; align-items: center; justify-content: center; gap: 2px; }
  .rstat .rk { font-size: var(--fs-xs); font-weight: 700; color: var(--animal-text-2); white-space: nowrap; }
  .rstar { width: 26px; height: 26px; animation: dspop .4s cubic-bezier(.25, 1.5, .4, 1) backwards; }
  .rstar:nth-child(2) { animation-delay: .15s; }
  .rstar:nth-child(3) { animation-delay: .3s; }
  .rstar:nth-child(4) { animation-delay: .45s; }
  .rstar:nth-child(5) { animation-delay: .6s; }
  @keyframes dspop { from { transform: scale(0) rotate(-40deg); } }
  .rfire { position: absolute; top: -8%; animation: dfall 2.4s linear forwards; pointer-events: none; }
  @keyframes dfall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(300deg); opacity: .85; } }
  .dresult { position: relative; align-items: center; justify-content: center; text-align: center; overflow: hidden; }
  .rtitle { font-size: var(--fs-lg); font-weight: 900; color: #b07a1f; white-space: nowrap; }
  .rscore { font-size: 64px; font-weight: 900; color: var(--animal-primary-active); line-height: 1.3; }
  .rbest { margin-top: var(--sp-2); font-size: var(--fs-sm); font-weight: 800; color: #c77800; white-space: nowrap; }
  .rbtns { display: flex; flex-direction: column; gap: var(--sp-2); width: min(100%, 320px); margin-top: var(--sp-3); }

  @media (prefers-reduced-motion: reduce) {
    .rfire, .rstar { animation-duration: .01s !important; }
  }
</style>
