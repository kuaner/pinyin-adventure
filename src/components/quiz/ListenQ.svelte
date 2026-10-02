<script lang="ts">
  /* 听音选字：大喇叭 + 4 选项（①②③④）。
     v4.2c Bug#37 两段式回归（v1 正本行为）：首点=试听该选项读音（高亮）→ 再点同项=作答 */
  import { QZ, armOpt } from '../../stores/session.svelte'
  import { say } from '../../lib/audio'
  import { PH } from '../../data'
  import Speak from '../Speak.svelte'
  import Icon from '../Icon.svelte'
  import type { ListenQ as ListenQT } from '../../lib/types'

  let { q }: { q: ListenQT } = $props()
  const CIRC: string[] = (PH as any).circ
  const reveal = $derived(QZ.reveal)
  const armed = $derived(QZ.armed)
</script>

<div class="glyphbox qslide" id="glyphbox">
  <div style="position:relative">
    <button class="bigsound" type="button" onclick={() => say(q.A)}><Icon name="headphones" size={44} /><span class="bslabel"><Speak k="listenAgain" plain /></span></button>
  </div>
</div>
<div class="qextra" id="qextra"></div>
<div id="optbox">
  {#each q.opts as k, idx}
    <button class="opt" class:armed={armed === idx} class:correct={reveal && idx === reveal.correct} class:wrong={reveal && reveal.wrong.includes(idx)} onclick={() => armOpt(idx)}>
      <div class="og">{k}</div>
      <div class="ob">{CIRC[idx]}</div>
    </button>
  {/each}
</div>
