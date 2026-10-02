<script lang="ts">
  /* v4.0 GameShell：游戏共用骨架——3-2-1 倒计时开局 / 60 秒计时 / 连击 HUD（火焰+倍率）/ 结算层
     （得分+星星+最佳刷新破纪录礼花）。舞台 slot 由各游戏填充（phase=play 才动）。
     舞台 touch-action:none；退出按钮常在无惩罚；计时器/倒计时链 unmount 全清 */
  import { GS, quitGame, startGame, comboMult, gameTitle } from '../../stores/game.svelte'
  import { GD } from '../../stores/game.svelte'
  import Speak from '../Speak.svelte'
  import Icon from '../Icon.svelte'
  import type { Snippet } from 'svelte'
  import type { StringKey } from '../../text/strings'

  let { id, hint, children }: { id: string; hint?: string; children?: Snippet } = $props()

  const phase = $derived(GS.phase)
  const timeText = $derived.by(() => {
    const m = Math.floor(GS.left / 60), s2 = GS.left % 60
    return m + ':' + (s2 < 10 ? '0' : '') + s2
  })
  const mult = $derived(comboMult(GS.combo))
  const best = $derived(GD.games[id]?.best ?? 0)
  const title: StringKey = $derived(GS.win === 1 ? 'duelWinTitle' : GS.win === -1 ? 'duelLoseTitle' : GS.practice ? 'practiceDone' : 'timeUp')

  function noop() { /* 舞台层吃掉手势，防误触穿透 */ }
</script>

