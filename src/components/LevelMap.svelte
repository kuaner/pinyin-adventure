<script lang="ts">
  /* 关卡地图 v2.4：全屏专注态，8 关顺序解锁 + 毕业关。
     v2.8：10 关改 HSteps 横向翻页 5 关/页（历史页同款）——rt 注音关名换行后纵向装不下，翻页替代滚动 */
  import { LEVELS } from '../data'
  import { S, levelUnlocked } from '../stores/progress.svelte'
  import { startLevel } from '../stores/session.svelte'
  import { show, toast } from '../stores/ui.svelte'
  import { tRaw } from '../text/strings'
  import Speak from './Speak.svelte'
  import Icon from './Icon.svelte'
  import HSteps from './HSteps.svelte'

  const PER = 5
  const pages: typeof LEVELS[] = []
  for (let i = 0; i < Math.ceil(LEVELS.length / PER); i++) pages.push(LEVELS.slice(i * PER, i * PER + PER))
  let cur = $state(0)
</script>

<section id="v-levels" class="view on" data-screen="levels">
  <div class="ltop">
    <button class="cbtn" data-back="practice" onclick={() => show('practice')} aria-label="返回"><svg viewBox="0 0 24 24" fill="none" stroke="#794f27" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5L7.5 12l7 7" /></svg></button>
    <div class="ltt"><Speak k="chooseLevel" /></div>
    <div class="lprog">{#each Array(3) as _, i (i)}<svg viewBox="0 0 24 24" width="12" height="12" style="opacity:{i < 3 ? 1 : .25}"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z" fill="#f5c31c" /></svg>{/each}</div>
  </div>
  <div id="lvwrap">
    <HSteps n={pages.length} bind:cur>
      {#each pages as pg, pi (pi)}
        <div class="hspage">
          <div id="lvgrid">
            {#each pg as L (L.n)}
              {@const st = S.stars[L.n] || 0}
              {@const un = levelUnlocked(L.n)}
              <button
                class={'lvlcard' + (un ? '' : ' locked') + (L.boss ? ' boss' : '')}
                id="lv-{L.n}"
                onclick={() => un ? startLevel(L.n) : toast(tRaw('levelLockedToast'))}
              >
                <div class="lvnum">{#if un}<Icon name={L.icon} size={26} />{:else}<Icon name="lock" size={24} />{/if}</div>
                <div class="lvinfo">
                  <div class="lvname"><Speak k="levelN" vars={{ n: L.n }} /> · <Speak text={L.name} />{#if L.boss} <span class="bosstag"><Speak k="graduate" /></span>{/if}</div>
                  <div class="lvsub"><Speak text={L.sub} /></div>
                </div>
                <div class="lvstars">{#each Array(st) as _, i}<Icon name="star" size={16} />{/each}{#each Array(3 - st) as _, i}<span class="starempty"><Icon name="star-empty" size={16} /></span>{/each}</div>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </HSteps>
  </div>

  {#if pages.length > 1}
    <div id="pager">
      <div id="dots">
        {#each pages as _, i (i)}<i class:on={cur === i}></i>{/each}
      </div>
      <div id="swipehint"><svg viewBox="0 0 24 24" fill="none" stroke="#9f927d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6" /></svg><Speak k="swipeHintH" /></div>
    </div>
  {/if}
</section>

<style>
  #v-levels { padding: calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-3); }
  .ltop { display: flex; align-items: center; gap: var(--sp-2); height: 44px; flex: none; margin-bottom: var(--sp-2); }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .cbtn svg { width: 18px; height: 18px; }
  .ltt { flex: 1; text-align: center; font-size:var(--fs-md); font-weight: 900; }
  .lprog { display: flex; gap: var(--sp-1); }
  /* v2.8：翻页容器 + 卡片等分填满页（内容不足不留大片空白） */
  #lvwrap { flex: 1; min-height: 0; }
  .hspage { height: 100%; }
  #lvgrid { height: 100%; display: flex; flex-direction: column; gap: var(--sp-2); }
  .lvlcard { flex: 1; min-height: 0; }
  #pager { height: 46px; flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-1); }
  #dots { display: flex; gap: var(--sp-2); }
  #dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--animal-text-dis); }
  #dots i.on { width: 22px; background: var(--animal-primary); }
  #swipehint { display: flex; align-items: center; gap: var(--sp-2); font-size:var(--fs-xs); font-weight: 800; color: var(--animal-text-2); }
  #swipehint svg { width: 14px; height: 14px; }
  .lvlcard { display: flex; align-items: center; gap: var(--sp-3); background: #fff; border-radius: var(--animal-r); border: 2px solid var(--animal-border-light);
    padding: var(--sp-2) var(--sp-3); cursor: pointer; box-shadow: 0 3px 0 var(--animal-border-light); font-family: inherit; text-align: left; width: 100%;
    flex: 1; min-height: 0; }
  .lvlcard:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--animal-border-light); }
  /* v2.6 打磨：未解锁卡=暖灰底+奶油描边（去死灰 grayscale） */
  .lvlcard.locked { background: #f3efe6; border-color: #eee4d3; box-shadow: 0 3px 0 #e3d9c8; opacity: 1; filter: none; }
  .lvlcard.locked .lvnum { background: #eae3d5; color: #b7ab97; }
  .lvlcard.locked .lvname, .lvlcard.locked .lvsub { color: #b7ab97; }
  .lvlcard.locked .lvstars { opacity: .45; }
  .lvlcard .lvnum { flex: 0 0 46px; height: 46px; border-radius: 13px; display: flex; align-items: center; justify-content: center; background: var(--animal-bg-2); }
  .lvlcard.boss .lvnum { background: #fde4e8; }
  .lvlcard .lvinfo { flex: 1; display: flex; flex-direction: column; gap: 0; min-width: 0; }
  /* v2.8：关名/副题换行不截断（孩子必须看到完整关名），ruby 行高 1.6 预算 */
  .lvlcard .lvname { font-size:var(--fs-md); font-weight: 900; color: var(--animal-text); line-height: 1.6; }
  .lvlcard .lvsub { font-size:var(--fs-xs); color: var(--animal-text-2); font-weight: 700; line-height: 1.6; }
  .lvlcard .lvstars { display: flex; gap: var(--sp-1); flex: none; }
  .bosstag { font-size:var(--fs-xs); color: var(--animal-error); font-weight: 900; }
</style>
