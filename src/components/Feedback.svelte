<script lang="ts">
  /* 反馈层：答对=绿+星星动效，答错=红+正确答案展示（家长可点"继续"跳过） */
  import { QZ, fbSkip } from '../stores/session.svelte'
  import { T } from '../lib/ruby'
  import Icon from './Icon.svelte'

  const fb = $derived(QZ.fb)
  const starLeft = $derived.by(() => (25 + Math.random() * 50) + '%')
</script>

<div id="fb" class={'on ' + (fb!.good ? 'good' : 'bad')}>
  <div id="fbicon"><Icon name={({ celebrate: 'rainbow', detect: 'eye', cheer: 'dumbbell' } as Record<string, string>)[fb!.icon] ?? 'smile'} size={96} /></div>
  <div id="fbtext">{@html T(fb!.text)}</div>
  <div id="fbdetail" style="display:flex">
    <div class="glyph" id="fbglyph">{fb!.glyph}</div>
    <div class="fdesc" id="fbdesc">{@html T(fb!.desc)}</div>
  </div>
  {#if fb!.good}
    {#key QZ.star}
      <div class="floatstar" style="left:{starLeft};top:42%"><Icon name="star" size={34} /></div>
    {/key}
  {/if}
  <button id="fbskip" onclick={fbSkip}>{@html T('继续 ›')}</button>
</div>
