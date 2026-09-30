<script lang="ts">
  /* v2.4 我的 tab（打样屏3）：主角 = 小鸡。形象区（等级+星星+通关）+ 闪卡入口（Leitner 到期数）
     + 本周学习周历条 + 家长区（历史/声音礼仪/设置） */
  import { LETTERS } from '../../data'
  import { S, totalStars, todayStr } from '../../stores/progress.svelte'
  import { L as LRN, quizPassed } from '../../stores/learn.svelte'
  import { renderFlash } from '../../stores/flash.svelte'
  import { show } from '../../stores/ui.svelte'
  import Speak from '../Speak.svelte'
  import { t, WEEK_DAYS } from '../../text/strings'

  /* ---- 派生进度（纯读，不在 derived 内建卡——Svelte 禁 derived 内 mutation） ---- */
  const dueN = $derived.by(() => {
    let n = 0
    for (const k in LETTERS) {
      const rec = S.cards[k]
      if (!rec || !rec.due || rec.due <= todayStr()) n++
    }
    return n
  })
  const passLv = $derived.by(() => { let n = 0; for (let i = 1; i <= 9; i++) if (S.stars[i] >= 1) n++; return n })
  const learnDone = $derived.by(() => { let n = 0; for (let i = 1; i <= 12; i++) if (quizPassed(i)) n++; return n })
  const level = $derived(1 + passLv + learnDone)

  /* ---- 连续学习天数 + 本周（周一~周日）活动 ---- */
  const now = new Date()
  const dow = $derived(now.getDay() === 0 ? 7 : now.getDay())          // 一=1…日=7
  const weekDays = $derived.by(() => {
    const out: { key: string; hit: boolean; isToday: boolean; label: string }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() - (dow - 1) + i)
      const key = todayStr(d)
      out.push({ key, hit: !!S.days[key], isToday: key === todayStr(), label: WEEK_DAYS[i] })
    }
    return out
  })
  const weekHit = $derived(weekDays.filter((d) => d.hit).length)
  const streak = $derived.by(() => {
    let n = 0
    const d = new Date()
    if (!S.days[todayStr(d)]) d.setDate(d.getDate() - 1)   /* 今天还没学不打断连击 */
    while (S.days[todayStr(d)] && n < 365) { n++; d.setDate(d.getDate() - 1) }
    return n
  })

  function goFlash() { renderFlash(); show('flash') }
</script>

