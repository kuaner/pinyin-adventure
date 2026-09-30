<script lang="ts">
  /* 拼读练习（五步之④）：声母卡+韵母卡靠近合成动画 + 真人音节；L12 整体认读模式=认读卡片。
     v2.4.1 修拼读页空白（BUGS#5）：单韵母课（L1/L2）无 blends/ztlist，v2.4 起整页空白——
     补「四声读一读」模式（tones 数据逐卡点读，课本同款四声练习）+ 全空兜底文案 */
  import { playAudio, letterAudio } from '../../lib/audio'
  import { tRaw } from '../../text/strings'
  import Speak from '../Speak.svelte'
  import Icon from '../Icon.svelte'

  export type Blend = { ini: string; fin: string; syl: string; tone: number; display: string; char: string; file: string }
  export type ZtItem = { k: string; kj: string }
  export type ToneRow = { base: string; display: string; tones: { t: number; display: string; file: string }[] }

  let { blends = [], ztlist = [], tones = [], note = '', ondone }:
    { blends?: Blend[]; ztlist?: ZtItem[]; tones?: ToneRow[]; note?: string; ondone?: () => void } = $props()

  let idx = $state(0)
  let ztIdx = $state(0)
  let merging = $state(false)     // 0 未拼 1 合成中 2 完成
  let timer: ReturnType<typeof setTimeout> | null = null

  const b = $derived(blends[idx])
  const ztMode = $derived(ztlist.length > 0)
  const singleMode = $derived(!ztMode && blends.length === 0 && tones.length > 0)
  const emptyAll = $derived(!ztMode && blends.length === 0 && tones.length === 0)
  /* BUGS#24：L12 整体认读 16 张卡单网格被 overflow 裁掉 6 张（内容丢失）——分页 2×2×4 页 */
  const ZT_PER = 4
  const ztPages = $derived.by(() => {
    const out: ZtItem[][] = []
    for (let i = 0; i < ztlist.length; i += ZT_PER) out.push(ztlist.slice(i, i + ZT_PER))
    return out
  })
  function ztMove(d: number) { ztIdx = Math.max(0, Math.min(ztPages.length - 1, ztIdx + d)) }

  function merge() {
    if (!b || merging) return
    merging = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      playAudio(b.file, { hint: '语音未准备好' })
      timer = setTimeout(() => (merging = false), 1500)
    }, 620)
  }
  function move(d: number) {
    idx = Math.max(0, Math.min(blends.length - 1, idx + d))
    merging = false
  }
</script>

