<script lang="ts">
  /* 口诀判断："b 的口诀是'左下半圆'对不对" 👍/👎 */
  import { QZ, answer } from '../../stores/session.svelte'
  import { T } from '../../lib/ruby'
  import Icon from '../Icon.svelte'
  import type { RuleQ as RuleQT } from '../../lib/types'

  let { q }: { q: RuleQT } = $props()
  const reveal = $derived(QZ.reveal)
</script>

<div class="glyphbox" id="glyphbox">
  <div class="ruletext">「{@html T(q.stmt)}」</div>
</div>
<div class="qextra" id="qextra"></div>
<div id="optbox">
  <button class="opt tf yes" class:correct={reveal && reveal.correct === 0} class:wrong={reveal && reveal.wrong.includes(0)} onclick={() => answer(0)}>
    <div class="og"><Icon name="thumbs-up" size={48} /></div><div class="ob">{@html T('对')}</div>
  </button>
  <button class="opt tf no" class:correct={reveal && reveal.correct === 1} class:wrong={reveal && reveal.wrong.includes(1)} onclick={() => answer(1)}>
    <div class="og"><Icon name="thumbs-up" flip="y" size={48} /></div><div class="ob">{@html T('错')}</div>
  </button>
</div>
