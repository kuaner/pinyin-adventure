<script lang="ts">
  /* v4.2 练习 tab：🎪游戏岛 / 📚练习馆 分段切换（大号胶囊 toggle，默认游戏岛）。
     游戏岛 = 每日挑战卡 + 8 游戏摊位（4 实装：气球/口诀地鼠/镜像对决/钓鱼；
     4 占位：拼音蛋/声调音乐会/字母赛跑/记忆翻牌"敬请期待"灰卡不误触），2×4 网格零纵向滚动。
     练习馆 = 四入口正经练习回归（Bug#35：反复巩固记忆的需要保留）：
     ⚡闪电刷题 / ✍️听写专练 / 🔄易混对特训 / 📖识字表闯关。
     hall 状态存 ui.hall（跨 tab/跨视图往返保持）。闯关冒险/自由练习保留为底部紧凑入口 */
  import { ui, show } from '../../stores/ui.svelte'
  import { startGame, startDaily, dailyView, gameBest } from '../../stores/game.svelte'
  import { startBolt } from '../../stores/bolt.svelte'
  import { S } from '../../stores/progress.svelte'
  import { GD } from '../../stores/game.svelte'
  import { PAIRS, ZI } from '../../data'
  import { ziUnlocked } from '../../lib/ziGate'
  import Speak from '../Speak.svelte'
  import Icon from '../Icon.svelte'

  const daily = $derived(dailyView())
  const balloonBest = $derived(gameBest('balloon'))
  const moleBest = $derived(gameBest('mole'))
  const duelBest = $derived(gameBest('duel'))
  const fishBest = $derived(gameBest('fish'))

  const STALLS = [
    { id: 'balloon', nameKey: 'stallBalloon', cls: 's-sky' },
    { id: 'mole', nameKey: 'stallMoleKj', cls: 's-grass' },
    { id: 'duel', nameKey: 'stallDuel', cls: 's-sun' },
    { id: 'fish', nameKey: 'stallFish', cls: 's-sea' },
  ] as const

  const COMING = [
    { id: 'egg', nameKey: 'stallEgg' },
    { id: 'tone', nameKey: 'stallTone' },
    { id: 'race', nameKey: 'stallRace' },
    { id: 'memory', nameKey: 'stallMemory' },
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

  /* ---- 练习馆角标（真实进度，账本/权重派生） ---- */
  const boltBadge = $derived(S.bolt.tacc > 0 ? 'boltBestN' : 'fiveMinutes')
  const listenWeak = $derived.by(() => {
    let n = 0
    for (const k in GD.letters) if (GD.letters[k].err > 0) n++
    return n
  })
  const weakPairs = $derived.by(() => {
    const bad = new Set<string>()
    for (const p of PAIRS) { const w = GD.letters[p.a]; const w2 = GD.letters[p.b]
      if ((w && w.err > 0) || (w2 && w2.err > 0)) bad.add(p.a + '|' + p.b) }
    return bad.size
  })
  const ziProg = $derived(ziUnlocked())
</script>

<section id="v-island" class="view on" data-screen="practice" data-hall={ui.hall}>
  <!-- v4.2 分段切换：🎪游戏岛 / 📚练习馆（图标全 SVG——v2.2 铁律） -->
  <div id="hallbar" role="tablist" aria-label="hall">
    <button id="hallbtn-game" class="hallbtn pressable" class:on={ui.hall === 'game'} data-hallbtn="game"
      role="tab" aria-selected={ui.hall === 'game'} onclick={() => { ui.hall = 'game' }}>
      <Icon name="rainbow" size={22} /> <Speak k="islandTitle" />
    </button>
    <button id="hallbtn-drill" class="hallbtn pressable" class:on={ui.hall === 'drill'} data-hallbtn="drill"
      role="tab" aria-selected={ui.hall === 'drill'} onclick={() => { ui.hall = 'drill' }}>
      <Icon name="book" size={22} /> <Speak k="hallDrill" />
    </button>
  </div>

  {#if ui.hall === 'game'}
    <div id="greet">
      <span class="g1"><Speak k="islandSlogan" /></span>
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
              <svg viewBox="0 0 120 66" class="art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
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
              <svg viewBox="0 0 120 66" class="art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <rect x="0" y="0" width="120" height="66" rx="10" fill="#eaf7e2" />
                <ellipse cx="42" cy="52" rx="20" ry="8" fill="#8b5e3c" />
                <path d="M28 52 C 28 38 34 32 42 32 C 50 32 56 38 56 52 Z" fill="#c99b6a" />
                <circle cx="38" cy="44" r="2" fill="#3d3428" />
                <circle cx="46" cy="44" r="2" fill="#3d3428" />
                <path d="M74 18 L 88 32" stroke="#8b5e3c" stroke-width="4" stroke-linecap="round" />
                <rect x="66" y="8" width="16" height="12" rx="3" fill="#f0a35c" transform="rotate(-18 74 14)" />
                <rect x="0" y="58" width="120" height="8" rx="4" fill="#bfe6a8" />
                <circle cx="94" cy="16" r="7" fill="#fff3d6" stroke="#e9b64f" stroke-width="2" />
                <path d="M91 16 L 91 12.5 L 97.5 16 L 91 19.5 Z" fill="#e9b64f" />
                <rect x="90.4" y="20" width="7.2" height="2.6" rx="1.3" fill="#e9b64f" />
              </svg>
            {:else if s.id === 'duel'}
              <svg viewBox="0 0 120 66" class="art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <rect x="0" y="0" width="120" height="66" rx="10" fill="#fff3dc" />
                <path d="M18 30 C 40 44 80 44 102 30" stroke="#c99b6a" stroke-width="5" fill="none" stroke-linecap="round" />
                <circle cx="60" cy="39.5" r="7" fill="#fff" stroke="#e76f51" stroke-width="3" />
                <path d="M60 16 L60 39" stroke="#e76f51" stroke-width="2.5" stroke-dasharray="4 4" />
                <rect x="12" y="24" width="10" height="26" rx="4" fill="#2a9d8f" />
                <rect x="98" y="24" width="10" height="26" rx="4" fill="#e76f51" />
                <rect x="0" y="58" width="120" height="8" rx="4" fill="#f3dfae" />
              </svg>
            {:else}
              <svg viewBox="0 0 120 66" class="art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
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
          <div class="sinfo">
            <div class="sname"><Speak k={s.nameKey} /></div>
            <div class="sbest" data-best={bestOf(s.id)}>
              {#if bestOf(s.id) > 0}<Speak k="bestN" vars={{ n: bestOf(s.id) }} plain />{:else}<Speak k="newGame" plain />{/if}
            </div>
          </div>
        </button>
      {/each}

      <div class="stall coming" data-coming="egg" aria-disabled="true">
        <div class="scene">
          <svg viewBox="0 0 120 66" class="art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <rect x="0" y="0" width="120" height="66" rx="10" fill="#efece4" />
            <ellipse cx="60" cy="38" rx="20" ry="25" fill="#e3ded2" />
            <path d="M46 34 L 60 30 L 74 34 L 66 44 L 52 44 Z" fill="#d6d0c2" stroke="#c4bda9" stroke-width="2" stroke-dasharray="4 3" />
            <rect x="0" y="58" width="120" height="8" rx="4" fill="#dcd6c8" />
          </svg>
        </div>
        <div class="sinfo">
          <div class="sname"><Speak k="stallEgg" /></div>
          <div class="sbest"><Speak k="comingSoon" /></div>
        </div>
      </div>

      <div class="stall coming" data-coming="tone" aria-disabled="true">
        <div class="scene">
          <svg viewBox="0 0 120 66" class="art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <rect x="0" y="0" width="120" height="66" rx="10" fill="#efece4" />
            <path d="M40 46 L40 22 L62 16 L62 40" stroke="#c4bda9" stroke-width="4" fill="none" stroke-linecap="round" />
            <ellipse cx="34" cy="47" rx="8" ry="6" fill="#d6d0c2" />
            <ellipse cx="56" cy="41" rx="8" ry="6" fill="#d6d0c2" />
            <rect x="0" y="58" width="120" height="8" rx="4" fill="#dcd6c8" />
          </svg>
        </div>
        <div class="sinfo">
          <div class="sname"><Speak k="stallTone" /></div>
          <div class="sbest"><Speak k="comingSoon" /></div>
        </div>
      </div>

      <div class="stall coming" data-coming="race" aria-disabled="true">
        <div class="scene">
          <svg viewBox="0 0 120 66" class="art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <rect x="0" y="0" width="120" height="66" rx="10" fill="#efece4" />
            <path d="M8 52 L112 52" stroke="#c4bda9" stroke-width="3" stroke-dasharray="8 6" />
            <path d="M22 50 C 20 40 26 36 34 36 C 42 36 46 42 44 50 Z" fill="#e9b64f" />
            <circle cx="30" cy="43" r="1.8" fill="#3d3428" />
            <path d="M70 50 C 70 40 78 38 84 40 C 90 42 92 48 88 50 Z" fill="#d6d0c2" />
            <rect x="102" y="30" width="4" height="24" rx="2" fill="#c4bda9" />
            <path d="M106 32 L 116 35 L 106 38 Z" fill="#d6d0c2" />
            <rect x="0" y="58" width="120" height="8" rx="4" fill="#dcd6c8" />
          </svg>
        </div>
        <div class="sinfo">
          <div class="sname"><Speak k="stallRace" /></div>
          <div class="sbest"><Speak k="comingSoon" /></div>
        </div>
      </div>

      <div class="stall coming" data-coming="memory" aria-disabled="true">
        <div class="scene">
          <svg viewBox="0 0 120 66" class="art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <rect x="0" y="0" width="120" height="66" rx="10" fill="#efece4" />
            <rect x="30" y="16" width="26" height="34" rx="5" fill="#e3ded2" stroke="#c4bda9" stroke-width="2" />
            <rect x="64" y="16" width="26" height="34" rx="5" fill="#e3ded2" stroke="#c4bda9" stroke-width="2" />
            <circle cx="43" cy="33" r="7" fill="#d6d0c2" />
            <path d="M72 40 L 82 24 L 86 33 L 90 26" stroke="#c4bda9" stroke-width="2.4" fill="none" stroke-linecap="round" />
            <rect x="0" y="58" width="120" height="8" rx="4" fill="#dcd6c8" />
          </svg>
        </div>
        <div class="sinfo">
          <div class="sname"><Speak k="stallMemory" /></div>
          <div class="sbest"><Speak k="comingSoon" /></div>
        </div>
      </div>
    </div>
  {:else}
    <!-- 📚 练习馆：四入口正经练习（老机制回归+错误账本加权） -->
    <div id="drillgrid">
      <button class="dcard d-bolt pressable" data-drill="bolt" onclick={() => startBolt(false)}>
        <div class="dbadge">
          {#if S.bolt.tacc > 0}<Speak k={boltBadge} vars={{ n: S.bolt.tacc }} plain />{:else}<Speak k={boltBadge} plain />{/if}
        </div>
        <div class="mic"><svg viewBox="0 0 24 24" fill="#fff"><path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2z" /></svg></div>
        <div class="dname"><Speak k="boltSprint" /></div>
        <div class="ddesc"><Speak k="boltDesc" /></div>
      </button>

      <button class="dcard d-listen pressable" data-drill="listen" onclick={() => show('listendrill')}>
        <div class="dbadge">
          {#if listenWeak > 0}<Speak k="drillWeakN" vars={{ n: listenWeak }} plain />{:else}<Speak k="newGame" plain />{/if}
        </div>
        <div class="mic"><Icon name="ear" size={24} /></div>
        <div class="dname"><Speak k="drillListen" /></div>
        <div class="ddesc"><Speak k="drillListenDesc" /></div>
      </button>

      <button class="dcard d-pairs pressable" data-drill="pairs" onclick={() => show('pairs')}>
        <div class="dbadge">
          {#if weakPairs > 0}<Speak k="weakPairsN" vars={{ n: weakPairs }} plain />{:else}<Speak k="pairsFourteen" plain />{/if}
        </div>
        <div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="12" r="5.5" /><circle cx="15.5" cy="12" r="5.5" /></svg></div>
        <div class="dname"><Speak k="pairsDrill" /></div>
        <div class="ddesc"><Speak k="pairsDesc" /></div>
      </button>

      <button class="dcard d-zi pressable" data-drill="zi" onclick={() => show('zihall')}>
        <div class="dbadge"><Speak k="ziBadge" vars={{ a: ziProg.length, b: ZI.length }} plain /></div>
        <div class="mic"><Icon name="book" size={24} /></div>
        <div class="dname"><Speak k="drillZi" /></div>
        <div class="ddesc"><Speak k="drillZiDesc" /></div>
      </button>
    </div>
  {/if}

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

  /* ---- 分段切换（大号胶囊 toggle） ---- */
  #hallbar { flex: none; display: flex; gap: 4px; background: #efe9dd; border-radius: 999px; padding: 4px;
    box-shadow: inset 0 2px 3px rgba(61, 52, 40, .08); }
  .hallbtn { flex: 1; min-height: 44px; border: none; border-radius: 999px; background: transparent;
    color: var(--animal-text-2); font-size: var(--fs-md); font-weight: 900; font-family: inherit;
    display: flex; align-items: center; justify-content: center; gap: var(--sp-2); cursor: pointer;
    white-space: nowrap; transition: background .15s, color .15s, box-shadow .15s; padding: 0 var(--sp-2); }
  .hallbtn :global(rt) { font-size: var(--fs-rt); }
  .hallbtn.on { background: #fff; color: var(--animal-text); box-shadow: 0 2px 0 rgba(61, 52, 40, .12); }
  .hallbtn.on :global(.icon-wrap), .hallbtn.on :global(svg) { filter: none; }
  .hallbtn:not(.on) { opacity: .62; }

  /* ---- 游戏岛 ---- */
  #greet { flex: none; margin-top: var(--sp-2); line-height: 1.6; }
  #greet .g1 { font-size: var(--fs-sm); font-weight: 800; color: var(--animal-text-2); white-space: nowrap; }

  .dailycard { flex: none; display: flex; align-items: center; gap: var(--sp-2); width: 100%; margin-top: var(--sp-2);
    border: 2px solid #ffd98e; border-radius: var(--animal-r-lg); padding: var(--sp-1) var(--sp-3);
    background: linear-gradient(135deg, #fff3d6, #ffe6bd); box-shadow: 0 4px 0 #ecd9a8; cursor: pointer;
    font-family: inherit; text-align: left; }
  .dailycard:active { transform: translateY(2px); box-shadow: 0 2px 0 #ecd9a8; }
  .dico { width: 44px; height: 44px; flex: none; border-radius: 14px; background: #fff; display: flex;
    align-items: center; justify-content: center; box-shadow: 0 3px 0 rgba(61, 52, 40, .12); }
  .dinfo { flex: 1 1 0; min-width: 0; }
  .dtitle { font-size: var(--fs-sm); font-weight: 900; color: #b07a1f; white-space: nowrap; line-height: 1.7; }
  .ddesc { font-size: var(--fs-xs); font-weight: 700; color: #a3874f; line-height: 1.6; }
  .ddesc :global(rt) { font-size: var(--fs-rt); }
  .dgo { flex: none; color: #c77800; }

  /* v4.2：8 摊位 2×4 网格——插画全卡铺底（slice 裁切）+ 底部信息浮层（名字+最佳），零纵向滚动 */
  #stalls { flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(4, 1fr);
    gap: var(--sp-1); margin-top: var(--sp-2); }
  .stall { position: relative; border: none; border-radius: var(--animal-r-lg); background: #fff;
    box-shadow: var(--animal-shadow); cursor: pointer; overflow: hidden; font-family: inherit;
    display: flex; flex-direction: column; align-items: stretch; padding: 0; min-height: 0; min-width: 0; }
  .stall:active { transform: scale(.97); }
  .stall.coming { background: #f4f1ea; cursor: default; box-shadow: var(--animal-shadow-sm); }
  .stall.coming .sname { color: var(--animal-text-2); }
  .scene { position: absolute; inset: 0; display: block; }
  .art { width: 100%; height: 100%; min-height: 0; display: block; }
  .sinfo { position: absolute; left: 5px; right: 5px; bottom: 4px; background: rgba(255, 255, 255, .88);
    border-radius: 999px; text-align: center; padding: 1px 4px; box-shadow: 0 1px 3px rgba(61, 52, 40, .10); }
  .sname { font-size: var(--fs-xs); font-weight: 900; color: var(--animal-text); text-align: center;
    white-space: nowrap; line-height: 1.8; }
  .sname :global(rt) { font-size: var(--fs-rt); }
  .sbest { font-size: 10px; font-weight: 800; color: var(--animal-primary-active);
    white-space: nowrap; line-height: 1.3; }
  .sbest :global(rt) { font-size: 10px; }
  .stall.coming .sbest { color: #a89e8d; }

  /* ---- 练习馆 ---- */
  #drillgrid { flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;
    gap: var(--sp-2); margin-top: var(--sp-2); }
  .dcard { position: relative; border: none; border-radius: var(--animal-r-lg); cursor: pointer; overflow: hidden;
    font-family: inherit; display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; gap: var(--sp-1); padding: var(--sp-2); min-height: 0; min-width: 0;
    box-shadow: var(--animal-shadow); }
  .dcard:active { transform: scale(.97); }
  .dcard .mic { width: 48px; height: 48px; border-radius: 16px; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 3px 0 rgba(61, 52, 40, .14); flex: none; }
  .dcard .mic :global(svg) { width: 24px; height: 24px; }
  .dcard .dname { font-size: var(--fs-md); font-weight: 900; line-height: 1.6; white-space: nowrap; max-width: 100%; }
  .dcard .dname :global(rt) { font-size: var(--fs-rt); }
  .dcard .ddesc { font-size: var(--fs-xs); font-weight: 700; color: var(--animal-text-2); line-height: 1.6; max-width: 100%; }
  .dcard .ddesc :global(rt) { font-size: var(--fs-rt); }
  .dbadge { position: absolute; top: var(--sp-2); right: var(--sp-2); font-size: var(--fs-xs); font-weight: 900;
    padding: 2px var(--sp-2); white-space: nowrap; border-radius: 999px; background: rgba(255, 255, 255, .85);
    color: var(--animal-text); box-shadow: 0 1px 4px rgba(61, 52, 40, .12); max-width: calc(100% - var(--sp-4)); }
  .dbadge :global(rt) { font-size: var(--fs-rt); }
  .d-bolt { background: linear-gradient(160deg, #e8edff, #dbe3fb); }
  .d-bolt .mic { background: #889df0; }
  .d-listen { background: linear-gradient(160deg, #e6f9f6, #d2f1ec); }
  .d-listen .mic { background: var(--animal-primary); }
  .d-pairs { background: linear-gradient(160deg, #ffefdd, #ffe6c9); }
  .d-pairs .mic { background: #f5a35c; }
  .d-zi { background: linear-gradient(160deg, #efe9ff, #e5dbfb); }
  .d-zi .mic { background: #b58cff; }

  #morerow { flex: none; display: flex; gap: var(--sp-2); margin-top: var(--sp-2); }
  .morelink { flex: 1; min-height: 48px; border: 2px solid var(--animal-border-light); border-radius: 999px;
    background: #fff; color: var(--animal-text-2); font-size: var(--fs-sm); font-weight: 800; font-family: inherit;
    display: flex; align-items: center; justify-content: center; gap: var(--sp-2); cursor: pointer;
    box-shadow: 0 2px 0 var(--animal-border-light); white-space: nowrap; }
  .morelink:active { transform: translateY(2px); box-shadow: none; }
  .morelink :global(rt) { font-size: var(--fs-rt); }
</style>
