<script lang="ts">
  /* v3.0 学习流程结构反转（BUGS#28+#29+#30）+ v3.1 字模合体（BUGS#31）：按字母分，不再按步骤分——
     每个字母一个迷你流：学一学（合并页：笔顺动画=字模（唯一 z，进页自动播+可重播）+口诀+读音+例词，
     BUGS#29 两字模合一 → BUGS#31 静态字模退役）
     → 声调（四声演示+辨调小练）→ 走完自动推进下一字母；全部字母走完 → 课级拼读（hasBlend 课）→ 课级小测。
     进度指示 = 字母进度 chip 条（z✓ c✓ s · 拼读 · 小测），随时可跳（学习自由）；不再有课级步骤条。
     页面/单元推导共享于 lib/lessonUnits.ts（学习 tab 断点 CTA 同源）。
     声音礼仪：R1 翻页零过场音、零自动语音（读音全部点播）；零纵向滚动（#lesson-root 容器硬锁+clip）。 */
  import { untrack } from 'svelte'
  import lessonsData from '../../data/lessons.json'
  import { LETTERS, PAIRS } from '../../data'
  import { letterAudio, playAudio, sndOk, sndNo, sndStar, preloadAudioList } from '../../lib/audio'
  import { L as LRN, submitQuiz, setStep, lessonShort, quizPassed } from '../../stores/learn.svelte'
  import { onLearnQuizPass, addToneCorrect, celebrateLetter, allLessonsPassed } from '../../stores/growth.svelte'
  import { lessonPages, lessonHasBlend, toneRowOf, unitIndexOf, unitCountOf, type LessonLike } from '../../lib/lessonUnits'
  import { tRaw, cnNum, NUM_PY } from '../../text/strings'
  import { manifest } from '../../text/manifest'
  import { TONE_MARKS, TONE_COLORS } from '../../lib/toneMarks'
  import Speak from '../Speak.svelte'
  import Icon from '../Icon.svelte'
  import ChickGrowth from '../growth/ChickGrowth.svelte'
  import ToneDrill from './ToneDrill.svelte'
  import BlendDrill from './BlendDrill.svelte'
  import HSteps from '../HSteps.svelte'
  import PinyinCard from '../PinyinCard.svelte'

  let { n, li0 = 0, onexit }: { n: number; li0?: number; onexit: () => void } = $props()

  /* 课页可点播的 UI 短语键（本页模板 + ToneDrill/BlendDrill 子件；manifest 无值的键查表即跳过） */
  const LESSON_UI_KEYS = [
    'stepLearn', 'stepTone', 'stepBlend', 'stepQuiz', 'quizReady', 'startQuiz',
    'listenChoose', 'lookHowRead', 'whichTone', 'toneName1', 'toneName2', 'toneName3', 'toneName4',
    'almostMsg', 'restudy', 'backMap', 'swipeNextStep',
    'followMe', 'earPractice', 'heardN', 'goodEars', 'listenMore', 'tonePracticeAgain', 'tonePracticeDone',
    'ztDirect', 'fourTonesRead', 'tapFollow',
  ]

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

  /* v3.0 页面序列（扁平有序）：[学一学, 声调?]×字母 → 拼读? → 小测；单元=字母/拼读/小测（进度口径） */
  const lessonLike = $derived(lesson as unknown as LessonLike)
  const pages = $derived(lessonPages(lessonLike))
  const NP = $derived(pages.length)
  const hasBlend = $derived(lessonHasBlend(lessonLike))
  const nL = $derived(letters.length)
  const NL_UNIT = $derived(nL)                    /* 拼读的单元号 */
  const QUIZ_UNIT = $derived(nL + (hasBlend ? 1 : 0))
  const UNIT_N = $derived(unitCountOf(lessonLike))
  /* 韵母课才有听调辨调题（声调是韵母的属性；整体认读/声母课不考） */
  const isFinals = $derived(lesson.kind === 'ym' || lesson.kind === 'fu')

  /* BUGS#23 音频智能预载：进课（含课间换课）即并行预取本课全部音频——
     每字母呼读音(hyp) + 口诀(kjAudio) + 写法旁白(sayAudio) + 声调四声(hyp) + 课页/小测/声调/拼读 UI 短语(manifest)。
     fetch→写入 SW 的 pinyin-audio 运行时缓存（CacheFirst），首次点播即命中零网络等待；
     allSettled 单条失败静默、不阻塞渲染。预载≠自动播放（声音礼仪 R2 不变：语音仍全部点播触发）。
     GitHub Pages 冷请求 ~1.2s 的病灶在预载完成后消失——孩子点 🔊 时文件已在本地缓存。 */
  $effect(() => {
    const names: string[] = []
    for (const l of letters) {
      names.push(letterAudio(l.k))
      if (l.kjAudio) names.push(l.kjAudio)
      if (l.sayAudio) names.push(l.sayAudio)
    }
    for (const row of (lesson.tones || []) as { tones?: { file: string }[] }[]) {
      for (const tn of row.tones || []) names.push(tn.file)
    }
    for (const k of LESSON_UI_KEYS) { const f = manifest[k]; if (f) names.push(f) }
    void preloadAudioList(names)
  })

  const pageIdxOfLetter = (li: number) => pages.findIndex((p) => p.t === 'learn' && p.li === li)
  const pageIdxOfKind = (t: 'blend' | 'quiz') => pages.findIndex((p) => p.t === t)

  let chipsEl: HTMLDivElement
  /* 当前单元 chip 居中——v3.0 只滚 chip 条自己（chipsEl.scrollTo）。
     BUGS#30 根治：v2.6.1 起的 scrollIntoView({inline:center}) 会连带滚动 overflow:hidden 祖先
     （#v-lesson 可滚溢出被 HSteps track 撑出 (N-1)×W）→ 选后面字母整页左移 48/96px（L7 实测复现）。
     scrollTo 只作用于 chip 条自身；祖先另加 overflow:clip（连编程滚动都不可能）双保险 */
  $effect(() => {
    void page
    const el = chipsEl?.querySelector('.lchip.on') as HTMLElement | null
    if (chipsEl && el) {
      const target = el.offsetLeft - (chipsEl.clientWidth - el.offsetWidth) / 2
      chipsEl.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
    }
  })
  let quiz = $state<{ q: any[]; i: number; score: number; pick: string; lastPick: string; lastPickN: number; done: boolean; passed: boolean }>({
    q: [], i: 0, score: 0, pick: '', lastPick: '', lastPickN: 0, done: false, passed: false,
  })

  /* v3.0：页为断点（1 起存 LRN.step，学习 tab CTA 同源解读）。通过课=从头复习（页0） */
  const initPage =
    li0 > 0 ? Math.max(0, pageIdxOfLetter(Math.min(li0, nL - 1)))
    : quizPassed(n) ? 0
    : Math.max(0, Math.min(NP - 1, (LRN.step[n] || 1) - 1))
  let page = $state(initPage)        // 0..NP-1（= HSteps 页号）
  let letterDone = $state<Record<number, boolean>>({})   // 会话内字母完成标（chip ✓）
  /* BUGS#33 互动证据制：完成判定不再是"翻页推进本身"，每字母两个参与旗（课内会话级，重进课重计）——
     旗A 学一学：该字母 🔊读音点过 ≥1 次（PinyinCard 主按钮/v3.1.1 浮层读音键，onread 回调，两处都算）
     旗B 声调：ToneDrill 逐声调点读过（点读/跟我读覆盖声调行；行少的至少点过 3 个不同声调；
         无声调页的字母（L12 十个单页字母）豁免旗B，旗A 即可）。
     两旗齐才 letterDone ✓（chip ✓=已学会/当前=高亮/待学=灰三态沿用）；
     小测前置检查：进小测步时本课有未集旗字母 → 温和拦截卡（已过关课重学不拦=自由复习）。 */
  let flagRead = $state<Record<number, boolean>>({})
  let flagTone = $state<Record<number, number[]>>({})
  const toneNeedOf = (li: number) => {
    const ri = toneRowOf(lessonLike, li)
    const row = ri >= 0 ? ((lesson.tones || []) as { tones?: unknown[] }[])[ri] : null
    return row?.tones?.length ? Math.min(3, row.tones.length) : 0
  }
  const letterReady = (li: number) => !!flagRead[li] && (flagTone[li]?.length || 0) >= toneNeedOf(li)
  const unreadyCount = $derived.by(() => { let c = 0; for (let i = 0; i < nL; i++) if (!letterReady(i)) c++; return c })
  const unreadyIdx = $derived.by(() => { for (let i = 0; i < nL; i++) if (!letterReady(i)) return i; return -1 })
  /* 小测前置门（证据未齐即拦；quizPassed=已过关课重学自由复习不拦） */
  const gateOn = $derived(unreadyCount > 0 && !quizPassed(n))
  const curUnit = $derived(unitIndexOf(lessonLike, page))

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
    if (right && q.type === 'tone') addToneCorrect()   /* v3.2 声调大师徽章计数 */
    /* look 题选项音刚起播，等读音落地再叮/嘟（R3 一次一路，反馈音会打断在播读音） */
    const fire = () => {
      if (right) { quiz.score++; sndOk() } else { sndNo() }
      setTimeout(() => {
        if (quiz.i + 1 >= quiz.q.length) {
          quiz.done = true
          /* v3.2：过关前的状态先取证（submitQuiz 会写 learn store）——
             首过+5星/复玩+2、解锁本课字母卡、全屏庆祝（12课全通=毕业典礼），结算屏出现后再播 */
          const wasPassed = quizPassed(n)
          const wasAll = allLessonsPassed()
          quiz.passed = submitQuiz(n, quiz.score, LESSONS.length)
          sndStar()
          if (quiz.passed) setTimeout(() => { onLearnQuizPass(wasPassed, wasAll) }, 750)
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

  /* BUGS#33：✓ 记账=证据制——离开字母单元（前进向：单步滑/自动推进/切字母跳出，凡新单元号更大）时
     查两旗：齐 → chip ✓ + 迷你庆祝（一次性）；不齐 → chip 留「待学」灰态，不打 ✓ */
  function settleLetter(li: number) {
    if (!letterDone[li] && letterReady(li)) {
      letterDone[li] = true
      celebrateLetter(letters[li].k)
    }
  }
  /* 小测残卷复位（进小测步被门拦下时回 boot 态，渲染拦截卡） */
  function resetQuiz() {
    quiz = { q: [], i: 0, score: 0, pick: '', lastPick: '', lastPickN: 0, done: false, passed: false }
  }
  /* 参与旗采集：旗A=读音点播（主按钮/浮层键都算，PinyinCard onread）；
     旗B=声调行点读去重（ToneDrill ontone；达标线 toneNeedOf=min(3,行数)，无调行=0） */
  function markRead(li: number) { flagRead[li] = true }
  function markTone(li: number, ti: number) {
    /* 整组赋值走 $state 代理（Svelte 5：`(flagTone[li] = []).push()` 的表达式值是未代理的裸数组，
       首个 push 会绕过代理静默丢失——实测三个声调只记到两个） */
    const cur = flagTone[li] || []
    if (!cur.includes(ti)) flagTone[li] = [...cur, ti]
  }

  /* 翻页/跳单元：R1 翻页零音效；记页级断点（学习 tab CTA 用）。
     BUGS#33 小测前置检查：进小测步（翻页/chip/深链进入）且本课有未集旗字母 → 复位残卷出拦截卡，
     不自动建题（「我还要试试」放行 / 已过关课重学不拦）；放行或旗齐才建题。
     v3.2：前进跨出字母单元 → 证据结算（settleLetter，见上） */
  function gotoPage(p: number) {
    const prev = page
    page = Math.max(0, Math.min(NP - 1, p))
    setStep(n, page + 1)
    if (pages[page].t === 'quiz' && (!quiz.q.length || quiz.done)) {
      if (gateOn) resetQuiz()
      else buildQuiz()
    }
    const pg = pages[prev]
    if ((pg.t === 'learn' || pg.t === 'tone') && !letterDone[pg.li]) {
      if (unitIndexOf(lessonLike, page) > pg.li) settleLetter(pg.li)
    }
  }

  /* 声调小练「读完了」→ 自动推进下一字母（v3.0 推进结构不动；本字母 ✓ 由 gotoPage 的证据结算记账） */
  function toneDone(li: number) {
    const tp = pages.findIndex((pg) => pg.t === 'tone' && pg.li === li)
    if (tp >= 0 && tp + 1 < NP) gotoPage(tp + 1)
  }

  function restudy() { quiz.done = false; buildQuiz() }

  /* 深链（验收截图/笔顺自检用）：?page=P（0 起新口径）/ ?li=I（字母 I 的学一学页）/
     ?step=S（v2.9 旧口径兼容映射：1,2→学一学，3→声调，4→拼读，5→小测）/ ?static=K（学一学页笔顺静态帧）/
     ?qkey（小测选项 data-qkey 验收门）。
     注意：effect 内不读 page——page 进依赖会被深链打回（v2.6.1 实测教训） */
  let staticN = $state(-1)
  /* 验收钩子（qkey 门，probe.ts 同哲学但独立参数——URL 含 'probe' 子串会触发 probeRun 流程劫持视图）：
     仅 URL 带 ?qkey 时选项渲染 data-qkey，自动化作答可读答案；正常使用零泄漏 */
  const probeOn = typeof location !== 'undefined' && new URLSearchParams(location.search).has('qkey')
  $effect(() => {
    const q = new URLSearchParams(location.search)
    const iN = parseInt(q.get('li') || '', 10)
    const pN = parseInt(q.get('page') || '', 10)
    const sN = parseInt(q.get('step') || '', 10)
    if (iN >= 0 && iN < nL) page = Math.max(0, pageIdxOfLetter(iN))
    if (pN >= 0 && pN < NP) page = pN
    if (sN >= 1) {
      const liEff = Math.max(0, Math.min(iN >= 0 ? iN : 0, nL - 1))
      if (sN <= 2) page = pageIdxOfLetter(liEff)
      else if (sN === 3) {
        const tp = pages.findIndex((pg) => pg.t === 'tone' && pg.li === liEff)
        page = tp >= 0 ? tp : pageIdxOfLetter(liEff)
      } else if (sN === 4) page = hasBlend ? pageIdxOfKind('blend') : pageIdxOfKind('quiz')
      else page = pageIdxOfKind('quiz')
    }
    const st = q.get('static')
    if (st !== null) staticN = Math.max(0, parseInt(st, 10))
    /* 落在小测页 → 自动建题（BUGS#33：证据门同 gotoPage——未集旗时出拦截卡不建题）。
       必须 untrack：quiz 状态（done 在第 5 题翻转）不得进本 effect 依赖——
       否则答完卷 effect 重跑 buildQuiz 把卷子静默重置、结算页永不出（v30-accept 抓的实锤） */
    untrack(() => {
      if (pages[page]?.t === 'quiz' && (!quiz.q.length || quiz.done)) {
        if (gateOn) resetQuiz()
        else buildQuiz()
      }
    })
  })
</script>

<!-- BUGS#24 架构根治：课页最外层容器硬锁——height 锁视口（专注态全屏，无 tabbar 让位）+ overflow hidden/clip
     纵向滚动在容器级即不可能；clip（v3.0，BUGS#30 双保险）=连编程滚动都不可能，祖先左移类 bug 根绝。
     内部分配：固定件 flex:none（返回栏/进度 chip 条/页脚提示），舞台 flex:1 1 0 弹性吃掉剩余。
     内容超高 → 卡内弹性区压缩/横滑消化，绝不滚动、绝不撑破容器。 -->
<div id="lesson-root">
<section id="v-lesson" class="view on" data-screen="lesson">
  <div class="ltop">
    <button class="cbtn" data-back="learn" onclick={onexit} aria-label="返回"><svg viewBox="0 0 24 24" fill="none" stroke="#794f27" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5L7.5 12l7 7" /></svg></button>
    <div class="ltt">
      <Speak k="lessonN" vars={{ n: cn(n) }} py={{ 第: 'dì', ...npy(n), 课: 'kè' }} />
      {#if short.zh}&nbsp;·&nbsp;<Speak text={short.zh} py={{ [short.zh]: short.py || '' }} />{:else}&nbsp;·&nbsp;{short.raw}{/if}
    </div>
    <div class="lprog" id="lprog">{curUnit + 1}/{UNIT_N}</div>
  </div>

  <!-- 进度 chip 条（v3.0）：字母进度（✓ 完成 teal / on 当前）+ 分隔线 + 课级拼读/小测。
     随时可跳（学习自由）；声调「读完了」自动进下一字母。L12=18 chip 横滑消化；
     touch-action:pan-x + scrollTo 只滚自己（BUGS#30：杜绝手势/滚动波及课页） -->
  <div class="lchips" data-lchips bind:this={chipsEl}>
    {#each letters as l, i (l.k)}
      <button class="lchip" class:on={curUnit === i} class:done={!!letterDone[i]} data-ler={l.k} onclick={() => gotoPage(pageIdxOfLetter(i))}>
        {#if letterDone[i]}<svg class="ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11" /></svg>{/if}{l.k}
      </button>
    {/each}
    <i class="pdiv" aria-hidden="true"></i>
    {#if hasBlend}
    <button class="lchip pchip" class:on={curUnit === NL_UNIT} data-punit="blend" onclick={() => gotoPage(pageIdxOfKind('blend'))}><Speak k="stepBlend" plain /></button>
    {/if}
    <button class="lchip pchip" class:on={curUnit === QUIZ_UNIT} data-punit="quiz" onclick={() => gotoPage(pageIdxOfKind('quiz'))}><Speak k="stepQuiz" plain /></button>
  </div>

  <!-- 横向翻页舞台：页序列 = 每字母（学一学 → 声调）→ 拼读? → 小测 -->
  <div id="stagewrap">
    <HSteps n={NP} cur={page} onchange={(i) => gotoPage(i)}>
      {#each pages as pg, idx (idx)}
        {#if pg.t === 'learn'}
          <!-- 学一学（合并页，BUGS#29+#31）：PinyinCard full 五要素同屏——笔顺动画=字模（四线三格里
              唯一的 z，进页自动播、可重播）+ 🔊读音 + 口诀 + 例词；静态大字模已成历史（BUGS#31①） -->
          <div class="hspage"><div class="pcard">
            <div class="ptag"><Speak k="stepLearn" plain /> · {letters[pg.li].k}</div>
            <div class="knowfit">
              <!-- BUGS#26③：glyphMax 420（字模框上限 546px）——上限抬到高于一切手机视口的 hero 实际高度，
                  字模 svg 吃满面板（不再小字模居中漂在 92px×2 的奶油空白里）；上限仅防超高分屏失真 -->
              <PinyinCard mode="full" k={letters[pg.li].k} glyphMax={420} strokePlay={page === idx} strokeStatic={staticN >= 0 ? staticN : undefined} onread={() => markRead(pg.li)} />
            </div>
          </div></div>
        {:else if pg.t === 'tone'}
          <!-- 声调：四声演示 + 听调辨调；「读完了」= 本字母完成 → 自动推进下一字母 -->
          <div class="hspage"><div class="pcard">
            <div class="ptag hot"><Speak k="stepTone" plain /> · {letters[pg.li].k}</div>
            <div class="drillfit"><ToneDrill rows={lesson.tones} sel={toneRowOf(lessonLike, pg.li)} ondone={() => toneDone(pg.li)} ontone={(ti) => markTone(pg.li, ti)} /></div>
          </div></div>
        {:else if pg.t === 'blend'}
          <!-- 拼读（课级，仅 hasBlend 课）：声母+韵母合成 / 整体认读卡 -->
          <div class="hspage"><div class="pcard">
            <div class="ptag hot"><Speak k="stepBlend" plain /></div>
            <div class="drillfit"><BlendDrill blends={lesson.blends || []} ztlist={lesson.ztlist || []} tones={lesson.tones || []} note={lesson.note || ''} /></div>
          </div></div>
        {:else}
          <!-- 小测（课级，最后一步）：三题型混编（听音选字母/看字母选音/听调辨调），不考汉字（BUGS#18①）。
              BUGS#33：进小测步先过互动证据门——有未集旗字母出温和拦截卡（吉祥物+儿童语气文案），
              跳回去学=跳到第一个未学字母；我还要试试=家长通道式弱化放行（不锁死） -->
          <div class="hspage"><div class="pcard">
            {#if !quiz.q.length && !quiz.done}
              {#if gateOn}
                <div class="gate" data-gate>
                  <div class="gatemascot"><ChickGrowth stage={1} /></div>
                  <div class="gatemsg"><Speak k="gateNotDone" vars={{ n: cn(unreadyCount) }} py={{ 还有: 'hái yǒu', [cn(unreadyCount)]: NUM_PY[cn(unreadyCount)] || '', 个: 'gè', 拼音: 'pīn yīn', 没学完: 'méi xué wán', 先学完: 'xiān xué wán', 再来吧: 'zài lái ba' }} /></div>
                  <div class="gatebtns">
                    <button class="bootbtn" data-goback onclick={() => gotoPage(pageIdxOfLetter(unreadyIdx))}><Speak k="gateGoLearn" plain /></button>
                    <button class="bootbtn ghost sm" data-forcequiz onclick={() => buildQuiz()}><Speak k="gateForce" plain /></button>
                  </div>
                </div>
              {:else}
                <div class="quizboot"><Speak k="quizReady" /></div>
                <button class="bootbtn" data-bootquiz onclick={() => buildQuiz()}><Speak k="startQuiz" plain /></button>
              {/if}
            {:else if !quiz.done}
              {@const q = quiz.q[quiz.i]}
              <div class="ptag hot"><Speak k="stepQuiz" plain /> · <Speak k="quizQn" vars={{ n: cn(quiz.i + 1) }} py={{ 第: 'dì', ...npy(quiz.i + 1), 题: 'tí' }} /></div>
              <div class="qbody" data-qkey={probeOn ? String(q.key) : null}>
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
        {/if}
      {/each}
    </HSteps>
  </div>

  <!-- 页脚提示（v3.0：页点取消——字母进度 chip 条即进度指示，34 页课的点串只会是噪声） -->
  <div id="pager">
    <div id="swipehint"><svg viewBox="0 0 24 24" fill="none" stroke="#9f927d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6" /></svg><Speak k="swipeNextStep" /></div>
  </div></section>
</div>

  <style>
  /* ===== BUGS#24 架构根治：课页容器硬锁（不依赖祖先链，滚动禁令自己扛） =====
     height:100% 挂靠 #shell（专注态=全视口），max-height:100dvh 硬顶任何父级变化；
     overflow:hidden+clip + flex column——纵向滚动在容器级不可能；clip（BUGS#30 双保险）
     使 scrollIntoView/scrollTo 类调用在祖先上完全失效（hidden 仍可编程滚动，clip 不可）。
     内部分配：固定件 flex:none（返回栏/chip 条/页脚），舞台 flex:1 1 0 弹性吃掉剩余。
     内容超高 → 卡内弹性区压缩/横滑消化，绝不滚动、绝不撑破容器。 */
  #lesson-root {
    height: 100%; height: 100dvh;
    max-height: 100%;
    overflow: hidden;
    overflow: clip;
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative;
  }
  #lesson-root #v-lesson { flex: 1 1 0; min-height: 0; overflow: hidden; overflow: clip; }
  #v-lesson { padding: calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-2); gap: 0; }
  .ltop { display: flex; align-items: center; gap: var(--sp-2); height: 44px; flex: 0 0 auto; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
  .cbtn svg { width: 18px; height: 18px; }
  .ltt { flex: 1; text-align: center; font-size:var(--fs-md); font-weight: 900; line-height: 1.8; white-space: nowrap; }    /* 课名标题零换行 */
  .lprog { font-size:var(--fs-xs); font-weight: 900; color: var(--animal-primary-active); background: var(--animal-primary-bg);
    padding: var(--sp-2) var(--sp-3); border-radius: 999px; white-space: nowrap; }

  #stagewrap { flex: 1 1 0; min-height: 0; margin: var(--sp-2) 0 var(--sp-1); position: relative; }
  :global(.hswrap) { flex: 1; }
  /* BUGS#18⑥：页内左右对称留缝——相邻页卡片连阴影一起留在界外，左缘零碎片（仅课页覆写，不动 HSteps 其他消费方） */
  #stagewrap :global(.hspage) { padding-left: var(--sp-3); }
  .pcard { flex: 1; min-height: 0; background: #fff; border-radius: var(--animal-r-lg); box-shadow: var(--animal-shadow-lg);
    display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--sp-3) var(--sp-4) var(--sp-3); overflow: hidden; position: relative; gap: var(--sp-2); }
  .pcard .ptag { position: absolute; top: 12px; left: 14px; font-size:var(--fs-xs); font-weight: 900; color: var(--animal-text-dis);
    background: #f4f0e4; padding: var(--sp-1) var(--sp-2); border-radius: 999px; max-width: calc(100% - 28px); white-space: nowrap; z-index: 2; }
  .pcard .ptag.hot { background: #fff8e0; color: var(--animal-warning-active); }

  /* 学一学：PinyinCard full 承载区（rail 与 chip 条合一省下的纵向预算给了卡内） */
  .knowfit { flex: 1; min-height: 0; width: 100%; display: flex; flex-direction: column; }
  /* BUGS#26③：字模 svg 吃满面板后，顶部格线会贴到左上"学一学"角标——面板给角标让出顶肩位，
     格线整体下移（radio 展开区无角标不受影响，故只在课页 scope 覆写） */
  .knowfit :global(.pc-hero) { padding-top: 30px; }

  /* 进度 chip 条（v3.0）：字母 ✓/当前/待学 + 拼读/小测；L12=18 chip 横滑消化
     （硬约束#10：横向滚动仅限胶囊条带状物）。
     BUGS#30 三重防线：①touch-action:pan-x 明示横向 pan 意图 ②居中只 scrollTo 自己
     ③祖先 #lesson-root/#v-lesson overflow:clip。首尾 auto margin=放得下居中、放不下可滑 */
  .lchips { display: flex; gap: var(--sp-2); margin: var(--sp-2) 0 0; flex: none;
    overflow-x: auto; scrollbar-width: none; padding: 2px; touch-action: pan-x; }
  .lchips::-webkit-scrollbar { display: none; }
  .lchips .lchip:first-child { margin-left: auto; }
  .lchips .pchip:last-child { margin-right: auto; }
  .lchip { min-width: 40px; height: 36px; border-radius: 11px; border: 2px solid #e3d9c8; background: #fff;
    font-size:var(--fs-md); font-weight: 900; color: #6f6353; font-family: inherit; padding: 0 var(--sp-2);
    white-space: nowrap; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 2px; }
  .lchip.on { border-color: var(--animal-primary); background: var(--animal-primary-bg); color: var(--animal-primary-active); }
  .lchip.done { border-color: #bfe8e0; background: #f2fbf9; color: var(--animal-primary-active); }
  .lchip .ck { width: 12px; height: 12px; color: var(--animal-primary-active); }
  .lchip.pchip { background: var(--animal-primary-bg); border-color: #bfe8e0; color: var(--animal-primary-active); }
  .lchip.pchip :global(rt) { font-size: 9px; }
  .pdiv { width: 2px; height: 20px; border-radius: 2px; background: var(--animal-border-light); flex: 0 0 auto; align-self: center; margin: 0 2px; }

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
  /* BUGS#31③：声调页的跟我读/听音练等播放按钮 ≥48px 儿童触控 */
  .drillfit :global(.steps .btn), .drillfit :global(.trow .btn) { min-height: 48px; font-size:var(--fs-sm); }
  .drillfit :global(.navbtn) { width: 48px; height: 48px; font-size:var(--fs-lg); }

  /* 小测（BUGS#18④：qbody 占满卡片、space-evenly 均布——大空白/播放按钮叠压的病灶根除） */
  .qbody { flex: 1; min-height: 0; width: 100%; display: flex; flex-direction: column; align-items: center;
    justify-content: space-evenly; gap: var(--sp-2); padding-top: 42px; }
  .quizboot { font-size:var(--fs-md); font-weight: 900; color: var(--animal-text); line-height: 2; white-space: nowrap; }
  .bootbtn { border: none; border-radius: 999px; background: var(--animal-primary); color: #fff; font-family: inherit;
    font-size:var(--fs-md); font-weight: 900; padding: var(--sp-3) var(--sp-6); box-shadow: 0 4px 0 var(--press-teal); cursor: pointer; white-space: nowrap; }
  .bootbtn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--press-teal); }
  .bootbtn.ghost { background: #fff; color: var(--animal-primary-active); box-shadow: 0 4px 0 #e3d9c8; }
  .bootbtn.ghost:active { box-shadow: 0 1px 0 #e3d9c8; }
  /* BUGS#33 拦截卡（进小测步的互动证据门）：吉祥物+友好文案+双按钮（flex 均布，卡内消化零滚动）。
     「我还要试试」=家长通道式弱化（.sm 缩一号、ghost 灰底），主行动永远是「跳回去学」 */
  .gate { flex: 1; min-height: 0; width: 100%; display: flex; flex-direction: column; align-items: center;
    justify-content: space-evenly; gap: var(--sp-2); padding-top: 42px; }
  .gatemascot { width: 118px; flex: 0 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; }
  .gatemascot :global(svg.chickgrow) { width: 100%; height: auto; }
  .gatemsg { font-size:var(--fs-md); font-weight: 900; color: var(--animal-text); text-align: center; line-height: 2; max-width: 280px; }
  .gatebtns { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); width: 100%; max-width: 300px; flex: none; }
  .gatebtns .bootbtn { width: 100%; }
  .gatebtns .bootbtn.sm { font-size:var(--fs-xs); font-weight: 800; color: var(--animal-text-2); padding: var(--sp-2) var(--sp-4); width: auto; }
  .qprog { display: flex; gap: var(--sp-2); }
  .qdot { width: 11px; height: 11px; border-radius: 50%; background: var(--animal-border-light); transition: background .2s, box-shadow .2s; }
  .qdot.ok { background: var(--animal-primary); }
  .qdot.cur { background: #fff; border: 3px solid var(--animal-primary); width: 13px; height: 13px; }
  .qplay { width: 84px; height: 84px; border-radius: 50%; border: none; background: #fff; box-shadow: 0 4px 0 #e3d9c8;
    color: var(--animal-primary-active); display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
  .qplay:active { transform: translateY(3px); box-shadow: 0 1px 0 #e3d9c8; }
  .qglyph { font-size:var(--fs-glyph-lg); font-weight: 900; color: var(--animal-text); line-height: 1.2; flex: 0 0 auto; }
  .qhint { font-size:var(--fs-sm); font-weight: 800; color: var(--animal-text-2); flex: none; }    /* 题目指令=长内容允许换行 */
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
  .resscore { font-size:var(--fs-md); font-weight: 900; color: var(--animal-text); line-height: 2; }    /* 结算语=成句说明允许换行 */
  .resstars { color: #e9c46a; display: flex; gap: var(--sp-1); }
  .resmsg { font-size:var(--fs-sm); font-weight: 800; color: var(--animal-primary-active); text-align: center; line-height: 1.9; max-width: 260px; }    /* 安慰语=成句说明允许换行 */
  .resbtns { display: flex; gap: var(--sp-3); width: 100%; }
  .resbtns .bootbtn { flex: 1; padding: var(--sp-3) var(--sp-2); }

  #pager { min-height: 26px; flex: none; display: flex; align-items: center; justify-content: center; gap: var(--sp-3); padding: var(--sp-1) 0; }
  #swipehint { display: flex; align-items: center; gap: var(--sp-1); font-size:var(--fs-xs); font-weight: 800; color: var(--animal-text-2); white-space: nowrap; }    /* 提示文案零换行 */
  #swipehint svg { width: 14px; height: 14px; }
</style>
