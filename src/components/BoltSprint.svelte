<script lang="ts">
  /* ⚡闪电刷题：5 分钟无限连续出题、每题 2 选项、HUD 计数、结算（今日/历史最佳+礼花） */
  import { BT, startBolt, endBolt, boltAnswer, boltQuit, boltTitle, boltAcc, boltAvg } from '../stores/bolt.svelte'
  import { S } from '../stores/progress.svelte'
  import { say } from '../lib/audio'
  import { show, ui } from '../stores/ui.svelte'
  import { T } from '../lib/ruby'
  import AnchorBar from './AnchorBar.svelte'

  const q = $derived(BT.q as any)
  const reveal = $derived(BT.reveal)
  const timeText = $derived.by(() => {
    const m = Math.floor(BT.left / 60), s2 = BT.left % 60
    return m + ':' + (s2 < 10 ? '0' : '') + s2
  })

  /* blisten 出题自动读音（300ms） */
  $effect(() => {
    const cur = BT.q as any
    if (!cur || cur.type !== 'blisten') return
    const qRef = cur
    setTimeout(() => {
      if (!BT.done && ui.view === 'bolt' && BT.q === qRef) say(qRef.sound)
    }, 300)
  })

  const CONFETTI = ['🎉', '⭐', '✨', '🎊']
</script>

<section id="v-bolt" class="view on">
  <div class="topbar">
    <button class="backbtn" data-back="boltquit" onclick={boltQuit}>✕</button>
    <h2>⚡ <ruby>闪<rt>shǎn</rt></ruby><ruby>电<rt>diàn</rt></ruby><ruby>刷<rt>shuā</rt></ruby><ruby>题<rt>tí</rt></ruby></h2>
    <div class="scorechip" id="bolttime" class:low={BT.left <= 10}>{timeText}</div>
  </div>
  <div class="bolthud">
    <span id="boltans">{@html T('已{yǐ}答{dá} ')}{BT.n}</span>
    <span id="boltacc">{@html T('正{zhèng}确{què}率{lǜ} ')}{BT.n ? Math.round(BT.ok * 100 / BT.n) + '%' : '--'}</span>
    <span id="boltstreak" class={BT.streak >= 5 ? 'hot' : ''}>🔥 {BT.streak}</span>
  </div>
  <div class="qcard" id="boltcard" style="display:{BT.resultOn ? 'none' : 'flex'}">
    <div class="qhint" id="bhint">{@html q?.hint ?? ''}</div>
    {#key BT.q}
      <div class="glyphbox" id="bglyph">
        {#if q?.type === 'bdjudge'}
          <AnchorBar x={q.A} />
          <div class="glyph" class:mirror={q.flipped} style="min-height:96px">{q.A}</div>
        {:else if q?.type === 'blisten'}
          <div style="position:relative">
            <button class="bigsound" type="button" onclick={() => say(q.sound)}>🔊<span class="bslabel">{@html T('再{zài}听{tīng}一{yí}遍{biàn}')}</span></button>
          </div>
        {:else if q}
          <div class="glyph" style="min-height:96px">{q.A}</div>
        {/if}
      </div>
      <div class="boltopts" id="bopt">
        {#if q?.type === 'bdjudge'}
          <button class="opt tf" class:correct={reveal && reveal.correct === 0} class:wrong={reveal && reveal.wrong.includes(0)} onclick={() => boltAnswer(0)}>
            <div class="og">✅</div><div class="ob">{@html T('写{xiě}对{duì}了{le}')}</div>
          </button>
          <button class="opt tf" class:correct={reveal && reveal.correct === 1} class:wrong={reveal && reveal.wrong.includes(1)} onclick={() => boltAnswer(1)}>
            <div class="og">🔄</div><div class="ob">{@html T('写{xiě}反{fǎn}了{le}')}</div>
          </button>
        {:else if q}
          {#each q.opts as k, idx}
            <button class="opt" class:correct={reveal && idx === reveal.correct} class:wrong={reveal && reveal.wrong.includes(idx)} onclick={() => boltAnswer(idx)}>
              <div class="og">{k}</div>
            </button>
          {/each}
        {/if}
      </div>
    {/key}
  </div>
  <button class="btn ghost small" id="boltstop" style="margin-top:12px;display:{BT.resultOn ? 'none' : 'block'}" onclick={endBolt}>{@html T('提{tí}前{qián}结{jié}束{shù}，看{kàn}成{chéng}绩{jì}')}</button>
  <div id="boltresult" style="display:{BT.resultOn ? 'flex' : 'none'}">
    {#each BT.confetti as i (i)}
      <div class="bfire" style="left:{5 + Math.random() * 90}%;top:{18 + Math.random() * 40}%;animation-delay:{i * 0.12}s">{CONFETTI[i % 4]}</div>
    {/each}
    <div class="btitle" id="btitle">{@html boltTitle()}</div>
    <div class="bstats" id="bstats">
      <div class="bstat"><div class="bv">{BT.n}</div><div class="bk">{@html T('总{zǒng}题{tí}数{shù}')}</div></div>
      <div class="bstat"><div class="bv">{boltAcc()}%</div><div class="bk">{@html T('正{zhèng}确{què}率{lǜ}')}</div></div>
      <div class="bstat"><div class="bv">{BT.best}</div><div class="bk">{@html T('最{zuì}长{cháng}连{lián}对{duì}')}</div></div>
      <div class="bstat"><div class="bv">{boltAvg().toFixed(1)}</div><div class="bk">{@html T('秒{miǎo}/题{tí}')}</div></div>
    </div>
    <div class="brec" id="brec" style="display:{(S.bolt.acc > 0 || S.bolt.tacc > 0) ? 'block' : 'none'}">
      {@html T('今{jīn}日{rì}最{zuì}佳{jiā}：')}{S.bolt.tacc || 0}% · {@html T('历{lì}史{shǐ}最{zuì}佳{jiā}：')}{S.bolt.acc || 0}%{BT.record ? ' 🎉 ' + T('破{pò}纪{jì}录{lù}啦{la}！') : ''}
    </div>
    <div class="rbtns">
      <button class="btn red" id="bagain" onclick={() => startBolt(false)}>⚡ {@html T('再{zài}来{lái}一{yí}轮{lún}')}</button>
      <button class="btn ghost" id="bhome" onclick={() => show('home')}>{@html T('回{huí}主{zhǔ}页{yè}')}</button>
    </div>
  </div>
</section>
