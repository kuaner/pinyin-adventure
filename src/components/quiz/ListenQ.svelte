<script lang="ts">
  /* 听音选字：大喇叭 + 4 选项（①②③④） */
  import { QZ, answer } from '../../stores/session.svelte'
  import { say } from '../../lib/audio'
  import { PH } from '../../data'
  import { T } from '../../lib/ruby'
  import type { ListenQ as ListenQT } from '../../lib/types'

  let { q }: { q: ListenQT } = $props()
  const CIRC: string[] = (PH as any).circ
  const reveal = $derived(QZ.reveal)
</script>

<div class="glyphbox" id="glyphbox">
  <div style="position:relative">
    <button class="bigsound" type="button" onclick={() => say(q.A)}>🔊<span class="bslabel">{@html T('再{zài}听{tīng}一{yí}遍{biàn}')}</span></button>
  </div>
</div>
<div class="qextra" id="qextra"></div>
<div id="optbox">
  {#each q.opts as k, idx}
    <button class="opt" class:correct={reveal && idx === reveal.correct} class:wrong={reveal && reveal.wrong.includes(idx)} onclick={() => answer(idx)}>
      <div class="og">{k}</div>
      <div class="ob">{CIRC[idx]}</div>
    </button>
  {/each}
</div>
