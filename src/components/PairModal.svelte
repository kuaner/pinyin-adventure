<script lang="ts">
  /* 辨析卡弹窗：左右对照口诀 + 例词 + 💡技巧提示 */
  import { ui, closePair } from '../stores/ui.svelte'
  import { PAIRS, LETTERS } from '../data'
  import { say } from '../lib/audio'
  import { T } from '../lib/ruby'

  const p = $derived(ui.pairIdx >= 0 ? PAIRS[ui.pairIdx] : null)
</script>

{#if p}
  {@const la = LETTERS[p.a]}
  {@const lb = LETTERS[p.b]}
  <div class="modal on" id="pairModal" onclick={(e) => { if (e.target === e.currentTarget) closePair() }}>
    <div class="mcard">
      <button class="mclose" id="mclose" onclick={closePair}>✕</button>
      <div class="mtitle" id="mtitle">{p.a} {@html T('和{hé}')} {p.b} {@html T('辨{biàn}一{yí}辨{biàn}')}</div>
      <div class="mduo" id="mduo">
        <div class="mhalf">
          <div class="mg">{p.a}</div>
          <div class="mkj">{@html T(la.kj)}</div>
          <button class="msay" data-k={p.a} type="button" onclick={(e) => { e.stopPropagation(); say(p.a) }}>🔊 {@html T('读{dú}一{yì}读{dú}')}</button>
          <div class="mword">{la.em} {@html T(la.word)}</div>
        </div>
        <div class="mhalf">
          <div class="mg">{p.b}</div>
          <div class="mkj">{@html T(lb.kj)}</div>
          <button class="msay" data-k={p.b} type="button" onclick={(e) => { e.stopPropagation(); say(p.b) }}>🔊 {@html T('读{dú}一{yì}读{dú}')}</button>
          <div class="mword">{lb.em} {@html T(lb.word)}</div>
        </div>
      </div>
      <div class="mtip" id="mtip">💡 {@html T(p.tip)}</div>
    </div>
  </div>
{/if}
