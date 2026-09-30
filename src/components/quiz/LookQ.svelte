<script lang="ts">
  /* 看字选音：锚点区 + 大字模 + 宽选项（先点喇叭听 → 再点一次确认） */
  import { QZ, answer, armLook } from '../../stores/session.svelte'
  import { PH } from '../../data'
  import Speak from '../Speak.svelte'
  import Icon from '../Icon.svelte'
  import AnchorBar from '../AnchorBar.svelte'
  import type { LookQ as LookQT } from '../../lib/types'

  let { q }: { q: LookQT } = $props()
  const CIRC: string[] = (PH as any).circ
  const reveal = $derived(QZ.reveal)
  const armed = $derived(QZ.armed)
</script>

<AnchorBar x={q.A} />
<div class="glyphbox" id="glyphbox">
  <div class="glyph">{q.A}</div>
</div>
<div class="qextra" id="qextra"></div>
<div id="optbox">
  {#each q.opts as _k, idx}
    <button
      class="opt wide"
      class:armed={armed === idx}
      class:correct={reveal && idx === reveal.correct}
      class:wrong={reveal && reveal.wrong.includes(idx)}
      onclick={() => armLook(idx)}
    >
      <Icon name="headphones" size={34} />
      <span class="ob" class:confirm={armed === idx}>{#if armed === idx}<Speak k="confirmAgain" plain />{:else}{CIRC[idx]}{/if}</span>
    </button>
  {/each}
</div>
<div class="subhint" id="subhint"><Speak k="lookSubHint" /></div>
