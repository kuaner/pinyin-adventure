<script lang="ts">
  /* 声音礼仪页（v2.4 家长区入口，打样屏6）：三规则 + 声音地图。家长向文本，不注音 */
  import { show } from '../../stores/ui.svelte'
  import { t, etiquette } from '../../text/strings'

  const RULES = etiquette.rules
  const MAP = etiquette.map
</script>

<section id="v-sound" class="view on" data-screen="sound">
  <div class="ltop">
    <button class="cbtn" data-back="mine" onclick={() => show('mine')} aria-label="返回"><svg viewBox="0 0 24 24" fill="none" stroke="#794f27" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5L7.5 12l7 7" /></svg></button>
    <div class="ltt">{t('etiquetteTitle')}</div>
    <div style="width:38px;flex:none"></div>
  </div>
  <div class="intro">{t('etiquetteIntro')}</div>

  {#each RULES as r (r.t)}
    <div class="card srule">
      <div class="sic" style="background:{r.bg}">
        {#if r.num === '0'}
          <svg viewBox="0 0 24 24" fill="none" stroke="#129d8f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z" /><path d="M16 9l6 6M22 9l-6 6" stroke="#c94444" /></svg>
        {:else if r.num === '3'}
          <svg viewBox="0 0 24 24" fill="none" stroke="#dba90e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="3.2" fill="#dba90e" stroke="none" /><path d="M6.5 8.5a7.5 7.5 0 0111 0M8.8 11a4.5 4.5 0 016.4 0" /></svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="#9a5fd4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h6a2 2 0 012 2v12a2 2 0 01-2 2H6z" /><path d="M14 6.5l4 1.5-4.5 11-4-1.5" opacity=".55" /></svg>
        {/if}
      </div>
      <div><b>{r.n} {r.t}</b><span>{r.d}</span></div>
      <div class="rnum">{r.num}</div>
    </div>
  {/each}

  <div class="card" id="soundmap">
    <div class="sec-label"><b>{t('soundMap')}</b><span>{t('soundMapHead')}</span></div>
    {#each MAP as row (row[0])}
      <div class="smaprow"><span class="sc">{row[0]}</span><span class="tag" class:silent={!row[2]} class:sound={row[2]}>{row[1]}</span></div>
    {/each}
    <div class="note">{t('deletedNote')}</div>
  </div>
</section>

<style>
  #v-sound { padding: calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-3); }
  .ltop { display: flex; align-items: center; gap: var(--sp-2); height: 44px; flex: none; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .cbtn svg { width: 18px; height: 18px; }
  .ltt { flex: 1; text-align: center; font-size:var(--fs-sm); font-weight: 900; }
  .intro { font-size:var(--fs-xs); font-weight: 700; color: var(--animal-text-2); margin: var(--sp-1) var(--sp-1) var(--sp-3); flex: none; }
  .srule { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); margin-bottom: var(--sp-2); flex: none; }
  .srule .sic { width: 46px; height: 46px; border-radius: 15px; display: flex; align-items: center; justify-content: center; flex: none; }
  .srule .sic svg { width: 24px; height: 24px; }
  .srule b { font-size:var(--fs-sm); font-weight: 900; display: block; line-height: 1.8; }
  .srule span { font-size:var(--fs-xs); font-weight: 700; color: var(--animal-text-2); display: block; line-height: 1.5; }
  .srule .rnum { margin-left: auto; font-size:var(--fs-lg); font-weight: 900; color: var(--animal-border-light); }
  #soundmap { margin-top: var(--sp-1); padding: var(--sp-3) var(--sp-4) var(--sp-2); flex: none; }
  #soundmap .sec-label { margin-bottom: var(--sp-1); display: flex; align-items: center; justify-content: space-between; }
  #soundmap .sec-label b { font-size:var(--fs-xs); font-weight: 900; }
  #soundmap .sec-label span { font-size:var(--fs-xs); font-weight: 700; color: var(--animal-text-dis); }
  .smaprow { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-2) 0; border-bottom: 1px dashed var(--animal-border-light);
    font-size:var(--fs-xs); font-weight: 800; }
  .smaprow:last-of-type { border-bottom: none; }
  .smaprow .sc { color: var(--animal-text-2); font-weight: 700; }
  .tag { font-size:var(--fs-xs); font-weight: 900; padding: var(--sp-1) var(--sp-2); border-radius: 999px; }
  .tag.silent { background: #f4f0e4; color: var(--animal-text-dis); }
  .tag.sound { background: var(--animal-primary-bg); color: var(--animal-primary-active); }
  #soundmap .note { font-size:var(--fs-xs); font-weight: 700; color: var(--animal-text-dis); padding: var(--sp-2) 0 var(--sp-2); line-height: 1.6; }
</style>
