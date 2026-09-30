<script lang="ts">
  /* 第 n 课五步流程 · v2.4 横向翻页版（打样屏4/5）：五步五页一线（认识/写法/声调/拼读/小测），
     步骤条-页点-进度 chip 三方同步；拖拽跟手 + 阈值吸附；零纵向滚动；R1 零过场音（open_N/step_N 已删） */
  import lessonsData from '../../data/lessons.json'
  import { LETTERS, PAIRS } from '../../data'
  import { letterAudio, playAudio, say, sndOk, sndNo, sndStar } from '../../lib/audio'
  import { submitQuiz, setStep, lessonShort } from '../../stores/learn.svelte'
  import Ruby from '../Ruby.svelte'
  import Icon from '../Icon.svelte'
  import StrokeAnim from './StrokeAnim.svelte'
  import ToneDrill from './ToneDrill.svelte'
  import BlendDrill from './BlendDrill.svelte'
  import HSteps from '../HSteps.svelte'

  let { n, onexit }: { n: number; onexit: () => void } = $props()

  const LESSONS = (lessonsData as any).lessons as any[]
  const CN = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九', 10: '十', 11: '十一', 12: '十二' }
  const cn = (x: number | string) => CN[+x] || String(x)

  /* 截至本课已学过的字母（小测干扰项只从中取，不超纲） */
  const learnedKeys = $derived.by(() => {
    const set: string[] = []
    for (const l of LESSONS) if (l.n <= n) for (const e of l.letters) if (!set.includes(e.k)) set.push(e.k)
    return set
  })

  const STEPS = [
    { id: 1, name: '认识', py: 'rèn shi' },
    { id: 2, name: '写法', py: 'xiě fǎ' },
    { id: 3, name: '声调', py: 'shēng diào' },
    { id: 4, name: '拼读', py: 'pīn dú' },
    { id: 5, name: '小测', py: 'xiǎo cè' },
  ] as const

  let step = $state(1)                // 1..5（= HSteps 页号 + 1）
  let li = $state(0)                 // 当前字母下标
  let sa: StrokeAnim
  let quiz = $state<{ q: any[]; i: number; score: number; pick: string; lastPick: string; done: boolean; passed: boolean }>({
    q: [], i: 0, score: 0, pick: '', lastPick: '', done: false, passed: false,
  })

  const lesson = $derived(LESSONS.find((x) => x.n === n) || LESSONS[0])
  const short = $derived(lessonShort(n, lesson.title))
  const letters = $derived(lesson.letters as { k: string; kj: string; kjAudio?: string; xie: string; strokes: string[]; say: string; sayAudio?: string }[])
  const letter = $derived(letters[li] || letters[0])

  function pickDistractors(k: string, count: number): string[] {
    const pool: string[] = []
    for (const l of letters) if (l.k !== k) pool.push(l.k)                 // 本课字母优先
    for (const p of PAIRS) {                                                // 易混对（已学过才算）
      const other = p.a === k ? p.b : p.b === k ? p.a : null
      if (other && learnedKeys.includes(other) && !pool.includes(other)) pool.push(other)
    }
    const sameCat = learnedKeys.filter((x) => x !== k && LETTERS[k] && LETTERS[x] && LETTERS[x].cat === LETTERS[k].cat)
    for (const x of sameCat) pool.push(x)
    const out: string[] = []
    for (const x of pool) if (!out.includes(x) && x !== k) out.push(x)
    return out.slice(0, count)
  }

  function shuffle<T>(a: T[]): T[] { return a.map((v) => ({ v, r: Math.random() })).sort((x, y) => x.r - y.r).map((o) => o.v) }

  function buildQuiz() {
    const withHan = letters.filter((l) => (LETTERS[l.k] as any)?.han)
    const qs: any[] = []
    const lk = shuffle(letters.map((l) => l.k))
    for (let i = 0; i < 5; i++) {
      const k = lk[i % lk.length]
      const listen = i % 2 === 0 || withHan.length < 4
      if (listen) {
        const opts = shuffle([k, ...pickDistractors(k, 3)])
        qs.push({ type: 'listen', k, opts })
      } else {
        const hk = shuffle(withHan.map((l) => l.k))[0]
        const hanPool = pickDistractors(hk, 6).filter((x) => (LETTERS[x] as any)?.han)
        const opts = shuffle([hk, ...hanPool.slice(0, 3)])
        qs.push({ type: 'look', k: hk, opts })
      }
    }
    quiz = { q: qs, i: 0, score: 0, pick: '', lastPick: '', done: false, passed: false }
    setTimeout(() => playQuestionAudio(qs[0]), 400)
  }

  function playQuestionAudio(q: any) {
    if (!q) return
    if (q.type === 'listen') playAudio(letterAudio(q.k), { hint: '语音未准备好' })
    else say(q.k)
  }

  function answer(v: string) {
    if (quiz.pick) return
    const q = quiz.q[quiz.i]
    const right = v === q.k
    quiz.pick = right ? '✓' : '✗'
    if (right) { quiz.score++; sndOk() } else { sndNo() }
    setTimeout(() => {
      if (quiz.i + 1 >= quiz.q.length) {
        quiz.done = true
        quiz.passed = submitQuiz(n, quiz.score, LESSONS.length)
        sndStar()
        playAudio(quiz.passed ? (quiz.score >= 5 ? 'lessons/cheer_perfect' : 'lessons/cheer_pass') : 'lessons/cheer_retry')
      } else {
        quiz.i++
        quiz.pick = ''
        playQuestionAudio(quiz.q[quiz.i])
      }
    }, right ? 650 : 1400)
  }

  /* 旁白按逗号拆行，防尾字孤行 */
  function sayLines(s: string): string[] {
    const parts = s.split('，')
    if (parts.length < 2) return [s]
    return [parts.slice(0, -1).join('，'), parts[parts.length - 1]]
  }

  /* 翻页/跳步：R1 翻页零音效；进小测页建题；记五步断点（学习 tab 断点续学 CTA） */
  function goto(s: number) {
    step = Math.max(1, Math.min(5, s))
    setStep(n, step)
    if (s === 5 && !quiz.q.length) buildQuiz()
    else if (s === 5 && quiz.done) buildQuiz()
  }
  function restudy() { quiz.done = false; buildQuiz() }

  /* ?step=S&li=I&static=K 深链（验收截图/笔顺自检用；static=前 K 笔静态帧） */
  let staticN = $state(-1)
  $effect(() => {
    const q = new URLSearchParams(location.search)
    const sN = parseInt(q.get('step') || '', 10)
    if (sN >= 1 && sN <= 5) {
      step = sN
      if (sN === 5) buildQuiz()
    }
    const iN = parseInt(q.get('li') || '', 10)
    if (iN >= 0 && iN < letters.length) li = iN
    const st = q.get('static')
    if (st !== null) staticN = Math.max(0, parseInt(st, 10))
  })
