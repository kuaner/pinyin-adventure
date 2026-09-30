<script lang="ts">
  /* 历史成绩 v2.4（家长向，文字不注音）：课程进度条 + 历史记录横向翻页卡片（5 条/页，零纵向滚动） */
  import { S, save } from '../stores/progress.svelte'
  import { show } from '../stores/ui.svelte'
  import { t } from '../text/strings'
  import { L as LRN } from '../stores/learn.svelte'
  import lessonsData from '../data/lessons.json'
  import Icon from './Icon.svelte'
  import HSteps from './HSteps.svelte'

  const LESSONS = (lessonsData as any).lessons as { n: number; label: string }[]
  const PER = 5
  const pages: typeof S.hist[] = []
  for (let i = 0; i < Math.max(1, Math.ceil(S.hist.length / PER)); i++) pages.push(S.hist.slice(i * PER, i * PER + PER))
  let cur = $state(0)
</script>

<section id="v-history" class="view on" data-screen="history">
  <div class="ltop">
    <button class="cbtn" data-back="mine" onclick={() => show('mine')} aria-label="back"><svg viewBox="0 0 24 24" fill="none" stroke="#794f27" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5L7.5 12l7 7" /></svg></button>
    <div class="ltt">{t('histTitle')}</div>
    <div class="lprog">{t('histCount', { n: S.hist.length })}</div>
  </div>

  <div class="learnprog">
    <div class="lptitle"><Icon name="sprout" size={16} /> {t('learnProgressN', { n: LRN.u })} <button class="gol" data-golearn onclick={() => show('learn')}>{t('goLearn')}</button></div>
    <div class="lpmap">
      {#each LESSONS as ls (ls.n)}
        <div class="lpcell" class:done={(LRN.stars[ls.n] || 0) > 0} class:lock={ls.n > LRN.u}>
          <span class="lpn">{ls.n}</span>
          <span class="lpl">{ls.label}</span>
          <span class="lps">{#if LRN.stars[ls.n]}<Icon name="star" size={12} />{LRN.stars[ls.n]}{:else if ls.n > LRN.u}<Icon name="lock" size={12} />{:else}<Icon name="play" size={12} />{/if}</span>
        </div>
      {/each}
    </div>
  </div>

  <div id="histwrap">
    <HSteps n={pages.length} bind:cur>
      {#each pages as pg, pi (pi)}
        <div class="hspage"><div class="pcard">
          {#if pg.length === 0}
            <div class="hempty">{t('histEmpty')}</div>
          {:else}
            {#each pg as r, ri (pi + '-' + ri)}
              <div class="hitem">
                <div class="ht">{r.d}</div>
                <div class="hl">{@html r.lv}</div>
                <div class="hs">{#if r.st >= 0}{#each Array(r.st) as _, i}<Icon name="star" size={14} />{/each} {/if}{t('histScore', { n: r.sc })}</div>
                {#if r.wp}<div class="hs" style="color:#C77B1E">{r.wp}</div>{/if}
              </div>
            {/each}
          {/if}
        </div></div>
      {/each}
    </HSteps>
  </div>

  {#if pages.length > 1}
    <div id="pager">
      <div id="dots">
        {#each pages as _, i (i)}<i class:on={cur === i}></i>{/each}
      </div>
      <div id="swipehint"><svg viewBox="0 0 24 24" fill="none" stroke="#9f927d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6" /></svg>{t('swipeMoreHist')}</div>
    </div>
  {:else}
    <div style="flex:0 0 8px"></div>
  {/if}

  <button class="btn ghost small" id="hclear" onclick={() => {
    if (confirm(t('clearConfirm'))) { S.hist = []; save(S); cur = 0 }
  }}>{t('clearHist')}</button>
</section>

<style>
  #v-history { padding: calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-3); }
  .ltop { display: flex; align-items: center; gap: var(--sp-2); height: 44px; flex: none; margin-bottom: var(--sp-2); }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .cbtn svg { width: 18px; height: 18px; }
  .ltt { flex: 1; text-align: center; font-size:var(--fs-md); font-weight: 900; }
  .lprog { font-size:var(--fs-xs); font-weight: 900; color: var(--animal-primary-active); background: var(--animal-primary-bg); padding: var(--sp-2) var(--sp-3); border-radius: 999px; }
  .learnprog { flex: none; background: #fff; border: 2px solid #eee4d3; border-radius: 18px; padding: var(--sp-2) var(--sp-3); margin-bottom: var(--sp-2); }
  .lptitle { font-size:var(--fs-xs); font-weight: 800; color: #264653; margin-bottom: var(--sp-2); display: flex; align-items: center; gap: var(--sp-1); }
  .gol { margin-left: auto; border: none; background: #e6f7f2; color: #1f7a68; font-family: inherit; font-size:var(--fs-xs); font-weight: 900;
    padding: var(--sp-1) var(--sp-2); border-radius: 999px; cursor: pointer; }
  /* v2.8：minmax(0,1fr) 防内容吹爆网格（12 课两行六列，格内标签截断） */
  .lpmap { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: var(--sp-1); }
  .lpcell { border: 1.5px solid #eee4d3; border-radius: 9px; padding: var(--sp-1) var(--sp-1); text-align: center;
    font-size:var(--fs-xs); font-weight: 700; color: #8a7a68; display: flex; flex-direction: column; gap: var(--sp-1); min-width: 0; }
  .lpcell.done { border-color: #bfe8df; background: #e6f7f2; color: #1f7a68; }
  .lpcell.lock { opacity: .5; }
  .lpn { font-size:var(--fs-xs); color: #b7ab97; }
  .lpl { font-size:var(--fs-xs); line-height: 1.3; word-break: break-all; }
  .lps { font-size:var(--fs-xs); }

  #histwrap { flex: 1; min-height: 0; }
  /* v2.8：记录卡内容簇居中（去掉 flex:1 拉伸造成的条内大片空白） */
  .pcard { height: 100%; background: #fff; border-radius: var(--animal-r-lg); border: 2px solid var(--animal-border-light);
    box-shadow: var(--animal-shadow); padding: var(--sp-3) var(--sp-3); display: flex; flex-direction: column; justify-content: center; gap: var(--sp-2); overflow: hidden; }
  .hitem { background: var(--animal-bg); border-radius: var(--animal-r-sm); padding: var(--sp-2) var(--sp-3); display: flex; align-items: center;
    gap: var(--sp-2); flex-wrap: wrap; flex: 0 0 auto; }
  .hitem .ht { font-size:var(--fs-xs); color: var(--animal-text-2); font-weight: 800; flex: 0 0 100%; order: 3; }
  .hitem .hl { font-size:var(--fs-sm); font-weight: 900; color: var(--animal-text); flex: 1; }
  .hitem .hs { font-size:var(--fs-xs); font-weight: 900; color: var(--animal-warning-active); }
  .hempty { text-align: center; color: var(--animal-text-dis); font-weight: 800; margin: auto; font-size:var(--fs-sm); line-height: 2; }

  #pager { height: 46px; flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-1); }
  #dots { display: flex; gap: var(--sp-2); }
  #dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--animal-text-dis); }
  #dots i.on { width: 22px; background: var(--animal-primary); }
  #swipehint { display: flex; align-items: center; gap: var(--sp-2); font-size:var(--fs-xs); font-weight: 800; color: var(--animal-text-2); }
  #swipehint svg { width: 14px; height: 14px; }
  #hclear { flex: none; min-height: 44px; font-size:var(--fs-xs); }
</style>
