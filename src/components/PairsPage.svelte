<script lang="ts">
  /* 易混对专练 v2.4：四组横向翻页（一组一页，一屏一事），点对看辨析卡或整组开练；零纵向滚动 */
  import { PAIRS, GRPS, GRPNAME } from '../data'
  import { startPairGroup } from '../stores/session.svelte'
  import { show, openPair } from '../stores/ui.svelte'
  import Speak from './Speak.svelte'
  import Icon from './Icon.svelte'
  import HSteps from './HSteps.svelte'

  let cur = $state(0)
</script>

<section id="v-pairs" class="view on" data-screen="pairs">
  <div class="ltop">
    <button class="cbtn" data-back="practice" onclick={() => show('practice')} aria-label="back"><svg viewBox="0 0 24 24" fill="none" stroke="#794f27" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5L7.5 12l7 7" /></svg></button>
    <div class="ltt"><Speak k="pairsDrill" /></div>
    <div class="lprog">{cur + 1}/{GRPS.length}</div>
  </div>

  <div id="pgwrap">
    <HSteps n={GRPS.length} bind:cur>
      {#each GRPS as grp, gi (grp)}
        {@const ps = PAIRS.filter((p) => p.grp === grp)}
        <div class="hspage"><div class="pcard">
          <div class="ghead">
            <div class="gtitle"><Speak text={GRPNAME[grp]} />&nbsp;（<Speak k="groupCount" vars={{ n: ps.length }} />）</div>
            <div class="gdesc"><Speak k="pairsGuide" /></div>
          </div>
          <div class="chips">
            {#each ps as p (p.a + '|' + p.b)}
              {@const pi = PAIRS.indexOf(p)}
              <button class="chip" data-pi={pi} type="button" onclick={() => openPair(pi)}>{p.a} ↔ {p.b}</button>
            {/each}
          </div>
          <button class="btn small purple gstart" type="button" onclick={() => startPairGroup(grp)}><Icon name="play" size={20} /> <Speak k="startGroupN" vars={{ n: ps.length }} plain /></button>
        </div></div>
      {/each}
    </HSteps>
  </div>

  <div id="pager">
    <div id="dots">
      {#each GRPS as grp, i (grp)}
        <i class:on={cur === i}></i>
      {/each}
    </div>
    <div id="swipehint"><svg viewBox="0 0 24 24" fill="none" stroke="#9f927d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6" /></svg><Speak k="swipeNextGroup" /></div>
  </div>
</section>

<style>
  #v-pairs { padding: 10px 16px 8px; }
  .ltop { display: flex; align-items: center; gap: 10px; height: 44px; flex: none; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .cbtn svg { width: 18px; height: 18px; }
  .ltt { flex: 1; text-align: center; font-size: 16px; font-weight: 900; }
  .lprog { font-size: 12px; font-weight: 900; color: var(--animal-primary-active); background: var(--animal-primary-bg);
    padding: 6px 11px; border-radius: 999px; }
  #pgwrap { flex: 1; min-height: 0; margin: 12px 0 4px; }
  .pcard { height: 100%; background: #fff; border-radius: var(--animal-r-lg); box-shadow: var(--animal-shadow-lg);
    display: flex; flex-direction: column; align-items: center; padding: 20px 16px 16px; overflow: hidden; }
  .ghead { flex: none; text-align: center; }
  .gtitle { font-size: 20px; font-weight: 900; color: var(--animal-text); line-height: 2; }
  .gdesc { font-size: 12.5px; font-weight: 700; color: var(--animal-text-2); line-height: 1.9; }
  .chips { flex: 1; min-height: 0; display: flex; flex-wrap: wrap; gap: 10px; align-content: center; justify-content: center; margin: 8px 0; }
  .chip { border: 2px solid var(--animal-border-light); background: var(--animal-bg); color: var(--animal-text); font-family: inherit;
    font-size: 20px; font-weight: 900; padding: 6px 16px; border-radius: var(--animal-r-pill); cursor: pointer; min-height: 52px; }
  .chip:active { transform: translateY(2px); }
  .gstart { flex: none; width: 100%; max-width: 280px; }
  #pager { height: 56px; flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }
  #dots { display: flex; gap: 7px; }
  #dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--animal-text-dis); }
  #dots i.on { width: 22px; background: var(--animal-primary); }
  #swipehint { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 800; color: var(--animal-text-2); }
  #swipehint svg { width: 16px; height: 16px; }
</style>
