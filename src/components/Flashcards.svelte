<script lang="ts">
  /* 闪卡复习：Leitner 三盒（全部/声母/韵母/整体认读），正面字模/背面读音+口诀+例词 */
  import { FC, setCat, flip, rate, deckInfo } from '../stores/flash.svelte'
  import { cardRec } from '../stores/progress.svelte'
  import { show } from '../stores/ui.svelte'
  import { LETTERS } from '../data'
  import { T } from '../lib/ruby'
  import Ruby from './Ruby.svelte'
  import Icon from './Icon.svelte'

  const k = $derived(FC.deck[FC.idx])
  const L = $derived(k ? LETTERS[k] : null)
  const finished = $derived(FC.idx >= FC.deck.length)
  const tabs = [
    { cat: 'all', label: '全部' },
    { cat: 'sm', label: '声母' },
    { cat: 'ym', label: '韵母' },
    { cat: 'zt', label: '整体认读' },
  ] as const
</script>

<section id="v-flash" class="view on">
  <div class="topbar">
    <button class="backbtn" data-back="home" onclick={() => show('home')}>‹</button>
    <h2><Icon name="bookmark" size={26} /> <Ruby text="闪卡复习" /></h2>
  </div>
  <div class="ftabs" id="ftabs">
    {#each tabs as t (t.cat)}
      <button class="ftab" class:on={FC.cat === t.cat} data-cat={t.cat} onclick={() => setCat(t.cat)}>{@html T(t.label)}</button>
    {/each}
  </div>
  <div id="deckinfo">{@html deckInfo()}</div>
  <div id="flashcard" role="button" tabindex="0" onclick={flip} onkeydown={(e) => e.key === 'Enter' && flip()}>
    {#if finished}
      <div style="line-height:1"><Icon name="rainbow" size={60} /></div>
      <div style="font-size:22px;font-weight:900;color:#2FA95C">{@html T('这一盒翻完啦！')}</div>
      <div class="fchint">{@html T('换分类继续，或明天再来')}</div>
    {:else}
      <div class="fcbox" id="fcbox">{@html T('盒')} {k ? cardRec(k).box : 1}</div>
      <div id="fcinner">
        {#if FC.flipped && L}
          <div class="fcback">
            <div class="fcem">{L.em}</div>
            <div class="fcread">{L.tts}</div>
            <div class="fckj">{@html T(L.kj)}</div>
            <div class="fcword">{@html T(L.word)} <span class="fcwp">{L.wp}</span></div>
          </div>
        {:else if k}
          <div class="fcglyph">{k}</div>
        {/if}
      </div>
      <div class="fchint" id="fchint">{@html FC.flipped ? T('再点一下翻回正面') : T('点卡片翻面')}</div>
    {/if}
  </div>
  <div id="rate">
    <button class="ratebtn r1" data-rate="1" onclick={() => rate(1)}><Ruby text="还不会" /><br><Ruby text="今天再学" /></button>
    <button class="ratebtn r2" data-rate="2" onclick={() => rate(2)}><Ruby text="快会了" /><br><Ruby text="明天再来" /></button>
    <button class="ratebtn r3" data-rate="3" onclick={() => rate(3)}><Ruby text="会啦" />！<br>3<Ruby text="天后再见" /></button>
  </div>
</section>