<section id="v-minetab" class="view on" data-screen="mine">
  <div class="rowhead">
    <div class="h1"><Speak k="tabMine" /></div>
    <div class="chip"><Speak k="streakDays" vars={{ n: streak }} /></div>
  </div>

  <div id="mascot">
    <div class="blob"></div>
    <svg id="chick" viewBox="0 0 172 168" data-chick>
      <ellipse cx="86" cy="158" rx="50" ry="7" fill="rgba(61,52,40,.10)" />
      <path d="M42 118 L30 138 L54 132 Z" fill="#f5a35c" />
      <path d="M130 118 L142 138 L118 132 Z" fill="#f5a35c" />
      <circle cx="86" cy="88" r="58" fill="#ffd95e" />
      <circle cx="86" cy="88" r="58" fill="none" stroke="#f0b429" stroke-width="3" opacity=".5" />
      <path d="M34 100 q-12 10 -6 24 q16 2 22 -12" fill="#ffd95e" stroke="#f0b429" stroke-width="3" stroke-linecap="round" />
      <circle cx="64" cy="78" r="7.5" fill="#4a3b32" />
      <circle cx="108" cy="78" r="7.5" fill="#4a3b32" />
      <circle cx="66.5" cy="75.5" r="2.6" fill="#fff" />
      <circle cx="110.5" cy="75.5" r="2.6" fill="#fff" />
      <circle cx="51" cy="98" r="7" fill="#ffb3a0" opacity=".8" />
      <circle cx="121" cy="98" r="7" fill="#ffb3a0" opacity=".8" />
      <path d="M78 94 L94 94 L86 106 Z" fill="#f5893c" />
      <path d="M78 94 h16 l-2.5 4 h-11 Z" fill="#e8772a" />
      <path d="M76 26 q-3 -13 4 -18 M86 24 q0 -14 5 -18 M96 26 q4 -11 10 -13" fill="none" stroke="#f0b429" stroke-width="4.5" stroke-linecap="round" />
    </svg>
    <div id="mname"><Speak k="chickName" /> · {level} <Speak k="levelTag" vars={{ n: level }} /></div>
    <div id="mmeta">
      <div class="chip"><svg viewBox="0 0 24 24" fill="#f5c31c" stroke="#dba90e" stroke-width="1.5" stroke-linejoin="round"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z" /></svg><Speak k="starLabel" />&nbsp;{totalStars()}</div>
      <div class="chip"><svg viewBox="0 0 24 24" fill="none" stroke="#19c8b9" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7z" /></svg><Speak k="passLabel" />&nbsp;<Speak k="passCount" vars={{ n: passLv }} /></div>
    </div>
  </div>

  <button class="card pressable" id="flash-entry" data-go="flash" onclick={goFlash}>
    <div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6.5" width="13" height="14" rx="3" fill="#fff" stroke="none" opacity=".35" /><rect x="7" y="3.5" width="14" height="14" rx="3" /><path d="M11 8h6M11 12h4" /></svg></div>
    <div class="ftx">
      <b><Speak k="flashReview" plain /></b>
      <span><Speak k="flashDesc" /></span>
    </div>
    <div class="due"><Speak k="flashDueN" vars={{ n: dueN }} /></div>
  </button>

  <div class="card" id="week">
    <div class="sec-label"><b><Speak k="thisWeek" /></b><span><Speak k="learnedDays" vars={{ a: weekHit }} /></span></div>
    <div id="wrow">
      {#each weekDays as d (d.key)}
        <div class="wday" class:hit={d.hit} class:today={d.isToday}>
          <div class="wc">{#if d.hit}<svg viewBox="0 0 24 24" fill={d.isToday ? '#f5c31c' : '#fff'}><path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.3l-4.8 2.6.9-5.4L4.2 8.7l5.4-.8z" /></svg>{/if}</div>
          <i>{d.label}</i>
        </div>
      {/each}
    </div>
  </div>

  <div id="parent">
    <div class="sec-label"><b>{t('parentZone')}</b></div>
    <button class="prow pressable" data-go="history" onclick={() => show('history')}>
      <div class="pic"><svg viewBox="0 0 24 24" fill="none" stroke="#9f927d" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg></div>
      <b>{t('history')}</b><span class="chev"><svg viewBox="0 0 24 24" fill="none" stroke="#c4b89e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7" /></svg></span>
    </button>
    <button class="prow pressable" data-go="sound" onclick={() => show('sound')}>
      <div class="pic"><svg viewBox="0 0 24 24" fill="none" stroke="#9f927d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z" /><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" opacity=".55" /><path d="M16.5 8.5l5 7M21.5 8.5l-5 7" stroke="#c94444" /></svg></div>
      <b>{t('soundEtiquette')}</b><span class="new">{t('newTag')}</span><span class="chev"><svg viewBox="0 0 24 24" fill="none" stroke="#c4b89e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7" /></svg></span>
    </button>
    <button class="prow pressable" data-go="settings" onclick={() => show('settings')}>
      <div class="pic"><svg viewBox="0 0 24 24" fill="none" stroke="#9f927d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" /></svg></div>
      <b>{t('settings')}</b><span class="chev"><svg viewBox="0 0 24 24" fill="none" stroke="#c4b89e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7" /></svg></span>
    </button>
  </div>
</section>

<style>
  #v-minetab { padding: calc(var(--sat) + 10px) 16px 12px; }
  .rowhead { display: flex; align-items: center; justify-content: space-between; height: 34px; flex: none; }
  .rowhead .h1 { font-size: 21px; font-weight: 900; letter-spacing: .5px; }
  .chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 999px;
    font-size: 12.5px; font-weight: 800; background: #fff; box-shadow: var(--animal-shadow); }
  .chip svg { width: 14px; height: 14px; }

  #mascot { flex: 1; min-height: 0; position: relative; display: flex; flex-direction: column; align-items: center;
    justify-content: flex-end; padding-bottom: 2px; }
  #mascot .blob { position: absolute; width: 240px; height: 150px; border-radius: 48% 52% 55% 45% / 55% 48% 52% 45%;
    background: var(--animal-primary-bg); bottom: 58px; left: 50%; transform: translateX(-50%); }
  #chick { position: relative; z-index: 1; width: 128px; height: 125px; margin-bottom: 2px; }
  #mname { font-size: 16.5px; font-weight: 900; margin-top: 8px; line-height: 1.9; position: relative; z-index: 1; }
  #mmeta { display: flex; gap: 10px; margin-top: 7px; position: relative; z-index: 1; }

  #flash-entry { height: 76px; flex: none; display: flex; align-items: center; gap: 13px; padding: 0 16px; margin-top: 8px;
    border: none; font-family: inherit; width: 100%; cursor: pointer; }
  #flash-entry:active { transform: scale(.98); }
  #flash-entry .fic { width: 48px; height: 48px; border-radius: 15px; background: #b58cff; display: flex;
    align-items: center; justify-content: center; box-shadow: 0 3px 0 #9a5fd4; flex: none; }
  #flash-entry .fic svg { width: 26px; height: 26px; }
  #flash-entry .ftx { flex: 1; text-align: left; min-width: 0; }
  #flash-entry .ftx b { font-size: 16.5px; font-weight: 900; line-height: 1.9; display: block; }
  #flash-entry .ftx span { display: block; font-size: 11px; font-weight: 700; color: var(--animal-text-2); }
  #flash-entry .ftx span :global(rt) { font-size: 8px; }
  #flash-entry .due { font-size: 15px; font-weight: 900; color: #9a5fd4; background: #efe9ff; padding: 8px 12px; border-radius: 14px; flex: none; }

  #week { margin-top: 12px; padding: 12px 16px 13px; flex: none; }
  #week .sec-label { margin-bottom: 10px; }
  #wrow { display: flex; justify-content: space-between; }
  .wday { display: flex; flex-direction: column; align-items: center; gap: 5px; }
  .wday i { font-style: normal; font-size: 10.5px; font-weight: 800; color: var(--animal-text-2); }
  .wday .wc { width: 32px; height: 32px; border-radius: 50%; background: #f4f0e4; display: flex; align-items: center; justify-content: center; }
  .wday.hit .wc { background: var(--animal-primary); }
  .wday.hit .wc svg { width: 15px; height: 15px; }
  .wday.today .wc { box-shadow: 0 0 0 2.5px var(--animal-warning); background: #fff; }

  #parent { margin-top: 10px; flex: none; }
  #parent .sec-label { margin-bottom: 2px; }
  #parent .sec-label b { font-size: 12px; color: var(--animal-text-2); }
  .prow { display: flex; align-items: center; gap: 10px; padding: 8px 4px; border-bottom: 1px solid var(--animal-border-light);
    background: none; border-radius: 0; box-shadow: none; width: 100%; border-left: none; border-right: none; border-top: none;
    font-family: inherit; cursor: pointer; }
  .prow:last-child { border-bottom: none; }
  .prow .pic { width: 30px; height: 30px; border-radius: 10px; background: #f4f0e4; display: flex; align-items: center; justify-content: center; flex: none; }
  .prow .pic svg { width: 16px; height: 16px; }
  .prow b { flex: 1; font-size: 13.5px; font-weight: 800; text-align: left; }
  .prow .new { font-size: 9px; font-weight: 900; color: #fff; background: var(--animal-error); border-radius: 999px; padding: 2px 7px; }
  .prow .chev { display: inline-flex; }
  .prow .chev svg { width: 14px; height: 14px; }
</style>
