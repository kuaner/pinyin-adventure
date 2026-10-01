<script lang="ts">
  /* PinyinCard v2.5 统一学习卡片（kuaner 2026-09-30 14:51："针对每个拼音都搞个组件，到处都可以复用，
     相当于是每个拼音的学习卡片，闪卡都用得上，到处统一"）。
     一个组件 = 每个拼音的完整学习身份，五要素：大字模（四线三格，v3.1 起=笔顺动画本体，BUGS#31①）/
     真人读音 / 笔顺动画（与字模合体后此条即字模条目）/ 口诀（文+音）/ 例词。
     v3.1.1（BUGS#32）：full 档控制键（🔊读音/▶重播）从下方独立行改为浮层锚字模框右下角——
     动画与控制在同一个视觉单元。
     三档形态：full（学习岛学一学页 · 口诀广播展开区，五要素全展示；字模=会自己写自己的笔顺动画）
              card（闪卡：正面字模+口诀，翻面笔顺动画+例词）
              mini（答错反馈弹层：字模+读音+口诀一行）
     数据正本 = src/data/pinyin-cards.json（scripts/gen-pinyin-cards.mjs 从 pinyin/lessons/strokes 聚合生成）。
     声音礼仪 R2：全部点击触发，组件自身零自动播放；读音/口诀/笔顺旁白均点播（radio 连播由父级驱动例外，R5）。 */
  import cardsData from '../data/pinyin-cards.json'
  import { LETTERS } from '../data'
  import { say, playAudio } from '../lib/audio'
  import { tRaw } from '../text/strings'
  import Speak from './Speak.svelte'
  import Icon from './Icon.svelte'
  import StrokeAnim from './learn/StrokeAnim.svelte'

  interface CardRec { k: string; tts: string; han: string; kj: string; kjAudio: string; word: string; wp: string; em: string; say: string; sayAudio: string; stroke: boolean }
  const CARDS = new Map<string, CardRec>(
    ((cardsData as any).cards as CardRec[]).map((c) => [c.k, c]),
  )

  let {
    k, mode = 'full', flipped = false,
    strokePlay = false,      /* 外部驱动的笔顺播放信号（口诀联动：音频在播=动画在跑） */
    strokeLoop = false,      /* 播完自动循环（连播/点播期间跟随音频时长） */
    strokeStatic = -1,       /* >=0 时笔顺预览为静态帧（?static=K 深链自检用，v3.0 学一学页透传） */
    onmain,                  /* 主字模点播回调（缺省 = say(k) 呼读音；口诀广播传整条口诀点播） */
    tip = '',                /* 主字模下方提示（缺省不显示） */
    glyphMax = 132,          /* full 档字模区高度上限（×1.3 为显示区 px，SVG 等比适配） */
  }: {
    k: string; mode?: 'full' | 'card' | 'mini'; flipped?: boolean
    strokePlay?: boolean; strokeLoop?: boolean; strokeStatic?: number
    onmain?: () => void; tip?: string; glyphMax?: number
  } = $props()

  /* v2.8：字模长度适配——Nunito ≈0.55em/字母，250px 内容宽反推字号上限（yuan/zhi/zh 这类长单元零溢出） */
  const fitMax = $derived(Math.round(250 / (0.55 * Math.max(1, k.length))))
  /* 数据三级兜底：pinyin-cards.json → LETTERS（pinyin.json）→ 空对象（渲染层判空） */
  const C = $derived(CARDS.get(k) || (() => {
    const L: any = (LETTERS as any)[k] || {}
    return { k, tts: L.tts || '', han: L.han || '', kj: L.kj || '', kjAudio: '', word: L.word || '', wp: L.wp || '', em: L.em || '', say: '', sayAudio: '', stroke: false } as CardRec
  })())
  const kjEn = $derived.by(() => {
    const m = (C.kj || '').match(/^([一-鿿，、！？]+)\s*(.*)$/)
    return m ? [m[1], m[2]] : [C.kj || '', '']
  })

  let sa: StrokeAnim
  let manualStroke = $state(false)
  const strokeActive = $derived(mode !== 'mini' && (strokePlay || manualStroke))

  /* BUGS#31③：播放键按压动效反馈（短脉冲，动画结束自动熄） */
  let readPing = $state(false)
  let kjPing = $state(false)
  let replayPing = $state(false)
  let pingTimers: ReturnType<typeof setTimeout>[] = []
  function ping(name: 'read' | 'kj' | 'replay') {
    const flag = name === 'read' ? readPing : name === 'kj' ? kjPing : replayPing
    pingTimers.forEach(clearTimeout)
    readPing = kjPing = replayPing = false
    void flag
    requestAnimationFrame(() => {
      if (name === 'read') readPing = true
      else if (name === 'kj') kjPing = true
      else replayPing = true
      pingTimers.push(setTimeout(() => { readPing = kjPing = replayPing = false }, 700))
    })
  }

  function strokeDone() {
    if (strokePlay && strokeLoop) { setTimeout(() => sa?.replay(), 500); return }
    manualStroke = false
  }
  function replayStroke() { ping('replay'); manualStroke = true; sa?.replay(); if (C.sayAudio) playAudio(C.sayAudio, { hint: '' }) }
  function mainTap() { if (onmain) onmain(); else say(k) }
  function readTap() { ping('read'); say(k) }
  function playKj() {
    ping('kj')
    if (C.kjAudio) playAudio(C.kjAudio, { hint: tRaw('notReady') })
    else say(k)
  }

  /* card 档翻面时重播笔顺（每次翻开从第一笔起） */
  $effect(() => { if (mode === 'card') { manualStroke = flipped ? true : false; if (flipped) setTimeout(() => sa?.replay(), 60) } })
