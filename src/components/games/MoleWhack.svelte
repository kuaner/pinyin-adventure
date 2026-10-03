<script lang="ts">
  /* 🔨 口诀打地鼠（v4.2 Bug#35 上半 → v4.5 Bug#39 谜面制）：认知路径=谜面→形——
     每轮自动播【谜面】音频（口诀剥离全部字母的形状描述，mimo 中文合成，零答案读音），
     播完 320ms 后地鼠举字母探头，猜谜打对的那只；点对后播【整句口诀原声】奖励（回忆→确认→强化）。
     v4.5 练习制：无 60s 计时（✕=结算答对数），点对才换题——错点=晃动提示+地鼠不走+可重听谜面，
     无超时强制推进。干扰共存立法（Bug#36）保持：目标鼠+镜像陷阱+≥2 干扰鼠同场。
     回合链 setTimeout 全部带会话代数守卫 */
  import { GS, askTarget, listenTarget, gameHit } from '../../stores/game.svelte'
  import { learnedLetters, pickGameTarget } from '../../lib/gameEngine'
  import { hasRiddle, riddleAudio, kjAudio, playAudio, audioDurMs } from '../../lib/audio'
  import { holdAnswer, releaseAnswer } from '../../lib/inputGuard'
  import Icon from '../Icon.svelte'
  import Speak from '../Speak.svelte'

  interface Mole { hole: number; k: string; up: boolean; hit: boolean; bad: boolean }
  let moles = $state<Mole[]>([])
  let roundTid: ReturnType<typeof setTimeout> | null = null
  const pool = learnedLetters().filter(hasRiddle)   /* 谜面制：只从有谜面的字母出题（组合式口诀跳过） */
  const playing = $derived(GS.phase === 'play')

  $effect(() => {
    if (!playing) return
    moles = []
    const e = GS.epoch
    roundTid = setTimeout(() => { if (GS.epoch === e) round() }, 500)
    return () => { if (roundTid) { clearTimeout(roundTid); roundTid = null } }
  })

  /* 一个回合（v4.7 P1-5 确定性起局）：谜面自动播 → 【谜面播完】→ 目标+陷阱+干扰鼠一起探头。
     此前探头挂在「开播后 320ms」——谜面 2-4s，孩子对着已探头的不认识的地鼠发呆，
     且两次观测序相反（地鼠先/谜面先均有）。onend 主路 + 3.6s 兜底（缺失/静音不卡局）。
     v4.2c 共存立法（Bug#36）保持：干扰鼠 ≥2 与目标同探。
     v4.7 P2-9 驻留上限：探头后 7s 未击=缩回+miss（清连击）→ 900ms 后新回合谜面重发 */
  function round() {
    if (GS.phase !== 'play') return
    const e = GS.epoch
    const target = pickGameTarget(pool, moles.length ? [GS.target] : [])
    moles = []   /* 换题清场：起局时序=谜面→探头，无一帧裸鼠场 */
    up_ = false
    const molesUp = () => {
      if (GS.epoch !== e || GS.phase !== 'play' || up_) return
      up_ = true
      releaseAnswer()   /* 谜面播完 → 作答门开 */
      for (const m of moles) m.up = true
      if (roundTid) clearTimeout(roundTid)
      roundTid = setTimeout(() => {
        if (GS.epoch !== e || GS.phase !== 'play' || !up_) return
        up_ = false
        for (const m of moles) m.up = false   /* P2-9：驻留 7s 上限，缩回 */
        gameHit(GS.target, false)             /* 超时未击=miss（清连击记错题） */
        roundTid = setTimeout(() => { if (GS.epoch === e && GS.phase === 'play') round() }, 900)
      }, 7000)
    }
    /* 干扰鼠：镜像陷阱必上，其余从池里随机补（有限次——gameDistractor 镜像优先会重复返回搭档，禁无限循环）；
       保底 2 只（池允许时）——目标永远与 ≥2 干扰同探，正确答案只能由"谜面↔字母"匹配得出 */
    const maxDecoys = Math.min(4, pool.length - 1)
    const want = Math.min(maxDecoys, 2 + Math.floor(Math.random() * 2))
    const decoys: string[] = []
    const mirror = { b: 'd', d: 'b', p: 'q', q: 'p' }[target]
    if (mirror && pool.includes(mirror)) decoys.push(mirror)
    const others = shuffle(pool.filter((x) => x !== target && !decoys.includes(x)))
    while (decoys.length < want && others.length) decoys.push(others.pop()!)
    const holes = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, decoys.length + 1)
    const next: Mole[] = [{ hole: holes[0], k: target, up: false, hit: false, bad: false }]
    decoys.forEach((k, i) => next.push({ hole: holes[i + 1], k, up: false, hit: false, bad: false }))
    moles = next
    askTarget(target, riddleAudio(target), molesUp)   /* 谜面先行；播完探头（P1-5 确定性） */
    /* v4.8.1 时长感知兜底：ended 只做加速（audio.ts 看门狗=时长+400ms 主兜底），
       这里是第二道保险——谜面真时长+600ms，未知时长才用旧 3.6s 死值（iOS ended
       丢失时探头不再迟到 3.6s：谜面 1.2-1.9s → 兜底 ≈1.8-2.5s） */
    const rd = audioDurMs(riddleAudio(target))
    const gate = rd ? rd + 600 : 3600
    holdAnswer(gate)   /* P1-2 谜面门（兜底=探头上限） */
    if (roundTid) clearTimeout(roundTid)
    roundTid = setTimeout(molesUp, gate)
  }

  /* P2-9 驻留计时重置：错点/🔊重听=孩子仍在参与，重算 7s（驻留上限罚的是无操作，不是参与） */
  function bumpDwell() {
    if (!up_) return
    const e = GS.epoch
    if (roundTid) clearTimeout(roundTid)
    roundTid = setTimeout(() => {
      if (GS.epoch !== e || GS.phase !== 'play' || !up_) return
      up_ = false
      for (const m of moles) m.up = false
      gameHit(GS.target, false)
      roundTid = setTimeout(() => { if (GS.epoch === e && GS.phase === 'play') round() }, 900)
    }, 7000)
  }
  let up_ = false

  function whack(m: Mole) {
    if (!playing || !m.up || m.hit) return
    if (m.k === GS.target) {
      m.hit = true
      gameHit(GS.target, true)
      if (roundTid) { clearTimeout(roundTid); roundTid = null }
      const e = GS.epoch
      for (const x of moles) x.up = false
      /* 点对奖励：整句口诀原声（"右下半圆 b b b"——回忆→确认→强化闭环）；
         播完换下一题（onend 主路 + 时长感知兜底）。v4.8.1：旧 3.5s 死值比整句口诀
         （实测 ~5s）还短——正常设备上也截断奖励；改真时长+600ms，ended 丢失时
         看门狗（时长+400ms）先放行，两道保险都不截断不悬挂 */
      let advanced = false
      const advance = () => { if (!advanced && GS.epoch === e && GS.phase === 'play') { advanced = true; round() } }
      playAudio(kjAudio(GS.target), { onend: advance })
      const kd = audioDurMs(kjAudio(GS.target))
      roundTid = setTimeout(advance, kd ? kd + 600 : 3500)
    } else {
      /* 错点：晃动提示+地鼠不走+可再敲（点对才换题）；清连击记错题照旧 */
      m.bad = true
      gameHit(m.k, false)
      bumpDwell()   /* 参与即重置驻留（罚无操作不罚尝试） */
      const me = m
      setTimeout(() => { me.bad = false }, 500)
    }
  }

  function shuffle<T>(a: T[]): T[] {
    const r = a.slice()
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = r[i]; r[i] = r[j]; r[j] = t
    }
    return r
  }