<section id="v-game" class="view on" data-screen="game" data-game={id}>
  <div class="ltop">
    <button class="cbtn" data-back="gamequit" onclick={quitGame} aria-label="exit"><Icon name="close" size={20} /></button>
    <div class="ltt"><Speak text={gameTitle()} /></div>
    <div class="lprog" id="gtime" class:low={!GS.practice && GS.left <= 10 && phase === 'play'}>
      {#if GS.practice}<span id="gok" data-ok={GS.tries}><Speak k="okCountN" vars={{ n: GS.tries }} /></span>
      {:else}{timeText}{/if}
    </div>
  </div>
  <div class="gamehud">
    <span id="gscore" data-score>{GS.score}</span>
    <span class="hlabel"><Speak k="gameScore" plain /></span>
    <span class="hspacer"></span>
    {#if mult > 1}<span class="gmult" id="gmult" data-mult={mult}><Speak k={mult === 3 ? 'comboMult3' : 'comboMult2'} /></span>{/if}
    <span id="gcombo" class:hot={GS.combo >= 3} data-combo={GS.combo} style="transform:scale({1 + Math.min(GS.combo, 8) * 0.05})">
      <Icon name="flame" size={20} /> {GS.combo}
    </span>
  </div>
  {#if hint}<div class="ghint" id="ghint"><Speak text={hint} /></div>{/if}

  <div class="stage" id="gstage" onpointerdown={noop} role="presentation">
    {@render children?.()}
  </div>

  {#if phase === 'count'}
    <div class="countlay" id="gcount" data-count>
      {#key GS.countN}
        <div class="cnum">{#if GS.countN > 0}{GS.countN}{:else}<Speak k="goCount" plain />{/if}</div>
      {/key}
      <div class="chint"><Speak k="listenThenAct" /></div>
    </div>
  {/if}

  {#if phase === 'result'}
    <div class="resultlay" id="gresult" data-result>
      {#if GS.record}
        {#each Array(10) as _, i (i)}
          <div class="rfire" style="left:{6 + i * 9.5}%; animation-delay:{i * 0.13}s"><Icon name={['star', 'balloon', 'heart', 'flower'][i % 4]} size={30} /></div>
        {/each}
      {/if}
      <div class="rcard">
        <div class="rtitle"><Speak k={title || 'timeUp'} /></div>
        <div class="rscore" id="rscore" data-rscore>{GS.score}</div>
        <div class="rstats">
          <div class="rstat"><div class="rv" id="rcombo">{GS.maxCombo}</div><div class="rk"><Speak k="maxCombo" /></div></div>
          <div class="rstat"><div class="rv rstars" id="rstars" data-stars={GS.stars}>
            {#each Array(GS.stars) as _, i (i)}<svg viewBox="0 0 24 24" class="rstar"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z" fill="#f5c31c" stroke="#dba90e" stroke-width="1.4" /></svg>{/each}
          </div><div class="rk"><Speak k="starsGot" /></div></div>
        </div>
        <div class="rbest" id="rbest" data-best={best}>
          <Speak k={GS.record ? 'dailyRecord' : 'bestScoreN'} vars={GS.record ? {} : { n: best }} />
        </div>
      </div>
      <div class="rbtns">
        <button class="btn red" id="gagain" data-again onclick={() => startGame(id)}><Icon name="rocket" size={24} /> <Speak k="playAgainGame" plain /></button>
        <button class="btn ghost" id="ghome" data-home onclick={quitGame}><Speak k="backGameIsland" plain /></button>
      </div>
    </div>
  {/if}
</section>

<style>
  #v-game { background: linear-gradient(180deg, #fdf7ea, #fbeee0); }
  .ltop { display: flex; align-items: center; gap: var(--sp-2); height: 44px; flex: none; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
  .ltt { flex: 1; text-align: center; font-size: var(--fs-md); font-weight: 900; white-space: nowrap; }
  .lprog { font-size: var(--fs-xs); font-weight: 900; color: var(--animal-primary-active); background: var(--animal-primary-bg);
    padding: var(--sp-2) var(--sp-3); border-radius: 999px; white-space: nowrap; }
  #gtime.low { color: var(--animal-error); animation: gblink 1s steps(2) infinite; }
  @keyframes gblink { 50% { opacity: .45; } }

  .gamehud { flex: none; display: flex; align-items: center; gap: var(--sp-2); margin-top: var(--sp-1);
    background: #fff; border-radius: 999px; padding: 6px var(--sp-3); box-shadow: var(--animal-shadow-sm); }
  #gscore { font-size: var(--fs-lg); font-weight: 900; color: var(--animal-primary-active); min-width: 44px; line-height: 1.4; }
  .hlabel { font-size: var(--fs-xs); font-weight: 800; color: var(--animal-text-2); white-space: nowrap; }
  .hspacer { flex: 1; }
  .gmult { font-size: var(--fs-xs); font-weight: 900; color: #fff; background: #f5a35c; border-radius: 999px;
    padding: 3px 10px; white-space: nowrap; animation: gpop .25s cubic-bezier(.25,1.4,.4,1); }
  @keyframes gpop { from { transform: scale(0); } }
  #gcombo { display: inline-flex; align-items: center; gap: 3px; font-size: var(--fs-md); font-weight: 900;
    color: var(--animal-text-2); transition: color .2s; min-height: 24px; }
  #gcombo.hot { color: #e76f51; }
  .ghint { flex: none; text-align: center; font-size: var(--fs-xs); font-weight: 700; color: var(--animal-text-2);
    line-height: 1.7; margin-top: var(--sp-1); white-space: nowrap; }
  .ghint :global(rt) { font-size: var(--fs-rt); }

  .stage { position: relative; flex: 1 1 0; min-height: 0; margin-top: var(--sp-2); border-radius: var(--animal-r-lg);
    overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; background: #fff;
    border: 2px solid var(--animal-border-light); box-shadow: var(--animal-shadow); }

  /* 倒计时层 */
  .countlay { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: var(--sp-3); background: rgba(255, 251, 240, .88); }
  .cnum { font-size: 96px; font-weight: 900; color: var(--animal-primary-active); animation: cpop .9s cubic-bezier(.25,1.3,.4,1); }
  @keyframes cpop { 0% { transform: scale(.4); opacity: 0; } 30% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); } }
  .chint { font-size: var(--fs-md); font-weight: 800; color: var(--animal-text-2); }

  /* 结算层 */
  .resultlay { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: var(--sp-4); background: rgba(255, 251, 240, .92); padding: var(--sp-4); overflow: hidden; }
  .rfire { position: absolute; top: -8%; animation: rfall 2.4s linear forwards; pointer-events: none; }
  @keyframes rfall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(300deg); opacity: .85; } }
  .rcard { background: #fff; border-radius: var(--animal-r-lg); box-shadow: var(--animal-shadow-lg);
    border: 2px solid var(--animal-border-light); padding: var(--sp-4) var(--sp-5); text-align: center; width: min(88%, 340px); }
  .rtitle { font-size: var(--fs-lg); font-weight: 900; color: #b07a1f; line-height: 1.8; white-space: nowrap; }
  .rscore { font-size: 64px; font-weight: 900; color: var(--animal-primary-active); line-height: 1.3; }
  .rstats { display: flex; justify-content: center; gap: var(--sp-6); margin-top: var(--sp-2); }
  .rstat .rv { font-size: var(--fs-xl); font-weight: 900; color: var(--animal-text); line-height: 1.5; min-height: 42px;
    display: flex; align-items: center; justify-content: center; gap: 2px; }
  .rstat .rk { font-size: var(--fs-xs); font-weight: 700; color: var(--animal-text-2); white-space: nowrap; }
  .rstar { width: 26px; height: 26px; animation: spop .4s cubic-bezier(.25,1.5,.4,1) backwards; }
  .rstar:nth-child(2) { animation-delay: .15s; }
  .rstar:nth-child(3) { animation-delay: .3s; }
  .rstar:nth-child(4) { animation-delay: .45s; }
  .rstar:nth-child(5) { animation-delay: .6s; }
  @keyframes spop { from { transform: scale(0) rotate(-40deg); } }
  .rbest { margin-top: var(--sp-2); font-size: var(--fs-sm); font-weight: 800; color: #c77800; white-space: nowrap; }
  .rbtns { display: flex; flex-direction: column; gap: var(--sp-2); width: min(88%, 340px); }

  @media (prefers-reduced-motion: reduce) {
    .rfire, .cnum, .gmult, .rstar { animation-duration: .01s !important; }
  }
</style>
