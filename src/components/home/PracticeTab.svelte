<script lang="ts">
  /* v2.4 练习 tab（打样屏2）：主角 = 六模式 2×3 大卡阵。六卡=六个既有模式原样搬迁（不新增不合并），
     角标 = 各模式真实进度（localStorage 派生）；greet = 当日轻总结 */
  import { PAIRS, ZI } from '../../data'
  import { S, levelUnlocked, todayStr } from '../../stores/progress.svelte'
  import { startDet, startZi } from '../../stores/session.svelte'
  import { startBolt } from '../../stores/bolt.svelte'
  import { show } from '../../stores/ui.svelte'
  import Ruby from '../Ruby.svelte'

  /* ---- 真实进度角标 ---- */
  const curLv = $derived.by(() => { for (let i = 1; i <= 9; i++) if (levelUnlocked(i) && !(S.stars[i] >= 1)) return i; return 9 })
  const boltBest = $derived(S.bolt.acc || 0)
  const ziDone = $derived.by(() => { const s = new Set<string>(); for (const k in S.weights) if (k.startsWith('Z:') || k.startsWith('W:')) s.add(k); return s.size })
  const ziTotal = $derived(ZI.length + 30)
  const detStreak = $derived.by(() => {
    let mx = 0
    for (const k in S.weights) if (k.startsWith('M:') && S.weights[k].streak > mx) mx = S.weights[k].streak
    return mx
  })
  const weakPairs = $derived.by(() => {
    const bad = new Set<string>()
    for (const p of PAIRS) { const w = S.weights[p.a + '|' + p.b]; if (w && w.w > 1) bad.add(p.a + '|' + p.b) }
    return bad.size
  })

  /* 今日轻总结（hist 日期戳「9月30日 10:39」） */
  const today = $derived.by(() => {
    const td = todayStr()
    const isToday = (dstr: string) => {
      const m = dstr.match(/^(\d+)月(\d+)日/)
      if (!m) return false
      const d = new Date(); d.setMonth(+m[1] - 1); d.setDate(+m[2])
      return todayStr(d) === td
    }
    const th = S.hist.filter((h) => isToday(h.d))
    const score = th.reduce((a, h) => a + h.sc, 0)
    const total = th.length * 10
    return { n: th.length, acc: total ? Math.round((score / total) * 100) : 0 }
  })
</script>

