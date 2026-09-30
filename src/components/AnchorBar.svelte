<script lang="ts">
  /* 锚点区（v5c：常见字大字+注音+实物图+🔊）——"记住：爸（bà）的 b"。
     v2.1：anchar 锚点字模的 rt 用数据表 A.p（人工核对的锚点音，非引擎产物），听音钮 emoji→Icon */
  import { ANCHORS } from '../data'
  import { playAudio } from '../lib/audio'
  import { tRaw } from '../text/strings'
  import Speak from './Speak.svelte'
  import Icon from './Icon.svelte'
  let { x }: { x: string } = $props()
  const A = $derived(ANCHORS[x])
</script>

{#if A}
  <div class="anchorbar">
    <span class="anchar"><ruby>{A.h}<rt>{A.p}</rt></ruby></span><span class="anem">{A.em}</span>
    <span class="antip"><Speak k="rememberAnchor" vars={{ h: A.h, p: A.p, x }} /></span>
    <button class="anbtn" type="button" aria-label="听锚点读音" onclick={(e) => {
      e.stopPropagation()
      playAudio('anchor_' + x, { hint: tRaw('anchorMissing').replace('{f}', 'anchor_' + x) })
    }}><Icon name="headphones" size={28} /></button>
  </div>
{/if}
