<script lang="ts">
  /* v4.0 游戏岛 hub：练习 tab 整体重造——顶部每日挑战卡 + 6 游戏摊位（本期 4 实装，
     ⑤拼音蛋⑥声调音乐会"敬请期待"灰卡不误触）。旧练习四入口删除（机制已吸收进游戏：
     听写→气球/地鼠；混淆搭档→镜像大对决；识字→每日挑战；闪电→连击机制）；
     闯关冒险/自由练习保留为底部紧凑入口。零纵向滚动：容器级自扛（#tab-view-root 硬锁） */
  import { startGame, startDaily, dailyView, gameBest } from '../../stores/game.svelte'
  import { show } from '../../stores/ui.svelte'
  import Speak from '../Speak.svelte'
  import Icon from '../Icon.svelte'

  const daily = $derived(dailyView())
  const balloonBest = $derived(gameBest('balloon'))
  const moleBest = $derived(gameBest('mole'))
  const duelBest = $derived(gameBest('duel'))
  const fishBest = $derived(gameBest('fish'))

  const STALLS = [
    { id: 'balloon', nameKey: 'stallBalloon', cls: 's-sky' },
    { id: 'mole', nameKey: 'stallMole', cls: 's-grass' },
    { id: 'duel', nameKey: 'stallDuel', cls: 's-sun' },
    { id: 'fish', nameKey: 'stallFish', cls: 's-sea' },
  ] as const

  function bestOf(id: string): number {
    if (id === 'balloon') return balloonBest
    if (id === 'mole') return moleBest
    if (id === 'duel') return duelBest
    return fishBest
  }

  function openDaily() {
    startDaily()
  }
</script>

