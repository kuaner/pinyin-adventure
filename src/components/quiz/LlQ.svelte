<script lang="ts">
  /* 听看一致：大字模 + 🔊重听 + ✅一样/❌不一样 */
  import { QZ, answer } from '../../stores/session.svelte'
  import { say } from '../../lib/audio'
  import { T } from '../../lib/ruby'
  import Icon from '../Icon.svelte'
  import type { LlQ as LlQT } from '../../lib/types'

  let { q }: { q: LlQT } = $props()
  const reveal = $derived(QZ.reveal)
</script>

<div class="glyphbox" id="glyphbox">
  <div class="glyph">{q.A}</div>
  <button class="replaybtn" type="button" onclick={() => say(q.sound)}><Icon name="headphones" size={30} /></button>
</div>
<div class="qextra" id="qextra"></div>
<div id="optbox">
  <button class="opt tf yes" class:correct={reveal && reveal.correct === 0} class:wrong={reveal && reveal.wrong.includes(0)} onclick={() => answer(0)}>
    <div class="og"><Icon name="check" size={44} /></div><div class="ob">{@html T('一样')}</div>
  </button>
  <button class="opt tf no" class:correct={reveal && reveal.correct === 1} class:wrong={reveal && reveal.wrong.includes(1)} onclick={() => answer(1)}>
    <div class="og"><Icon name="close" size={44} /></div><div class="ob">{@html T('不一样')}</div>
  </button>
</div>
