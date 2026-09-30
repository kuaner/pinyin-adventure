<script lang="ts">
  /* 声调练习（五步之③）：四声演示（真人音 + 声调符号方向动画）+ 听调辨调小练（听音选声调符号） */
  import { playAudio, sndOk, sndNo, sndStar } from '../../lib/audio'
  import { TONE_MARKS, TONE_COLORS } from '../../lib/toneMarks'
  import { toast } from '../../stores/ui.svelte'
  import { tRaw } from '../../text/strings'
  import Speak from '../Speak.svelte'
  import Icon from '../Icon.svelte'

  export type ToneRow = { base: string; display: string; tones: { t: number; display: string; file: string }[] }

  let { rows, sel: selProp, ondone }: { rows: ToneRow[]; sel?: number; ondone?: () => void } = $props()

  const sel = $derived(selProp !== undefined ? Math.min(selProp, rows.length - 1) : 0)
  let playing = $state(-1)          // 正在演示第几声
  let quizOn = $state(false)
  let qIdx = $state(0)
  let qTone = $state(0)
  let qPick = $state(0)
  let qRight = $state(0)
  let qDone = $state(false)
  let lastPickTone = $state(0)
  let timer: ReturnType<typeof setTimeout> | null = null

  /* 四声符号几何走共享模块（lib/toneMarks，与课内小测听调题同一套图形） */
  const MARKS = TONE_MARKS.map((m) => ({ ...m, name: tRaw('toneName' + m.t), tip: tRaw('toneTip' + m.t) }))
  const COLORS = TONE_COLORS

  const row = $derived(rows[sel])

  function playTone(i: number) {
    playing = i
    playAudio(row.tones[i].file, { hint: '语音未准备好' })
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => (playing = -1), 1400)
  }

  function playAll() {
    row.tones.forEach((_, i) => {
      setTimeout(() => playTone(i), i * 1500)
    })
  }

  function startQuiz() {
    quizOn = true; qIdx = 0; qRight = 0; qDone = false; qPick = 0
    nextQ()
  }
  function nextQ() {
    qPick = 0; lastPickTone = 0
    qTone = 1 + Math.floor(Math.random() * 4)
    /* v2.6 零自动播放：出题不自动播音，孩子点 🔊 replay 听题 */
  }
  function pick(t: number) {
    if (qPick) return
    qPick = 1; lastPickTone = t
    if (t === qTone) { qRight++; sndOk() } else { sndNo() /* v2.6 零自动播放：答错只留嘟声，重听走 replay 键 */ }
    setTimeout(() => {
      qIdx++
      if (qIdx >= 4) { qDone = true; sndStar() } else nextQ()
    }, t === qTone ? 750 : 1500)
  }
</script>

