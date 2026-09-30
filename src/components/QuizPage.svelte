<script lang="ts">
  /* 答题页：闯关/小侦探/常见字/专练共用（顶栏进度 + 题卡，题型渲染交给子组件）
     v2.3：ll 听看一致 / rule 错句判断删除（零错误信息铁律），新增 kj 口诀正向回忆；
     Bug#2 收口：题面指令 hint 等中文文案渲染层一律过 T() 注音（数据层纯文本）
     v2.4：全屏专注态零纵向滚动；答完左滑 = 跳过反馈等价（下一题） */
  import { QZ, answer, quitQuiz, fbSkip, scheduleAutoSay } from '../stores/session.svelte'
  import { say, playAudio } from '../lib/audio'
  import { PH } from '../data'
  import { T } from '../lib/ruby'
  import Icon from './Icon.svelte'
  import ListenQ from './quiz/ListenQ.svelte'
  import LookQ from './quiz/LookQ.svelte'
  import MirrorDetect from './MirrorDetect.svelte'
  import ZiQuiz from './ZiQuiz.svelte'

  const q = $derived(QZ.q)
  const kindName = $derived((PH.kindNames as Record<string, string>)[(q as any)?.type] || '')
  const CIRC: string[] = (PH as any).circ
  const reveal = $derived(QZ.reveal)

  /* 自动读音：listen 400ms，zi/zword 350ms（出题即读，读音是考题不是反馈） */
  $effect(() => {
    const cur = QZ.q as any
    if (!cur) return
    if (cur.type === 'listen') {
      scheduleAutoSay(400, () => say(cur.A))
    } else if (cur.type === 'zi' || cur.type === 'zword') {
      scheduleAutoSay(350, () => playAudio(cur.z.f, { hint: '字音缺失：' + cur.z.f }))
    }
  })

  /* 题内左滑：反馈层在显示时 = 提前进入下一题（R1 翻页零音效） */
  let sx: number | null = null
  function dwn(e: PointerEvent) { sx = e.clientX }
  function up2(e: PointerEvent) {
    if (sx === null) return
    if (sx - e.clientX > 55 && QZ.fb) fbSkip()
    sx = null
  }
</script>

<section id="v-quiz" class="view on" data-screen="quiz">
  <div class="ltop">
    <button class="cbtn" data-back="quit" onclick={quitQuiz} aria-label="退出"><Icon name="close" size={20} /></button>
    <div class="ltt" id="qtitle">{@html QZ.cfg?.name ?? ''}</div>
    <div class="lprog" id="qscore">{@html T('得分 ')}{QZ.score}</div>
  </div>
  <div class="progresswrap">
    <div class="ptext"><span id="qprog">{@html T('第 ')}{QZ.i + 1}/10 {@html T('题')}</span><span id="qkind">{@html T(kindName)}</span></div>
    <div class="pbar"><div class="pfill" id="pfill" style="width:{QZ.i * 10}%"></div></div>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="qcard" onpointerdown={dwn} onpointerup={up2}>
    <div class="qhint" id="qhint">{@html T((q as any)?.hint ?? '')}</div>
    {#key QZ.seq}
      {#if (q as any).type === 'listen'}
        <ListenQ q={(q as any)} />
      {:else if (q as any).type === 'look'}
        <LookQ q={(q as any)} />
      {:else if (q as any).type === 'kj'}
        <div class="glyphbox" id="glyphbox">
          <div class="ruletext">「{@html T((q as any).stmt)}」</div>
        </div>
        <div class="qextra" id="qextra"></div>
        <div id="optbox">
          {#each (q as any).opts as k, idx}
            <button
              class="opt"
              class:correct={reveal && idx === reveal?.correct}
              class:wrong={reveal && reveal.wrong.includes(idx)}
              onclick={() => answer(idx)}
            >
              <div class="og">{k}</div>
              <div class="ob">{CIRC[idx]}</div>
            </button>
          {/each}
        </div>
      {:else if (q as any).type === 'djudge' || (q as any).type === 'dfix'}
        <MirrorDetect q={(q as any)} />
      {:else}
        <ZiQuiz q={(q as any)} />
      {/if}
    {/key}
  </div>
</section>

<style>
  .ltop { display: flex; align-items: center; gap: 10px; height: 44px; flex: none; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
  .ltt { flex: 1; text-align: center; font-size: 16px; font-weight: 900; line-height: 1.8; }
  .lprog { font-size: 12px; font-weight: 900; color: var(--animal-primary-active); background: var(--animal-primary-bg);
    padding: 6px 11px; border-radius: 999px; white-space: nowrap; }
  .qcard { flex: 1; min-height: 0; touch-action: pan-y; }
</style>

