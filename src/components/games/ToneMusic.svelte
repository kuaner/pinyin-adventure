<script lang="ts">
  /* 🎵 声调音乐会（v4.3 游戏岛第 6 摊位，声调·节奏式）：
     音符带声调音节从 3 条轨道落下，轨道底部各有接音符的小鸡篮子。
     开局自动播一个带调音节（如 má，hyp 四声真人库），带对应声调的音符落下——
     点/接住它 = 得分+连击；接错/目标音漏掉 = 清连击换新目标。
     干扰音符 = 同音节其他声调（同字母四声辨析）；落速自适应：连对加速/连错减速。
     声音先行制（v4.1）：目标音自动播 → 音符挂声音开播 300ms 闸门后落下；🔊=重听。
     rAF/timeout 链 unmount 全清。 */
  import { untrack } from 'svelte'
  import { GS, askTarget, listenTarget, gameHit } from '../../stores/game.svelte'
  import { learnedToneRows, pickWeighted, itemWeight, type ToneRow } from '../../lib/gameEngine'
  import { TONE_MARKS, TONE_COLORS } from '../../lib/toneMarks'
  import Icon from '../Icon.svelte'
  import Speak from '../Speak.svelte'

  interface Note { id: number; t: number; display: string; file: string; lane: number; y: number; state: '' | 'caught' | 'wrong' }
  const LANES = 3
  const GATE = 320                 /* 声音先行闸门 */
  const FALL0 = 0.085              /* 初始落速（舞台高度比例/秒） */
  const FALL_MIN = 0.055
  const FALL_MAX = 0.15
  const rows = learnedToneRows()
  const flat = rows.flatMap((r) => r.tones.map((x) => ({ row: r, t: x })))

  let notes = $state<Note[]>([])
  let target = $state<{ row: ToneRow; t: { t: number; display: string; file: string } } | null>(null)
  let ready = $state(false)
  /* 当前目标音节的可视小卡（🔊 旁）——孩子听到后可对照；指令语由 GameShell ghint 承担 */
  let fall = $state(FALL0)
  let uid = 0
  let raf = 0
  let last = 0
  let spawnAt = 0
  let tid: ReturnType<typeof setTimeout> | null = null
  let alive = true

  const playing = $derived(GS.phase === 'play')

  $effect(() => {
    /* 依赖仅 phase+epoch；账本/notes 读取 untrack（答题写账本不得重置舞台） */
    alive = true
    if (!playing) return
    const e = GS.epoch
    untrack(() => {
      notes = []
      fall = FALL0
      newRound()
      const t0 = performance.now()
      last = t0
      spawnAt = t0 + GATE
    })
    raf = requestAnimationFrame(tick)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      if (tid) { clearTimeout(tid); tid = null }
    }
  })

  function newRound() {
    const pick = pickWeighted(flat, (x) => itemWeight(x.t.file), Math.random)
    target = pick
    ready = false
    notes = []                              /* 换目标清场 */
    askTarget(pick.t.file, pick.t.file)     /* 自动播四声真人音（hyp） */
    spawnAt = performance.now() + GATE + 500   /* 闸门期 tick 不得抢跑生成音符 */
    if (tid) clearTimeout(tid)
    tid = setTimeout(() => {
      if (!alive || GS.phase !== 'play') return
      ready = true
      /* v4.2c 共存立法（Bug#36）：目标符与 ≥2 干扰符同发（3 轨齐落：1 目标+2 同音节异调）——
         目标出现时刻干扰已在同屏，正确答案只能由"听到的调↔符上调号"匹配得出 */
      spawnTargetNote()
      spawnDistractor()
      spawnDistractor()
    }, GATE)
  }

  /* 空轨道：一轨道同时只挂一个活音符——同 lane 两符下落同速会重叠，
     后画的盖住先画的（验收实锤：点目标命中盖在上面的干扰符），且孩子读不清 */
  function freeLanes(): number[] {
    const busy = new Set(notes.filter((n) => !n.state).map((n) => n.lane))
    const out: number[] = []
    for (let i = 0; i < LANES; i++) if (!busy.has(i)) out.push(i)
    return out
  }

  function spawnTargetNote() {
    if (!target) return
    const free = freeLanes()
    if (!free.length) return
    const lane = free[Math.floor(Math.random() * free.length)]
    notes = [...notes, { id: ++uid, t: target.t.t, display: target.t.display, file: target.t.file, lane, y: -0.12, state: '' }]
  }

  /* 干扰音符=同音节其他声调（都是正确形态——零错误信息铁律） */
  function spawnDistractor() {
    if (!target) return
    const free = freeLanes()
    if (!free.length) return
    const others = target.row.tones.filter((x) => x.t !== target!.t.t)
    const d = others[Math.floor(Math.random() * others.length)]
    if (!d) return
    const lane = free[Math.floor(Math.random() * free.length)]
    notes = [...notes, { id: ++uid, t: d.t, display: d.display, file: d.file, lane, y: -0.12, state: '' }]
  }

  function tick(now: number) {
    if (GS.phase !== 'play') return
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const gone: number[] = []
    let missedTarget = false
    for (const n of notes) {
      if (n.state) continue
      n.y += fall * dt                        /* 从上落下：y 自顶（-0.12）向底（1.14）增 */
      if (n.y > 1.14) {
        gone.push(n.id)
        if (target && n.t === target.t.t && n.file === target.t.file) missedTarget = true
      }
    }
    if (gone.length) notes = notes.filter((n) => !gone.includes(n.id))
    if (missedTarget) {
      /* 目标音漏掉 = miss（清连击记错账）→ 换新目标自动播新音，绝不静默推进 */
      if (target) gameHit(target.t.file, false, 'item')
      fall = Math.max(FALL_MIN, fall - 0.015)           /* 连错减速 */
      newRound()
    } else {
      if (now >= spawnAt) {
        spawnAt = now + Math.max(900, 1600 - Math.min(GS.combo, 6) * 110)
        const targetOn = target && notes.some((n) => !n.state && n.file === target.t.file)
        if (!targetOn) spawnTargetNote()
        else if (notes.filter((n) => !n.state).length < 4 && Math.random() < 0.6) spawnDistractor()
      }
    }
    raf = requestAnimationFrame(tick)
  }

  function catchNote(n: Note) {
    if (!playing || !target || n.state) return
    if (n.file === target.t.file) {
      n.state = 'caught'
      gameHit(n.file, true, 'item')
      fall = Math.min(FALL_MAX, fall + 0.006)           /* 连对加速 */
      if (tid) clearTimeout(tid)
      tid = setTimeout(() => { if (alive && GS.phase === 'play') newRound() }, 620)   /* 接对 → 换新目标自动播新音 */
    } else {
      n.state = 'wrong'
      gameHit(n.file, false, 'item')
      fall = Math.max(FALL_MIN, fall - 0.012)           /* 连错减速 */
      setTimeout(() => { if (alive) notes = notes.filter((x) => x.id !== n.id) }, 620)
    }
  }
