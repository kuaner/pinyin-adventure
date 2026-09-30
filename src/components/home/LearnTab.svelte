<script lang="ts">
  /* v2.4 学习 tab（打样屏1）：一屏一事 —— 主角 = 当前课字模。
     当前课大卡（四线三格 + 断点续学 CTA）+ 12 课横向胶囊条（唯一允许滚动件）+ 🎧口诀小广播入口 */
  import { onMount } from 'svelte'
  import lessonsData from '../../data/lessons.json'
  import { LETTERS } from '../../data'
  import { L as LRN, quizPassed, currentLesson } from '../../stores/learn.svelte'
  import { openLesson, show } from '../../stores/ui.svelte'
  import { totalStars } from '../../stores/progress.svelte'
  import { say } from '../../lib/audio'
  import Speak from '../Speak.svelte'
  import { t, type StringKey } from '../../text/strings'

  const LESSONS = (lessonsData as any).lessons as { n: number; title: string; label: string; letters: { k: string; kj: string }[] }[]
  const ALL_STEPS: StringKey[] = ['stepKnow', 'stepWrite', 'stepTone', 'stepBlend', 'stepQuiz']

  const cur = $derived(currentLesson(LESSONS.length))
  const lesson = $derived(LESSONS[cur - 1])
  /* v2.9 步骤架构跟内容走（BUGS#17）：纯韵母课 4 步无拼读，断点/CTA 步名同步适配 */
  const steps = $derived.by(() => {
    const hb = (lesson as any).hasBlend ?? !!((lesson as any).blends?.length || (lesson as any).ztlist?.length)
    return hb ? ALL_STEPS : ALL_STEPS.filter((k) => k !== 'stepBlend')
  })
  const bp = $derived(Math.min(steps.length, LRN.step[cur] || 1))   // 动态步数断点
  const bpKey = $derived(steps[bp - 1])
  const passedCur = $derived(quizPassed(cur))

  let li = $state(0)                                             // 大卡当前字母
  let capsEl: HTMLDivElement
  const letters = $derived(lesson.letters)
  const letter = $derived(letters[Math.min(li, letters.length - 1)])

  /* 口诀「张大嘴巴 a a a」拆 汉字 + 字母两段 */
  const kjParts = $derived.by(() => {
    const kj = letter.kj || ''
    const m = kj.match(/^([一-鿿，、！？]+)\s*(.*)$/)
    return m ? [m[1], m[2]] : [kj, '']
  })

  onMount(() => {
    /* 胶囊条滚到当前课 */
    requestAnimationFrame(() => {
      capsEl?.querySelector('.cap.cur')?.scrollIntoView({ inline: 'center', block: 'nearest' })
    })
  })
</script>