</script>

{#if mode === 'full'}
  <div class="pcfull" data-pc={k}>
    <!-- BUGS#31①：笔顺动画=字模（唯一 z）——四线三格里它自己写自己：空闲=写好的字（idleDone 定格完整笔画），
         进页自动播/点重播=再写一遍。glyphMax 语义=字模显示区高度上限（SVG 等比适配，四线三格占比恒定）。
         BUGS#32：控制键上墙——🔊读音+▶重播不再独立成行堆在下方，改为浮层锚在字模框（herofit）右下角，
         与笔顺动画同一个视觉单元："看"和"控制看"视线/手指都不用跳区（kuaner 2026-10-01"看笔顺读音是不是可以放在上面的笔顺上"）。
         垂直叠放而非横排：字模 svg 宽≈高×0.475 居中，横排键组会压到四线格右端，纵叠在一切屏宽下零遮挡。 -->
    <div class="pc-hero">
      <div class="pc-herofit" style="max-height:{Math.round(glyphMax * 1.3)}px">
        <button class="pc-glyphbtn" data-pcmain={k} onclick={mainTap} aria-label="{k} {C.tts}">
          {#if C.stroke}
            <StrokeAnim unit={k} idleDone cell={120} showList={false} play={strokeActive} static={strokeStatic} bind:this={sa} ondone={strokeDone} />
          {:else}
            <!-- 兜底：无笔顺数据的单元退回字体字模（63 卡实测全覆盖，此分支仅为防御） -->
            <i class="pc-grid" aria-hidden="true"></i>
            <span class="pc-big" style="font-size:min(var(--fs-hero),{glyphMax}px,{fitMax}px)">{k}</span>
          {/if}
        </button>
        <div class="pc-ctrls">
          <button class="pc-read" data-pcread={k} class:ping={readPing} onclick={readTap} aria-label="读音">
            <Icon name="headphones" size={24} />
          </button>
          {#if C.stroke}
            <button class="pc-replay" data-pcreplay={k} class:ping={replayPing} onclick={replayStroke} aria-label="看笔顺">
              <Icon name="refresh" size={22} />
            </button>
          {/if}
        </div>
      </div>
    </div>
    {#if kjEn[0]}
      <button class="pc-kj" data-pckj={k} class:ping={kjPing} onclick={playKj} aria-label="口诀">
        {#if C.kjAudio}<span class="pc-kjplay"><Icon name="play" size={16} /></span>{/if}
        <Speak text={kjEn[0]} />
        {#if kjEn[1]}<b class="pc-kjen">{kjEn[1]}</b>{/if}
      </button>
    {/if}
    {#if C.word}
      <div class="pc-word"><span class="pc-em">{C.em}</span><Speak text={C.word} />&nbsp;<span class="pc-wp">{C.wp}</span></div>
    {/if}
    {#if tip}
      <div class="pc-tip"><Icon name="play" size={13} /><span>{@html tip}</span></div>
    {/if}
  </div>
{:else if mode === 'card'}
  <div class="pccard" data-pc={k}>
    {#if !flipped}
      <div class="pcc-front">
        <div class="pcc-glyph">{k}</div>
        {#if kjEn[0]}
          <div class="pcc-kj">
            <Speak text={kjEn[0]} />
            {#if kjEn[1]}<b class="pc-kjen">{kjEn[1]}</b>{/if}
          </div>
        {/if}
      </div>
    {:else}
      <div class="pcc-back">
        {#if C.stroke}
          <div class="pcc-strokefit"><StrokeAnim unit={k} cell={76} play={true} bind:this={sa} ondone={strokeDone} /></div>
        {:else}
          <div class="pcc-glyph sm">{k}</div>
        {/if}
        <div class="pcc-row">
          <span class="pc-em">{C.em}</span>
          <b class="pcc-tts">{C.tts || k}</b>
          <span class="pcc-word"><Speak text={C.word} /></span>
          <span class="pc-wp">{C.wp}</span>
        </div>
      </div>
    {/if}
  </div>
{:else}
  <!-- mini：字模 + 读音 + 口诀一行（答错/听写反馈弹层） -->
  {#if C.k}
    <div class="pcmini" data-pcmini={k}>
      <button class="pcm-g" onclick={() => say(k)} aria-label="{k} {C.tts}">{k}</button>
      <div class="pcm-r">
        <div class="pcm-kj">
          {#if kjEn[0]}<Speak text={kjEn[0]} plain />{/if}
          {#if kjEn[1]}<b class="pc-kjen">{kjEn[1]}</b>{/if}
        </div>
        <button class="pcm-say" onclick={() => say(k)}><Icon name="headphones" size={14} /> <span>{C.tts || k}</span></button>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* ---------- full ---------- */
  .pcfull { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-1); width: 100%; min-height: 0; flex: 1; }
  /* BUGS#31①：字模区=笔顺动画本体（唯一 z）——弹性主位（1.1），奶油练习本面板承载四线三格；
     idleDone 定格=完整字模，播放中=它自己写自己。glyphMax 经 herofit max-height 封顶 */
  .pc-hero { border: none; background: #fbf7ec; font-family: inherit; padding: var(--sp-1) var(--sp-2); line-height: 1; position: relative;
    width: 88%; flex: 1.1 1 0; min-height: 0; display: flex; align-items: center; justify-content: center; border-radius: 16px; }
  /* BUGS#32：herofit=字模框，浮层控制键的定位锚（按钮永远贴着动画框右下角，面板再高也不远离） */
  .pc-herofit { position: relative; width: 100%; height: 100%; min-height: 0; display: flex; align-items: center; justify-content: center; }
  .pc-herofit :global(svg.strokeanim) { max-width: 100%; max-height: 100%; }
  /* BUGS#32：字模主按钮=占满字模框（点字模读呼读音，原 pc-hero 整面板点按行为不变） */
  .pc-glyphbtn { position: absolute; inset: 0; width: 100%; border: none; background: none; padding: 0; margin: 0; font-family: inherit; line-height: 1;
    display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 16px; min-height: 48px; }
  .pc-glyphbtn:active { transform: scale(.98); }
  /* 兜底分支（无笔顺数据）：字体字模，白底回到老字模观感 */
  .pc-hero.fb { background: none; }
  /* 四线三格（仅无笔顺数据的字体字模兜底用） */
  .pc-grid { position: absolute; left: 0; right: 0; top: 16%; bottom: 18%; pointer-events: none;
    background-image: linear-gradient(#e3d3b6, #e3d3b6), linear-gradient(#e3d3b6, #e3d3b6), linear-gradient(#e3d3b6, #e3d3b6), linear-gradient(#e3d3b6, #e3d3b6);
    background-size: 100% 1.5px; background-position: 0 0, 0 33.33%, 0 66.66%, 0 100%; background-repeat: no-repeat; opacity: .5; border-radius: 4px; }
  .pc-big { font-weight: 900; line-height: 1.08; color: var(--animal-primary); text-shadow: 0 6px 0 rgba(18,157,143,.16); display: block; position: relative; z-index: 1; }
  /* BUGS#32：控制键浮层=字模框右下角垂直叠放——字模 svg 宽≈高×0.475 居中，右缘净空 390 屏 ≈35px+、
     320 窄屏仍 ≥7px，纵叠在任何屏宽零遮挡；圆钮 50×50（≥48 Apple 儿童触控标准）；
     容器 pointer-events:none 使钮间空隙点穿到字模按钮（热区不冲突、无死区） */
  .pc-ctrls { position: absolute; right: 6px; bottom: 6px; display: flex; flex-direction: column; gap: 6px; z-index: 2; pointer-events: none; }
  /* BUGS#31③：全部播放键 ≥48×48 +按压脉冲动效（沿用） */
  .pc-read { width: 50px; height: 50px; min-width: 50px; min-height: 50px; padding: 0; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; border: 2.5px solid #bce8e2; background: var(--animal-primary-bg); color: var(--animal-primary-active);
    font-family: inherit; cursor: pointer; flex: none; pointer-events: auto; box-shadow: 0 3px 0 #bce8e2; }
  .pc-read:active { transform: translateY(2px); box-shadow: 0 1px 0 #bce8e2; }
  .pc-read :global(svg) { width: 24px; height: 24px; }
  .pc-read.ping { animation: pcping .65s ease-out; }
  .pc-replay { width: 50px; height: 50px; min-width: 50px; min-height: 50px; padding: 0; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; border: none; background: #fff; color: var(--animal-primary-active);
    font-family: inherit; cursor: pointer; flex: none; pointer-events: auto; box-shadow: 0 3px 0 #e3d9c8; }
  .pc-replay:active { transform: translateY(2px); box-shadow: 0 1px 0 #e3d9c8; }
  .pc-replay :global(svg) { width: 22px; height: 22px; }
  .pc-replay.ping { animation: pcping .65s ease-out; }
  /* 按压脉冲：扩散光环+微放大（动效反馈，kuaner"动效反馈"） */
  @keyframes pcping { 0% { box-shadow: 0 3px 0 #bce8e2, 0 0 0 0 rgba(42,157,143,.4); } 70% { box-shadow: 0 3px 0 #bce8e2, 0 0 0 14px rgba(42,157,143,0); } 100% { box-shadow: 0 3px 0 #bce8e2, 0 0 0 0 rgba(42,157,143,0); } }
  /* 口诀全文=长内容允许换行（v2.9.4 换行立法豁免类；胶囊改大圆角，零溢出） */
  .pc-kj { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; row-gap: var(--sp-1); column-gap: var(--sp-2); border: none; background: #eef8e2; font-family: inherit;
    font-size:var(--fs-sm); font-weight: 800; color: var(--animal-text); min-height: 52px; min-width: 48px; padding: var(--sp-2) var(--sp-3); border-radius: var(--animal-r-lg); cursor: pointer; flex: none; max-width: 100%; text-align: center; line-height: 1.5; }
  .pc-kj:active { transform: translateY(1px); }
  .pc-kjplay { width: 30px; height: 30px; border-radius: 50%; background: var(--animal-success); color: #fff;
    display: inline-flex; align-items: center; justify-content: center; flex: none; }
  .pc-kj :global(svg), .pc-kjplay :global(svg) { width: 16px; height: 16px; }
  .pc-kj.ping .pc-kjplay { animation: kjping .65s ease-out; }
  @keyframes kjping { 0%, 100% { transform: scale(1); } 45% { transform: scale(1.3); } }
  .pc-kjen { font-weight: 900; color: var(--animal-primary-active); letter-spacing: 2px; }
  .pc-word { display: flex; align-items: center; gap: var(--sp-2); background: #fff8e0; border-radius: 999px;
    padding: var(--sp-1) var(--sp-3); font-size:var(--fs-xs); font-weight: 800; color: var(--animal-text); flex: none; max-width: 100%; }
  .pc-em { font-size:var(--fs-md); }
  .pc-wp { font-size:var(--fs-xs); color: #dba90e; font-weight: 900; }
  .pc-tip { display: flex; align-items: center; gap: var(--sp-2); font-size:var(--fs-xs); font-weight: 800; color: var(--animal-text-2); flex: none; }
  .pc-tip :global(svg) { width: 14px; height: 14px; }

  /* ---------- card ---------- */
  .pccard { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-2); width: 100%; height: 100%; min-height: 0; }
  .pcc-front, .pcc-back { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-2); width: 100%; min-height: 0; flex: 1; }
  .pcc-glyph { font-size: clamp(96px,30vw,var(--fs-hero)); font-weight: 800; line-height: 1.15; color: var(--animal-text); }
  .pcc-glyph.sm { font-size:var(--fs-glyph); }
  .pcc-kj { display: flex; align-items: center; gap: var(--sp-2); font-size:var(--fs-sm); font-weight: 800; color: var(--animal-success);
    background: #eef8e2; padding: var(--sp-2) var(--sp-3); border-radius: 14px; max-width: 100%; text-align: center; }
  .pcc-back { gap: var(--sp-2); }
  .pcc-strokefit { flex: 1; min-height: 0; width: 92%; display: flex; align-items: center; justify-content: center;
    background: #fbf7ec; border-radius: 16px; padding: var(--sp-1); }
  .pcc-strokefit :global(svg.strokeanim) { max-width: 100%; max-height: 100%; }
  .pcc-row { display: flex; align-items: center; gap: var(--sp-2); flex: none; font-size:var(--fs-md); font-weight: 900; color: var(--animal-text); }
  .pcc-tts { color: var(--animal-primary-active); font-size:var(--fs-lg); }
  .pcc-word { font-size:var(--fs-md); }

  /* ---------- mini ---------- */
  .pcmini { display: flex; align-items: center; gap: var(--sp-3); width: 100%; }
  .pcm-g { flex: none; width: 62px; height: 62px; border-radius: 16px; background: var(--animal-primary-bg); border: 2px solid #bce8e2;
    color: var(--animal-primary-active); font-family: inherit; font-size:var(--fs-em); font-weight: 900; line-height: 1;
    display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 3px 0 #bce8e2; }
  .pcm-g:active { transform: translateY(2px); box-shadow: 0 1px 0 #bce8e2; }
  .pcm-r { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: var(--sp-1); }
  .pcm-kj { display: flex; align-items: center; gap: var(--sp-2); font-size:var(--fs-sm); font-weight: 800; color: var(--animal-text); line-height: 1.9; max-width: 100%; }
  .pcm-say { display: flex; align-items: center; gap: var(--sp-1); border: none; background: var(--animal-primary-bg); color: var(--animal-primary-active);
    font-family: inherit; font-size:var(--fs-xs); font-weight: 900; padding: var(--sp-1) var(--sp-3); border-radius: 999px; cursor: pointer; }
</style>
