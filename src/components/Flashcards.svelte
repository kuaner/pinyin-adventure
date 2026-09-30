<script lang="ts">
  /* 闪卡复习 v2.4：卡片堆（左滑下一张 / 右滑翻回正面 / 点按翻面听读音）
     Leitner 三盒自评照旧（rate 按钮驱动复习间隔）；零纵向滚动 */
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

  /* ---- 横向拖拽：>55px 左滑 = 下一张（不评分跳过），右滑 = 翻回正面；点按翻面 ---- */
  let x0: number | null = null
  let dx = 0
  let suppressClick = false
  function down(e: PointerEvent) {
    if (finished) return
    x0 = e.clientX
    dx = 0
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function move(e: PointerEvent) {
    if (x0 === null) return
    dx = e.clientX - x0
    const card = document.getElementById('flashcard')
    if (card) { card.style.transition = 'none'; card.style.transform = `translateX(${dx}px) rotate(${dx / 40}deg)` }
  }
  function up() {
    if (x0 === null) return
    const card = document.getElementById('flashcard')
    if (card) { card.style.transition = 'transform .22s ease'; card.style.transform = '' }
    if (Math.abs(dx) > 10) suppressClick = true
    if (dx < -55) skipNext()
    else if (dx > 55 && FC.flipped) flip()
    x0 = null
  }
  function clickFlip() {
    if (suppressClick) { suppressClick = false; return }
    flip()
  }
  function skipNext() {
    if (FC.idx >= FC.deck.length) return
    FC.idx++
    FC.flipped = false
  }
</script>

<section id="v-flash" class="view on" data-screen="flash">
  <div class="ltop">
    <button class="cbtn" data-back="mine" onclick={() => show('mine')} aria-label="返回"><svg viewBox="0 0 24 24" fill="none" stroke="#794f27" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5L7.5 12l7 7" /></svg></button>
    <div class="ltt"><ruby>闪卡复习<rt>shǎn kǎ fù xí</rt></ruby></div>
    <div class="lprog" id="deckinfo">{FC.idx + 1}/{FC.deck.length}</div>
  </div>
  <div class="deckline" id="decktext">{@html deckInfo()}</div>
  <div class="ftabs" id="ftabs">
    {#each tabs as t (t.cat)}
      <button class="ftab" class:on={FC.cat === t.cat} data-cat={t.cat} onclick={() => setCat(t.cat)}>{@html T(t.label)}</button>
    {/each}
  </div>

  <div class="stackwrap">
    <!-- 卡堆：后两张做出堆感 -->
    {#if !finished}
      <div class="ghostcard g2"></div>
      <div class="ghostcard g1"></div>
    {/if}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      id="flashcard"
      role="button"
      tabindex="0"
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
      onclick={clickFlip}
      onkeydown={(e) => e.key === 'Enter' && flip()}
    >
      {#if finished}
        <div style="line-height:1"><Icon name="rainbow" size={60} /></div>
        <div style="font-size:22px;font-weight:900;color:#2FA95C">{@html T('这一盒翻完啦！')}</div>
        <div class="fchint">{@html T('换分类继续，或明天再来')}</div>
      {:else}
        <div class="fcbox" id="fcbox">{@html T('盒')} {cardRec(k).box}</div>
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
        <div class="fchint" id="fchint">{@html FC.flipped ? T('点卡片翻回 · 左滑下一张') : T('点卡片翻面听读音')}</div>
      {/if}
    </div>
  </div>

  <div id="rate">
    <button class="ratebtn r1" data-rate="1" onclick={() => rate(1)}><Ruby text="还不会" /><br><Ruby text="今天再学" /></button>
    <button class="ratebtn r2" data-rate="2" onclick={() => rate(2)}><Ruby text="快会了" /><br><Ruby text="明天再来" /></button>
    <button class="ratebtn r3" data-rate="3" onclick={() => rate(3)}><Ruby text="会啦" />！<br>3<Ruby text="天后再见" /></button>
  </div>
</section>

<style>
  #v-flash { padding: 10px 16px 12px; }
  .ltop { display: flex; align-items: center; gap: 10px; height: 44px; flex: none; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
  .cbtn svg { width: 18px; height: 18px; }
  .ltt { flex: 1; text-align: center; font-size: 16px; font-weight: 900; }
  .lprog { font-size: 11px; font-weight: 900; color: var(--animal-primary-active); background: var(--animal-primary-bg);
    padding: 6px 10px; border-radius: 999px; white-space: nowrap; }
  .ftabs { display: flex; gap: 7px; margin: 8px 0 8px; flex: none; }
  .ftab { flex: 1; min-height: 44px; border: none; border-radius: var(--animal-r-sm); background: #fff; color: var(--animal-text-2);
    font-family: inherit; font-size: 15px; font-weight: 800; box-shadow: 0 3px 0 var(--animal-border-light); cursor: pointer; line-height: 1.8; padding: 4px 2px; }
  .ftab.on { background: var(--animal-primary); color: #fff; box-shadow: 0 3px 0 var(--press-teal); }

  .deckline { flex: none; text-align: center; font-size: 12px; font-weight: 800; color: var(--animal-text-2);
    margin: -4px 0 6px; line-height: 1.7; white-space: nowrap; overflow: hidden; }
  .stackwrap { flex: 1; min-height: 0; position: relative; }
  .ghostcard { position: absolute; left: 14px; right: 14px; background: #fff; border-radius: var(--animal-r-lg);
    border: 3px solid var(--animal-border-light); opacity: .7; }
  .ghostcard.g1 { top: 10px; bottom: -6px; right: 0; }
  .ghostcard.g2 { top: 20px; bottom: -12px; right: -8px; opacity: .4; }

  #flashcard { position: absolute; left: 0; right: 12px; top: 0; bottom: 0; background: #fff; border-radius: var(--animal-r-lg);
    box-shadow: var(--animal-shadow-lg); border: 3px solid var(--animal-border-light);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 11px;
    padding: 24px 18px; cursor: pointer; overflow: hidden; touch-action: pan-y; }
  #flashcard .fcglyph { font-size: clamp(96px, 30vw, 128px); font-weight: 800; line-height: 1.15; color: var(--animal-text); }
  #flashcard .fchint { font-size: 14px; color: var(--animal-text-2); font-weight: 800; line-height: 1.9; }
  #flashcard .fcbox { position: absolute; top: 13px; right: 15px; font-size: 14px; font-weight: 900; color: #fff;
    background: var(--animal-text-2); padding: 4px 12px; border-radius: 12px; z-index: 2; }
  #fcinner { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; width: 100%; }
  #flashcard .fcback { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; max-height: 100%; overflow: hidden; }
  #flashcard .fcread { font-size: 34px; font-weight: 900; color: var(--animal-primary-active); line-height: 1.6; }
  #flashcard .fckj { font-size: 15.5px; font-weight: 800; color: var(--animal-success); background: #eef8e2;
    padding: 8px 14px; border-radius: 14px; text-align: center; line-height: 2.3; max-width: 100%; }
  #flashcard .fcword { font-size: 22px; font-weight: 900; color: var(--animal-text); line-height: 2; }
  #flashcard .fcwp { font-size: 15px; color: var(--animal-text-2); font-weight: 800; }
  #flashcard .fcem { font-size: 44px; line-height: 1.2; }

  #rate { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 9px; margin-top: 10px; flex: none; }
  .ratebtn { min-height: 62px; border: none; border-radius: var(--animal-r); font-family: inherit; font-size: 15px; font-weight: 900;
    color: #fff; cursor: pointer; box-shadow: 0 4px 0 rgba(61,52,40,.15); line-height: 2.05; padding: 4px 2px; }
  .ratebtn:active { transform: translateY(3px); }
  .ratebtn.r1 { background: var(--animal-error); box-shadow: 0 4px 0 var(--animal-error-active); }
  .ratebtn.r2 { background: var(--animal-warning); box-shadow: 0 4px 0 var(--animal-warning-active); }
  .ratebtn.r3 { background: var(--animal-success); box-shadow: 0 4px 0 var(--animal-success-active); }
</style>
