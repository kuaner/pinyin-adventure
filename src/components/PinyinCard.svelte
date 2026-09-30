<script lang="ts">
  /* PinyinCard v2.5 统一学习卡片（kuaner 2026-09-30 14:51："针对每个拼音都搞个组件，到处都可以复用，
     相当于是每个拼音的学习卡片，闪卡都用得上，到处统一"）。
     一个组件 = 每个拼音的完整学习身份，五要素：大字模（四线三格）/ 真人读音 / 笔顺动画 / 口诀（文+音）/ 例词。
     三档形态：full（学习岛认识页 · 口诀广播展开区，五要素全展示）
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
    glyphMax = 132,          /* full 档字模上限字号 */
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

  function strokeDone() {
    if (strokePlay && strokeLoop) { setTimeout(() => sa?.replay(), 500); return }
    manualStroke = false
  }
  function replayStroke() { manualStroke = true; sa?.replay(); if (C.sayAudio) playAudio(C.sayAudio, { hint: '' }) }
  function mainTap() { if (onmain) onmain(); else say(k) }
  function playKj() {
    if (C.kjAudio) playAudio(C.kjAudio, { hint: tRaw('notReady') })
    else say(k)
  }

  /* card 档翻面时重播笔顺（每次翻开从第一笔起） */
  $effect(() => { if (mode === 'card') { manualStroke = flipped ? true : false; if (flipped) setTimeout(() => sa?.replay(), 60) } })
</script>

{#if mode === 'full'}
  <div class="pcfull" data-pc={k}>
    <button class="pc-mainbtn" data-pcmain={k} onclick={mainTap} aria-label="{k} {C.tts}">
      {#if C.stroke}
        <!-- BUGS#22②：大字模直接复用 StrokeAnim 的 SVG（同 viewBox 76×160/字母+四线三格背景线）——
           废弃原"字体文本+CSS 自画格线"双坐标系（i 的竖笔曾穿破第 4 线，与笔顺卡占格不一致）。
           glyphMax 语义=字模显示区高度上限（SVG 等比适配，笔格占比恒定） -->
        <div class="pc-glyphfit" style="max-height:{Math.round(glyphMax * 1.3)}px">
          <StrokeAnim unit={k} glyph={true} play={false} showList={false} />
        </div>
      {:else}
        <!-- 兜底：无笔顺数据的单元退回字体字模（57 卡实测全覆盖，此分支仅为防御） -->
        <i class="pc-grid" aria-hidden="true"></i>
        <span class="pc-big" style="font-size:min(var(--fs-hero),{glyphMax}px,{fitMax}px)">{k}</span>
      {/if}
    </button>
    <button class="pc-read" data-pcread={k} onclick={() => say(k)} aria-label="读音">
      <Icon name="headphones" size={17} />
      <span>{C.tts || k}</span>
      {#if C.han}<i class="pc-han">{C.han}</i>{/if}
    </button>
    {#if C.stroke}
      <div class="pc-strokewrap">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="pc-strokefit"><StrokeAnim unit={k} cell={64} showList={false} play={strokeActive} static={strokeStatic} bind:this={sa} ondone={strokeDone} /></div>
        <button class="pc-replay" data-pcreplay={k} onclick={replayStroke}>
          <Icon name="refresh" size={14} />
          <span><Speak k="seeStroke" plain /></span>
        </button>
      </div>
    {/if}
    {#if kjEn[0]}
      <button class="pc-kj" data-pckj={k} onclick={playKj} aria-label="口诀">
        {#if C.kjAudio}<span class="pc-kjplay"><Icon name="play" size={13} /></span>{/if}
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
  /* BUGS#22②：字模按钮=弹性子项（与笔顺区按 1.1:1 分卡内剩余预算），glyphfit 满高承载 SVG；
     SVG max 约束等比缩放，零塌陷 */
  .pc-mainbtn { border: none; background: none; font-family: inherit; padding: 0; cursor: pointer; line-height: 1; position: relative;
    width: 82%; flex: 1.1 1 0; min-height: 0; display: flex; align-items: center; justify-content: center; }
  .pc-glyphfit { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
  .pc-glyphfit :global(svg.strokeanim) { max-width: 100%; max-height: 100%; }
  /* 四线三格（仅无笔顺数据的字体字模兜底用） */
  .pc-grid { position: absolute; left: 0; right: 0; top: 16%; bottom: 18%; pointer-events: none;
    background-image: linear-gradient(#e3d3b6, #e3d3b6), linear-gradient(#e3d3b6, #e3d3b6), linear-gradient(#e3d3b6, #e3d3b6), linear-gradient(#e3d3b6, #e3d3b6);
    background-size: 100% 1.5px; background-position: 0 0, 0 33.33%, 0 66.66%, 0 100%; background-repeat: no-repeat; opacity: .5; border-radius: 4px; }
  .pc-big { font-weight: 900; line-height: 1.08; color: var(--animal-primary); text-shadow: 0 6px 0 rgba(18,157,143,.16); display: block; position: relative; z-index: 1; }
  .pc-read { display: flex; align-items: center; gap: var(--sp-2); border: 2px solid #bce8e2; background: var(--animal-primary-bg); color: var(--animal-primary-active);
    font-family: inherit; font-size:var(--fs-sm); font-weight: 900; padding: var(--sp-1) var(--sp-3); border-radius: 999px; cursor: pointer; flex: none; }
  .pc-read:active { transform: translateY(2px); }
  .pc-han { font-style: normal; font-weight: 800; opacity: .8; }
  .pc-strokewrap { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 88%; min-height: 0; flex: 1;
    background: #fbf7ec; border-radius: 16px; padding: 2px var(--sp-2); }
  .pc-strokefit { flex: 1; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; }
  .pc-strokefit :global(svg.strokeanim) { max-width: 100%; max-height: 100%; }
  .pc-replay { display: flex; align-items: center; gap: var(--sp-1); border: none; background: none; color: var(--animal-primary-active);
    font-family: inherit; font-size:var(--fs-xs); font-weight: 900; cursor: pointer; padding: 0 var(--sp-2); flex: none; }
  .pc-replay :global(svg) { width: 13px; height: 13px; }
  /* 口诀全文=长内容允许换行（v2.9.4 换行立法豁免类；胶囊改大圆角，零溢出） */
  .pc-kj { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; row-gap: var(--sp-1); column-gap: var(--sp-2); border: none; background: #eef8e2; font-family: inherit;
    font-size:var(--fs-sm); font-weight: 800; color: var(--animal-text); padding: var(--sp-2) var(--sp-3); border-radius: var(--animal-r-lg); cursor: pointer; flex: none; max-width: 100%; text-align: center; line-height: 1.5; }
  .pc-kj:active { transform: translateY(1px); }
  .pc-kjplay { width: 22px; height: 22px; border-radius: 50%; background: var(--animal-success); color: #fff;
    display: inline-flex; align-items: center; justify-content: center; flex: none; }
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
