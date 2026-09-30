<script lang="ts">
  /* v2.4 学习 tab（打样屏1）：一屏一事 —— 主角 = 当前课字模。
     当前课大卡（四线三格 + 断点续学 CTA）+ 12 课横向胶囊条（唯一允许滚动件）+ 🎧口诀小广播入口 */
  import { onMount } from 'svelte'
  import lessonsData from '../../data/lessons.json'
  import { LETTERS } from '../../data'
  import { L as LRN, quizPassed, currentLesson, lessonShort } from '../../stores/learn.svelte'
  import { openLesson, show } from '../../stores/ui.svelte'
  import { totalStars } from '../../stores/progress.svelte'
  import { say } from '../../lib/audio'
  import Speak from '../Speak.svelte'
  import { t, type StringKey } from '../../text/strings'

  const LESSONS = (lessonsData as any).lessons as { n: number; title: string; label: string; letters: { k: string; kj: string }[] }[]
  const STEPS: StringKey[] = ['stepKnow', 'stepWrite', 'stepTone', 'stepBlend', 'stepQuiz']

  const cur = $derived(currentLesson(LESSONS.length))
  const lesson = $derived(LESSONS[cur - 1])
  const bp = $derived(Math.min(5, LRN.step[cur] || 1))          // 五步断点
  const bpKey = $derived(STEPS[bp - 1])
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
      <Speak k="lessonN" vars={{ n: cur }} /> ·
      {#if lessonShort(cur, lesson.title).zh}<Speak text={lessonShort(cur, lesson.title).zh!} />{:else}{lessonShort(cur, lesson.title).raw}{/if}
    </div>
    <div id="letters" class="grid4">
      {#each letters as l, i (l.k)}
        <button class="letterbtn" data-ler={l.k} onclick={() => { li = i; say(l.k) }} aria-label={l.k}>
          <span class="letter" class:curo={i === li}>{l.k}</span>
        </button>
      {/each}
    </div>
    <div id="koujue">{#if kjParts[0]}<Speak text={kjParts[0]} />{/if}{#if kjParts[1]}<span class="kj-en">{kjParts[1]}</span>{/if}</div>
    <div id="steps5">
      {#each STEPS as s, i (s)}
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
  #v-learntab { padding: calc(var(--sat) + 10px) 16px 12px; gap: 0; }
  .rowhead { display: flex; align-items: center; justify-content: space-between; height: 34px; flex: none; }
  .rowhead .h1 { font-size: 21px; font-weight: 900; letter-spacing: .5px; }
  .rowhead .h1 small { font-size: 12px; font-weight: 700; color: var(--animal-text-dis); margin-left: 6px; }
  .chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 999px;
    font-size: 12.5px; font-weight: 800; background: #fff; box-shadow: var(--animal-shadow); }
  .chip svg { width: 14px; height: 14px; }

  #hero { flex: 1; min-height: 0; margin-top: 12px; padding: 18px 22px 18px; display: flex; flex-direction: column; position: relative; }
  #hero .lchip { align-self: flex-start; background: var(--animal-primary-bg); color: var(--animal-primary-active);
    font-size: 13px; font-weight: 900; padding: 6px 14px; border-radius: 999px; }
  .grid4 { position: relative; }
  .grid4::before { content: ''; position: absolute; left: 0; right: 0; top: 12%; bottom: 14%; pointer-events: none;
    background-image: linear-gradient(#e3d3b6, #e3d3b6), linear-gradient(#e3d3b6, #e3d3b6), linear-gradient(#e3d3b6, #e3d3b6), linear-gradient(#e3d3b6, #e3d3b6);
    background-size: 100% 1.5px; background-position: 0 0, 0 33.33%, 0 66.66%, 0 100%; background-repeat: no-repeat; opacity: .55; border-radius: 4px; }
  #letters { flex: 1; display: flex; align-items: center; justify-content: center; gap: 20px; min-height: 0; padding-bottom: 10px; }
  .letterbtn { border: none; background: none; font-family: inherit; padding: 0; }
  .letter { font-weight: 900; font-size: 104px; line-height: 1; color: var(--animal-text-dis); opacity: .5; position: relative;
    z-index: 1; transition: .2s; display: block; }
  .letter.curo { color: var(--animal-primary); opacity: 1; font-size: 148px; text-shadow: 0 6px 0 rgba(18,157,143,.18); }
  .letter.curo::after { content: ''; position: absolute; left: 50%; transform: translateX(-50%); bottom: -14px;
    width: 12px; height: 12px; border-radius: 50%; background: var(--animal-warning); box-shadow: 0 2px 0 var(--animal-warning-active); }
  #koujue { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 17px; font-weight: 800; line-height: 2.1; flex: none; }
  #koujue .kj-en { font-weight: 900; color: var(--animal-primary-active); font-size: 19px; letter-spacing: 2px; }
  #steps5 { display: flex; justify-content: center; gap: 10px; margin: 12px 0 14px; flex: none; }
  #steps5 i { width: 34px; height: 7px; border-radius: 7px; background: var(--animal-border-light); }
  #steps5 i.d { background: var(--animal-primary); }
  #steps5 i.c { background: var(--animal-warning); }
  #cta { height: 62px; border: none; border-radius: 999px; background: var(--animal-primary); color: #fff; font-family: inherit;
    font-size: 19px; font-weight: 900; letter-spacing: 1px; box-shadow: 0 5px 0 var(--press-teal), var(--animal-shadow-lg); cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px; flex: none; }
  #cta:active { transform: translateY(3px); box-shadow: 0 2px 0 var(--press-teal); }
  #cta rt { color: #fff; opacity: .85; }

  #mapbar { margin-top: 14px; flex: none; }
  .sec-label { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .sec-label b { font-size: 13.5px; font-weight: 900; }
  .sec-label span { font-size: 11px; font-weight: 700; color: var(--animal-text-dis); }
  #caps { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
  #caps::-webkit-scrollbar { display: none; }
  .cap { flex: 0 0 auto; width: 46px; height: 58px; border-radius: 16px; background: #fff; box-shadow: var(--animal-shadow);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border: none; font-family: inherit; padding: 0; }
  .cap b { font-size: 17px; font-weight: 900; color: var(--animal-text-dis); }
  .cap i { font-style: normal; font-size: 8.5px; font-weight: 700; color: var(--animal-text-dis); }
  .cap.locked { background: #f3efe6; border: 2px solid #eee4d3; box-shadow: 0 2px 0 #e3d9c8; }
  .cap.locked b, .cap.locked i { color: #b7ab97; }
  .cap.done { background: var(--animal-primary-bg); }
  .cap.done b, .cap.done i { color: var(--animal-primary-active); }
  .cap.cur { width: 96px; background: var(--animal-primary); box-shadow: 0 4px 0 var(--press-teal), var(--animal-shadow-lg); }
  .cap.cur b { color: #fff; font-size: 15px; }
  .cap.cur i { color: #fff; opacity: .9; }

  #radio { margin-top: 14px; height: 74px; flex: none; display: flex; align-items: center; gap: 13px; padding: 0 16px;
    background: var(--animal-warning-hover); border-radius: var(--animal-r-lg); box-shadow: var(--animal-shadow);
    background: #fff8e0; border: none; font-family: inherit; width: 100%; cursor: pointer; }
  #radio:active { transform: scale(.98); }
  #radio .ric { width: 44px; height: 44px; border-radius: 14px; background: var(--animal-warning); display: flex; align-items: center;
    justify-content: center; box-shadow: 0 3px 0 var(--animal-warning-active); flex: none; }
  #radio .ric svg { width: 24px; height: 24px; }
  #radio .rtx { flex: 1; min-width: 0; text-align: left; }
  #radio .rtx b { font-size: 16px; font-weight: 900; line-height: 1.9; display: block; }
  #radio .rtx span { display: block; font-size: 11px; font-weight: 700; color: var(--animal-text-2); }
  #radio .rtx span :global(rt) { font-size: 8px; }
  #radio .rplay { width: 42px; height: 42px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow);
    display: flex; align-items: center; justify-content: center; flex: none; }
  #radio .rplay svg { width: 18px; height: 18px; }
</style>