<section id="v-island" class="view on" data-screen="practice">
  <div id="greet">
    <div class="g1"><Speak k="islandTitle" /></div>
    <div class="g2"><Speak k="islandSlogan" /></div>
  </div>

  <button class="dailycard pressable" id="dailycard" data-daily onclick={openDaily}>
    <div class="dico"><Icon name="trophy" size={40} /></div>
    <div class="dinfo">
      <div class="dtitle"><Speak k="dailyTitle" /></div>
      <div class="ddesc">
        {#if daily.done}
          <span data-dailydone><Speak k="dailyDone" /> · <Speak k="dailyBestN" vars={{ n: daily.best }} /></span>
        {:else}
          <span><Speak k="dailyDesc" /></span>
        {/if}
      </div>
    </div>
    <div class="dgo"><Icon name={daily.done ? 'check' : 'arrow-right'} size={26} /></div>
  </button>

  <div id="stalls">
    {#each STALLS as s (s.id)}
      <button class="stall pressable {s.cls}" data-stall={s.id} onclick={() => startGame(s.id)}>
        <div class="scene">
          {#if s.id === 'balloon'}
            <svg viewBox="0 0 120 66" class="art" aria-hidden="true">
              <rect x="0" y="0" width="120" height="66" rx="10" fill="#dff2ff" />
              <ellipse cx="26" cy="14" rx="13" ry="6" fill="#fff" opacity=".85" />
              <ellipse cx="96" cy="10" rx="10" ry="5" fill="#fff" opacity=".7" />
              <path d="M34 40 C 34 30 27 26 22 26 C 15 26 11 32 11 38 C 11 45 17 50 22 50 C 27 50 34 47 34 40 Z" fill="#f08080" />
              <path d="M52 30 C 52 20 45 15 40 15 C 33 15 29 22 29 28 C 29 35 35 40 40 40 C 45 40 52 38 52 30 Z" fill="#889df0" transform="translate(14 6)" />
              <path d="M22 50 C 20 55 25 58 22 62" stroke="#c9bca6" stroke-width="1.6" fill="none" />
              <path d="M54 48 C 52 53 57 56 54 60" stroke="#c9bca6" stroke-width="1.6" fill="none" />
              <rect x="0" y="58" width="120" height="8" rx="4" fill="#bfe6a8" />
            </svg>
          {:else if s.id === 'mole'}
            <svg viewBox="0 0 120 66" class="art" aria-hidden="true">
              <rect x="0" y="0" width="120" height="66" rx="10" fill="#eaf7e2" />
              <ellipse cx="42" cy="52" rx="20" ry="8" fill="#8b5e3c" />
              <path d="M28 52 C 28 38 34 32 42 32 C 50 32 56 38 56 52 Z" fill="#c99b6a" />
              <circle cx="38" cy="44" r="2" fill="#3d3428" />
              <circle cx="46" cy="44" r="2" fill="#3d3428" />
              <path d="M74 18 L 88 32" stroke="#8b5e3c" stroke-width="4" stroke-linecap="round" />
              <rect x="66" y="8" width="16" height="12" rx="3" fill="#f0a35c" transform="rotate(-18 74 14)" />
              <rect x="0" y="58" width="120" height="8" rx="4" fill="#bfe6a8" />
            </svg>
          {:else if s.id === 'duel'}
            <svg viewBox="0 0 120 66" class="art" aria-hidden="true">
              <rect x="0" y="0" width="120" height="66" rx="10" fill="#fff3dc" />
              <path d="M18 30 C 40 44 80 44 102 30" stroke="#c99b6a" stroke-width="5" fill="none" stroke-linecap="round" />
              <circle cx="60" cy="39.5" r="7" fill="#fff" stroke="#e76f51" stroke-width="3" />
              <path d="M60 16 L60 39" stroke="#e76f51" stroke-width="2.5" stroke-dasharray="4 4" />
              <rect x="12" y="24" width="10" height="26" rx="4" fill="#2a9d8f" />
              <rect x="98" y="24" width="10" height="26" rx="4" fill="#e76f51" />
              <rect x="0" y="58" width="120" height="8" rx="4" fill="#f3dfae" />
            </svg>
          {:else}
            <svg viewBox="0 0 120 66" class="art" aria-hidden="true">
              <rect x="0" y="0" width="120" height="66" rx="10" fill="#d8f0fb" />
              <path d="M0 46 Q 15 40 30 46 T 60 46 T 90 46 T 120 46 L120 66 L0 66 Z" fill="#9fd0ea" />
              <path d="M28 30 C 32 22 44 20 50 26 C 56 32 54 40 46 42 C 38 44 30 38 28 30 Z" fill="#2a9d8f" />
              <path d="M52 32 L 64 24 L 64 40 Z" fill="#f0a35c" />
              <circle cx="36" cy="28" r="2.4" fill="#fff" />
              <circle cx="36" cy="28" r="1.1" fill="#3d3428" />
              <path d="M96 14 L 96 44" stroke="#8b5e3c" stroke-width="3" stroke-linecap="round" />
              <path d="M96 44 L 88 52" stroke="#8b5e3c" stroke-width="2.4" stroke-linecap="round" />
            </svg>
          {/if}
        </div>
        <div class="sname"><Speak k={s.nameKey} /></div>
        <div class="sbest" data-best={bestOf(s.id)}>
          {#if bestOf(s.id) > 0}<Speak k="bestN" vars={{ n: bestOf(s.id) }} plain />{:else}<Speak k="newGame" plain />{/if}
        </div>
      </button>
    {/each}

    <div class="stall coming" data-coming="egg" aria-disabled="true">
      <div class="scene">
        <svg viewBox="0 0 120 66" class="art" aria-hidden="true">
          <rect x="0" y="0" width="120" height="66" rx="10" fill="#efece4" />
          <ellipse cx="60" cy="38" rx="20" ry="25" fill="#e3ded2" />
          <path d="M46 34 L 60 30 L 74 34 L 66 44 L 52 44 Z" fill="#d6d0c2" stroke="#c4bda9" stroke-width="2" stroke-dasharray="4 3" />
          <rect x="0" y="58" width="120" height="8" rx="4" fill="#dcd6c8" />
        </svg>
      </div>
      <div class="sname"><Speak k="stallEgg" /></div>
      <div class="sbest"><Speak k="comingSoon" /></div>
    </div>

    <div class="stall coming" data-coming="tone" aria-disabled="true">
      <div class="scene">
        <svg viewBox="0 0 120 66" class="art" aria-hidden="true">
          <rect x="0" y="0" width="120" height="66" rx="10" fill="#efece4" />
          <path d="M40 46 L40 22 L62 16 L62 40" stroke="#c4bda9" stroke-width="4" fill="none" stroke-linecap="round" />
          <ellipse cx="34" cy="47" rx="8" ry="6" fill="#d6d0c2" />
          <ellipse cx="56" cy="41" rx="8" ry="6" fill="#d6d0c2" />
          <rect x="0" y="58" width="120" height="8" rx="4" fill="#dcd6c8" />
        </svg>
      </div>
      <div class="sname"><Speak k="stallTone" /></div>
      <div class="sbest"><Speak k="comingSoon" /></div>
    </div>
  </div>

  <div id="morerow">
    <button class="morelink" data-go="levels" onclick={() => show('levels')}>
      <Icon name="map" size={22} /> <Speak k="adventureEntry" />
    </button>
    <button class="morelink" data-go="free" onclick={() => show('free')}>
      <Icon name="dumbbell" size={22} /> <Speak k="freeEntry" />
    </button>
  </div>
</section>

<style>
  #v-island { padding: calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-2); }
  #greet { flex: none; }
  #greet .g1 { font-size: var(--fs-lg); font-weight: 900; line-height: 1.6; }
  #greet .g2 { font-size: var(--fs-xs); font-weight: 700; color: var(--animal-text-2); line-height: 1.6; }

  .dailycard { flex: none; display: flex; align-items: center; gap: var(--sp-3); width: 100%; margin-top: var(--sp-2);
    border: 2px solid #ffd98e; border-radius: var(--animal-r-lg); padding: var(--sp-3) var(--sp-3);
    background: linear-gradient(135deg, #fff3d6, #ffe6bd); box-shadow: 0 4px 0 #ecd9a8; cursor: pointer;
    font-family: inherit; text-align: left; }
  .dailycard:active { transform: translateY(2px); box-shadow: 0 2px 0 #ecd9a8; }
  .dico { width: 52px; height: 52px; flex: none; border-radius: 16px; background: #fff; display: flex;
    align-items: center; justify-content: center; box-shadow: 0 3px 0 rgba(61, 52, 40, .12); }
  .dinfo { flex: 1 1 0; min-width: 0; }
  .dtitle { font-size: var(--fs-md); font-weight: 900; color: #b07a1f; white-space: nowrap; line-height: 1.7; }
  .ddesc { font-size: var(--fs-xs); font-weight: 700; color: #a3874f; line-height: 1.7; }
  .ddesc :global(rt) { font-size: var(--fs-rt); }
  .dgo { flex: none; color: #c77800; }

  #stalls { flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr 1fr;
    gap: var(--sp-2); margin-top: var(--sp-2); }
  .stall { position: relative; border: none; border-radius: var(--animal-r-lg); background: #fff;
    box-shadow: var(--animal-shadow); cursor: pointer; overflow: hidden; font-family: inherit;
    display: flex; flex-direction: column; align-items: stretch; padding: 0; min-height: 0; min-width: 0; }
  .stall:active { transform: scale(.97); }
  .stall.coming { background: #f4f1ea; cursor: default; box-shadow: var(--animal-shadow-sm); }
  .stall.coming .sname { color: var(--animal-text-2); }
  .scene { flex: 1 1 0; min-height: 0; display: flex; align-items: center; justify-content: center; padding: var(--sp-1) var(--sp-2) 0; }
  .art { width: 100%; height: 100%; min-height: 0; }
  .sname { flex: none; font-size: var(--fs-sm); font-weight: 900; color: var(--animal-text); text-align: center;
    white-space: nowrap; line-height: 1.8; }
  .sbest { flex: none; text-align: center; font-size: var(--fs-xs); font-weight: 800; color: var(--animal-primary-active);
    padding-bottom: var(--sp-1); white-space: nowrap; line-height: 1.6; }
  .stall.coming .sbest { color: #a89e8d; }

  #morerow { flex: none; display: flex; gap: var(--sp-2); margin-top: var(--sp-2); }
  .morelink { flex: 1; min-height: 48px; border: 2px solid var(--animal-border-light); border-radius: 999px;
    background: #fff; color: var(--animal-text-2); font-size: var(--fs-sm); font-weight: 800; font-family: inherit;
    display: flex; align-items: center; justify-content: center; gap: var(--sp-2); cursor: pointer;
    box-shadow: 0 2px 0 var(--animal-border-light); white-space: nowrap; }
  .morelink:active { transform: translateY(2px); box-shadow: none; }
  .morelink :global(rt) { font-size: var(--fs-rt); }
</style>