</script>

<div class="fill" id="v-mole">
  <div class="prompt" data-prompt data-riddle={GS.kj ? '1' : '0'} data-target={GS.target}>
    <button class="bigsound small" class:live={GS.listened} data-listen onclick={() => { listenTarget(); bumpDwell() }}>
      <Icon name="headphones" size={34} />
    </button>
    {#if GS.kj}<span class="kjchip" data-riddlechip><Icon name="music" size={16} /><Speak k="riddleTag" plain /></span>{/if}
    <div class="ptip"><Speak k="listenThenAct" plain={GS.listened} /></div>
  </div>
  <div class="lawn">
    {#each Array(9) as _, h (h)}
      <div class="hole" data-hole={h}>
        <div class="dirt"></div>
        {#if moles.find((m) => m.hole === h)}
          {@const m = moles.find((m) => m.hole === h)!}
          <button
            class="mole"
            class:up={m.up}
            class:hit={m.hit}
            class:bad={m.bad}
            data-letter={m.k}
            onpointerdown={() => whack(m)}
            aria-label="mole"
          >
            <svg viewBox="0 0 72 64">
              <path d="M14 62 C 14 34 20 22 36 22 C 52 22 58 34 58 62 Z" fill="#a97c50" />
              <path d="M20 62 C 20 40 25 30 36 30 C 47 30 52 40 52 62 Z" fill="#c99b6a" />
              <path d="M12 24 C 12 16 22 16 22 24 L22 34 L12 34 Z" fill="#c99b6a" />
              <path d="M60 24 C 60 16 50 16 50 24 L50 34 L60 34 Z" fill="#c99b6a" />
              <circle cx="28" cy="44" r="3" fill="#3d3428" />
              <circle cx="44" cy="44" r="3" fill="#3d3428" />
              <ellipse cx="36" cy="53" rx="4.5" ry="3.4" fill="#e77" />
              <path d="M31 49 Q 36 51 41 49" stroke="#3d3428" stroke-width="1.6" fill="none" />
            </svg>
            <span class="mk">{m.k}</span>
          </button>
        {/if}
        <div class="bush"></div>
      </div>
    {/each}
  </div>
</div>

<style>
  .fill { position: absolute; inset: 0; display: flex; flex-direction: column; touch-action: none;
    background: linear-gradient(180deg, #f0fbf0, #dff3d9); }
  .prompt { flex: none; display: flex; align-items: center; justify-content: center; gap: var(--sp-3);
    padding: var(--sp-2) 0 0; min-height: 64px; }
  .ptip { font-size: var(--fs-xs); font-weight: 700; color: var(--animal-text-2); white-space: nowrap; }
  .kjchip { display: inline-flex; align-items: center; gap: 3px; font-size: var(--fs-xs); font-weight: 900;
    color: #b07a1f; background: #fff3d6; border: 2px solid #ffd98e; border-radius: 999px;
    padding: 2px 10px; white-space: nowrap; }
  .kjchip :global(rt) { font-size: var(--fs-rt); }
  .bigsound.live { border-color: #7fc8a9; background: #eaf9f0; }
  .lawn { flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr 1fr;
    gap: var(--sp-1); padding: var(--sp-2) var(--sp-2) var(--sp-3); }
  .hole { position: relative; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; }
  .dirt { position: absolute; bottom: 6%; width: 82%; height: 26%; border-radius: 50%; background: #8b5e3c;
    box-shadow: inset 0 -5px 0 rgba(61, 52, 40, .22); }
  .bush { position: absolute; bottom: 20%; width: 96%; height: 14%; border-radius: 50%; background: rgba(111, 186, 44, .35); }
  .mole { position: absolute; bottom: 16%; width: 68%; max-width: 96px; border: none; background: none; padding: 0;
    transform: translateY(105%); transition: transform .22s cubic-bezier(.3, 1.2, .4, 1); cursor: pointer;
    -webkit-tap-highlight-color: transparent; }
  .mole.up { transform: translateY(6%); }
  .mole svg { width: 100%; display: block; filter: drop-shadow(0 2px 1px rgba(61, 52, 40, .18)); }
  .mole .mk { position: absolute; left: 0; right: 0; top: 22%; text-align: center; font-size: 26px; font-weight: 900;
    color: #fff; text-shadow: 0 2px 0 rgba(61, 52, 40, .3); line-height: 1.2; }
  .mole.hit { animation: mbonk .38s ease-out forwards; }
  @keyframes mbonk { 40% { transform: translateY(6%) scale(1.08, .82); } 100% { transform: translateY(105%); } }
  .mole.bad { animation: mshake .4s; filter: grayscale(.6); }

  @media (prefers-reduced-motion: reduce) {
    .mole { transition-duration: .01s; }
    .mole.hit, .mole.bad { animation-duration: .01s; }
  }
</style>