</script>

<section id="v-lesson" class="view on" data-screen="lesson">
  <div class="ltop">
    <button class="cbtn" data-back="learn" onclick={onexit} aria-label="返回"><svg viewBox="0 0 24 24" fill="none" stroke="#794f27" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5L7.5 12l7 7" /></svg></button>
    <div class="ltt">
      <ruby>第 {cn(n)} 课<rt>dì {n} kè</rt></ruby>
      {#if short.zh}&nbsp;·&nbsp;<ruby>{short.zh}<rt>{short.py}</rt></ruby>{:else}&nbsp;·&nbsp;{short.raw}{/if}
    </div>
    <div class="lprog" id="lprog">{step}/5</div>
  </div>

  <!-- 步骤条（点选可跳） -->
  <div id="rail">
    {#each STEPS as s, i (s.id)}
      <button class="rstep" class:done={step > s.id || (s.id === 5 && quiz.done && quiz.passed)} class:cur={step === s.id} data-step={s.id} onclick={() => goto(s.id)}>
        <span class="rd">
          {#if step > s.id && s.id !== 5}
            <svg viewBox="0 0 24 24" fill="none" stroke="#19c8b9" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11" /></svg>
          {:else}{s.id}{/if}
        </span>
        <span class="rname"><ruby>{s.name}<rt>{s.py}</rt></ruby></span>
      </button>
    {/each}
  </div>

  <!-- 横向翻页舞台 -->
  <div id="stagewrap">
    <HSteps n={5} cur={step - 1} onchange={(i) => goto(i + 1)}>
      <!-- 页1 · 认识：大字模 + 点读 + 口诀 + 例词 -->
      <div class="hspage"><div class="pcard">
        <div class="ptag"><ruby>认识<rt>rèn shi</rt></ruby> · {letter.k}</div>
        <div class="lchips">
          {#each letters as l, i (l.k)}
            <button class="lchip" class:on={i === li} data-ler={l.k} onclick={() => (li = i)}>{l.k}</button>
          {/each}
        </div>
        <div class="bigwrap grid4">
          <button class="bigbtn" data-say={letter.k} onclick={() => say(letter.k)}>
            <span class="big" data-big>{letter.k}</span>
          </button>
        </div>
        <div class="kjline" data-kj={letter.k}>
          {#if letter.kjAudio}<button class="kjplay" onclick={() => playAudio(letter.kjAudio!, { hint: '语音未准备好' })}><Icon name="play" size={15} /></button>{/if}
          <Ruby text={letter.kj} />
        </div>
        {#if LETTERS[letter.k]?.word}
          <div class="wrow">
            <span class="cip"><span class="wem">{LETTERS[letter.k].em}</span><Ruby text={LETTERS[letter.k].word} />&nbsp;<span class="wp">{LETTERS[letter.k].wp}</span></span>
          </div>
        {/if}
        <div class="taptip"><svg viewBox="0 0 24 24" fill="none" stroke="#19c8b9" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z" /><path d="M16.5 8.5a5 5 0 010 7" /></svg><ruby>点一点，听读音<rt>diǎn yī diǎn tīng dú yīn</rt></ruby></div>
      </div></div>

      <!-- 页2 · 写法：笔顺动画 + 旁白 -->
      <div class="hspage"><div class="pcard">
        <div class="ptag hot"><ruby>写法<rt>xiě fǎ</rt></ruby> · {letter.k}</div>
        <div class="animfit"><StrokeAnim unit={letter.k} static={staticN} bind:this={sa} /></div>
        <div class="sayline">{#each sayLines(letter.say) as seg, i (i)}{#if i > 0}<br />{/if}<Ruby text={seg} />{/each}</div>
        <div class="xrow">
          <button class="rebtn" onclick={() => { sa?.replay(); if (letter.sayAudio) playAudio(letter.sayAudio, { hint: '' }) }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#19c8b9" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-2.6-6.4" /><path d="M21 4v5h-5" /></svg>
            <ruby>再看一遍<rt>zài kàn yī biàn</rt></ruby>
          </button>
        </div>
        <div class="taptip"><ruby>看一遍，再写一遍<rt>kàn yī biàn zài xiě yī biàn</rt></ruby></div>
      </div></div>

      <!-- 页3 · 声调 -->
      <div class="hspage"><div class="pcard">
        <div class="ptag hot"><ruby>声调<rt>shēng diào</rt></ruby></div>
        <div class="drillfit"><ToneDrill rows={lesson.tones} /></div>
      </div></div>

      <!-- 页4 · 拼读 / 整体认读 -->
      <div class="hspage"><div class="pcard">
        <div class="ptag hot"><ruby>拼读<rt>pīn dú</rt></ruby></div>
        <div class="drillfit"><BlendDrill blends={lesson.blends || []} ztlist={lesson.ztlist || []} tones={lesson.tones || []} note={lesson.note || ''} /></div>
      </div></div>

      <!-- 页5 · 小测 -->
      <div class="hspage"><div class="pcard">
        {#if !quiz.q.length && !quiz.done}
          <div class="quizboot"><ruby>准备好了吗<rt>zhǔn bèi hǎo le ma</rt></ruby></div>
          <button class="bootbtn" data-bootquiz onclick={() => buildQuiz()}><ruby>开始小测<rt>kāi shǐ xiǎo cè</rt></ruby></button>
        {:else if !quiz.done}
          {@const q = quiz.q[quiz.i]}
          <div class="ptag hot"><ruby>小测<rt>xiǎo cè</rt></ruby> · <ruby>第{cn(quiz.i + 1)}题<rt>dì {cn(quiz.i + 1)} tí</rt></ruby></div>
          <div class="qprog">{#each Array(5) as _, i (i)}<span class="qdot" class:ok={i < quiz.i}></span>{/each}</div>
          {#if q.type === 'listen'}
            <button class="qplay" onclick={() => playQuestionAudio(q)}><Icon name="play" size={40} /></button>
            <div class="qhint"><ruby>听一听，选出来<rt>tīng yī tīng xuǎn chū lái</rt></ruby></div>
          {:else}
            <div class="qglyph">{q.k}</div>
            <div class="qhint"><ruby>看一看，它怎么读<rt>kàn yī kàn tā zěn me dú</rt></ruby></div>
          {/if}
          <div class="opts">
            {#each q.opts as o (o)}
              <button
                class="opt" class:right={quiz.pick && o === q.k}
                class:wrong={quiz.pick === '✗' && o !== q.k && o === quiz.lastPick}
                onclick={() => { quiz.lastPick = o; answer(o) }}
              >{q.type === 'look' ? (LETTERS[o] as any)?.han || o : o}</button>
            {/each}
          </div>
        {:else if quiz.passed}
          <div class="res">
            <div class="resemoji"><Icon name="rainbow" size={46} /><Icon name="star" size={46} /></div>
            <div class="resscore"><ruby>对了{cn(quiz.score)}题，太棒了！<rt>duì le {quiz.score} tí tài bàng le</rt></ruby></div>
            <div class="resstars">{#each Array(quiz.score >= 5 ? 3 : 2) as _, i (i)}<Icon name="star" size={30} />{/each}</div>
            <button class="bootbtn" data-backlearn onclick={onexit}><ruby>回课程地图<rt>huí kè chéng dì tú</rt></ruby></button>
          </div>
        {:else}
          <div class="res">
            <div class="resemoji"><Icon name="sprout" size={46} /><Icon name="dumbbell" size={46} /></div>
            <div class="resscore"><ruby>对了{cn(quiz.score)}题<rt>duì le {quiz.score} tí</rt></ruby></div>
            <div class="resmsg"><ruby>差一点点！再学一遍，你一定可以的<rt>chà yī diǎn diǎn zài xué yī biàn</rt></ruby></div>
            <button class="bootbtn" onclick={restudy}><ruby>再学一遍<rt>zài xué yī biàn</rt></ruby></button>
          </div>
        {/if}
      </div></div>
    </HSteps>
  </div>

  <!-- 页点 + 滑动提示 -->
  <div id="pager">
    <div id="dots">
      {#each STEPS as s, i (s.id)}
        <i class:on={step === i + 1} data-dot={s.id}></i>
      {/each}
    </div>
    <div id="swipehint"><svg viewBox="0 0 24 24" fill="none" stroke="#9f927d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6" /></svg><ruby>左滑，下一步<rt>zuǒ huá xià yī bù</rt></ruby></div>
  </div>
</section>

<style>
  #v-lesson { padding: 10px 16px 8px; gap: 0; }
  .ltop { display: flex; align-items: center; gap: 10px; height: 44px; flex: none; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
  .cbtn svg { width: 18px; height: 18px; }
  .ltt { flex: 1; text-align: center; font-size: 16px; font-weight: 900; line-height: 1.8; }
  .lprog { font-size: 12px; font-weight: 900; color: var(--animal-primary-active); background: var(--animal-primary-bg);
    padding: 6px 11px; border-radius: 999px; }

  #rail { display: flex; align-items: flex-start; justify-content: space-between; margin: 8px 6px 0; position: relative; flex: none; }
  #rail::before { content: ''; position: absolute; top: 15px; left: 36px; right: 36px; height: 3px; background: var(--animal-border-light); border-radius: 3px; }
  .rstep { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer;
    font-family: inherit; background: none; border: none; color: var(--animal-text-2); }
  .rstep .rd { width: 32px; height: 32px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow);
    display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 900; font-style: normal; }
  .rstep .rd svg { width: 14px; height: 14px; }
  .rstep .rname { font-size: 11px; font-weight: 800; }
  .rstep .rname :global(rt) { font-size: 8px; }
  .rstep.done .rd { background: var(--animal-primary-bg); color: var(--animal-primary-active); }
  .rstep.cur .rd { background: var(--animal-primary); color: #fff; box-shadow: 0 3px 0 var(--press-teal); }
  .rstep.cur .rname { color: var(--animal-primary-active); }

  #stagewrap { flex: 1; min-height: 0; margin: 12px 0 4px; position: relative; }
  :global(.hswrap) { flex: 1; }
  .pcard { flex: 1; min-height: 0; background: #fff; border-radius: var(--animal-r-lg); box-shadow: var(--animal-shadow-lg);
    display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 14px 18px 14px; overflow: hidden; position: relative; gap: 6px; }
  .pcard .ptag { position: absolute; top: 12px; left: 14px; font-size: 11px; font-weight: 900; color: var(--animal-text-dis);
    background: #f4f0e4; padding: 4px 10px; border-radius: 999px; max-width: calc(100% - 28px); }
  .pcard .ptag.hot { background: #fff8e0; color: var(--animal-warning-active); }

  .grid4 { position: relative; }
  .grid4::before { content: ''; position: absolute; left: 0; right: 0; top: 12%; bottom: 14%; pointer-events: none;
    background-image: linear-gradient(#e3d3b6, #e3d3b6), linear-gradient(#e3d3b6, #e3d3b6), linear-gradient(#e3d3b6, #e3d3b6), linear-gradient(#e3d3b6, #e3d3b6);
    background-size: 100% 1.5px; background-position: 0 0, 0 33.33%, 0 66.66%, 0 100%; background-repeat: no-repeat; opacity: .55; border-radius: 4px; }

  /* 认识 */
  .lchips { display: flex; gap: 7px; margin-top: 22px; }
  .lchip { min-width: 44px; height: 40px; border-radius: 13px; border: 2px solid #e3d9c8; background: #fff;
    font-size: 20px; font-weight: 900; color: #6f6353; font-family: inherit; padding: 0 8px; }
  .lchip.on { border-color: var(--animal-primary); background: var(--animal-primary-bg); color: var(--animal-primary-active); }
  .bigwrap { width: 82%; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
  .bigbtn { border: none; background: none; font-family: inherit; padding: 0; }
  .big { font-weight: 900; font-size: clamp(120px, 40vw, 176px); line-height: 1; color: var(--animal-primary);
    text-shadow: 0 6px 0 rgba(18,157,143,.16); display: block; }
  .kjline { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 800; color: var(--animal-text); line-height: 2; flex: none; }
  .kjplay { width: 30px; height: 30px; border-radius: 50%; border: none; background: #fdeee7; color: #e76f51;
    display: inline-flex; align-items: center; justify-content: center; flex: none; }
  .wrow { display: flex; align-items: center; justify-content: center; flex: none; }
  .cip { display: flex; align-items: center; gap: 6px; background: #fff8e0; border-radius: 999px;
    padding: 6px 13px; font-size: 13.5px; font-weight: 800; color: var(--animal-text); }
  .wem { font-size: 20px; }
  .wp { font-size: 12px; color: #dba90e; font-weight: 900; }
  .taptip { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 800; color: var(--animal-text-2); flex: none; margin-bottom: 14px; }
  .taptip svg { width: 16px; height: 16px; }

  /* 写法 */
  .animfit { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; width: 100%; }
  .animfit :global(svg.strokeanim) { max-width: 100%; max-height: 100%; }
  .sayline { font-size: 14px; font-weight: 800; color: var(--animal-text-2); line-height: 2; text-align: center; flex: none; }
  .xrow { display: flex; gap: 10px; flex: none; }
  .rebtn { display: flex; align-items: center; gap: 7px; border: none; background: var(--animal-primary-bg); color: var(--animal-primary-active);
    font-family: inherit; font-size: 14px; font-weight: 900; padding: 9px 16px; border-radius: 999px; cursor: pointer; }
  .rebtn svg { width: 15px; height: 15px; }

  /* 声调 / 拼读 drill 卡内适配 */
  .drillfit { flex: 1; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .drillfit :global(.tonedrill), .drillfit :global(.blenddrill) { width: 100%; gap: 8px; }
  .drillfit :global(.tonerow) { min-height: 52px; padding: 6px 12px; }
  .drillfit :global(.tsyl) { font-size: 30px; min-width: 56px; }
  .drillfit :global(.tname) { font-size: 14px; }
  .drillfit :global(.bigbase) { font-size: 44px; min-height: 58px; line-height: 1.3; }
  .drillfit :global(.basechip) { min-width: 56px; min-height: 42px; font-size: 22px; border-radius: 14px; }
  .drillfit :global(.stage) { height: 128px; }
  .drillfit :global(.card) { width: 82px; height: 102px; font-size: 46px; }
  .drillfit :global(.rsyl) { font-size: 54px; }
  .drillfit :global(.rchar) { font-size: 30px; }
  .drillfit :global(.bchip) { font-size: 14px; padding: 6px 10px; }
  .drillfit :global(.magicnote) { font-size: 13px; padding: 6px 10px; }
  .drillfit :global(.ztgrid) { gap: 7px; }
  .drillfit :global(.ztcard) { padding: 7px 6px; }
  .drillfit :global(.ztu) { font-size: 26px; }
  .drillfit :global(.zkj) { font-size: 12px; }
  .drillfit :global(.qhint) { font-size: 19px; margin-top: 0; }
  .drillfit :global(.topt) { min-height: 64px; }
  .drillfit :global(.topt svg) { width: 40px; height: 22px; }
  .drillfit :global(.topt span) { font-size: 15px; }
  .drillfit :global(.replay) { width: 76px; height: 76px; }
  .drillfit :global(.steps .btn), .drillfit :global(.trow .btn) { min-height: 44px; font-size: 15px; }
  .drillfit :global(.navbtn) { width: 44px; height: 44px; font-size: 22px; }

  /* 小测 */
  .quizboot { font-size: 19px; font-weight: 900; color: var(--animal-text); line-height: 2; }
  .bootbtn { border: none; border-radius: 999px; background: var(--animal-primary); color: #fff; font-family: inherit;
    font-size: 17px; font-weight: 900; padding: 14px 34px; box-shadow: 0 4px 0 var(--press-teal); cursor: pointer; }
  .bootbtn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--press-teal); }
  .qprog { display: flex; gap: 7px; margin-top: 24px; }
  .qdot { width: 11px; height: 11px; border-radius: 50%; background: var(--animal-border-light); }
  .qdot.ok { background: var(--animal-primary); }
  .qplay { width: 84px; height: 84px; border-radius: 50%; border: none; background: #fff; box-shadow: 0 4px 0 #e3d9c8;
    color: var(--animal-primary-active); display: flex; align-items: center; justify-content: center; flex: none; }
  .qplay:active { transform: translateY(3px); box-shadow: 0 1px 0 #e3d9c8; }
  .qglyph { font-size: 84px; font-weight: 900; color: var(--animal-text); line-height: 1.2; }
  .qhint { font-size: 15px; font-weight: 800; color: var(--animal-text-2); flex: none; }
  .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; flex: 1; min-height: 0; max-height: 260px; margin-bottom: 14px; }
  .opt { min-height: 96px; border-radius: 18px; border: 3px solid var(--animal-border-light); background: #fbf8ee;
    font-size: 44px; font-weight: 900; color: var(--animal-text); font-family: inherit; cursor: pointer; }
  .opt.right { border-color: var(--animal-primary); background: var(--animal-primary-bg); color: var(--animal-primary-active); }
  .opt.wrong { border-color: #e76f51; background: #fdeee7; animation: shake .3s; }
  @keyframes shake { 25% { transform: translateX(-4px) } 75% { transform: translateX(4px) } }

  /* 小测结算 */
  .res { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .resemoji { display: flex; gap: 10px; }
  .resscore { font-size: 20px; font-weight: 900; color: var(--animal-text); line-height: 2; }
  .resstars { color: #e9c46a; display: flex; gap: 4px; }
  .resmsg { font-size: 14.5px; font-weight: 800; color: var(--animal-primary-active); text-align: center; line-height: 1.9; max-width: 260px; }

  #pager { height: 56px; flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }
  #dots { display: flex; gap: 7px; }
  #dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--animal-text-dis); transition: .2s; }
  #dots i.on { width: 22px; background: var(--animal-primary); }
  #swipehint { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 800; color: var(--animal-text-2); }
  #swipehint svg { width: 16px; height: 16px; }
</style>
