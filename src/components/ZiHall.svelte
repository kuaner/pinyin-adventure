<script lang="ts">
  /* 📖 识字表闯关（v4.2 练习馆，Bug#35 上半）：一年级字表看字选拼音，按学习进度分层解锁
     （ziGate：声母已学+韵母可由已学单元拼出才解锁——先解锁已学字母相关的字，绝不超纲）。
     网格=横滑分页（12 字/页，零纵向滚动铁律）：解锁字=可点开练，锁定字=灰卡带锁（点击温和提示）。
     点字开练=从该字起顺序刷（弱字 Z: 权重高的排前——字级错误账本加权）。
     看字题不播答案音（v4.1 已定边界：播了=报答案），🔊 点播照旧；答错只高亮正确拼音（零错误信息） */
  import { ZI } from '../data'
  import type { ZiItem } from '../lib/types'
  import { ziUnlocked, ziDrillOrder } from '../lib/ziGate'
  import { markResult } from '../stores/weights.svelte'
  import { show, toast } from '../stores/ui.svelte'
  import { playAudio, sndOk, sndNo } from '../lib/audio'
  import { makeZiQ } from '../lib/quizEngine'
  import { t } from '../text/strings'
  import Speak from './Speak.svelte'
  import Icon from './Icon.svelte'
  import HSteps from './HSteps.svelte'

  const unlockedSet = $derived.by(() => new Set(ziUnlocked().map((z) => z.h)))
  /* 解锁字排前（字表顺序），锁定字殿后；12 字/页横滑 */
  const ordered = $derived.by(() => {
    const yes: ZiItem[] = []
    const no: ZiItem[] = []
    for (const z of ZI) (unlockedSet.has(z.h) ? yes : no).push(z)
    return yes.concat(no)
  })
  const PAGES: number = Math.ceil(ZI.length / 12)
  const pages = $derived.by(() => {
    const out: ZiItem[][] = []
    for (let i = 0; i < PAGES; i++) out.push(ordered.slice(i * 12, i * 12 + 12))
    return out
  })
  let cur = $state(0)

  const unlockedCount = $derived(unlockedSet.size)

  /* ---- 练习态 ---- */
  let practicing = $state(false)
  let zitem = $state<ZiItem | null>(null)
  let q = $state<any>(null)
  let n = $state(0)
  let okN = $state(0)
  let streak = $state(0)
  let best = $state(0)
  let reveal = $state<{ correct: number; wrong: number[] } | null>(null)
  let order: ZiItem[] = []
  let oi = 0
  let tid: ReturnType<typeof setTimeout> | null = null
  let alive = true

  function startAt(z: ZiItem) {
    if (!unlockedSet.has(z.h)) { toast(t('ziLockedToast')); return }
    order = ziDrillOrder(ziUnlocked())
    const i = order.indexOf(z)
    if (i > 0) order = order.slice(i).concat(order.slice(0, i))
    oi = 0
    n = 0; okN = 0; streak = 0; best = 0
    practicing = true
    nextQ()
  }

  function nextQ() {
    zitem = order[oi % order.length]
    q = makeZiQ(zitem!, false)
    reveal = null
  }

  function answer(idx: number) {
    if (reveal || !q) return
    const good = idx === q.ans
    reveal = { correct: q.ans, wrong: good ? [] : [idx] }
    markResult(q.key, good)   /* 字级账本 Z: 权重——下次弱字先出 */
    n++
    if (good) {
      okN++
      streak++
      if (streak > best) best = streak
      sndOk()
    } else {
      streak = 0
      sndNo()
    }
    tid = setTimeout(() => { if (alive) { oi++; nextQ() } }, good ? 550 : 1400)
  }

  function stopPractice() {
    if (tid) { clearTimeout(tid); tid = null }
    practicing = false
    q = null
    reveal = null
  }

  $effect(() => {
    alive = true
    /* 验收钩子：?open= 场景下暴露当前题答案（与 __PJ.Q().q.ans 同惯例，正常使用零挂载） */
    const w = window as any
    if (w.__PJ) w.__PJ.ziQ = () => ({ ans: q?.ans, h: zitem?.h, opts: q?.opts })
    return () => {
      alive = false
      if (tid) { clearTimeout(tid); tid = null }
    }
  })
