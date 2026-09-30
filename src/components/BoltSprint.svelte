<script lang="ts">
  /* ⚡闪电刷题：5 分钟无限连续出题、每题 2 选项、HUD 计数、结算（今日/历史最佳+礼花）
     v2.3 听写重构：听写 blisten ~70%（播真人音→混淆搭档二选一）+ 口诀正向回忆 bkj ~30%；
     "看大字选一样"与正反判断删除（零错误信息铁律 + 正反归小侦探） */
  import { BT, startBolt, endBolt, boltAnswer, boltQuit, boltTitle, boltAcc, boltAvg } from '../stores/bolt.svelte'
  import { S } from '../stores/progress.svelte'
  import { say } from '../lib/audio'
  import { show } from '../stores/ui.svelte'
  import Speak from './Speak.svelte'
  import Icon from './Icon.svelte'

  const q = $derived(BT.q as any)
  const reveal = $derived(BT.reveal)
  const timeText = $derived.by(() => {
    const m = Math.floor(BT.left / 60), s2 = BT.left % 60
    return m + ':' + (s2 < 10 ? '0' : '') + s2
  })

  /* v2.6 零自动播放：blisten 出题不再自动读音——题面 🔊 大喇叭点播，孩子控节奏 */

</script>

<section id="v-bolt" class="view on" data-screen="bolt">
  <div class="ltop">
    <button class="cbtn" data-back="boltquit" onclick={boltQuit} aria-label="exit"><Icon name="close" size={20} /></button>
    <div class="ltt"><Speak k="boltSprint" /></div>
    <div class="lprog" id="bolttime" class:low={BT.left <= 10}>{timeText}</div>
  </div>
  <div class="bolthud">
    <span id="boltans"><Speak k="hudAnswered" plain />{BT.n}</span>
    <span id="boltacc"><Speak k="hudAcc" plain />{BT.n ? Math.round(BT.ok * 100 / BT.n) + '%' : '--'}</span>
    <span id="boltstreak" class={BT.streak >= 5 ? 'hot' : ''}><Icon name="flame" size={18} /> {BT.streak}</span>
  </div>
  <div class="qcard" id="boltcard" style="display:{BT.resultOn ? 'none' : 'flex'}">
    <div class="qhint" id="bhint"><Speak text={q?.hint ?? ''} /></div>
    {#key BT.q}
      <div class="glyphbox" id="bglyph">
        {#if q?.type === 'bkj'}
          <div class="ruletext">「<Speak text={q.stmt} />」</div>
        {:else if q?.type === 'blisten'}
          <div style="position:relative">
            <button class="bigsound" type="button" onclick={() => say(q.sound)}><Icon name="headphones" size={44} /><span class="bslabel"><Speak k="listenAgain" plain /></span></button>
          </div>
        {/if}
      </div>
      <div class="boltopts" id="bopt">
        {#if q}
          {#each q.opts as k, idx}
            <button class="opt" class:correct={reveal && idx === reveal.correct} class:wrong={reveal && reveal.wrong.includes(idx)} onclick={() => boltAnswer(idx)}>
              <div class="og">{k}</div>
            </button>
          {/each}
        {/if}
      </div>
    {/key}
  </div>
  <button class="btn ghost small" id="boltstop" style="margin-top:var(--sp-3);display:{BT.resultOn ? 'none' : 'block'}" onclick={endBolt}><Speak k="stopEarly" plain /></button>
  <div id="boltresult" style="display:{BT.resultOn ? 'flex' : 'none'}">
    {#each BT.confetti as i (i)}
      <div class="bfire" style="left:{5 + Math.random() * 90}%;top:{18 + Math.random() * 40}%;animation-delay:{i * 0.12}s"><Icon name={['star','balloon','heart','flower'][i % 4]} size={34} /></div>
    {/each}
    <div class="btitle" id="btitle"><Speak text={boltTitle()} /></div>
    <div class="bstats" id="bstats">
      <div class="bstat"><div class="bv">{BT.n}</div><div class="bk"><Speak k="totalQs" /></div></div>
      <div class="bstat"><div class="bv">{boltAcc()}%</div><div class="bk"><Speak k="accLabel" /></div></div>
      <div class="bstat"><div class="bv">{BT.best}</div><div class="bk"><Speak k="bestStreak" /></div></div>
      <div class="bstat"><div class="bv">{boltAvg().toFixed(1)}</div><div class="bk"><Speak k="secPerQ" /></div></div>
    </div>
    <div class="brec" id="brec" style="display:{(S.bolt.acc > 0 || S.bolt.tacc > 0) ? 'block' : 'none'}">
      <Speak k="todayBest" plain />{S.bolt.tacc || 0}% · <Speak k="histBest" plain />{S.bolt.acc || 0}%{#if BT.record} <Speak k="newRecord" />{/if}
    </div>
    <div class="rbtns">
      <button class="btn red" id="bagain" onclick={() => startBolt(false)}><Icon name="rocket" size={24} /> <Speak k="againRound" plain /></button>
      <button class="btn ghost" id="bhome" onclick={() => show('practice')}><Speak k="backPractice" plain /></button>
    </div>
  </div>
</section>

<style>
  .ltop { display: flex; align-items: center; gap: var(--sp-2); height: 44px; flex: none; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
  .ltt { flex: 1; text-align: center; font-size:var(--fs-md); font-weight: 900; }
  .lprog { font-size:var(--fs-xs); font-weight: 900; color: var(--animal-primary-active); background: var(--animal-primary-bg);
    padding: var(--sp-2) var(--sp-3); border-radius: 999px; white-space: nowrap; }
  #bolttime.low { color: var(--animal-error); animation: blinkT 1s steps(2) infinite; }
  @keyframes blinkT { 50% { opacity: .45; } }
</style>
