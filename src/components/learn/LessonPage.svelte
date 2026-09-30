<script lang="ts">
  /* 第 n 课五步流程 · v2.9 重设计（BUGS#17+#18）：步骤数跟内容走——纯韵母课 4 步（认识/写法/声调/小测），
     有拼读内容的课 5 步（+拼读），小测=最后一步；小测只考本课所学三种题型
     （听音选字母 / 看字母选音 / 听调辨调·仅韵母课），不再考汉字识别。
     步骤条-页点-进度 chip 三方同步；拖拽跟手 + 阈值吸附；零纵向滚动；R1 零过场音 */
  import lessonsData from '../../data/lessons.json'
  import { LETTERS, PAIRS } from '../../data'
  import { letterAudio, playAudio, sndOk, sndNo, sndStar } from '../../lib/audio'
  import { L as LRN, submitQuiz, setStep, lessonShort, quizPassed } from '../../stores/learn.svelte'
  import { t, tRaw, cnNum, NUM_PY, type StringKey } from '../../text/strings'
  import { T } from '../../lib/ruby'
  import { TONE_MARKS, TONE_COLORS } from '../../lib/toneMarks'
  import Speak from '../Speak.svelte'
  import Icon from '../Icon.svelte'
  import StrokeAnim from './StrokeAnim.svelte'
  import ToneDrill from './ToneDrill.svelte'
  import BlendDrill from './BlendDrill.svelte'
  import HSteps from '../HSteps.svelte'
  import PinyinCard from '../PinyinCard.svelte'

  let { n, li0 = 0, onexit }: { n: number; li0?: number; onexit: () => void } = $props()

  const LESSONS = (lessonsData as any).lessons as any[]
  const cn = cnNum
  /* 中文数字的注音逃生口（题号/课号的 rt 需数字读音，引擎不管数字） */
  const npy = (x: number | string) => ({ [cn(x)]: NUM_PY[cn(x)] || '' })

  /* 截至本课已学过的字母（小测干扰项只从中取，不超纲） */
  const learnedKeys = $derived.by(() => {
    const set: string[] = []
    for (const l of LESSONS) if (l.n <= n) for (const e of l.letters) if (!set.includes(e.k)) set.push(e.k)
    return set
  })

  const lesson = $derived(LESSONS.find((x) => x.n === n) || LESSONS[0])
  const short = $derived(lessonShort(n, lesson.title))
  const letters = $derived(lesson.letters as { k: string; kj: string; kjAudio?: string; xie: string; strokes: string[]; say: string; sayAudio?: string }[])

  /* BUGS#17：步骤架构跟内容走——hasBlend=false 纯韵母课 4 步，true 有拼读 5 步（小测恒为最后一步） */
  const hasBlend = $derived((lesson.hasBlend ?? !!((lesson.blends || []).length || (lesson.ztlist || []).length)) as boolean)
  const STEPS: { id: number; k: StringKey }[] = $derived.by(() => {
    const s: { id: number; k: StringKey }[] = [
      { id: 1, k: 'stepKnow' },
      { id: 2, k: 'stepWrite' },
      { id: 3, k: 'stepTone' },
    ]
    if (hasBlend) s.push({ id: 4, k: 'stepBlend' })
    s.push({ id: s.length + 1, k: 'stepQuiz' })
    return s
  })
  const NSTEP = $derived(STEPS.length)          /* 4 | 5 */
  const QUIZ_STEP = $derived(NSTEP)             /* 小测=最后一步 */
  const BLEND_STEP = $derived(hasBlend ? 4 : 0) /* 拼读步号（无拼读课=0 不命中） */
  /* 韵母课才有听调辨调题（声调是韵母的属性；整体认读/声母课不考） */
  const isFinals = $derived(lesson.kind === 'ym' || lesson.kind === 'fu')

  let sa: StrokeAnim
  let chipsEl: HTMLDivElement
  /* 横滑 chip 条（L12=16 个）：切字母后选中 chip 滚回视野中央（block:nearest 不动纵向） */
  $effect(() => {
    void li
    chipsEl?.querySelector('.lchip.on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  })
  let quiz = $state<{ q: any[]; i: number; score: number; pick: string; lastPick: string; lastPickN: number; done: boolean; passed: boolean }>({
    q: [], i: 0, score: 0, pick: '', lastPick: '', lastPickN: 0, done: false, passed: false,
  })

  /* Bug#14 终极修复：letterStep（每字母独立步骤记忆）全删——它就是"切拼音跳步骤"的根源。
     现在的规则只有一条：切字母 → 步骤不动。步骤切换只靠 HSteps 翻页/步骤条点击。 */
  const initStep = quizPassed(n) ? 1 : Math.min(NSTEP, LRN.step[n] || 1)
  const initLi = Math.max(0, Math.min(letters.length - 1, li0 || 0))
  let step = $state(initStep)        // 1..NSTEP（= HSteps 页号 + 1）
  let li = $state(initLi)            // 当前字母下标
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

  /* BUGS#18①：小测三题型混编 5 题——听音选字母 / 看字母选音 / 听调辨调（仅韵母课）。
     干扰项只从本课+已学池取（不超纲）；题面零汉字、零错误形态（零错误信息铁律） */
  function buildQuiz() {
    const pool = isFinals ? ['listen', 'look', 'tone'] : ['listen', 'look']
    const types: string[] = []
    while (types.length < 5) types.push(...shuffle(pool))
    const lk = shuffle(letters.map((l) => l.k))
    const toneRows: any[] = lesson.tones || []
    const qs: any[] = []
    for (let i = 0; i < 5; i++) {
      const k = lk[i % lk.length]
      let type = types[i]
      if (type === 'tone' && !toneRows.length) type = 'listen'   /* 无声调数据兜底（数据正本不会走到） */
      if (type === 'tone') {
        const row = toneRows[Math.floor(Math.random() * toneRows.length)]
        const t = 1 + Math.floor(Math.random() * 4)
        qs.push({ type, k: row.display, file: row.tones[t - 1].file, key: t })   /* 屏显不带调字母，答案在音频里 */
      } else {
        qs.push({ type, k, opts: shuffle([k, ...pickDistractors(k, 3)]), key: k })
      }
    }
    quiz = { q: qs, i: 0, score: 0, pick: '', lastPick: '', lastPickN: 0, done: false, passed: false }
    /* v2.6 零自动播放：小测出题不再自动读音，题面 🔊 点播 */
  }

  function playQuestionAudio(q: any) {
    if (!q) return
    if (q.type === 'tone') playAudio(q.file, { hint: tRaw('notReady') })
    else if (q.type === 'listen') playAudio(letterAudio(q.k), { hint: tRaw('notReady') })
    /* look 题：锚点是看得见的字母，选项即声音，锚点不播音（播了=泄答案） */
  }

  function answer(v: string | number) {
    if (quiz.pick) return
    const q = quiz.q[quiz.i]
    const right = v === q.key
    quiz.pick = right ? '✓' : '✗'
    /* look 题选项音刚起播，等读音落地再叮/嘟（R3 一次一路，反馈音会打断在播读音） */
    const fire = () => {
      if (right) { quiz.score++; sndOk() } else { sndNo() }
      setTimeout(() => {
        if (quiz.i + 1 >= quiz.q.length) {
          quiz.done = true
          quiz.passed = submitQuiz(n, quiz.score, LESSONS.length)
          sndStar()
          /* v2.6 零自动播放：结算只留星星音（非语音），cheer 语音废除 */
        } else {
          quiz.i++
          quiz.pick = ''
          quiz.lastPick = ''
          quiz.lastPickN = 0
        }
      }, right ? 650 : 1400)
    }
    if (q.type === 'look') setTimeout(fire, 950)
    else fire()
  }

  /* 旁白按逗号拆行，防尾字孤行 */
  function sayLines(s: string): string[] {
    const parts = s.split('，')
    if (parts.length < 2) return [s]
    return [parts.slice(0, -1).join('，'), parts[parts.length - 1]]
  }

  /* 翻页/跳步：R1 翻页零音效；进小测页建题；记课级断点（学习 tab CTA 用） */
  function goto(s: number) {
    step = Math.max(1, Math.min(NSTEP, s))
    setStep(n, step)
    if (step === QUIZ_STEP && (!quiz.q.length || quiz.done)) buildQuiz()
  }

  /* Bug#14 终极修复：切字母只换字母，步骤绝对不动。
     "每字母独立记忆步骤"功能整个废弃——它就是跳步骤 bug 的根源（e 记住了上次在声调 → 切 e 就跳声调）。
     正确交互=当前在写法 → 切任何字母都留在写法看新字母的笔顺 */
  function pickLetter(i: number) {
    if (i === li || !letters[i]) return
    li = i
  }
  function restudy() { quiz.done = false; buildQuiz() }

  /* ?step=S&li=I&static=K 深链（验收截图/笔顺自检用；static=前 K 笔静态帧）。
     注意：effect 内只读 iN 局部量、不读 li——li 一旦进依赖，切字母会重跑本 effect 被深链打回（v2.6.1 实测教训） */
  let staticN = $state(-1)
  /* 验收钩子（qkey 门，probe.ts 同哲学但独立参数——URL 含 'probe' 子串会触发 probeRun 流程劫持视图）：
     仅 URL 带 ?qkey 时选项渲染 data-qkey，自动化作答可读答案；正常使用零泄漏 */
  const probeOn = typeof location !== 'undefined' && new URLSearchParams(location.search).has('qkey')
  $effect(() => {
    const q = new URLSearchParams(location.search)
    const sN = parseInt(q.get('step') || '', 10)
    const iN = parseInt(q.get('li') || '', 10)
    if (iN >= 0 && iN < letters.length) li = iN
    if (sN >= 1 && sN <= NSTEP) {
      step = sN
      if (sN === QUIZ_STEP) buildQuiz()
    }
    const st = q.get('static')
    if (st !== null) staticN = Math.max(0, parseInt(st, 10))
  })
</script>

<!-- BUGS#24 架构根治：课页最外层容器硬锁——height 锁视口（专注态全屏，无 tabbar 让位）+ overflow:hidden
     纵向滚动在容器级即不可能；课程/字母/步骤切换再怎么变内容，总高度也出不了这个盒子 -->
<div id="lesson-root">
<section id="v-lesson" class="view on" data-screen="lesson">
  <div class="ltop">
    <button class="cbtn" data-back="learn" onclick={onexit} aria-label="返回"><svg viewBox="0 0 24 24" fill="none" stroke="#794f27" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5L7.5 12l7 7" /></svg></button>
    <div class="ltt">
      <Speak k="lessonN" vars={{ n: cn(n) }} py={{ 第: 'dì', ...npy(n), 课: 'kè' }} />
      {#if short.zh}&nbsp;·&nbsp;<Speak text={short.zh} py={{ [short.zh]: short.py || '' }} />{:else}&nbsp;·&nbsp;{short.raw}{/if}
    </div>
    <div class="lprog" id="lprog">{step}/{NSTEP}</div>
  </div>

  <!-- 步骤条（点选可跳）——步骤数跟课内容走（4/5），标签容器 min-width:fit-content 零截断（BUGS#18③） -->
  <div id="rail">
    {#each STEPS as s, i (s.id)}
      <button class="rstep" class:done={step > s.id || (s.id === QUIZ_STEP && quiz.done && quiz.passed)} class:cur={step === s.id} data-step={s.id} onclick={() => goto(s.id)}>
        <span class="rd">
          {#if step > s.id && s.id !== QUIZ_STEP}
            <svg viewBox="0 0 24 24" fill="none" stroke="#19c8b9" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11" /></svg>
          {:else}{s.id}{/if}
        </span>
        <span class="rname"><Speak k={s.k} /></span>
      </button>
    {/each}
  </div>

  <!-- 字母切换器（Bug#12/Bug#14：任何步骤可直接切字母，切字母步骤绝对不动；
     BUGS#18②：拼读/小测两步隐藏——拼读是课级内容、小测考的是整课，字母切换在这两步无意义） -->
  {#if step !== BLEND_STEP && step !== QUIZ_STEP}
  <div class="lchips" data-lchips bind:this={chipsEl}>
    {#each letters as l, i (l.k)}
      <button class="lchip" class:on={i === li} data-ler={l.k} onclick={() => pickLetter(i)}>{l.k}</button>
    {/each}
  </div>
  {/if}

  <!-- 横向翻页舞台 -->
  <div id="stagewrap">
    <HSteps n={NSTEP} cur={step - 1} onchange={(i) => goto(i + 1)}>
      <!-- 页1 · 认识：PinyinCard full（五要素统一学习卡片 v2.5）。
          v2.9.1：去 tip（与读音 pill 重复）+ 字模 104——卡内预算救笔顺预览（原 svg 被挤到 0 高） -->
      <div class="hspage"><div class="pcard">
        <div class="ptag"><Speak k="stepKnow" plain /> · {letter.k}</div>
        <div class="knowfit">
          <PinyinCard mode="full" k={letter.k} glyphMax={104} />
        </div>
      </div></div>

      <!-- 页2 · 写法：笔顺动画 + 旁白 -->
      <div class="hspage"><div class="pcard">
        <div class="ptag hot"><Speak k="stepWrite" plain /> · {letter.k}</div>
        <div class="animfit"><StrokeAnim unit={letter.k} static={staticN} play={step === 2} bind:this={sa} /></div>
        <div class="sayline">{#each sayLines(letter.say) as seg, i (i)}{#if i > 0}<br />{/if}<Speak text={seg} />{/each}</div>
        <div class="xrow">
          <button class="rebtn" onclick={() => { sa?.replay(); if (letter.sayAudio) playAudio(letter.sayAudio, { hint: '' }) }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#19c8b9" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-2.6-6.4" /><path d="M21 4v5h-5" /></svg>
            <Speak k="seeAgain" plain />
          </button>
        </div>
        <div class="taptip"><Speak k="watchWriteLine" /></div>
      </div></div>

      <!-- 页3 · 声调 -->
      <div class="hspage"><div class="pcard">
        <div class="ptag hot"><Speak k="stepTone" plain /></div>
        <div class="drillfit"><ToneDrill rows={lesson.tones} sel={li} /></div>
      </div></div>

      <!-- 页4 · 拼读 / 整体认读（仅 hasBlend 课：BUGS#17 纯韵母课此步整页删除） -->
      {#if hasBlend}
      <div class="hspage"><div class="pcard">
        <div class="ptag hot"><Speak k="stepBlend" plain /></div>
        <div class="drillfit"><BlendDrill blends={lesson.blends || []} ztlist={lesson.ztlist || []} tones={lesson.tones || []} note={lesson.note || ''} /></div>
      </div></div>
      {/if}

      <!-- 页{NSTEP} · 小测：三题型混编（听音选字母/看字母选音/听调辨调），不考汉字（BUGS#18①） -->
      <div class="hspage"><div class="pcard">
        {#if !quiz.q.length && !quiz.done}
          <div class="quizboot"><Speak k="quizReady" /></div>
          <button class="bootbtn" data-bootquiz onclick={() => buildQuiz()}><Speak k="startQuiz" plain /></button>
        {:else if !quiz.done}
          {@const q = quiz.q[quiz.i]}
          <div class="ptag hot"><Speak k="stepQuiz" plain /> · <Speak k="quizQn" vars={{ n: cn(quiz.i + 1) }} py={{ 第: 'dì', ...npy(quiz.i + 1), 题: 'tí' }} /></div>
          <div class="qbody">
            <!-- BUGS#18⑨：圆点与"第 X 题"严格同步——X-1 个已完成点 + 1 个当前点 -->
            <div class="qprog">{#each quiz.q as _, i (i)}<span class="qdot" class:ok={i < quiz.i} class:cur={i === quiz.i}></span>{/each}</div>
            {#if q.type === 'listen'}
              <button class="qplay" data-qplay onclick={() => playQuestionAudio(q)} aria-label="listen"><Icon name="play" size={40} /></button>
              <div class="qhint"><Speak k="listenChoose" /></div>
              <div class="opts" data-opts>
                {#each q.opts as o (o)}
                  <button
                    class="opt" class:right={quiz.pick && o === q.key}
                    class:wrong={quiz.pick === '✗' && o !== q.key && o === quiz.lastPick}
                    data-qkey={probeOn ? o : null}
                    onclick={() => { quiz.lastPick = o; answer(o) }}
                  >{o}</button>
                {/each}
              </div>
            {:else if q.type === 'look'}
              <div class="qglyph" data-qglyph>{q.k}</div>
              <div class="qhint"><Speak k="lookHowRead" /></div>
              <div class="opts" data-opts>
                {#each q.opts as o (o)}
                  <button
                    class="opt optear" class:right={quiz.pick && o === q.key}
                    class:wrong={quiz.pick === '✗' && o !== q.key && o === quiz.lastPick}
                    aria-label={o}
                    data-qkey={probeOn ? o : null}
                    onclick={() => { quiz.lastPick = o; playAudio(letterAudio(o), { hint: tRaw('notReady') }); answer(o) }}
                  ><Icon name="play" size={34} /></button>
                {/each}
              </div>
            {:else}
              <button class="qplay" data-qplay onclick={() => playQuestionAudio(q)} aria-label="listen"><Icon name="play" size={40} /></button>
              <div class="qglyph" data-qglyph>{q.k}</div>
              <div class="qhint"><Speak k="whichTone" /></div>
              <div class="opts" data-opts>
                {#each TONE_MARKS as m, i (m.t)}
                  <button
                    class="opt topt" class:right={quiz.pick && m.t === q.key}
                    class:wrong={quiz.pick === '✗' && m.t !== q.key && m.t === quiz.lastPickN}
                    data-qkey={probeOn ? String(m.t) : null}
                    onclick={() => { quiz.lastPickN = m.t; answer(m.t) }}
                  >
                    <svg viewBox="0 0 56 30"><path d={m.d} stroke={TONE_COLORS[i]} stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg>
                    <span><Speak text={tRaw('toneName' + m.t)} /></span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {:else if quiz.passed}
          <div class="res">
            <div class="resemoji"><Icon name="rainbow" size={46} /><Icon name="star" size={46} /></div>
            <div class="resscore"><Speak k="gotNGreat" vars={{ n: cn(quiz.score) }} /></div>
            <div class="resstars">{#each Array(quiz.score >= 5 ? 3 : 2) as _, i (i)}<Icon name="star" size={30} />{/each}</div>
            <!-- BUGS#18⑦：结算页双按钮——回课程地图 + 再学一遍 -->
            <div class="resbtns">
              <button class="bootbtn ghost" data-restudy onclick={restudy}><Speak k="restudy" plain /></button>
              <button class="bootbtn" data-backlearn onclick={onexit}><Speak k="backMap" plain /></button>
            </div>
          </div>
        {:else}
          <div class="res">
            <div class="resemoji"><Icon name="sprout" size={46} /><Icon name="dumbbell" size={46} /></div>
            <div class="resscore"><Speak k="gotNScore" vars={{ n: cn(quiz.score) }} /></div>
            <div class="resmsg"><Speak k="almostMsg" /></div>
            <div class="resbtns">
              <button class="bootbtn" data-restudy onclick={restudy}><Speak k="restudy" plain /></button>
              <button class="bootbtn ghost" data-backlearn onclick={onexit}><Speak k="backMap" plain /></button>
            </div>
          </div>
        {/if}
      </div></div>
    </HSteps>
  </div>

  <!-- 页点 + 滑动提示（v2.9.1 并排单行——纵向预算让给卡内笔顺预览） -->
  <div id="pager">
    <div id="dots">
      {#each STEPS as s, i (s.id)}
        <i class:on={step === i + 1} data-dot={s.id}></i>
      {/each}
    </div>
    <div id="swipehint"><svg viewBox="0 0 24 24" fill="none" stroke="#9f927d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6" /></svg><Speak k="swipeNextStep" /></div>
  </div></section>
</div>

  <style>
  /* ===== BUGS#24 架构根治：课页容器硬锁（不依赖祖先链，滚动禁令自己扛） =====
     height:100% 挂靠 #shell（专注态=全视口），max-height:100dvh 硬顶任何父级变化；
     overflow:hidden + flex column——纵向滚动在容器级不可能。
     内部分配：固定件 flex:none（返回栏/步骤条/chip 条/页点），舞台 flex:1 1 0 弹性吃掉剩余。
     内容超高 → 卡内弹性区压缩/横滑消化，绝不滚动、绝不撑破容器。 */
  #lesson-root {
    height: 100%; height: 100dvh;
    max-height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative;
  }
  #lesson-root #v-lesson { flex: 1 1 0; min-height: 0; }
  #v-lesson { padding: calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-2); gap: 0; }
  .ltop { display: flex; align-items: center; gap: var(--sp-2); height: 44px; flex: 0 0 auto; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
  .cbtn svg { width: 18px; height: 18px; }
  .ltt { flex: 1; text-align: center; font-size:var(--fs-md); font-weight: 900; line-height: 1.8; }
  .lprog { font-size:var(--fs-xs); font-weight: 900; color: var(--animal-primary-active); background: var(--animal-primary-bg);
    padding: var(--sp-2) var(--sp-3); border-radius: 999px; }

  /* 步骤条：4/5 步等宽列排布；标签容器 fit-content 零截断（BUGS#18③，禁 ellipsis）。
     v2.9.1 密度回收：徽章 32→28——卡内笔顺预览的预算从壳件挤出来 */
  #rail { display: flex; align-items: flex-start; margin: var(--sp-2) 0 0; position: relative; flex: none; }
  #rail::before { content: ''; position: absolute; top: 13px; left: 34px; right: 34px; height: 3px; background: var(--animal-border-light); border-radius: 3px; }
  .rstep { position: relative; z-index: 1; flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: var(--sp-1); cursor: pointer;
    font-family: inherit; background: none; border: none; color: var(--animal-text-2); }
  .rstep .rd { width: 28px; height: 28px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow);
    display: flex; align-items: center; justify-content: center; font-size:var(--fs-xs); font-weight: 900; font-style: normal; }
  .rstep .rd svg { width: 13px; height: 13px; }
  .rstep .rname { min-width: fit-content; font-size:var(--fs-xs); font-weight: 800; }
  .rstep .rname :global(rt) { font-size:var(--fs-rt); }
  .rstep.done .rd { background: var(--animal-primary-bg); color: var(--animal-primary-active); }
  .rstep.cur .rd { background: var(--animal-primary); color: #fff; box-shadow: 0 3px 0 var(--press-teal); }
  .rstep.cur .rname { color: var(--animal-primary-active); }

  #stagewrap { flex: 1 1 0; min-height: 0; margin: var(--sp-2) 0 var(--sp-1); position: relative; }
  :global(.hswrap) { flex: 1; }
  /* BUGS#18⑥：页内左右对称留缝——相邻页卡片连阴影一起留在界外，左缘零碎片（仅课页覆写，不动 HSteps 其他消费方） */
  #stagewrap :global(.hspage) { padding-left: var(--sp-3); }
  .pcard { flex: 1; min-height: 0; background: #fff; border-radius: var(--animal-r-lg); box-shadow: var(--animal-shadow-lg);
    display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--sp-3) var(--sp-4) var(--sp-3); overflow: hidden; position: relative; gap: var(--sp-2); }
  .pcard .ptag { position: absolute; top: 12px; left: 14px; font-size:var(--fs-xs); font-weight: 900; color: var(--animal-text-dis);
    background: #f4f0e4; padding: var(--sp-1) var(--sp-2); border-radius: 999px; max-width: calc(100% - 28px); }
  .pcard .ptag.hot { background: #fff8e0; color: var(--animal-warning-active); }

  /* 认识：PinyinCard full 承载区 */
  .knowfit { flex: 1; min-height: 0; width: 100%; display: flex; flex-direction: column; }
  /* 字母 chip 条：常驻 rail 之下（Bug#12），紧凑版给舞台省纵向。
     BUGS#24：L12=16 个整体认读，chip 挤压换行+右半不可达——改横滑胶囊条消化
     （硬约束#10：横向滚动仅限胶囊条带状物）；首尾 auto margin=放得下居中、放不下可滑 */
  .lchips { display: flex; gap: var(--sp-2); margin: var(--sp-2) 0 0; flex: none;
    overflow-x: auto; scrollbar-width: none; padding: 2px; }
  .lchips::-webkit-scrollbar { display: none; }
  .lchips .lchip:first-child { margin-left: auto; }
  .lchips .lchip:last-child { margin-right: auto; }
  .lchip { min-width: 40px; height: 34px; border-radius: 11px; border: 2px solid #e3d9c8; background: #fff;
    font-size:var(--fs-md); font-weight: 900; color: #6f6353; font-family: inherit; padding: 0 var(--sp-2);
    white-space: nowrap; flex: 0 0 auto; }
  .lchip.on { border-color: var(--animal-primary); background: var(--animal-primary-bg); color: var(--animal-primary-active); }

  /* 写法 */
  .animfit { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; width: 100%; }
  .animfit :global(svg.strokeanim) { max-width: 100%; max-height: 100%; }
  .sayline { font-size:var(--fs-xs); font-weight: 800; color: var(--animal-text-2); line-height: 2; text-align: center; flex: none; }
  .xrow { display: flex; gap: var(--sp-2); flex: none; }
  .rebtn { display: flex; align-items: center; gap: var(--sp-2); border: none; background: var(--animal-primary-bg); color: var(--animal-primary-active);
    font-family: inherit; font-size:var(--fs-xs); font-weight: 900; padding: var(--sp-2) var(--sp-4); border-radius: 999px; cursor: pointer; }
  .rebtn svg { width: 15px; height: 15px; }

  /* 声调 / 拼读 drill 卡内适配 */
  .drillfit { flex: 1; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .drillfit :global(.tonedrill), .drillfit :global(.blenddrill) { width: 100%; gap: var(--sp-2); }
  .drillfit :global(.tonerow) { min-height: 52px; padding: var(--sp-2) var(--sp-3); }
  .drillfit :global(.tsyl) { font-size:var(--fs-xl); min-width: 56px; }
  .drillfit :global(.tname) { font-size:var(--fs-xs); }
  .drillfit :global(.bigbase) { font-size:var(--fs-glyph-sm); min-height: 58px; line-height: 1.3; }
  .drillfit :global(.basechip) { min-width: 56px; min-height: 42px; font-size:var(--fs-lg); border-radius: 14px; }
  .drillfit :global(.stage) { height: 128px; }
  .drillfit :global(.card) { width: 82px; height: 102px; font-size:var(--fs-glyph-sm); }
  .drillfit :global(.rsyl) { font-size:var(--fs-glyph); }
  .drillfit :global(.rchar) { font-size:var(--fs-xl); }
  .drillfit :global(.bchip) { font-size:var(--fs-xs); padding: var(--sp-2) var(--sp-2); }
  .drillfit :global(.magicnote) { font-size:var(--fs-xs); padding: var(--sp-2) var(--sp-2); }
  .drillfit :global(.ztgrid) { gap: var(--sp-2); }
  .drillfit :global(.ztcard) { padding: var(--sp-2) var(--sp-2); }
  .drillfit :global(.ztu) { font-size:var(--fs-lg); }
  .drillfit :global(.zkj) { font-size:var(--fs-xs); }
  .drillfit :global(.qhint) { font-size:var(--fs-md); margin-top: 0; }
  .drillfit :global(.topt) { min-height: 64px; }
  .drillfit :global(.topt svg) { width: 40px; height: 22px; }
  .drillfit :global(.topt span) { font-size:var(--fs-sm); }
  .drillfit :global(.replay) { width: 76px; height: 76px; }
  .drillfit :global(.steps .btn), .drillfit :global(.trow .btn) { min-height: 44px; font-size:var(--fs-sm); }
  .drillfit :global(.navbtn) { width: 44px; height: 44px; font-size:var(--fs-lg); }

  /* 小测（BUGS#18④：qbody 占满卡片、space-evenly 均布——大空白/播放按钮叠压的病灶根除） */
  .qbody { flex: 1; min-height: 0; width: 100%; display: flex; flex-direction: column; align-items: center;
    justify-content: space-evenly; gap: var(--sp-2); padding-top: 42px; }
  .quizboot { font-size:var(--fs-md); font-weight: 900; color: var(--animal-text); line-height: 2; }
  .bootbtn { border: none; border-radius: 999px; background: var(--animal-primary); color: #fff; font-family: inherit;
    font-size:var(--fs-md); font-weight: 900; padding: var(--sp-3) var(--sp-6); box-shadow: 0 4px 0 var(--press-teal); cursor: pointer; }
  .bootbtn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--press-teal); }
  .bootbtn.ghost { background: #fff; color: var(--animal-primary-active); box-shadow: 0 4px 0 #e3d9c8; }
  .bootbtn.ghost:active { box-shadow: 0 1px 0 #e3d9c8; }
  .qprog { display: flex; gap: var(--sp-2); }
  .qdot { width: 11px; height: 11px; border-radius: 50%; background: var(--animal-border-light); transition: background .2s, box-shadow .2s; }
  .qdot.ok { background: var(--animal-primary); }
  .qdot.cur { background: #fff; border: 3px solid var(--animal-primary); width: 13px; height: 13px; }
  .qplay { width: 84px; height: 84px; border-radius: 50%; border: none; background: #fff; box-shadow: 0 4px 0 #e3d9c8;
    color: var(--animal-primary-active); display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
  .qplay:active { transform: translateY(3px); box-shadow: 0 1px 0 #e3d9c8; }
  .qglyph { font-size:var(--fs-glyph-lg); font-weight: 900; color: var(--animal-text); line-height: 1.2; flex: 0 0 auto; }
  .qhint { font-size:var(--fs-sm); font-weight: 800; color: var(--animal-text-2); flex: none; }
  .opts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); width: 100%; flex: 0 0 auto; }
  .opt { min-height: 96px; border-radius: 18px; border: 3px solid var(--animal-border-light); background: #fbf8ee;
    font-size:var(--fs-glyph-sm); font-weight: 900; color: var(--animal-text); font-family: inherit; cursor: pointer; }
  .opt.right { border-color: var(--animal-primary); background: var(--animal-primary-bg); color: var(--animal-primary-active); }
  .opt.wrong { border-color: #e76f51; background: #fdeee7; animation: shake .3s; }
  @keyframes shake { 25% { transform: translateX(-4px) } 75% { transform: translateX(4px) } }
  .optear { color: var(--animal-primary-active); display: flex; align-items: center; justify-content: center; }
  .topt { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-1); }
  .topt svg { width: 52px; height: 28px; }
  .topt span { font-size:var(--fs-sm); font-weight: 800; color: #6f6353; }

  /* 小测结算（BUGS#18⑦：双按钮；块本体 flex:1 均布——短内容居中造成的上下大空白根除） */
  .res { flex: 1; min-height: 0; width: 100%; display: flex; flex-direction: column; align-items: center;
    justify-content: space-evenly; gap: var(--sp-2); padding: var(--sp-4) 0 var(--sp-2); }
  .resemoji { display: flex; gap: var(--sp-2); }
  .resscore { font-size:var(--fs-md); font-weight: 900; color: var(--animal-text); line-height: 2; }
  .resstars { color: #e9c46a; display: flex; gap: var(--sp-1); }
  .resmsg { font-size:var(--fs-sm); font-weight: 800; color: var(--animal-primary-active); text-align: center; line-height: 1.9; max-width: 260px; }
  .resbtns { display: flex; gap: var(--sp-3); width: 100%; }
  .resbtns .bootbtn { flex: 1; padding: var(--sp-3) var(--sp-2); }

  #pager { min-height: 30px; flex: none; display: flex; align-items: center; justify-content: center; gap: var(--sp-3); padding: var(--sp-1) 0; }
  #dots { display: flex; gap: var(--sp-2); }
  #dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--animal-text-dis); transition: .2s; }
  #dots i.on { width: 22px; background: var(--animal-primary); }
  #swipehint { display: flex; align-items: center; gap: var(--sp-1); font-size:var(--fs-xs); font-weight: 800; color: var(--animal-text-2); }
  #swipehint svg { width: 14px; height: 14px; }
</style>
