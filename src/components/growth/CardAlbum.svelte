<script lang="ts">
  /* v3.2 拼音卡收集册（spec 要素2）：63 张图鉴式 3 列网格（9 张/页横滑，零纵向滚动）。
     已学=金边+字模+口诀+例词（点卡片读音）；未学=灰色剪影+？。数据=pinyin-cards.json（63 全集）；
     解锁=所在课小测通过（growth.cardUnlocked 派生，单一真相=学习进度）。 */
  import cardData from '../../data/pinyin-cards.json'
  import { CARD_KEYS, cardUnlocked, unlockedCardCount } from '../../stores/growth.svelte'
  import { show } from '../../stores/ui.svelte'
  import { t } from '../../text/strings'
  import { say } from '../../lib/audio'
  import HSteps from '../HSteps.svelte'
  import Speak from '../Speak.svelte'

  interface CardT { k: string; kj: string; word: string; em: string }
  const BYK: Record<string, CardT> = {}
  for (const c of (cardData as any).cards as CardT[]) BYK[c.k] = c

  const PER = 9
  const pages: string[][] = []
  for (let i = 0; i < CARD_KEYS.length; i += PER) pages.push(CARD_KEYS.slice(i, i + PER))
  let cur = $state(0)

  function tapCard(k: string) { if (cardUnlocked(k)) say(k) }
</script>

<section id="v-album" class="view on" data-screen="album">
  <div class="ltop">
    <button class="cbtn" data-back="mine" onclick={() => show('mine')} aria-label="back"><svg viewBox="0 0 24 24" fill="none" stroke="#794f27" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5L7.5 12l7 7" /></svg></button>
    <div class="ltt"><Speak k="albumTitle" /></div>
    <div class="lprog" data-cardcount>{t('cardCountN', { a: unlockedCardCount(), b: CARD_KEYS.length })}</div>
  </div>

  <div class="albumwrap">
    <HSteps n={pages.length} bind:cur>
      {#each pages as pg, pi (pi)}
        <div class="hspage"><div class="agrid" data-albumpage={pi}>
          {#each pg as k (k)}
            {@const c = BYK[k]}
            {@const got = cardUnlocked(k)}
            <button class="alcard" class:got data-card={k} onclick={() => tapCard(k)}>
              {#if got}
                <b class="cglyph" class:long={k.length >= 3}>{k}</b>
                <span class="kj"><Speak text={c.kj} plain /></span>
                <span class="word">{c.em}&nbsp;<Speak text={c.word} plain /></span>
              {:else}
                <b class="qmark">?</b>
              {/if}
            </button>
          {/each}
        </div></div>
      {/each}
    </HSteps>
  </div>

  <div id="pager">
    <div class="adots">
      {#each pages as _, i (i)}<span class="adot" class:on={cur === i}></span>{/each}
    </div>
  </div>
</section>

<style>
  #v-album { height: 100%; display: flex; flex-direction: column; padding: calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-2); }
  .ltop { display: flex; align-items: center; gap: var(--sp-2); height: 44px; flex: 0 0 auto; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
  .cbtn svg { width: 18px; height: 18px; }
  .ltt { flex: 1; text-align: center; font-size: var(--fs-md); font-weight: 900; line-height: 1.8; white-space: nowrap; }
  .lprog { font-size: var(--fs-xs); font-weight: 900; color: #c77800; background: #fff8e0;
    padding: var(--sp-2) var(--sp-3); border-radius: 999px; white-space: nowrap; }

  .albumwrap { flex: 1 1 0; min-height: 0; margin: var(--sp-2) 0 var(--sp-1); }
  .agrid { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr);
    gap: var(--sp-2); width: 100%; }
  .alcard { appearance: none; -webkit-appearance: none; border: 2.5px solid #e3d9c8; border-radius: 16px; background: #f4f0e4; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    padding: var(--sp-1); min-width: 0; min-height: 0; overflow: hidden; font-family: inherit; }
  .alcard.got { border-color: #f0b429; background: #fffdf5; box-shadow: 0 3px 0 #f0e3c0; }
  .alcard:active { transform: scale(.96); }
  .cglyph { font-size: 34px; font-weight: 900; color: var(--animal-text); line-height: 1.25; }
  .cglyph.long { font-size: 20px; }
  .qmark { font-size: 34px; font-weight: 900; color: #c9bda9; line-height: 1.2; }
  .kj { font-size: 10px; font-weight: 700; color: var(--animal-text-2); line-height: 1.5;
    max-width: 100%; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .kj :global(rt) { font-size: 8.5px; }
  .word { font-size: 10.5px; font-weight: 800; color: var(--animal-text); line-height: 1.5;
    max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .word :global(rt) { font-size: 8.5px; }

  #pager { min-height: 26px; flex: none; display: flex; align-items: center; justify-content: center; }
  .adots { display: flex; gap: 6px; }
  .adot { width: 8px; height: 8px; border-radius: 50%; background: var(--animal-border-light); transition: background .2s; }
  .adot.on { background: var(--animal-primary); }
</style>