</script>

<div class="fill" id="v-tone">
  <div class="prompt" data-prompt data-target={GS.target}>
    <button class="bigsound small" class:live={GS.listened} data-listen onclick={listenTarget}>
      <Icon name="headphones" size={34} />
    </button>
    <div class="tchip" data-tchip>{target ? target.t.display : ''}</div>
  </div>

  <div class="hall">
    <!-- 3 条轨道 + 底部小鸡篮子 -->
    {#each Array(LANES) as _, li (li)}
      <div class="lane" data-lane={li}>
        <div class="linebar" aria-hidden="true"></div>
        {#each notes.filter((n) => n.lane === li) as n (n.id)}
          <button class="tnote" class:caught={n.state === 'caught'} class:wrong={n.state === 'wrong'}
            style="top:{n.y * 100}%; --tc:{TONE_COLORS[n.t - 1]}"
            data-note data-tone={n.t} data-file={n.file}
            onpointerdown={() => catchNote(n)} aria-label="note">
            <svg viewBox="0 0 40 34" class="nmark" aria-hidden="true">
              <path d={TONE_MARKS[n.t - 1].d} transform="translate(-4 0) scale(0.8)" stroke="#fff" stroke-width="7"
                stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".95" />
            </svg>
            <span class="nsyl">{n.display}</span>
          </button>
        {/each}
        <div class="basket" data-basket={li} aria-hidden="true">
          <svg viewBox="0 0 56 34">
            <path d="M8 12 L48 12 L43 30 C 42 32 40 33 38 33 L18 33 C 16 33 14 32 13 30 Z" fill="#e8c98f" stroke="#c9a24b" stroke-width="2" />
            <path d="M14 12 L42 12" stroke="#c9a24b" stroke-width="2.4" />
            <circle cx="28" cy="9" r="7.5" fill="#ffd94d" stroke="#e9b64f" stroke-width="1.6" />
            <circle cx="25.5" cy="7.5" r="1.3" fill="#3d3428" />
            <circle cx="30.5" cy="7.5" r="1.3" fill="#3d3428" />
            <path d="M26.5 10.5 L29.5 10.5 L28 12.5 Z" fill="#f0a35c" />
          </svg>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .fill { position: absolute; inset: 0; display: flex; flex-direction: column; touch-action: none; }
  .prompt { flex: none; display: flex; align-items: center; justify-content: center; gap: var(--sp-3);
    padding: var(--sp-1) 0 0; min-height: 56px; }
  /* 落下式玩法要跑道纵深：🔊 本地压缩（≥48px 铁律）——全局 .bigsound 168×138 会把 prompt 撑到 ~146px，
     压掉音符入场段（验收实锤：入场段被 .hall 裁剪不可见、点击被 prompt 行拦截） */
  .prompt :global(.bigsound) { width: 64px; height: 56px; min-height: 0; min-width: 0; padding: 0;
    flex-direction: row; justify-content: center; }
  .bigsound.live { border-color: #7fc8a9; background: #eaf9f0; }
  .tchip { min-width: 64px; height: 44px; border-radius: 12px; background: #fff; border: 2.5px solid #cfe0f5;
    box-shadow: 0 2px 0 rgba(61, 52, 40, .08); display: flex; align-items: center; justify-content: center;
    font-size: 24px; font-weight: 900; color: var(--animal-text); padding: 0 var(--sp-2); }

  .hall { position: relative; flex: 1 1 0; min-height: 0; display: flex;
    background: linear-gradient(180deg, #f2f9ff, #fdf7ea 78%); overflow: hidden; }
  .lane { position: relative; flex: 1 1 0; min-width: 0; }
  .lane + .lane { border-left: 2px dashed #e3dcc8; }
  .linebar { position: absolute; inset: 0; pointer-events: none; }

  .tnote { position: absolute; left: 50%; width: 58px; height: 58px; margin-left: -29px; padding: 0;
    border: none; border-radius: 50%; background: var(--tc); cursor: pointer; -webkit-tap-highlight-color: transparent;
    box-shadow: 0 3px 0 rgba(61, 52, 40, .16), inset 0 2px 0 rgba(255, 255, 255, .35);
    display: flex; flex-direction: column; align-items: center; justify-content: center; transform: translateY(-50%); }
  .nmark { width: 30px; height: 12px; }
  .nsyl { font-size: 15px; font-weight: 900; color: #fff; line-height: 1.1; text-shadow: 0 1px 0 rgba(61, 52, 40, .2); }
  .tnote.caught { animation: ncatch .38s ease-in forwards; pointer-events: none; }
  @keyframes ncatch { 100% { transform: translateY(-50%) scale(.35); opacity: 0; } }
  .tnote.wrong { animation: nshake .6s ease forwards; pointer-events: none; }
  @keyframes nshake { 25% { transform: translateY(-50%) translateX(-5px); filter: grayscale(.7); }
    60% { transform: translateY(-50%) translateX(5px); filter: grayscale(.7); }
    100% { transform: translateY(-50%) scale(.8); opacity: .35; filter: grayscale(.9); } }

  .basket { position: absolute; left: 50%; bottom: 2px; width: 56px; height: 34px; margin-left: -28px;
    pointer-events: none; }

  @media (prefers-reduced-motion: reduce) {
    .tnote.caught, .tnote.wrong { animation-duration: .01s; }
  }
</style>
