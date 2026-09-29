<script lang="ts">
  /* 锚点区（v5c：常见字大字+注音+emoji+🔊）——"记住：爸（bà）的 b" */
  import { ANCHORS } from '../data'
  import { playAudio } from '../lib/audio'
  import { T } from '../lib/ruby'
  let { x }: { x: string } = $props()
  const A = $derived(ANCHORS[x])
</script>

{#if A}
  <div class="anchorbar">
    <span class="anchar"><ruby>{A.h}<rt>{A.p}</rt></ruby></span><span class="anem">{A.em}</span>
    <span class="antip">{@html T('记{jì}住{zhù}：')}{A.h}（{A.p}）{@html T('的{de}')} {x}</span>
    <button class="anbtn" type="button" onclick={(e) => {
      e.stopPropagation()
      playAudio('anchor_' + x, { hint: '🔊 锚{máo}点{diǎn}音{yīn}频{pín}缺失：anchor_' + x })
    }}>🔊</button>
  </div>
{/if}
