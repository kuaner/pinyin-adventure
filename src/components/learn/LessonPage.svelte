<script lang="ts">
  /* 第 n 课五步流程：①认识 ②写法（笔顺动画+旁白）③声调 ④拼读 ⑤小测（4/5 解锁下一课） */
  import lessonsData from '../../data/lessons.json'
  import { LETTERS, PAIRS } from '../../data'
  import { letterAudio, playAudio, say, sndOk, sndNo, sndStar } from '../../lib/audio'
  import { submitQuiz } from '../../stores/learn.svelte'
  import { toast } from '../../stores/ui.svelte'
  import Ruby from '../Ruby.svelte'
  import Icon from '../Icon.svelte'
  import StrokeAnim from './StrokeAnim.svelte'
  import ToneDrill from './ToneDrill.svelte'
  import BlendDrill from './BlendDrill.svelte'

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
    { id: 1, name: '认识', icon: 'eye' },
    { id: 2, name: '写法', icon: 'pencil' },
    { id: 3, name: '声调', icon: 'music' },
    { id: 4, name: '拼读', icon: 'rainbow' },
    { id: 5, name: '小测', icon: 'trophy' },
  ] as const

  let step = $state(1)
  let li = $state(0)                 // 当前字母下标
  let sa: StrokeAnim                 // 笔顺动画引用
  let quiz = $state<{ q: any[]; i: number; score: number; pick: string; lastPick: string; done: boolean; passed: boolean }>({
    q: [], i: 0, score: 0, pick: '', lastPick: '', done: false, passed: false,
  })

  const lesson = $derived(LESSONS.find((x) => x.n === n) || LESSONS[0])
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
    setTimeout(() => playQuestionAudio(qs[0]), 350)
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

  function goto(s: number) {
    step = s
    if (s === 5) buildQuiz()
    else playAudio('lessons/step_' + s)
    window.scrollTo(0, 0)
  }
  function restudy() { quiz.done = false; goto(1) }

  /* 进课开场音 */
  $effect(() => {
    n
    const t = setTimeout(() => playAudio('lessons/open_' + n), 400)
    return () => clearTimeout(t)
  })

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

