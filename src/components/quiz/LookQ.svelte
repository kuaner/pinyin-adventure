<script lang="ts">
  /* 看字选音：锚点区 + 大字模 + 宽选项（先点喇叭听 → 再点一次确认） */
  import { QZ, answer, armLook } from '../../stores/session.svelte'
  import { PH } from '../../data'
  import { T } from '../../lib/ruby'
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
      <span style="font-size:34px">🔊</span>
      <span class="ob" class:confirm={armed === idx}>{armed === idx ? T('再{zài}点{diǎn}一{yí}次{cì}确{què}认{rèn}') : CIRC[idx]}</span>
    </button>
  {/each}
</div>
<div class="subhint" id="subhint">{@html T('先{xiān}点{diǎn}喇{lǎ}叭{ba}听{tīng}一{yì}听{tīng} ➜ 再{zài}点{diǎn}一{yí}次{cì}选{xuǎn}定{dìng}')}</div>
