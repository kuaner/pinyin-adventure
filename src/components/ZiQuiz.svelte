<script lang="ts">
  /* 常见字快拼：汉字大字模 → 4 选拼音；出题即读字（读音是考题）+ 🔊重听 */
  import { QZ, armOpt } from '../stores/session.svelte'
  import { playAudio } from '../lib/audio'
  import { PH } from '../data'
  import Icon from './Icon.svelte'
  import type { ZiQ, ZwordQ } from '../lib/types'

  let { q }: { q: ZiQ | ZwordQ } = $props()
  const CIRC: string[] = (PH as any).circ
  const reveal = $derived(QZ.reveal)
  const armed = $derived(QZ.armed)
  const isWord = $derived(q.type === 'zword')
</script>

<div class="glyphbox" id="glyphbox">
  {#if isWord}
    <div class="glyph" style="font-size:clamp(var(--fs-glyph),19vw,var(--fs-glyph-lg));min-width:200px">{(q as ZwordQ).z.w}</div>
  {:else}
    <div class="glyph" style="font-size:clamp(96px,28vw,var(--fs-hero))">{(q as ZiQ).z.h}</div>
  {/if}
  <button class="replaybtn" type="button" onclick={() => playAudio(q.z.f)}><Icon name="headphones" size={30} /></button>
</div>
<div class="qextra" id="qextra"></div>
<div id="optbox">
  {#each q.opts as py, idx}
    <button class="opt wide" class:armed={armed === idx} class:correct={reveal && idx === reveal.correct} class:wrong={reveal && reveal.wrong.includes(idx)} onclick={() => armOpt(idx)}>
      <span class="og" style="font-size:{isWord ? 'var(--fs-xl)' : 'var(--fs-em)'}">{py}</span><span class="ob">{CIRC[idx]}</span>
    </button>
  {/each}
</div>