<div class="blenddrill">
  {#if note}
    <div class="magicnote"><Icon name="bulb" size={22} /> <Speak text={note} /></div>
  {/if}

  {#if ztMode}
    <div class="zthint"><Speak k="ztDirect" /></div>
    <div class="ztgrid">
      {#each ztPages[Math.min(ztIdx, ztPages.length - 1)] as z (z.k)}
        <button class="ztcard" onclick={() => playAudio(letterAudio(z.k), { hint: tRaw('notReady') })}>
          <span class="ztu">{z.k}</span>
          <span class="zkj"><Speak text={z.kj} plain /></span>
        </button>
      {/each}
    </div>
    {#if ztPages.length > 1}
      <div class="steps">
        <button class="navbtn" disabled={ztIdx === 0} onclick={() => ztMove(-1)} aria-label="上一页">‹</button>
        <div class="pcount">{ztIdx + 1} / {ztPages.length}</div>
        <button class="navbtn" disabled={ztIdx === ztPages.length - 1} onclick={() => ztMove(1)} aria-label="下一页">›</button>
      </div>
    {/if}
  {:else if singleMode}
    <div class="zthint"><Speak k="fourTonesRead" /></div>
    <div class="srows">
      {#each tones as row (row.base)}
        <div class="srow">
          <span class="sbase">{row.base}</span>
          <div class="sgrid">
            {#each row.tones as t (t.t)}
              <button class="scard" data-syl={t.display} onclick={() => playAudio(t.file, { hint: tRaw('notReady') })}>{t.display}</button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
    <div class="stip"><Speak k="tapFollow" /></div>
  {:else if b}
    <div class="stage" class:merged={merging}>
      <div class="card inicard">{b.ini}</div>
      <div class="plus" class:hide={merging}>+</div>
      <div class="card fincard">{b.fin}</div>
      <div class="result" class:show={merging}>
        <div class="rsyl">{b.display}</div>
        {#if b.char}<div class="rchar">{b.char}</div>{/if}
      </div>
    </div>

    <div class="steps">
      <button class="navbtn" disabled={idx === 0} onclick={() => move(-1)} aria-label="上一个">‹</button>
      <button class="btn teal" onclick={merge} disabled={merging}>
        <Icon name="play" size={22} /> <Speak k="blendIt" plain />
      </button>
      <button class="navbtn" disabled={idx === blends.length - 1} onclick={() => move(1)} aria-label="下一个">›</button>
    </div>
    <div class="pcount">{idx + 1} / {blends.length}</div>

    <div class="btable">
      {#each blends as x, i (x.syl + i)}
        <button class="bchip" class:on={i === idx} onclick={() => playAudio(x.file, { hint: tRaw('notReady') })}>
          {x.ini}·{x.fin}→{x.display}{x.char ? ' ' + x.char : ''}
        </button>
      {/each}
    </div>
  {:else if emptyAll}
    <div class="bempty"><Speak k="emptyBlend" /></div>
  {/if}
</div>

<style>
  .blenddrill { display: flex; flex-direction: column; gap: var(--sp-3); }
  .magicnote { background: #fff8e0; border: 2.5px dashed #e6c96a; border-radius: 16px; padding: var(--sp-2) var(--sp-3);
    font-size:var(--fs-md); font-weight: 700; color: #8a6d1f; display: flex; align-items: center; gap: var(--sp-2); line-height: 1.9; }
  .stage { position: relative; height: 190px; display: flex; align-items: center; justify-content: center; gap: var(--sp-3); }
  .card { width: 104px; height: 132px; border-radius: 22px; background: #fff; box-shadow: 0 5px 0 #e3d9c8;
    display: flex; align-items: center; justify-content: center; font-size:var(--fs-glyph); font-weight: 900;
    transition: transform .6s cubic-bezier(.55,0,.35,1); font-family: inherit; }
  .inicard { color: #2A9D8F; border: 3px solid #bfe8df; }
  .fincard { color: #E76F51; border: 3px solid #f6cdc2; }
  .plus { font-size:var(--fs-em); font-weight: 900; color: #8a7a68; transition: opacity .3s; }
  .stage.merged .inicard { transform: translateX(56px) rotate(-4deg); }
  .stage.merged .fincard { transform: translateX(-56px) rotate(4deg); }
  .stage.merged .plus { opacity: 0; }
  .result { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0; transform: scale(.4); transition: all .5s cubic-bezier(.2,1.4,.4,1) .45s; pointer-events: none; }
  .result.show { opacity: 1; transform: scale(1); }
  .rsyl { font-size:var(--fs-glyph-lg); font-weight: 900; color: #264653; }
  .rchar { font-size:var(--fs-glyph-sm); color: #E76F51; font-weight: 900; }
  .steps { display: flex; gap: var(--sp-2); align-items: center; }
  .steps .btn { flex: 1; }
  .navbtn { width: 56px; height: 56px; border-radius: 16px; border: 2px solid #e3d9c8; background: #fff;
    font-size:var(--fs-xl); font-weight: 900; color: #6f6353; font-family: inherit; }
  .navbtn:disabled { opacity: .35; }
  .pcount { text-align: center; color: #8a7a68; font-weight: 800; font-size:var(--fs-sm); }
  .btable { display: flex; flex-wrap: wrap; gap: var(--sp-2); justify-content: center; }    /* 拼读表=内容网格允许换行（卡内 flex:1 弹性区消化，撑不出页面） */
  .bchip { background: #fff; border: 2px solid #eee4d3; border-radius: 14px; padding: var(--sp-2) var(--sp-3);
    font-size:var(--fs-md); font-weight: 800; color: #6f6353; font-family: inherit; }
  .bchip.on { border-color: #2A9D8F; background: #e6f7f2; color: #1f7a68; }
  .zthint { text-align: center; font-size:var(--fs-lg); font-weight: 800; color: #264653; }
  /* 单韵母四声读一读（v2.4.1 BUGS#5） */
  .srows { display: flex; flex-direction: column; gap: var(--sp-2); width: 100%; }
  .srow { display: flex; align-items: center; gap: var(--sp-2); }
  .sbase { flex: 0 0 52px; height: 52px; border-radius: 14px; background: var(--animal-primary-bg, #e6f9f6);
    display: flex; align-items: center; justify-content: center; font-size:var(--fs-xl); font-weight: 900; color: #1f7a68; }
  .sgrid { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-2); }
  .scard { height: 52px; border-radius: 14px; border: 2px solid #eee4d3; background: #fff; font-family: inherit;
    font-size:var(--fs-lg); font-weight: 900; color: #264653; }
  .scard:active { border-color: #2A9D8F; background: #e6f7f2; color: #1f7a68; }
  .stip { text-align: center; font-size:var(--fs-xs); font-weight: 800; color: #8a7a68; }
  .bempty { text-align: center; font-size:var(--fs-md); font-weight: 800; color: #8a7a68; line-height: 2; padding: var(--sp-6) var(--sp-2); }
  .ztgrid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
  .ztcard { background: #fff; border: 2.5px solid #eee4d3; border-radius: 18px; padding: var(--sp-3) var(--sp-2);
    display: flex; flex-direction: column; align-items: center; gap: var(--sp-1); font-family: inherit; }
  .ztu { font-size:var(--fs-em); font-weight: 900; color: #264653; }
  .zkj { font-size:var(--fs-md); font-weight: 700; color: #8a7a68; line-height: 1.7; }
</style>