<div class="tonedrill">
  {#if !quizOn}
    <!-- Bug#15：删内部字母选择器（与 LessonPage 顶部 lchip 重复且不同步）——字母切换只走顶部唯一入口 -->

    <div class="bigbase">{#if playing >= 0}<span class="basetone">{row.tones[playing].display}</span>{:else}{row.display}{/if}</div>

    <div class="tonerows">
      {#each row.tones as tn, i (tn.t)}
        <button class="tonerow" class:on={playing === i} onclick={() => playTone(i)}>
          <svg viewBox="0 0 56 30" class="mark" class:draw={playing === i}>
            <path d={MARKS[i].d} stroke={COLORS[i]} stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          </svg>
          <span class="tsyl">{tn.display}</span>
          <span class="tname"><Speak text={MARKS[i].name + ' ' + MARKS[i].tip} /></span>
        </button>
      {/each}
    </div>

    <div class="trow">
      <button class="btn teal small" onclick={playAll}><Icon name="play" size={20} /> <Speak k="followMe" plain /></button>
      <button class="btn green small" onclick={startQuiz}><Icon name="headphones" size={20} /> <Speak k="earPractice" plain /></button>
    </div>
  {:else if !qDone}
    <div class="qhint"><Speak k="whichTone" /></div>
    <div class="qprog">{#each Array(4) as _, i}<span class="dot" class:ok={i < qRight}></span>{/each}</div>
    <button class="replay" aria-label="listen" onclick={() => playAudio(row.tones[qTone - 1].file, { hint: tRaw('notReady') })}>
      <Icon name="play" size={44} />
    </button>
    <div class="topts">
      {#each MARKS as m, i (m.t)}
        <button class="topt" class:right={qPick && i + 1 === qTone} class:wrong={qPick && i + 1 === lastPickTone && i + 1 !== qTone} onclick={() => pick(i + 1)}>
          <svg viewBox="0 0 56 30"><path d={m.d} stroke={COLORS[i]} stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg>
          <span><Speak text={m.name} /></span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="qresult">
      <div class="qemoji"><Icon name="ear" size={46} /> <Icon name="star" size={46} /></div>
      <div class="qscore"><Speak k="heardN" vars={{ n: qRight }} /></div>
      {#if qRight >= 3}<div class="qpraise"><Speak k="goodEars" /></div>{:else}<div class="qpraise"><Speak k="listenMore" /></div>{/if}
      <div class="trow">
        <button class="btn teal small" onclick={startQuiz}><Icon name="refresh" size={20} /> <Speak k="tonePracticeAgain" plain /></button>
        <button class="btn green small" onclick={() => { quizOn = false; ondone?.() }}><Speak k="tonePracticeDone" plain /></button>
      </div>
    </div>
  {/if}
</div>

<style>
  .tonedrill { display: flex; flex-direction: column; gap: var(--sp-3); }
  .bases { display: flex; gap: var(--sp-2); justify-content: center; flex-wrap: wrap; }
  .basechip { min-width: 72px; min-height: 56px; border-radius: 18px; border: 2.5px solid #e3d9c8; background: #fff;
    font-size:var(--fs-xl); font-weight: 900; color: #6f6353; font-family: inherit; }
  .basechip.on { border-color: #2A9D8F; background: #e6f7f2; color: #1f7a68; }
  .bigbase { text-align: center; font-size:var(--fs-glyph); font-weight: 900; color: #264653; line-height: 1.35; min-height: 92px; }
  .basetone { color: #E76F51; }
  .tonerows { display: flex; flex-direction: column; gap: var(--sp-2); }
  .tonerow { display: flex; align-items: center; gap: var(--sp-3); background: #fff; border: 2.5px solid #eee4d3;
    border-radius: 18px; padding: var(--sp-2) var(--sp-4); min-height: 68px; font-family: inherit; text-align: left; }
  .tonerow.on { border-color: #E76F51; background: #fdeee7; transform: scale(1.015); }
  .mark { width: 58px; height: 32px; flex: 0 0 58px; }
  .mark path { stroke-dasharray: 130; stroke-dashoffset: 130; }
  .mark.draw path { animation: drawmark .5s cubic-bezier(.4,0,.6,1) forwards; }
  @keyframes drawmark { to { stroke-dashoffset: 0; } }
  .tsyl { font-size:var(--fs-glyph-sm); font-weight: 900; color: #264653; min-width: 72px; text-align: center; }
  .tname { font-size:var(--fs-md); font-weight: 700; color: #8a7a68; }
  .trow { display: flex; gap: var(--sp-2); }
  .trow .btn { flex: 1; }
  .qhint { text-align: center; font-size:var(--fs-lg); font-weight: 900; color: #264653; margin-top: var(--sp-2); }
  .qprog { display: flex; gap: var(--sp-2); justify-content: center; }
  .dot { width: 14px; height: 14px; border-radius: 50%; background: #eee4d3; }
  .dot.ok { background: #2A9D8F; }
  .replay { align-self: center; width: 110px; height: 110px; border-radius: 50%; border: none; background: #fff;
    box-shadow: 0 5px 0 #e3d9c8; color: #2A9D8F; display: flex; align-items: center; justify-content: center; }
  .replay:active { transform: translateY(3px); box-shadow: 0 1px 0 #e3d9c8; }
  .topts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
  .topt { background: #fff; border: 2.5px solid #eee4d3; border-radius: 18px; min-height: 84px;
    display: flex; align-items: center; justify-content: center; gap: var(--sp-2); font-family: inherit; }
  .topt svg { width: 52px; height: 28px; }
  .topt span { font-size:var(--fs-lg); font-weight: 800; color: #6f6353; }
  .topt.right { border-color: #2A9D8F; background: #e6f7f2; }
  .topt.wrong { border-color: #E76F51; background: #fdeee7; animation: shake .3s; }
  @keyframes shake { 25% { transform: translateX(-4px) } 75% { transform: translateX(4px) } }
  .qresult { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-4) 0; }
  .qemoji { font-size:var(--fs-glyph); }
  .qscore { font-size:var(--fs-xl); font-weight: 900; color: #264653; }
  .qpraise { font-size:var(--fs-lg); font-weight: 700; color: #2A9D8F; }
</style>
