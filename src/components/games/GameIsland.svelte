<script lang="ts">
  /* v4.3 练习 tab：🎪游戏岛 / 📚练习馆 分段切换（大号胶囊 toggle，默认游戏岛）。
     游戏岛 = 每日挑战卡 + 6 游戏摊位全部实装（气球/口诀地鼠/镜像对决/钓鱼/拼音蛋/声调音乐会），
     2×3 网格零纵向滚动（v4.3 裁定终版：蛋/音乐会换实装，赛跑/翻牌占位删除）。
     练习馆 = 六入口正经练习：⚡闪电刷题 / ✍️听写专练 / 🔄易混对特训 / 📖识字表闯关
     / ✍️拼读专练 / 🎵声调专练（v4.3 增两件）。
     hall 状态存 ui.hall（跨 tab/跨视图往返保持）。闯关冒险/自由练习保留为底部紧凑入口 */
  import { ui, show } from '../../stores/ui.svelte'
  import { startGame, startDaily, dailyView, gameBest } from '../../stores/game.svelte'
  import { startBolt } from '../../stores/bolt.svelte'
  import Speak from '../Speak.svelte'
  import Icon from '../Icon.svelte'

  const daily = $derived(dailyView())
  const balloonBest = $derived(gameBest('balloon'))
  const moleBest = $derived(gameBest('mole'))
  const duelBest = $derived(gameBest('duel'))
  const fishBest = $derived(gameBest('fish'))
  const eggBest = $derived(gameBest('egg'))
  const toneBest = $derived(gameBest('tone'))

  /* v4.3 终态 6 摊位（裁定 2026-10-01：赛跑/翻牌不上，占位删除） */
  const STALLS = [
    { id: 'balloon', nameKey: 'stallBalloon', cls: 's-sky' },
    { id: 'mole', nameKey: 'stallMoleKj', cls: 's-grass' },
    { id: 'duel', nameKey: 'stallDuel', cls: 's-sun' },
    { id: 'fish', nameKey: 'stallFish', cls: 's-sea' },
    { id: 'egg', nameKey: 'stallEgg', cls: 's-nest' },
    { id: 'tone', nameKey: 'stallTone', cls: 's-note' },
  ] as const

  function bestOf(id: string): number {
    if (id === 'balloon') return balloonBest
    if (id === 'mole') return moleBest
    if (id === 'duel') return duelBest
    if (id === 'fish') return fishBest
    if (id === 'egg') return eggBest
    return toneBest
  }

  function openDaily() {
    startDaily()
  }

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
        {#if daily.done}
          <div class="dsub" data-dailydone><Speak k="dailyDone" /> · <Speak k="dailyBestN" vars={{ n: daily.best }} /></div>
        {/if}
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
            {:else if s.id === 'egg'}
              <svg viewBox="0 0 120 66" class="art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <rect x="0" y="0" width="120" height="66" rx="10" fill="#fdf3e0" />
                <ellipse cx="60" cy="52" rx="34" ry="10" fill="#e8d9b0" />
                <path d="M48 18 C 36 18 30 30 30 40 C 30 50 38 56 48 56 L48 18 Z" fill="#f4a6a4" transform="scale(-1 1) translate(-96 0)" />
                <path d="M72 18 C 84 18 90 30 90 40 C 90 50 82 56 72 56 L72 18 Z" fill="#889df0" />
                <text x="56" y="34" font-size="13" font-weight="900" fill="#3d3428" text-anchor="middle">bā</text>
                <circle cx="58" cy="16" r="7" fill="#ffd94d" stroke="#e9b64f" stroke-width="1.6" />
                <circle cx="55.8" cy="14.8" r="1.2" fill="#3d3428" />
                <circle cx="60.2" cy="14.8" r="1.2" fill="#3d3428" />
                <rect x="0" y="58" width="120" height="8" rx="4" fill="#f3e2b8" />
              </svg>
            {:else if s.id === 'tone'}
              <svg viewBox="0 0 120 66" class="art" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <rect x="0" y="0" width="120" height="66" rx="10" fill="#eef6ff" />
                <path d="M40 46 L40 22 L62 16 L62 40" stroke="#6c86e8" stroke-width="4" fill="none" stroke-linecap="round" />
                <ellipse cx="34" cy="47" rx="8" ry="6" fill="#6c86e8" />
                <ellipse cx="56" cy="41" rx="8" ry="6" fill="#6c86e8" />
                <circle cx="88" cy="22" r="8" fill="#f5c31c" />
                <path d="M82 22 L94 22" stroke="#fff" stroke-width="3" stroke-linecap="round" />
                <circle cx="97" cy="44" r="8" fill="#b58cff" />
                <path d="M91 40 L97 46 L103 40" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" />
                <rect x="0" y="58" width="120" height="8" rx="4" fill="#cfe3f7" />
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
            <!-- P1-9 立法：摊位卡=名+插画；最佳>0 才显副标，「新游戏」meta 副标删除 -->
            {#if bestOf(s.id) > 0}<div class="sbest" data-best={bestOf(s.id)}><Speak k="bestN" vars={{ n: bestOf(s.id) }} plain /></div>{/if}
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <!-- 📚 练习馆：四入口正经练习（老机制回归+错误账本加权） -->
    <div id="drillgrid">
      <button class="dcard d-bolt pressable" data-drill="bolt" onclick={() => startBolt(false)}>
        <div class="mic"><svg viewBox="0 0 24 24" fill="#fff"><path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2z" /></svg></div>
        <div class="dname"><Speak k="boltSprint" /></div>
      </button>

      <button class="dcard d-listen pressable" data-drill="listen" onclick={() => show('listendrill')}>
        <div class="mic"><Icon name="ear" size={24} /></div>
        <div class="dname"><Speak k="drillListen" /></div>
      </button>

      <button class="dcard d-pairs pressable" data-drill="pairs" onclick={() => show('pairs')}>
        <div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="12" r="5.5" /><circle cx="15.5" cy="12" r="5.5" /></svg></div>
        <div class="dname"><Speak k="pairsDrill" /></div>
      </button>

      <button class="dcard d-zi pressable" data-drill="zi" onclick={() => show('zihall')}>
        <div class="mic"><Icon name="book" size={24} /></div>
        <div class="dname"><Speak k="drillZi" /></div>
      </button>

      <!-- v4.3 增两件专练：拼读/声调（纯题目高密度，条目账本加权） -->
      <button class="dcard d-blend pressable" data-drill="blend" onclick={() => show('blendquiz')}>
        <div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="9" cy="12" rx="6" ry="8" /><ellipse cx="16.5" cy="12" rx="4.5" ry="6.5" /></svg></div>
        <div class="dname"><Speak k="hallBlend" /></div>
      </button>

      <button class="dcard d-tone pressable" data-drill="tone" onclick={() => show('tonequiz')}>
        <div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18 L9 5 L19 3 L19 16" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></svg></div>
        <div class="dname"><Speak k="hallTone" /></div>
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
  .dsub { font-size: var(--fs-xs); font-weight: 700; color: #a3874f; line-height: 1.6; }
  .dsub :global(rt) { font-size: var(--fs-rt); }
  .dgo { flex: none; color: #c77800; }

  /* v4.3：6 摊位 2×3 网格（终态）——插画全卡铺底（slice 裁切）+ 底部信息浮层（名字+最佳），零纵向滚动 */
  #stalls { flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, 1fr);
    gap: var(--sp-1); margin-top: var(--sp-2); }
  .stall { position: relative; border: none; border-radius: var(--animal-r-lg); background: #fff;
    box-shadow: var(--animal-shadow); cursor: pointer; overflow: hidden; font-family: inherit;
    display: flex; flex-direction: column; align-items: stretch; padding: 0; min-height: 0; min-width: 0; }
  .stall:active { transform: scale(.97); }
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

  /* ---- 练习馆（v4.3 六入口 2×3） ---- */
  #drillgrid { flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, 1fr);
    gap: var(--sp-1); margin-top: var(--sp-2); }
  .dcard { position: relative; border: none; border-radius: var(--animal-r-lg); cursor: pointer; overflow: hidden;
    font-family: inherit; display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; gap: var(--sp-1); padding: var(--sp-1); min-height: 0; min-width: 0;
    box-shadow: var(--animal-shadow); }
  .dcard:active { transform: scale(.97); }
  /* v4.3 六入口 2×3：卡高约砍 1/3——mic 40px+名称单行+描述≤6 字单行（放不下=压缩，绝不截断丢失） */
  .dcard .mic { width: 40px; height: 40px; border-radius: 13px; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 3px 0 rgba(61, 52, 40, .14); flex: none; }
  .dcard .mic :global(svg) { width: 20px; height: 20px; }
  .dcard .dname { font-size: var(--fs-sm); font-weight: 900; line-height: 1.5; white-space: nowrap; max-width: 100%; }
  .dcard .dname :global(rt) { font-size: var(--fs-rt); }
  .dbadge { position: absolute; top: 6px; right: 6px; font-size: 10px; font-weight: 900;
    padding: 1px 7px; white-space: nowrap; border-radius: 999px; background: rgba(255, 255, 255, .85);
    color: var(--animal-text); box-shadow: 0 1px 4px rgba(61, 52, 40, .12); max-width: calc(100% - 12px); }
  .dbadge :global(rt) { font-size: 10px; }
  .d-bolt { background: linear-gradient(160deg, #e8edff, #dbe3fb); }
  .d-bolt .mic { background: #889df0; }
  .d-listen { background: linear-gradient(160deg, #e6f9f6, #d2f1ec); }
  .d-listen .mic { background: var(--animal-primary); }
  .d-pairs { background: linear-gradient(160deg, #ffefdd, #ffe6c9); }
  .d-pairs .mic { background: #f5a35c; }
  .d-zi { background: linear-gradient(160deg, #efe9ff, #e5dbfb); }
  .d-zi .mic { background: #b58cff; }
  .d-blend { background: linear-gradient(160deg, #fdeef0, #f9dde1); }
  .d-blend .mic { background: #e8899b; }
  .d-tone { background: linear-gradient(160deg, #e9f3ff, #d8e9fb); }
  .d-tone .mic { background: #6c86e8; }

  #morerow { flex: none; display: flex; gap: var(--sp-2); margin-top: var(--sp-2); }
  .morelink { flex: 1; min-height: 48px; border: 2px solid var(--animal-border-light); border-radius: 999px;
    background: #fff; color: var(--animal-text-2); font-size: var(--fs-sm); font-weight: 800; font-family: inherit;
    display: flex; align-items: center; justify-content: center; gap: var(--sp-2); cursor: pointer;
    box-shadow: 0 2px 0 var(--animal-border-light); white-space: nowrap; }
  .morelink:active { transform: translateY(2px); box-shadow: none; }
  .morelink :global(rt) { font-size: var(--fs-rt); }
</style>