<section id="v-lesson" class="view on">
  <div class="topbar">
    <button class="backbtn" data-back="island" onclick={onexit}>‹</button>
    <h2><Ruby text="第{cn(n)}课 {lesson.title}" /></h2>
    <div class="scorechip">{cn(step)}/五</div>
  </div>

  <!-- 五步进度条 -->
  <div class="stepbar">
    {#each STEPS as s (s.id)}
      <button class="stepdot" class:on={step === s.id} class:passed={step > s.id} onclick={() => goto(s.id)}>
        <Icon name={s.icon} size={18} />
        <span><Ruby text={s.name} /></span>
      </button>
    {/each}
  </div>

  {#if step === 1}
    <!-- ① 认识：大字模 + 点读 + 口诀 + 例词 -->
    <div class="stepwrap">
      {#each letters as l (l.k)}
        <div class="recog">
          <button class="glyphbtn" data-say={l.k} onclick={() => say(l.k)}>
            <span class="glyph">{l.k}</span>
          </button>
          <div class="kj" data-kj={l.k}>{#if l.kjAudio}<button class="kjplay" onclick={() => playAudio(l.kjAudio!, { hint: '语音未准备好' })}><Icon name="play" size={16} /></button>{/if}<Ruby text={l.kj} /></div>
          {#if LETTERS[l.k]?.word}
            <div class="wrow">
              <span class="wem">{LETTERS[l.k].em}</span>
              <span class="word">{LETTERS[l.k].word} <span class="wp">{LETTERS[l.k].wp}</span></span>
            </div>
          {/if}
        </div>
      {/each}
      <button class="btn green gonext" data-gonext="2" onclick={() => goto(2)}><Ruby text="学会啦，看写法" /> <Icon name="arrow-right" size={20} /></button>
    </div>

  {:else if step === 2}
    <!-- ② 写法：笔顺动画 + 分笔旁白 -->
    <div class="stepwrap">
      <div class="lchips">
        {#each letters as l, i (l.k)}
          <button class="lchip" class:on={i === li} onclick={() => (li = i)}>{l.k}</button>
        {/each}
      </div>
      <div class="animbox">
        <StrokeAnim unit={letter.k} static={staticN} bind:this={sa} />
      </div>
      <div class="strokeinfo">
        <div class="say">{#each sayLines(letter.say) as seg, i (i)}{#if i > 0}<br />{/if}<Ruby text={seg} />{/each}</div>
        <div class="xie"><Ruby text={letter.xie} /></div>
        <div class="stroketags">
          {#each letter.strokes as sn, i (letter.k + i)}<span class="stag"><b>{i + 1}</b> <Ruby text={sn} /></span>{/each}
        </div>
      </div>
      <div class="xrow">
        <button class="btn blue small" onclick={() => { sa?.replay(); if (letter.sayAudio) playAudio(letter.sayAudio, { hint: '' }) }}>
          <Icon name="refresh" size={20} /> <Ruby text="再看一遍" />
        </button>
        <button class="navbtn" disabled={li === 0} onclick={() => (li = Math.max(0, li - 1))} aria-label="上一个">‹</button>
        <button class="navbtn" disabled={li >= letters.length - 1} onclick={() => (li = Math.min(letters.length - 1, li + 1))} aria-label="下一个">›</button>
      </div>
      <button class="btn green gonext" data-gonext="3" onclick={() => goto(3)}><Ruby text="会写了，练声调" /> <Icon name="arrow-right" size={20} /></button>
    </div>

  {:else if step === 3}
    <!-- ③ 声调 -->
    <div class="stepwrap">
      <ToneDrill rows={lesson.tones} />
      <button class="btn green gonext" data-gonext="4" onclick={() => goto(4)}><Ruby text="练好了，去拼读" /> <Icon name="arrow-right" size={20} /></button>
    </div>

  {:else if step === 4}
    <!-- ④ 拼读 / 整体认读 -->
    <div class="stepwrap">
      <BlendDrill blends={lesson.blends || []} ztlist={lesson.ztlist || []} note={lesson.note || ''} />
      <button class="btn green gonext" data-gonext="5" onclick={() => goto(5)}><Ruby text="拼完了，去小测" /> <Icon name="arrow-right" size={20} /></button>
    </div>

  {:else if !quiz.done}
    <!-- ⑤ 小测 -->
    <div class="stepwrap quizwrap">
      {#if quiz.q[quiz.i]}
        {@const q = quiz.q[quiz.i]}
        <div class="qmeta"><Ruby text="第{cn(quiz.i + 1)}题" /> · <Ruby text={q.type === 'listen' ? '听一听，选出来' : '看一看，它怎么读'} /></div>
        <div class="qprog">{#each Array(5) as _, i (i)}<span class="qdot" class:ok={i < quiz.i}></span>{/each}</div>
        {#if q.type === 'listen'}
          <button class="qplay" onclick={() => playQuestionAudio(q)}><Icon name="play" size={44} /></button>
          <div class="qhint"><Ruby text="点我听一听" /></div>
        {:else}
          <div class="qglyph">{q.k}</div>
        {/if}
        <div class="opts">
          {#each q.opts as o (o)}
            <button
              class="opt" class:wide={q.type === 'look'}
              class:right={quiz.pick && o === q.k}
              class:wrong={quiz.pick === '✗' && o !== q.k && o === quiz.lastPick}
              onclick={() => { quiz.lastPick = o; answer(o) }}
            >
              {q.type === 'look' ? (LETTERS[o] as any)?.han || o : o}
            </button>
          {/each}
        </div>
      {/if}
    </div>

  {:else}
    <!-- 小测结算 -->
    <div class="stepwrap resultwrap">
      <div class="resEmoji">{#if quiz.passed}<Icon name="rainbow" size={54} /><Icon name="star" size={54} />{:else}<Icon name="sprout" size={54} /><Icon name="dumbbell" size={54} />{/if}</div>
      {#if quiz.passed}
        <div class="resScore"><Ruby text="对了{cn(quiz.score)}题，太棒了！" /></div>
        <div class="resStars">{#each Array(quiz.score >= 5 ? 3 : 2)}<Icon name="star" size={34} />{/each}</div>
        <div class="resMsg"><Ruby text={quiz.score >= 5 ? '全部答对，你是拼音小天才！' : '通过啦，下一课已经解锁！'} /></div>
        <button class="btn green" onclick={onexit}><Icon name="map" size={22} /> <Ruby text="回学习岛" /></button>
      {:else}
        <div class="resScore"><Ruby text="对了{cn(quiz.score)}题" /></div>
        <div class="resMsg"><Ruby text="差一点点！我们再学一遍，你一定可以的" /></div>
        <button class="btn teal" onclick={restudy}><Icon name="refresh" size={22} /> <Ruby text="再学一遍" /></button>
      {/if}
    </div>
  {/if}
</section>

<style>
  #v-lesson { gap: 12px; }
  .stepbar { display: flex; gap: 6px; }
  .stepdot { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 7px 2px;
    background: #fff; border: 2px solid #eee4d3; border-radius: 13px; color: #b7ab97;
    font-size: 13.5px; font-weight: 800; font-family: inherit; }
  .stepdot.on { border-color: #2A9D8F; background: #e6f7f2; color: #1f7a68; }
  .stepdot.passed { color: #1f7a68; border-color: #bfe8df; }
  .stepwrap { display: flex; flex-direction: column; gap: 12px; padding-bottom: 86px; }
  /* .view 是 min-height+overflow 布局（body 滚动），sticky 失效 → 用 fixed 底栏 */
  .stepwrap > .gonext {
    position: fixed; bottom: calc(env(safe-area-inset-bottom) + 10px); left: 50%;
    transform: translateX(-50%); width: min(calc(100vw - 36px), 396px); z-index: 5; min-height: 62px;
  }
  .quizwrap { justify-content: center; flex: 1; }
  .qprog { display: flex; gap: 8px; justify-content: center; }
  .qdot { width: 13px; height: 13px; border-radius: 50%; background: #eee4d3; }
  .qdot.ok { background: #2A9D8F; }
  .qhint { text-align: center; font-size: 19px; font-weight: 700; color: #2A9D8F; }

  /* 认识 */
  .recog { background: #fff; border: 2.5px solid #eee4d3; border-radius: 22px; padding: 14px;
    display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .glyphbtn { border: none; background: none; font-family: inherit; }
  .glyph { font-size: 96px; font-weight: 900; color: #264653; line-height: 1.25; }
  .glyph:active { color: #E76F51; }
  .kj { font-size: 22px; font-weight: 800; color: #E76F51; display: flex; align-items: center; gap: 8px; line-height: 1.9; }
  .kjplay { width: 40px; height: 40px; border-radius: 50%; border: none; background: #fdeee7; color: #E76F51;
    display: inline-flex; align-items: center; justify-content: center; }
  .wrow { display: flex; align-items: center; gap: 8px; font-size: 21px; font-weight: 800; color: #6f6353; }
  .wem { font-size: 30px; }
  .wp { font-size: 17px; color: #8a7a68; }

  /* 写法 */
  .lchips { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .lchip { min-width: 58px; min-height: 52px; border-radius: 15px; border: 2.5px solid #e3d9c8; background: #fff;
    font-size: 27px; font-weight: 900; color: #6f6353; font-family: inherit; }
  .lchip.on { border-color: #2A9D8F; background: #e6f7f2; color: #1f7a68; }
  .animbox { background: #fff; border-radius: 22px; border: 2.5px solid #eee4d3; padding: 12px 8px; }
  .say { font-size: 21px; font-weight: 800; color: #264653; line-height: 1.9; }
  .xie { font-size: 17px; font-weight: 700; color: #8a7a68; }
  .stroketags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
  .stag { background: #f4efe4; border-radius: 11px; padding: 4px 10px; font-size: 17px; font-weight: 700; color: #6f6353; }
  .stag b { color: #E76F51; }
  .xrow { display: flex; gap: 10px; align-items: stretch; }
  .xrow .btn { flex: 1; }
  .navbtn { width: 58px; border-radius: 16px; border: 2px solid #e3d9c8; background: #fff;
    font-size: 30px; font-weight: 900; color: #6f6353; font-family: inherit; }
  .navbtn:disabled { opacity: .35; }

  /* 小测 */
  .qmeta { text-align: center; font-size: 20px; font-weight: 800; color: #264653; line-height: 1.9; }
  .qplay { align-self: center; width: 118px; height: 118px; border-radius: 50%; border: none; background: #fff;
    box-shadow: 0 6px 0 #e3d9c8; color: #2A9D8F; display: flex; align-items: center; justify-content: center; margin: 8px 0; }
  .qplay:active { transform: translateY(3px); box-shadow: 0 2px 0 #e3d9c8; }
  .qglyph { text-align: center; font-size: 110px; font-weight: 900; color: #264653; line-height: 1.3; margin: 4px 0; }
  .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .opt { min-height: 84px; border-radius: 19px; border: 2.5px solid #eee4d3; background: #fff;
    font-size: 44px; font-weight: 900; color: #264653; font-family: inherit; }
  .opt.wide { font-size: 34px; min-height: 74px; color: #6f6353; }
  .opt.right { border-color: #2A9D8F; background: #e6f7f2; }
  .opt.wrong { border-color: #E76F51; background: #fdeee7; animation: shake .3s; }
  @keyframes shake { 25% { transform: translateX(-4px) } 75% { transform: translateX(4px) } }

  /* 结算 */
  .resultwrap { align-items: center; gap: 14px; padding: 26px 0; }
  .resEmoji { font-size: 62px; }
  .resScore { font-size: 27px; font-weight: 900; color: #264653; }
  .resStars { color: #E9C46A; display: flex; gap: 4px; }
  .resMsg { font-size: 21px; font-weight: 800; color: #2A9D8F; text-align: center; line-height: 1.9; }
</style>
