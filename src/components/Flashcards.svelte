<script lang="ts">
  /* 闪卡复习：Leitner 三盒（全部/声母/韵母/整体认读），正面字模/背面读音+口诀+例词 */
  import { FC, setCat, flip, rate, deckInfo } from '../stores/flash.svelte'
  import { cardRec } from '../stores/progress.svelte'
  import { show } from '../stores/ui.svelte'
  import { LETTERS } from '../data'
  import { T } from '../lib/ruby'

  const k = $derived(FC.deck[FC.idx])
  const L = $derived(k ? LETTERS[k] : null)
  const finished = $derived(FC.idx >= FC.deck.length)
  const tabs = [
    { cat: 'all', label: '全{quán}部{bù}' },
    { cat: 'sm', label: '声{shēng}母{mǔ}' },
    { cat: 'ym', label: '韵{yùn}母{mǔ}' },
    { cat: 'zt', label: '整{zhěng}体{tǐ}认{rèn}读{dú}' },
  ] as const
</script>

<section id="v-flash" class="view on">
  <div class="topbar">
    <button class="backbtn" data-back="home" onclick={() => show('home')}>‹</button>
    <h2><ruby>闪<rt>shǎn</rt></ruby><ruby>卡<rt>kǎ</rt></ruby><ruby>复<rt>fù</rt></ruby><ruby>习<rt>xí</rt></ruby></h2>
  </div>
  <div class="ftabs" id="ftabs">
    {#each tabs as t (t.cat)}
      <button class="ftab" class:on={FC.cat === t.cat} data-cat={t.cat} onclick={() => setCat(t.cat)}>{@html T(t.label)}</button>
    {/each}
  </div>
  <div id="deckinfo">{@html deckInfo()}</div>
  <div id="flashcard" role="button" tabindex="0" onclick={flip} onkeydown={(e) => e.key === 'Enter' && flip()}>
    {#if finished}
      <div style="font-size:60px">🎉</div>
      <div style="font-size:22px;font-weight:900;color:#2FA95C">{@html T('这{zhè}一{yí}盒{hé}翻{fān}完{wán}啦{la}！')}</div>
      <div class="fchint">{@html T('换{huàn}分{fēn}类{lèi}继{jì}续{xù}，或{huò}明{míng}天{tiān}再{zài}来{lái}')}</div>
    {:else}
      <div class="fcbox" id="fcbox">{@html T('盒{hé}')} {k ? cardRec(k).box : 1}</div>
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
      <div class="fchint" id="fchint">{@html FC.flipped ? T('再{zài}点{diǎn}一{yí}下{xià}翻{fān}回{huí}正{zhèng}面{miàn}') : T('点{diǎn}卡{kǎ}片{piàn}翻{fān}面{miàn} 👆')}</div>
    {/if}
  </div>
  <div id="rate">
    <button class="ratebtn r1" data-rate="1" onclick={() => rate(1)}><ruby>还<rt>hái</rt></ruby><ruby>不<rt>bú</rt></ruby><ruby>会<rt>huì</rt></ruby><br><ruby>今<rt>jīn</rt></ruby><ruby>天<rt>tiān</rt></ruby><ruby>再<rt>zài</rt></ruby><ruby>学<rt>xué</rt></ruby></button>
    <button class="ratebtn r2" data-rate="2" onclick={() => rate(2)}><ruby>快<rt>kuài</rt></ruby><ruby>会<rt>huì</rt></ruby><ruby>了<rt>le</rt></ruby><br><ruby>明<rt>míng</rt></ruby><ruby>天<rt>tiān</rt></ruby><ruby>再<rt>zài</rt></ruby><ruby>来<rt>lái</rt></ruby></button>
    <button class="ratebtn r3" data-rate="3" onclick={() => rate(3)}><ruby>会<rt>huì</rt></ruby><ruby>啦<rt>la</rt></ruby>！<br>3<ruby>天<rt>tiān</rt></ruby><ruby>后<rt>hòu</rt></ruby><ruby>再<rt>zài</rt></ruby><ruby>见<rt>jiàn</rt></ruby></button>
  </div>
</section>
