<script lang="ts">
  /* 反馈层：答对=绿+星星动效，答错=红+正确答案展示（家长可点"继续"跳过）。
     v2.5：答错且正确答案是拼音字母时 = PinyinCard mini（字模+读音+口诀一行，统一学习卡片接入点）；
     汉字题（常见字快拼）仍走原 glyph+描述版式 */
  import { QZ, fbSkip } from '../stores/session.svelte'
  import { LETTERS } from '../data'
  import Speak from './Speak.svelte'
  import Icon from './Icon.svelte'
  import PinyinCard from './PinyinCard.svelte'

  const fb = $derived(QZ.fb)
  const starLeft = $derived.by(() => (25 + Math.random() * 50) + '%')
  const pcKey = $derived(fb && (LETTERS as any)[fb.glyph] ? fb.glyph : '')
</script>

<div id="fb" class={'on ' + (fb!.good ? 'good' : 'bad')}>
  <div id="fbicon"><Icon name={({ celebrate: 'rainbow', detect: 'eye', cheer: 'dumbbell' } as Record<string, string>)[fb!.icon] ?? 'smile'} size={96} /></div>
  <div id="fbtext"><Speak text={fb!.text} /></div>
  {#if pcKey && !fb!.good}
    <div id="fbdetail" style="display:flex" data-pcdetail={pcKey}>
      <PinyinCard mode="mini" k={pcKey} />
    </div>
  {:else}
    <div id="fbdetail" style="display:flex">
      <div class="glyph" id="fbglyph">{fb!.glyph}</div>
      <div class="fdesc" id="fbdesc"><Speak text={fb!.desc} /></div>
    </div>
  {/if}
  {#if fb!.good}
    {#key QZ.star}
      <div class="floatstar" style="left:{starLeft};top:42%"><Icon name="star" size={34} /></div>
    {/key}
  {/if}
  <button id="fbskip" onclick={fbSkip}><Speak k="continueBtn" plain /></button>
</div>
