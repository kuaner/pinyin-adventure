<script lang="ts">
  /* 答题页：闯关/小侦探/常见字/专练共用（顶栏进度 + 题卡，题型渲染交给子组件） */
  import { QZ, quitQuiz, scheduleAutoSay } from '../stores/session.svelte'
  import { say, playAudio } from '../lib/audio'
  import { PH } from '../data'
  import { T } from '../lib/ruby'
  import Icon from './Icon.svelte'
  import ListenQ from './quiz/ListenQ.svelte'
  import LookQ from './quiz/LookQ.svelte'
  import LlQ from './quiz/LlQ.svelte'
  import RuleQ from './quiz/RuleQ.svelte'
  import MirrorDetect from './MirrorDetect.svelte'
  import ZiQuiz from './ZiQuiz.svelte'

  const q = $derived(QZ.q)
  const kindName = $derived((PH.kindNames as Record<string, string>)[(q as any)?.type] || '')

  /* 自动读音：listen/ll 400ms，zi/zword 350ms（出题即读，读音是考题不是反馈） */
  $effect(() => {
    const cur = QZ.q as any
    if (!cur) return
    if (cur.type === 'listen' || cur.type === 'll') {
      scheduleAutoSay(400, () => say(cur.type === 'listen' ? cur.A : cur.sound))
    } else if (cur.type === 'zi' || cur.type === 'zword') {
      scheduleAutoSay(350, () => playAudio(cur.z.f, { hint: '🔊 字音缺失：' + cur.z.f }))
    }
  })
</script>

<section id="v-quiz" class="view on">
  <div class="topbar">
    <button class="backbtn" data-back="quit" onclick={quitQuiz}><Icon name="close" size={22} /></button>
    <h2 id="qtitle">{@html QZ.cfg?.name ?? ''}</h2>
    <div class="scorechip" id="qscore">{@html T('得分 ')}{QZ.score}</div>
  </div>
  <div class="progresswrap">
    <div class="ptext"><span id="qprog">{@html T('第 ')}{QZ.i + 1}/10 {@html T('题')}</span><span id="qkind">{@html T(kindName)}</span></div>
    <div class="pbar"><div class="pfill" id="pfill" style="width:{QZ.i * 10}%"></div></div>
  </div>
  <div class="qcard">
    <div class="qhint" id="qhint">{@html (q as any)?.hint ?? ''}</div>
    {#key QZ.seq}
      {#if (q as any).type === 'listen'}
        <ListenQ q={(q as any)} />
      {:else if (q as any).type === 'look'}
        <LookQ q={(q as any)} />
      {:else if (q as any).type === 'll'}
        <LlQ q={(q as any)} />
      {:else if (q as any).type === 'rule'}
        <RuleQ q={(q as any)} />
      {:else if (q as any).type === 'djudge' || (q as any).type === 'dfix'}
        <MirrorDetect q={(q as any)} />
      {:else}
        <ZiQuiz q={(q as any)} />
      {/if}
    {/key}
  </div>
</section>