<section id="v-learntab" class="view on" data-screen="learn">
  <div class="rowhead">
    <div class="h1"><Speak k="pinyinIsland" /><small>PIN YIN</small></div>
    <div class="chip" id="starchip"><svg viewBox="0 0 24 24" fill="#f5c31c" stroke="#dba90e" stroke-width="1.5" stroke-linejoin="round"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z" /></svg>{totalStars()}</div>
  </div>

  <div class="card" id="hero">
    <div class="lchip">
      <Speak k="lessonN" vars={{ n: cur }} /> · <Speak text={lesson.title} />
    </div>
    <div id="letters" class="grid4" class:n4={letters.length >= 4} class:n5={letters.length >= 5}>
      {#each letters as l, i (l.k)}
        <button class="letterbtn" data-ler={l.k} onclick={() => { li = i; say(l.k) }} aria-label={l.k}>
          <span class="letter" class:curo={i === li}>{l.k}</span>
        </button>
      {/each}
    </div>
    <div id="koujue">{#if kjParts[0]}<Speak text={kjParts[0]} />{/if}{#if kjParts[1]}<span class="kj-en">{kjParts[1]}</span>{/if}</div>
    <div id="steps5">
      {#each steps as s, i (s)}
        <i class:d={i < bp - 1 || passedCur} class:c={i === bp - 1 && !passedCur}></i>
      {/each}
    </div>
    <button id="cta" data-cta onclick={() => openLesson(cur, li)}>
      {#if passedCur}
        <Speak k="restudy" plain /> · <Speak k="stepKnow" plain />
      {:else}
        <Speak k="continueLearning" plain /> · <Speak k={bpKey} plain />
      {/if}
    </button>
  </div>

  <div id="mapbar">
    <div class="sec-label"><b><Speak k="courseMapN" vars={{ n: 12 }} /></b><span><Speak k="swipeHintH" /></span></div>
    <div id="caps" bind:this={capsEl}>
      {#each LESSONS as ls (ls.n)}
        {@const done = quizPassed(ls.n)}
        {@const isCur = ls.n === cur}
        <button
          class="cap" class:done class:cur={isCur} class:locked={ls.n > LRN.u}
          data-lesson={ls.n}
          onclick={() => { if (ls.n <= LRN.u) openLesson(ls.n) }}
        >
          <b>{#if done}✓{:else if isCur}{t('lessonN', { n: ls.n })}{:else}{ls.n}{/if}</b>
          <i>{ls.label}</i>
        </button>
      {/each}
    </div>
  </div>

  <button id="radio" class="pressable" data-radio onclick={() => show('radio')}>
    <div class="ric"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13a8 8 0 0116 0" /><rect x="3" y="13" width="4" height="7" rx="2" fill="#fff" stroke="none" /><rect x="17" y="13" width="4" height="7" rx="2" fill="#fff" stroke="none" /></svg></div>
    <div class="rtx">
      <b><Speak k="radioTitle" plain /></b>
      <span><Speak k="radioSlogan" /></span>
    </div>
    <div class="rplay"><svg viewBox="0 0 24 24" fill="#dba90e"><path d="M8 5.5v13l11-6.5z" /></svg></div>
  </button>
</section>

<style>
  #v-learntab { padding: calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-3); gap: 0; }
  .rowhead { display: flex; align-items: center; justify-content: space-between; height: 34px; flex: none; }
  .rowhead .h1 { font-size:var(--fs-lg); font-weight: 900; letter-spacing: .5px; }
  .rowhead .h1 small { font-size:var(--fs-xs); font-weight: 700; color: var(--animal-text-dis); margin-left: var(--sp-2); }
  .chip { display: inline-flex; align-items: center; gap: var(--sp-1); padding: var(--sp-1) var(--sp-3); border-radius: 999px;
    font-size:var(--fs-xs); font-weight: 800; background: #fff; box-shadow: var(--animal-shadow); white-space: nowrap; }
  .chip svg { width: 14px; height: 14px; }

  #hero { flex: 1; min-height: 0; margin-top: var(--sp-3); padding: var(--sp-4) var(--sp-4) var(--sp-4); display: flex; flex-direction: column; position: relative;
    overflow: hidden; }   /* BUGS#24：卡内内容（字模条）再怎么高也压在卡内，绝不涂到课程地图条 */
  /* 课名 chip（v2.9.4 换行立法修订）：一行显示不换行（旧"超宽自动两行"废除——换行撑高=滚动条根源） */
  #hero .lchip { align-self: flex-start; background: var(--animal-primary-bg); color: var(--animal-primary-active);
    font-size:var(--fs-xs); font-weight: 900; padding: var(--sp-1) var(--sp-3); border-radius: var(--animal-r); line-height: 1.6;
    max-width: 100%; text-align: left; white-space: nowrap; }
  .grid4 { position: relative; }
  .grid4::before { content: ''; position: absolute; left: 0; right: 0; top: 12%; bottom: 14%; pointer-events: none;
    background-image: linear-gradient(#e3d3b6, #e3d3b6), linear-gradient(#e3d3b6, #e3d3b6), linear-gradient(#e3d3b6, #e3d3b6), linear-gradient(#e3d3b6, #e3d3b6);
    background-size: 100% 1.5px; background-position: 0 0, 0 33.33%, 0 66.66%, 0 100%; background-repeat: no-repeat; opacity: .55; border-radius: 4px; }
  /* v2.8：字模条按字母数适配（4~5 个字母自动降档，零溢出） */
  #letters { flex: 1; display: flex; align-items: center; justify-content: center; gap: var(--sp-4); min-height: 0; padding-bottom: var(--sp-2); }
  #letters.n4 { gap: var(--sp-3); }
  #letters.n5 { gap: var(--sp-2); }
  .letterbtn { border: none; background: none; font-family: inherit; padding: 0; min-width: 0; }
  .letter { font-weight: 900; font-size:var(--fs-hero); line-height: 1; color: var(--animal-text-dis); opacity: .5; position: relative;
    z-index: 1; transition: .2s; display: block; }
  #letters.n4 .letter { font-size:var(--fs-glyph-lg); }
  #letters.n5 .letter { font-size:var(--fs-glyph); }
  .letter.curo { color: var(--animal-primary); opacity: 1; text-shadow: 0 6px 0 rgba(18,157,143,.18); }
  .letter.curo::after { content: ''; position: absolute; left: 50%; transform: translateX(-50%); bottom: -14px;
    width: 12px; height: 12px; border-radius: 50%; background: var(--animal-warning); box-shadow: 0 2px 0 var(--animal-warning-active); }
  #koujue { display: flex; align-items: center; justify-content: center; gap: var(--sp-2); font-size:var(--fs-md); font-weight: 800; line-height: 2.1; flex: none; }    /* 口诀全文=长内容允许换行 */
  #koujue .kj-en { font-weight: 900; color: var(--animal-primary-active); font-size:var(--fs-md); letter-spacing: 2px; }
  #steps5 { display: flex; justify-content: center; gap: var(--sp-2); margin: var(--sp-3) 0 var(--sp-3); flex: none; }
  #steps5 i { width: 34px; height: 7px; border-radius: 7px; background: var(--animal-border-light); }
  #steps5 i.d { background: var(--animal-primary); }
  #steps5 i.c { background: var(--animal-warning); }
  #cta { height: 62px; border: none; border-radius: 999px; background: var(--animal-primary); color: #fff; font-family: inherit;
    font-size:var(--fs-md); font-weight: 900; letter-spacing: 1px; box-shadow: 0 5px 0 var(--press-teal), var(--animal-shadow-lg); cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: var(--sp-2); flex: none; white-space: nowrap; }
  #cta:active { transform: translateY(3px); box-shadow: 0 2px 0 var(--press-teal); }
  #cta rt { color: #fff; opacity: .85; }

  #mapbar { margin-top: var(--sp-3); flex: none; }
  .sec-label { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); margin-bottom: var(--sp-2); }
  .sec-label b { font-size:var(--fs-xs); font-weight: 900; white-space: nowrap; }
  .sec-label span { font-size:var(--fs-xs); font-weight: 700; color: var(--animal-text-dis); white-space: nowrap; }
  #caps { display: flex; gap: var(--sp-2); overflow-x: auto; padding-bottom: var(--sp-1); scrollbar-width: none; }
  #caps::-webkit-scrollbar { display: none; }
  /* 课程地图 Tab（BUGS#25+#27）：标签零换行一行显示——宽度不够由横滑消化（硬约束#10），
     chip 宽随文字自适应（min-width 保底），绝不换行撑高容器（滚动条根源） */
  .cap { flex: 0 0 auto; min-width: 46px; height: 58px; border-radius: 16px; background: #fff; box-shadow: var(--animal-shadow);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-1); border: none; font-family: inherit; padding: 0 var(--sp-2); }
  .cap b { font-size:var(--fs-md); font-weight: 900; color: var(--animal-text-dis); white-space: nowrap; }
  .cap i { font-style: normal; font-size:var(--fs-xs); font-weight: 700; color: var(--animal-text-dis); white-space: nowrap; }
  .cap.locked { background: #f3efe6; border: 2px solid #eee4d3; box-shadow: 0 2px 0 #e3d9c8; }
  .cap.locked b, .cap.locked i { color: #b7ab97; }
  .cap.done { background: var(--animal-primary-bg); }
  .cap.done b, .cap.done i { color: var(--animal-primary-active); }
  .cap.cur { min-width: 96px; background: var(--animal-primary); box-shadow: 0 4px 0 var(--press-teal), var(--animal-shadow-lg); }
  .cap.cur b { color: #fff; font-size:var(--fs-sm); }
  .cap.cur i { color: #fff; opacity: .9; }

  /* v2.8：口诀广播入口条自适应高（ruby 两行不裁切） */
  #radio { margin-top: var(--sp-3); min-height: 64px; flex: none; display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-4);
    background: var(--animal-warning-hover); border-radius: var(--animal-r-lg); box-shadow: var(--animal-shadow);
    background: #fff8e0; border: none; font-family: inherit; width: 100%; cursor: pointer; }
  #radio:active { transform: scale(.98); }
  #radio .ric { width: 44px; height: 44px; border-radius: 14px; background: var(--animal-warning); display: flex; align-items: center;
    justify-content: center; box-shadow: 0 3px 0 var(--animal-warning-active); flex: none; }
  #radio .ric svg { width: 24px; height: 24px; }
  #radio .rtx { flex: 1; min-width: 0; text-align: left; }
  #radio .rtx b { font-size:var(--fs-md); font-weight: 900; line-height: 1.6; display: block; white-space: nowrap; }
  #radio .rtx span { display: block; font-size:var(--fs-xs); font-weight: 700; color: var(--animal-text-2); line-height: 1.5; white-space: nowrap; }    /* 提示文案零换行 */
  #radio .rtx span :global(rt) { font-size:var(--fs-rt); }
  #radio .rplay { width: 42px; height: 42px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow);
    display: flex; align-items: center; justify-content: center; flex: none; }
  #radio .rplay svg { width: 18px; height: 18px; }
</style>
