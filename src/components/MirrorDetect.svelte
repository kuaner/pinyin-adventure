<script lang="ts">
  /* 正反小侦探：锚点区 + 正反判断（✅写对了/🔄写反了）+ 修复题（镜像大字→选正确字形）
     选项全部正常字形且互不相同；镜像只出现在题面大字上 */
  import { QZ, answer } from '../stores/session.svelte'
  import { LETTERS, PH } from '../data'
  import { T } from '../lib/ruby'
  import Icon from './Icon.svelte'
  import AnchorBar from './AnchorBar.svelte'
  import type { DjudgeQ, DfixQ } from '../lib/types'

  let { q }: { q: DjudgeQ | DfixQ } = $props()
  const CIRC: string[] = (PH as any).circ
  const reveal = $derived(QZ.reveal)
  const L = $derived(LETTERS[q.X])
</script>

<AnchorBar x={q.X} />
{#if q.type === 'djudge'}
  <div class="glyphbox" id="glyphbox">
    <div class="glyph" class:mirror={q.flipped}>{q.X}</div>
  </div>
  <div class="qextra" id="qextra"></div>
  <div id="optbox">
    <button class="opt tf yes" class:correct={reveal && reveal.correct === 0} class:wrong={reveal && reveal.wrong.includes(0)} onclick={() => answer(0)}>
      <div class="og"><Icon name="check" size={44} /></div><div class="ob">{@html T('写对了')}</div>
    </button>
    <button class="opt tf no" class:correct={reveal && reveal.correct === 1} class:wrong={reveal && reveal.wrong.includes(1)} onclick={() => answer(1)}>
      <div class="og"><Icon name="refresh" size={44} /></div><div class="ob">{@html T('写反了')}</div>
    </button>
  </div>
{:else}
  <div class="glyphbox" id="glyphbox">
    <div class="qbubble"><span class="qbicon"><Icon name="bird" size={22} /></span><span>{@html T('我要写「')}{L.tts}</span><span class="bem">{L.em}</span></div>
    <div class="glyph mirror">{q.X}</div>
  </div>
  <div class="qextra" id="qextra"></div>
  <div id="optbox">
    {#each q.opts as k, idx}
      <button class="opt" class:correct={reveal && idx === reveal.correct} class:wrong={reveal && reveal.wrong.includes(idx)} onclick={() => answer(idx)}>
        <span class="og small">{k}</span><span class="ob">{CIRC[idx]}</span>
      </button>
    {/each}
  </div>
{/if}