<section id="v-pracetab" class="view on" data-screen="practice">
  <div id="greet">
    <div class="g1"><ruby>练习场<rt>liàn xí chǎng</rt></ruby></div>
    <div class="g2" id="todaysum">
      {#if today.n}今天已经练了 {today.n * 10} 题{#if today.acc} · 正确率 {today.acc}%{/if}{:else}今天还没练，挑一个开始吧{/if}
    </div>
  </div>

  <div id="pgrid">
    <button class="mode m-teal pressable" data-go="levels" onclick={() => show('levels')}>
      <div class="mbadge">第 {curLv} 关</div>
      <div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L4 6v14l5-2 6 2 5-2V4l-5 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg></div>
      <div class="mname"><ruby>闯关冒险<rt>chuǎng guān mào xiǎn</rt></ruby></div>
      <div class="mdesc">一关一关，闯到大师关</div>
    </button>

    <button class="mode m-blue pressable" data-go="bolt" onclick={() => startBolt(false)}>
      <div class="mbadge">{#if boltBest}最佳 {boltBest}%{:else}5 分钟{/if}</div>
      <div class="mic"><svg viewBox="0 0 24 24" fill="#fff"><path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2z" /></svg></div>
      <div class="mname"><ruby>闪电刷题<rt>shǎn diàn shuā tí</rt></ruby></div>
      <div class="mdesc">5 分钟冲刺 · 听写二选一</div>
    </button>

    <button class="mode m-green pressable" data-go="zi" onclick={() => startZi()}>
      <div class="mbadge">{ziDone} / {ziTotal} 字</div>
      <div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z" /><path d="M4 18a2.5 2.5 0 012.5-2.5H20" /></svg></div>
      <div class="mname"><ruby>常见字快拼<rt>cháng jiàn zì kuài pīn</rt></ruby></div>
      <div class="mdesc">一年级识字表 · 看字选拼音</div>
    </button>

    <button class="mode m-pink pressable" data-go="detect" onclick={() => startDet()}>
      <div class="mbadge">连对 {detStreak}</div>
      <div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></svg></div>
      <div class="mname"><ruby>正反小侦探<rt>zhèng fǎn xiǎo zhēn tàn</rt></ruby></div>
      <div class="mdesc">b d p q 写反了吗</div>
    </button>

    <button class="mode m-orange pressable" data-go="pairs" onclick={() => show('pairs')}>
      <div class="mbadge">{#if weakPairs}{weakPairs} 组待加强{:else}14 组{/if}</div>
      <div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="12" r="5.5" /><circle cx="15.5" cy="12" r="5.5" /></svg></div>
      <div class="mname"><ruby>易混对专练<rt>yì hùn duì zhuān liàn</rt></ruby></div>
      <div class="mdesc">混淆搭档 · 逐对击破</div>
    </button>

    <button class="mode m-purple pressable" data-go="free" onclick={() => show('free')}>
      <div class="mbadge">自选字母</div>
      <div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="8.5" cy="8.5" r="1.6" fill="#fff" stroke="none" /><circle cx="15.5" cy="15.5" r="1.6" fill="#fff" stroke="none" /><circle cx="15.5" cy="8.5" r="1.6" fill="#fff" stroke="none" /><circle cx="8.5" cy="15.5" r="1.6" fill="#fff" stroke="none" /></svg></div>
      <div class="mname"><ruby>自由练习<rt>zì yóu liàn xí</rt></ruby></div>
      <div class="mdesc">自己挑字母，想练哪就练哪</div>
    </button>
  </div>
</section>

<style>
  #v-pracetab { padding: 10px 16px 12px; }
  #greet { flex: none; margin-top: 2px; }
  #greet .g1 { font-size: 22px; font-weight: 900; }
  #greet .g2 { font-size: 12px; font-weight: 700; color: var(--animal-text-2); margin-top: 1px; line-height: 1.9; }
  #pgrid { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr 1fr;
    gap: 12px; margin-top: 12px; }
  .mode { border-radius: var(--animal-r-lg); padding: 12px 10px 12px; position: relative; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; box-shadow: var(--animal-shadow); cursor: pointer; overflow: hidden;
    border: none; font-family: inherit; min-height: 0; }
  .mode:active { transform: scale(.97); }
  .mode .mic { width: 54px; height: 54px; border-radius: 18px; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 3px 0 rgba(61,52,40,.14); margin-bottom: 10px; flex: none; }
  .mode .mic svg { width: 28px; height: 28px; }
  .mode .mname { font-size: 17px; font-weight: 900; line-height: 1.75; }
  .mode .mdesc { font-size: 10.5px; font-weight: 700; color: var(--animal-text-2); margin-top: 2px; white-space: nowrap; }
  .mode .mbadge { position: absolute; top: 10px; right: 10px; font-size: 9.5px; font-weight: 900; padding: 4px 9px;
    border-radius: 999px; background: rgba(255,255,255,.85); color: var(--animal-text); box-shadow: 0 1px 4px rgba(61,52,40,.12); }
  .m-teal { background: linear-gradient(160deg, #e6f9f6, #d2f1ec); }
  .m-teal .mic { background: var(--animal-primary); }
  .m-blue { background: linear-gradient(160deg, #e8edff, #dbe3fb); }
  .m-blue .mic { background: #889df0; }
  .m-green { background: linear-gradient(160deg, #e8f5e8, #d9eed9); }
  .m-green .mic { background: var(--animal-success); }
  .m-pink { background: linear-gradient(160deg, #fde4e8, #fbd6dd); }
  .m-pink .mic { background: #f0889f; }
  .m-orange { background: linear-gradient(160deg, #ffefdd, #ffe6c9); }
  .m-orange .mic { background: #f5a35c; }
  .m-purple { background: linear-gradient(160deg, #efe9ff, #e5dbfb); }
  .m-purple .mic { background: #b58cff; }
</style>
