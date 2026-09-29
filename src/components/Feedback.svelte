<script lang="ts">
  /* 反馈层：答对=绿+🎉+星星动效，答错=红+👀/💪+正确答案展示（家长可点"继续"跳过） */
  import { QZ, fbSkip } from '../stores/session.svelte'
  import { T } from '../lib/ruby'

  const fb = $derived(QZ.fb)
  const starLeft = $derived.by(() => (25 + Math.random() * 50) + '%')
</script>

<div id="fb" class={'on ' + (fb!.good ? 'good' : 'bad')}>
  <div id="fbicon">{fb!.icon}</div>
  <div id="fbtext">{@html T(fb!.text)}</div>
  <div id="fbdetail" style="display:flex">
    <div class="glyph" id="fbglyph">{fb!.glyph}</div>
    <div class="fdesc" id="fbdesc">{@html fb!.desc}</div>
  </div>
  {#if fb!.good}
    {#key QZ.star}
      <div class="floatstar" style="left:{starLeft};top:42%">⭐</div>
    {/key}
  {/if}
  <button id="fbskip" onclick={fbSkip}>{@html T('继{jì}续{xù} ›')}</button>
</div>
