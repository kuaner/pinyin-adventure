<script lang="ts">
  /* 🎧 口诀小广播（v2.4 学习 tab 子模块，kuaner 2026-09-30 07:45）：全部课本口诀
     逐条点播 + 连播 + 循环；音频 = audio/lessons/kj_*.mp3 真人拼接版。
     声音礼仪 R5：连播是全 app 唯一例外声源 —— 显式手动开启，开启后即当前唯一一路。
     交互 = 横向翻页（一屏一口诀，主角 = 字模），零纵向滚动 */
  import lessonsData from '../data/lessons.json'
  import { playAudio, stopAll } from '../lib/audio'
  import { show } from '../stores/ui.svelte'
  import { T } from '../lib/ruby'
import { t, tRaw } from '../text/strings'
  import Speak from './Speak.svelte'
  import Icon from './Icon.svelte'
  import HSteps from './HSteps.svelte'
  import PinyinCard from './PinyinCard.svelte'

  interface KJEntry { k: string; kj: string; audio: string }
  /* v2.4.1 修列表空白（BUGS#7）：数据提取包兜底——任何异常转空数组，由空态兜底呈现，
     不再整片空白无提示（真机历史 bug 的防御性收口） */
  const ALL: KJEntry[] = (() => {
    try {
      return ((lessonsData as any).lessons as any[])
        .flatMap((l) => l.letters as any[])
        .filter((e) => e.kjAudio || e.kj)
        .map((e) => ({ k: e.k, kj: e.kj, audio: e.kjAudio || ('lessons/kj_' + (e.k === 'ü' ? 'v' : e.k)) }))
    } catch { return [] }
  })()

  let cur = $state(0)
  let chainOn = $state(false)
  let loopOn = $state(false)
  let playingK = $state('')       // 正在播的字母（按钮动画态）
  let capsEl: HTMLDivElement

  const entry = $derived(ALL[cur])

  function play(i: number) {
    const e = ALL[i]
    if (!e) { chainOn = false; return }
    cur = i
    playingK = e.k
    playAudio(e.audio, {
      hint: tRaw('notReady'),
      onend: () => {
        playingK = ''
        if (chainOn) {
          if (i + 1 < ALL.length) play(i + 1)
          else if (loopOn) play(0)
          else chainOn = false
        }
      },
    })
  }

  function toggleChain() {
    if (chainOn) { chainOn = false; stopAll(); playingK = '' }
    else { loopOn = false; chainOn = true; play(cur) }
  }
  function toggleLoop() {
    loopOn = !loopOn
    if (loopOn && !chainOn) { chainOn = true; play(cur) }
  }
  function jump(i: number) { play(i) }                 // 点播该条
  function onSwipe(i: number) {
    /* 滑动浏览 = 静默换页（R1 翻页零音效）；连播中翻页则接播新条 */
    cur = i
    if (chainOn) play(i)
  }

  function exit() { chainOn = false; loopOn = false; stopAll(); playingK = ''; show('learn') }
  const tipText = (on: boolean) => (on ? tRaw('listenKjSeeStroke') : tRaw('tapHearThis'))

  $effect(() => {
    requestAnimationFrame(() => capsEl?.querySelector('.cap.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }))
  })
</script>

<section id="v-radio" class="view on" data-screen="radio">
  <div class="ltop">
    <button class="cbtn" data-back="learn" onclick={exit} aria-label="back"><svg viewBox="0 0 24 24" fill="none" stroke="#794f27" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5L7.5 12l7 7" /></svg></button>
    <div class="ltt"><Speak k="radioTitle" /></div>
    <div class="lprog">{cur + 1}/{ALL.length}</div>
  </div>

  {#if ALL.length === 0}
    <!-- 空态兜底（BUGS#7）：数据缺失时给出可见引导，不再无声空白 -->
    <div class="kempty">
      <div class="kempty-ic"><svg viewBox="0 0 24 24" fill="none" stroke="#dba90e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13a8 8 0 0116 0" /><rect x="3" y="13" width="4" height="7" rx="2" fill="#dba90e" stroke="none" /><rect x="17" y="13" width="4" height="7" rx="2" fill="#dba90e" stroke="none" /></svg></div>
      <div class="kempty-tx"><Speak k="radioEmpty" /></div>
      <button class="kempty-btn" onclick={exit}><Speak k="backIsland" plain /></button>
    </div>
  {:else}
  <HSteps n={ALL.length} bind:cur onchange={onSwipe}>
    {#each ALL as e, i (e.k + i)}
      <div class="hspage">
        <div class="pcard">
          <div class="ptag"><Speak k="entryN" vars={{ n: i + 1 }} plain /></div>
          <!-- v2.5 口诀×笔顺联动：展开区 = PinyinCard full，点播/连播中笔顺动画随口诀音频同步跑（R5 唯一例外声源） -->
          <div class="radfit">
            <PinyinCard
              mode="full"
              k={e.k}
              glyphMax={118}
              strokePlay={playingK === e.k}
              strokeLoop={true}
              onmain={() => play(i)}
              /* BUGS#22②：空闲态去 tip（与 v2.9.1 认识页同判例——常驻 tip 占 35px 曾把字模/笔顺
                 预览挤到塌陷）；播放中保留"听口诀，看笔顺"提示（解释笔顺联动，有真实信息量） */
              tip={playingK === e.k ? T(tipText(true)) : ''}
            />
          </div>
        </div>
      </div>
    {/each}
  </HSteps>

  <div id="rctrl">
    <button class="rbtn main" class:live={chainOn} id="chainbtn" onclick={toggleChain}>
      {#if chainOn}
        <svg viewBox="0 0 24 24" fill="#fff"><rect x="6" y="5" width="4" height="14" rx="1.5" /><rect x="14" y="5" width="4" height="14" rx="1.5" /></svg>
        <span><Speak k="stopChain" plain /></span>
      {:else}
        <svg viewBox="0 0 24 24" fill="#fff"><path d="M8 5.5v13l11-6.5z" /></svg>
        <span><Speak k="chain" plain /></span>
      {/if}
    </button>
    <button class="rbtn" class:live2={loopOn} id="loopbtn" onclick={toggleLoop}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-2.6-6.4" /><path d="M21 4v5h-5" /></svg>
      <span><Speak k="loop" plain /></span>
    </button>
  </div>

  <div id="rlistbar">
    <div class="sec-label"><b><Speak k="kjList" plain /> · <Speak k="groupCount" vars={{ n: ALL.length }} plain /></b><span><Speak k="swipeHintH" /></span></div>
    <div id="rcaps" bind:this={capsEl}>
      {#each ALL as e, i (e.k + i)}
        <button class="cap" class:on={i === cur} data-idx={i} onclick={() => jump(i)}>{e.k}</button>
      {/each}
    </div>
  </div>

  <div id="pager">
    <div id="swipehint"><svg viewBox="0 0 24 24" fill="none" stroke="#9f927d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6" /></svg><Speak k="swipeNextKj" /></div>
  </div>
  {/if}
</section>

<style>
  #v-radio { padding: calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-2); gap: 0; }
  /* BUGS#22② 配套：卡外四处密度回收（ltop/rctrl/rlistbar/pager 共 +26px 给卡内字模与笔顺预览） */
  .ltop { display: flex; align-items: center; gap: var(--sp-2); height: 40px; flex: none; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
  .cbtn svg { width: 18px; height: 18px; }
  .ltt { flex: 1; text-align: center; font-size:var(--fs-md); font-weight: 900; line-height: 1.8; }
  .lprog { font-size:var(--fs-xs); font-weight: 900; color: var(--animal-primary-active); background: var(--animal-primary-bg);
    padding: var(--sp-2) var(--sp-3); border-radius: 999px; }

  .pcard { flex: 1; min-height: 0; background: #fff; border-radius: var(--animal-r-lg); box-shadow: var(--animal-shadow-lg);
    display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--sp-4) var(--sp-4) var(--sp-4); overflow: hidden; position: relative; }
  .pcard .ptag { position: absolute; top: 12px; left: 14px; font-size:var(--fs-xs); font-weight: 900; color: var(--animal-text-dis);
    background: #f4f0e4; padding: var(--sp-1) var(--sp-2); border-radius: 999px; z-index: 2; }
  .radfit { flex: 1; min-height: 0; width: 100%; display: flex; flex-direction: column; padding-top: var(--sp-4); }

  #rctrl { display: flex; gap: var(--sp-2); margin: var(--sp-2) 0 0; flex: none; }
  .rbtn { flex: 1; height: 54px; border-radius: 999px; border: none; font-family: inherit; font-size:var(--fs-md); font-weight: 900;
    display: flex; align-items: center; justify-content: center; gap: var(--sp-2); cursor: pointer;
    background: #fff; color: var(--animal-text-2); box-shadow: 0 3px 0 var(--animal-border-light), var(--animal-shadow); }
  .rbtn svg { width: 19px; height: 19px; }
  .rbtn.main { background: var(--animal-primary); color: #fff; box-shadow: 0 4px 0 var(--press-teal), var(--animal-shadow-lg); }
  .rbtn.main.live { background: #f29cb6; box-shadow: 0 4px 0 var(--press-pink), var(--animal-shadow-lg); }
  .rbtn.live2 { color: var(--animal-primary-active); background: var(--animal-primary-bg); }

  #rlistbar { margin-top: var(--sp-2); flex: none; }
  .sec-label { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); margin-bottom: var(--sp-2); }
  .sec-label b { font-size:var(--fs-xs); font-weight: 900; white-space: nowrap; }
  .sec-label span { font-size:var(--fs-xs); font-weight: 700; color: var(--animal-text-dis); white-space: nowrap; }
  #rcaps { display: flex; gap: var(--sp-2); overflow-x: auto; padding-bottom: var(--sp-1); scrollbar-width: none; }
  #rcaps::-webkit-scrollbar { display: none; }
  .cap { flex: 0 0 auto; min-width: 46px; height: 40px; border-radius: 14px; background: #fff; box-shadow: var(--animal-shadow);
    display: flex; align-items: center; justify-content: center; font-size:var(--fs-md); font-weight: 900; color: var(--animal-text-dis);
    border: none; font-family: inherit; padding: 0 var(--sp-2); }
  .cap.on { background: var(--animal-primary); color: #fff; box-shadow: 0 3px 0 var(--press-teal); }

  #pager { height: 46px; flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-2); }
  #dots { display: flex; gap: var(--sp-2); max-width: 100%; overflow: hidden; }
  #dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--animal-text-dis); transition: .2s; flex: none; }
  #dots i.on { width: 20px; border-radius: 6px; background: var(--animal-primary); }
  #swipehint { display: flex; align-items: center; gap: var(--sp-2); font-size:var(--fs-xs); font-weight: 800; color: var(--animal-text-2); }
  #swipehint svg { width: 15px; height: 15px; }

  /* 空态兜底（BUGS#7） */
  .kempty { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-3); }
  .kempty-ic svg { width: 54px; height: 54px; }
  .kempty-tx { font-size:var(--fs-md); font-weight: 800; color: var(--animal-text-2); line-height: 2.1; text-align: center; max-width: 260px; }
  .kempty-btn { border: none; border-radius: 999px; background: var(--animal-primary); color: #fff; font-family: inherit;
    font-size:var(--fs-md); font-weight: 900; padding: var(--sp-3) var(--sp-6); box-shadow: 0 4px 0 var(--press-teal); cursor: pointer; }
  .kempty-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--press-teal); }
</style>