</script>

<section id="v-zihall" class="view on" data-screen="zihall" data-practicing={practicing ? '1' : '0'}>
  <div class="ltop">
    <button class="cbtn" data-back="zihallquit" onclick={() => (practicing ? stopPractice() : show('practice'))} aria-label="back">
      <Icon name="close" size={20} />
    </button>
    <div class="ltt"><Speak k="drillZi" /></div>
    <div class="lprog" data-ziProg><Speak k="ziHallProg" vars={{ a: unlockedCount, b: ZI.length }} /></div>
  </div>

  {#if !practicing}
    <div class="zhint"><Speak k="ziHallHint" /></div>
    {#if ZI.length - unlockedCount > 0}
      <div class="zlocked" data-lockedn><Icon name="lock" size={16} /> <Speak k="ziLockedN" vars={{ n: ZI.length - unlockedCount }} /></div>
    {/if}
    <div class="zwrap">
      <HSteps n={PAGES} bind:cur>
        {#each pages as pg, pi (pi)}
          <div class="hspage"><div class="zgrid" data-page={pi}>
            {#each pg as z (z.h)}
              <button class="zcell" class:locked={!unlockedSet.has(z.h)} data-zi={z.h} data-locked={unlockedSet.has(z.h) ? '0' : '1'}
                onclick={() => startAt(z)} aria-disabled={!unlockedSet.has(z.h)}>
                {#if unlockedSet.has(z.h)}
                  <span class="zh">{z.h}</span>
                {:else}
                  <span class="zh"><Icon name="lock" size={18} /></span>
                {/if}
              </button>
            {/each}
          </div></div>
        {/each}
      </HSteps>
    </div>
    <div class="zpager">
      {#each pages as _, i (i)}
        <i class:on={cur === i}></i>
      {/each}
    </div>
  {:else}
    <div class="phud">
      <span data-answered={n}><Speak k="hudAnswered" plain />{n}</span>
      <span><Speak k="hudAcc" plain />{n ? Math.round(okN * 100 / n) + '%' : '--'}</span>
      <span class="hspacer"></span>
      <span data-streak class:hot={streak >= 5}><Icon name="flame" size={18} /> {streak}</span>
    </div>
    {#if zitem}
      <div class="qcard" data-q data-zi={zitem.h} data-reveal={reveal ? '1' : '0'}>
        <div class="glyphbox">
          <div class="glyph">{zitem.h}</div>
          <button class="replaybtn" data-listen onclick={() => playAudio(zitem!.f)}><Icon name="headphones" size={30} /></button>
        </div>
        <div class="optgrid" data-opts>
          {#each q.opts as py, idx}
            <button class="opt" class:correct={reveal && idx === reveal.correct} class:wrong={reveal && reveal.wrong.includes(idx)}
              data-opt={py} onclick={() => answer(idx)}>
              <span class="og">{py}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</section>

<style>
  #v-zihall { padding: calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-2); }
  .ltop { display: flex; align-items: center; gap: var(--sp-2); height: 44px; flex: none; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
  .ltt { flex: 1; text-align: center; font-size: var(--fs-md); font-weight: 900; white-space: nowrap; }
  .lprog { font-size: var(--fs-xs); font-weight: 900; color: var(--animal-primary-active); background: var(--animal-primary-bg);
    padding: var(--sp-2) var(--sp-3); border-radius: 999px; white-space: nowrap; }
  .lprog :global(rt) { font-size: var(--fs-rt); }

  .zhint { flex: none; text-align: center; font-size: var(--fs-xs); font-weight: 700; color: var(--animal-text-2);
    margin-top: var(--sp-1); line-height: 1.7; white-space: nowrap; }
  .zhint :global(rt) { font-size: var(--fs-rt); }
  .zlocked { flex: none; display: flex; align-items: center; justify-content: center; gap: var(--sp-1);
    font-size: var(--fs-xs); font-weight: 800; color: #a89e8d; line-height: 1.7; white-space: nowrap; }
  .zlocked :global(rt) { font-size: var(--fs-rt); }

  .zwrap { flex: 1 1 0; min-height: 0; margin-top: var(--sp-2); }
  .zgrid { height: 100%; display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(3, 1fr);
    gap: var(--sp-2); }
  .zcell { border: 2px solid var(--animal-border-light); border-radius: var(--animal-r-lg); background: #fff;
    box-shadow: var(--animal-shadow-sm); cursor: pointer; font-family: inherit; display: flex; align-items: center;
    justify-content: center; min-height: 0; min-width: 0; padding: 2px; }
  .zcell:active { transform: translateY(2px); box-shadow: none; }
  .zcell .zh { font-size: var(--fs-xl); font-weight: 900; color: var(--animal-text); line-height: 1.3; }
  .zcell.locked { background: #f4f1ea; box-shadow: none; cursor: default; border-style: dashed; }
  .zcell.locked .zh { color: #c9bca6; }

  .zpager { flex: none; height: 26px; display: flex; align-items: center; justify-content: center; gap: var(--sp-1); flex-wrap: wrap; }
  .zpager i { width: 6px; height: 6px; border-radius: 50%; background: var(--animal-text-dis); }
  .zpager i.on { width: 18px; background: var(--animal-primary); }

  /* ---- 练习态 ---- */
  .phud { flex: none; display: flex; align-items: center; gap: var(--sp-3); margin-top: var(--sp-1);
    background: #fff; border-radius: 999px; padding: 6px var(--sp-3); box-shadow: var(--animal-shadow-sm);
    font-size: var(--fs-sm); font-weight: 900; color: var(--animal-text-2); white-space: nowrap; }
  .phud :global(rt) { font-size: var(--fs-rt); }
  .hspacer { flex: 1; }
  [data-streak] { display: inline-flex; align-items: center; gap: 3px; }
  [data-streak].hot { color: #e76f51; }

  .qcard { flex: 1 1 0; min-height: 0; margin-top: var(--sp-2); display: flex; flex-direction: column; gap: var(--sp-2); }
  .glyphbox { flex: 1 1 0; min-height: 0; position: relative; display: flex; align-items: center; justify-content: center;
    background: #fff; border-radius: var(--animal-r-lg); box-shadow: var(--animal-shadow); padding: var(--sp-2) 0; }
  .glyph { font-size: clamp(84px, 26vw, var(--fs-hero)); font-weight: 900; color: var(--animal-text); line-height: 1.25; }
  .replaybtn { position: absolute; right: var(--sp-3); top: 50%; transform: translateY(-50%); width: 48px; height: 48px;
    border-radius: 50%; border: 2px solid var(--animal-border-light); background: var(--animal-primary-bg);
    display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .optgrid { flex: none; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 104px; gap: var(--sp-2); }
  .opt { border: 3px solid var(--animal-border-light); border-radius: var(--animal-r-lg); background: #fff;
    box-shadow: var(--animal-shadow-sm); cursor: pointer; font-family: inherit; display: flex; align-items: center;
    justify-content: center; min-height: 104px; padding: var(--sp-1); }
  .opt:active { transform: translateY(2px); box-shadow: none; }
  .opt .og { font-size: var(--fs-xl); font-weight: 900; color: var(--animal-text); line-height: 1.4; }
  .opt.correct { border-color: var(--animal-success); background: #e8f5e8; }
  .opt.wrong { border-color: var(--animal-error); background: #fdeeee; animation: zshake .4s; }
  @keyframes zshake { 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }

  @media (prefers-reduced-motion: reduce) {
    .opt.wrong { animation-duration: .01s; }
  }
</style>
