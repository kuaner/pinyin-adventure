<script lang="ts">
  /* 闪卡复习 v2.4：卡片堆（左滑下一张 / 右滑翻回正面 / 点按翻面听读音）
     Leitner 三盒自评照旧（rate 按钮驱动复习间隔）；零纵向滚动 */
  import { FC, setCat, flip, rate, deckInfo } from '../stores/flash.svelte'
  import { cardRec } from '../stores/progress.svelte'
  import { show } from '../stores/ui.svelte'
  import Speak from './Speak.svelte'
  import Icon from './Icon.svelte'
  import PinyinCard from './PinyinCard.svelte'
  import type { StringKey } from '../text/strings'

  const k = $derived(FC.deck[FC.idx])
  const finished = $derived(FC.idx >= FC.deck.length)
  const tabs: { cat: 'all' | 'sm' | 'ym' | 'zt'; k: StringKey }[] = [
    { cat: 'all', k: 'catAll' },
    { cat: 'sm', k: 'catSm' },
    { cat: 'ym', k: 'catYm' },
    { cat: 'zt', k: 'catZt' },
  ]

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
    <button class="cbtn" data-back="mine" onclick={() => show('mine')} aria-label="back"><svg viewBox="0 0 24 24" fill="none" stroke="#794f27" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5L7.5 12l7 7" /></svg></button>
    <div class="ltt"><Speak k="flashReview" /></div>
    <div class="lprog" id="deckinfo">{FC.idx + 1}/{FC.deck.length}</div>
  </div>
  <div class="deckline" id="decktext"><Speak text={deckInfo()} /></div>
  <div class="ftabs" id="ftabs">
    {#each tabs as tb (tb.cat)}
      <button class="ftab" class:on={FC.cat === tb.cat} data-cat={tb.cat} onclick={() => setCat(tb.cat)}><Speak k={tb.k} /></button>
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
        <div style="font-size:var(--fs-lg);font-weight:900;color:#2FA95C"><Speak k="boxDone" /></div>
        <div class="fchint"><Speak k="boxDoneHint" /></div>
      {:else}
        <div class="fcbox" id="fcbox"><Speak k="boxLabel" plain /> {cardRec(k).box}</div>
        <div id="fcinner">
          <!-- v2.5 PinyinCard card 档：正面=字模+口诀，翻面=笔顺动画+例词（统一学习卡片接入点） -->
          {#if k}<PinyinCard mode="card" k={k} flipped={FC.flipped} />{/if}
        </div>
        <div class="fchint" id="fchint">{#if FC.flipped}<Speak k="flipHintBack" />{:else}<Speak k="flipHintFront" />{/if}</div>
      {/if}
    </div>
  </div>

  <div id="rate">
    <button class="ratebtn r1" data-rate="1" onclick={() => rate(1)}><Speak k="rateNotYet" plain /><br><Speak k="rateToday" plain /></button>
    <button class="ratebtn r2" data-rate="2" onclick={() => rate(2)}><Speak k="rateAlmost" plain /><br><Speak k="rateTomorrow" plain /></button>
    <button class="ratebtn r3" data-rate="3" onclick={() => rate(3)}><Speak k="rateGot" plain />！<br>3<Speak k="rateDays" plain /></button>
  </div>
</section>

<style>
  #v-flash { padding: calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-3); }
  .ltop { display: flex; align-items: center; gap: var(--sp-2); height: 44px; flex: none; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
  .cbtn svg { width: 18px; height: 18px; }
  .ltt { flex: 1; text-align: center; font-size:var(--fs-md); font-weight: 900; }
  .lprog { font-size:var(--fs-xs); font-weight: 900; color: var(--animal-primary-active); background: var(--animal-primary-bg);
    padding: var(--sp-2) var(--sp-2); border-radius: 999px; white-space: nowrap; }
  .ftabs { display: flex; gap: var(--sp-2); margin: var(--sp-2) 0 var(--sp-2); flex: none; }
  /* v2.8：四分类 tab 等宽不吹爆（长名两行内换行） */
  .ftab { flex: 1; min-width: 0; min-height: 44px; border: none; border-radius: var(--animal-r-sm); background: #fff; color: var(--animal-text-2);
    font-family: inherit; font-size:var(--fs-sm); font-weight: 800; box-shadow: 0 3px 0 var(--animal-border-light); cursor: pointer; line-height: 1.5; padding: var(--sp-1) var(--sp-1); }
  .ftab.on { background: var(--animal-primary); color: #fff; box-shadow: 0 3px 0 var(--press-teal); }
  .ftab :global(.rw) { white-space: normal; word-break: break-all; }

  .deckline { flex: none; text-align: center; font-size:var(--fs-xs); font-weight: 800; color: var(--animal-text-2);
    margin: 0 0 var(--sp-2); line-height: 1.5; }
  .stackwrap { flex: 1; min-height: 0; position: relative; }
  .ghostcard { position: absolute; left: 14px; right: 14px; background: #fff; border-radius: var(--animal-r-lg);
    border: 3px solid var(--animal-border-light); opacity: .7; }
  .ghostcard.g1 { top: 10px; bottom: -6px; right: 0; }
  .ghostcard.g2 { top: 20px; bottom: -12px; right: -8px; opacity: .4; }

  #flashcard { position: absolute; left: 0; right: 12px; top: 0; bottom: 0; background: #fff; border-radius: var(--animal-r-lg);
    box-shadow: var(--animal-shadow-lg); border: 3px solid var(--animal-border-light);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-3);
    padding: var(--sp-5) var(--sp-4); cursor: pointer; overflow: hidden; touch-action: pan-y; }
  #flashcard .fcglyph { font-size: clamp(96px,30vw,var(--fs-hero)); font-weight: 800; line-height: 1.15; color: var(--animal-text); }
  #flashcard .fchint { font-size:var(--fs-xs); color: var(--animal-text-2); font-weight: 800; line-height: 1.9; }
  #flashcard .fcbox { position: absolute; top: 13px; right: 15px; font-size:var(--fs-xs); font-weight: 900; color: #fff;
    background: var(--animal-text-2); padding: var(--sp-1) var(--sp-3); border-radius: 12px; z-index: 2; }
  #fcinner { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; width: 100%; }

  #rate { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--sp-2); margin-top: var(--sp-2); flex: none; }
  .ratebtn { min-width: 0; min-height: 62px; border: none; border-radius: var(--animal-r); font-family: inherit; font-size:var(--fs-sm); font-weight: 900;
    color: #fff; cursor: pointer; box-shadow: 0 4px 0 rgba(61,52,40,.15); line-height: 2.05; padding: var(--sp-1) var(--sp-1); }
  .ratebtn:active { transform: translateY(3px); }
  .ratebtn.r1 { background: var(--animal-error); box-shadow: 0 4px 0 var(--animal-error-active); }
  .ratebtn.r2 { background: var(--animal-warning); box-shadow: 0 4px 0 var(--animal-warning-active); }
  .ratebtn.r3 { background: var(--animal-success); box-shadow: 0 4px 0 var(--animal-success-active); }
</style>
