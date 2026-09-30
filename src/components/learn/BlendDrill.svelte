<script lang="ts">
  /* 拼读练习（五步之④）：声母卡+韵母卡靠近合成动画 + 真人音节；L12 整体认读模式=认读卡片 */
  import { playAudio, letterAudio } from '../../lib/audio'
  import Ruby from '../Ruby.svelte'
  import Icon from '../Icon.svelte'

  export type Blend = { ini: string; fin: string; syl: string; tone: number; display: string; char: string; file: string }
  export type ZtItem = { k: string; kj: string }

  let { blends = [], ztlist = [], note = '', ondone }: { blends?: Blend[]; ztlist?: ZtItem[]; note?: string; ondone?: () => void } = $props()

  let idx = $state(0)
  let merging = $state(false)     // 0 未拼 1 合成中 2 完成
  let timer: ReturnType<typeof setTimeout> | null = null

  const b = $derived(blends[idx])
  const ztMode = $derived(ztlist.length > 0)

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
    <div class="magicnote"><Icon name="bulb" size={22} /> <Ruby text={note} /></div>
  {/if}

  {#if ztMode}
    <div class="zthint"><Ruby text="整体认读，直接读成一个音" /></div>
    <div class="ztgrid">
      {#each ztlist as z (z.k)}
        <button class="ztcard" onclick={() => playAudio(letterAudio(z.k), { hint: '语音未准备好' })}>
          <span class="ztu">{z.k}</span>
          <span class="zkj"><Ruby text={z.kj} /></span>
        </button>
      {/each}
    </div>
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
        <Icon name="play" size={22} /> <Ruby text="拼一拼" />
      </button>
      <button class="navbtn" disabled={idx === blends.length - 1} onclick={() => move(1)} aria-label="下一个">›</button>
    </div>
    <div class="pcount">{idx + 1} / {blends.length}</div>

    <div class="btable">
      {#each blends as x, i (x.syl + i)}
        <button class="bchip" class:on={i === idx} onclick={() => playAudio(x.file, { hint: '语音未准备好' })}>
          {x.ini}·{x.fin}→{x.display}{x.char ? ' ' + x.char : ''}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .blenddrill { display: flex; flex-direction: column; gap: 12px; }
  .magicnote { background: #fff8e0; border: 2.5px dashed #e6c96a; border-radius: 16px; padding: 10px 14px;
    font-size: 19px; font-weight: 700; color: #8a6d1f; display: flex; align-items: center; gap: 8px; line-height: 1.9; }
  .stage { position: relative; height: 190px; display: flex; align-items: center; justify-content: center; gap: 14px; }
  .card { width: 104px; height: 132px; border-radius: 22px; background: #fff; box-shadow: 0 5px 0 #e3d9c8;
    display: flex; align-items: center; justify-content: center; font-size: 62px; font-weight: 900;
    transition: transform .6s cubic-bezier(.55,0,.35,1); font-family: inherit; }
  .inicard { color: #2A9D8F; border: 3px solid #bfe8df; }
  .fincard { color: #E76F51; border: 3px solid #f6cdc2; }
  .plus { font-size: 40px; font-weight: 900; color: #8a7a68; transition: opacity .3s; }
  .stage.merged .inicard { transform: translateX(56px) rotate(-4deg); }
  .stage.merged .fincard { transform: translateX(-56px) rotate(4deg); }
  .stage.merged .plus { opacity: 0; }
  .result { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0; transform: scale(.4); transition: all .5s cubic-bezier(.2,1.4,.4,1) .45s; pointer-events: none; }
  .result.show { opacity: 1; transform: scale(1); }
  .rsyl { font-size: 76px; font-weight: 900; color: #264653; }
  .rchar { font-size: 44px; color: #E76F51; font-weight: 900; }
  .steps { display: flex; gap: 10px; align-items: center; }
  .steps .btn { flex: 1; }
  .navbtn { width: 56px; height: 56px; border-radius: 16px; border: 2px solid #e3d9c8; background: #fff;
    font-size: 30px; font-weight: 900; color: #6f6353; font-family: inherit; }
  .navbtn:disabled { opacity: .35; }
  .pcount { text-align: center; color: #8a7a68; font-weight: 800; font-size: 15px; }
  .btable { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .bchip { background: #fff; border: 2px solid #eee4d3; border-radius: 14px; padding: 10px 14px;
    font-size: 20px; font-weight: 800; color: #6f6353; font-family: inherit; }
  .bchip.on { border-color: #2A9D8F; background: #e6f7f2; color: #1f7a68; }
  .zthint { text-align: center; font-size: 21px; font-weight: 800; color: #264653; }
  .ztgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .ztcard { background: #fff; border: 2.5px solid #eee4d3; border-radius: 18px; padding: 12px 8px;
    display: flex; flex-direction: column; align-items: center; gap: 4px; font-family: inherit; }
  .ztu { font-size: 40px; font-weight: 900; color: #264653; }
  .zkj { font-size: 16px; font-weight: 700; color: #8a7a68; line-height: 1.7; }
</style>
