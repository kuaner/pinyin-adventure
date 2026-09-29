<script lang="ts">
  /* 辨析卡弹窗：左右对照口诀 + 例词 + 💡技巧提示 */
  import { ui, closePair } from '../stores/ui.svelte'
  import { PAIRS, LETTERS } from '../data'
  import { say } from '../lib/audio'
  import { T } from '../lib/ruby'
  import Icon from './Icon.svelte'

  const p = $derived(ui.pairIdx >= 0 ? PAIRS[ui.pairIdx] : null)
</script>

{#if p}
  {@const la = LETTERS[p.a]}
  {@const lb = LETTERS[p.b]}
  <div class="modal on" id="pairModal" onclick={(e) => { if (e.target === e.currentTarget) closePair() }}>
    <div class="mcard">
      <button class="mclose" id="mclose" onclick={closePair}><Icon name="close" size={18} /></button>
      <div class="mtitle" id="mtitle">{p.a} {@html T('和')} {p.b} {@html T('辨一辨')}</div>
      <div class="mduo" id="mduo">
        <div class="mhalf">
          <div class="mg">{p.a}</div>
          <div class="mkj">{@html T(la.kj)}</div>
          <button class="msay" data-k={p.a} type="button" onclick={(e) => { e.stopPropagation(); say(p.a) }}><Icon name="headphones" size={16} /> {@html T('读一读')}</button>
          <div class="mword">{la.em} {@html T(la.word)}</div>
        </div>
        <div class="mhalf">
          <div class="mg">{p.b}</div>
          <div class="mkj">{@html T(lb.kj)}</div>
          <button class="msay" data-k={p.b} type="button" onclick={(e) => { e.stopPropagation(); say(p.b) }}><Icon name="headphones" size={16} /> {@html T('读一读')}</button>
          <div class="mword">{lb.em} {@html T(lb.word)}</div>
        </div>
      </div>
      <div class="mtip" id="mtip"><Icon name="bulb" size={18} /> {@html T(p.tip)}</div>
    </div>
  </div>
{/if}
