<script lang="ts">
  /* v3.2 我的 tab 重构（升级体系）：hero=小鸡成长线（五阶段按成长星星进阶+进化动画）
     + 双入口（闪卡复习/我的卡片）+ 签到连击周历 + 成就徽章墙 + 家长区。
     v2.4 结构保留：一屏一事零纵向滚动（hero flex 吸收剩余高度）。
     成长星星=练习关星+学习岛课星+升级奖励（growth store 汇总迁移，唯一口径）。 */
  import { LETTERS } from '../../data'
  import { S, totalStars, todayStr } from '../../stores/progress.svelte'
  import { quizPassed } from '../../stores/learn.svelte'
  import { G, STAGE_STARS, stageOf, stageNameKey, unlockedCardCount, CARD_KEYS, evolvePending, commitEvolve, celebrateEvolve } from '../../stores/growth.svelte'
  import { renderFlash } from '../../stores/flash.svelte'
  import { show } from '../../stores/ui.svelte'
  import { t } from '../../text/strings'
  import Speak from '../Speak.svelte'
  import ChickGrowth from '../growth/ChickGrowth.svelte'
  import StreakCalendar from '../growth/StreakCalendar.svelte'
  import BadgeWall from '../growth/BadgeWall.svelte'

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

  /* ---- v3.2 成长线 ---- */
  const stage = $derived(stageOf(G.stars))
  const stars = $derived(G.stars)
  const cardN = $derived(unlockedCardCount())
  /* 下一阶段进度条：本档区间内的位置（满级=吃满） */
  const pct = $derived.by(() => {
    if (stage >= 4) return 100
    const lo = STAGE_STARS[stage], hi = STAGE_STARS[stage + 1]
    return Math.max(4, Math.min(100, Math.round(((stars - lo) / (hi - lo)) * 100)))
  })
  const nextNeed = $derived(stage >= 4 ? 0 : STAGE_STARS[stage + 1] - stars)

  /* 进「我的」tab：有未播的进化 → 播放并记账（下次不再重播） */
  $effect(() => {
    const pend = evolvePending()
    if (pend >= 0) { commitEvolve(pend); celebrateEvolve(pend) }
  })

  function goFlash() { renderFlash(); show('flash') }
  function goAlbum() { show('album') }
</script>

<section id="v-minetab" class="view on" data-screen="mine">
  <div class="rowhead">
    <div class="h1"><Speak k="tabMine" /></div>
    <button class="chip" data-go="album" onclick={goAlbum}>
      <svg viewBox="0 0 24 24" fill="none" stroke="#c77800" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3.5" width="16" height="17" rx="3" /><path d="M8.5 9.5h7M8.5 13h4.5" /></svg>
      {t('cardCountN', { a: cardN, b: CARD_KEYS.length })}
    </button>
  </div>

  <!-- v3.2 hero=横排 HUD：小鸡恒定尺寸恒可见（竖排 hero 在小视口会被 flex 压缩到裁切——实测教训），
       左鸡右信息：阶段名·等级 / 成长星星 / 下一阶段进度条 -->
  <div id="hero">
    <div class="blob"></div>
    <div class="herochick" data-chick-stage={stage}><ChickGrowth stage={stage} /></div>
    <div class="hinfo">
      <div id="mname"><Speak k={stageNameKey(stage)} /> · <Speak k="levelTag" vars={{ n: level }} /></div>
      <div class="hstars">
        <span class="starchip"><svg viewBox="0 0 24 24" fill="#f5c31c" stroke="#dba90e" stroke-width="1.5" stroke-linejoin="round"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z" /></svg>{stars}</span>
      </div>
      <div id="mprog" data-stageprog>
        <div class="pbar"><i style="width:{pct}%"></i></div>
        <div class="ptext">
          {#if stage < 4}<Speak k="stageNextN" vars={{ n: nextNeed }} />
          {:else}<Speak k="growthMax" />{/if}
        </div>
      </div>
    </div>
  </div>



  <div id="entries">
    <button class="entry pressable" data-go="flash" onclick={goFlash}>
      <div class="fic purple"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6.5" width="13" height="14" rx="3" fill="#fff" stroke="none" opacity=".35" /><rect x="7" y="3.5" width="14" height="14" rx="3" /><path d="M11 8h6M11 12h4" /></svg></div>
      <div class="ftx">
        <b><Speak k="flashReview" plain /></b>
        <span>{t('flashDueN', { n: dueN })}</span>
      </div>
    </button>
    <button class="entry pressable" data-go="album" onclick={goAlbum}>
      <div class="fic gold"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3.5" width="16" height="17" rx="3" /><path d="M12 8.2l1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z" fill="#fff" stroke="none" /></svg></div>
      <div class="ftx">
        <b><Speak k="myCards" plain /></b>
        <span>{t('cardCountN', { a: cardN, b: CARD_KEYS.length })}</span>
      </div>
    </button>
  </div>

  <StreakCalendar />

  <BadgeWall />

  <div id="parent">
    <div class="prowrow">
      <button class="pbtn pressable" data-go="history" onclick={() => show('history')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#9f927d" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
        <b>{t('history')}</b>
      </button>
      <button class="pbtn pressable" data-go="sound" onclick={() => show('sound')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#9f927d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z" /><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" opacity=".55" /><path d="M16.5 8.5l5 7M21.5 8.5l-5 7" stroke="#c94444" /></svg>
        <b>{t('soundEtiquette')}</b>
      </button>
      <button class="pbtn pressable" data-go="settings" onclick={() => show('settings')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#9f927d" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" /></svg>
        <b>{t('settings')}</b>
      </button>
    </div>
  </div>
</section>

<style>
  #v-minetab { padding: calc(var(--sat) + var(--sp-2)) var(--sp-4) var(--sp-3); }
  .rowhead { display: flex; align-items: center; justify-content: space-between; min-height: 40px; flex: none; }   /* v4.8: 定高→min-height（同 Bug#43③：行盒装得下 ruby 注音，真机顶缘不裁） */
  .rowhead .h1 { font-size:var(--fs-lg); font-weight: 900; letter-spacing: .5px; line-height: 1.7; }
  .chip { display: inline-flex; align-items: center; gap: var(--sp-1); padding: var(--sp-1) var(--sp-2); border-radius: 999px;
    font-size:var(--fs-xs); font-weight: 800; background: #fff; box-shadow: var(--animal-shadow); white-space: nowrap; flex: none;
    border: none; font-family: inherit; cursor: pointer; color: #c77800; }
  .chip svg { width: 14px; height: 14px; }

  /* v3.2 hero（横排 HUD）：小鸡定尺寸恒可见；信息列吃剩余宽度 */
  #hero { flex: none; position: relative; display: flex; align-items: center; gap: var(--sp-2);
    padding: var(--sp-1) var(--sp-1) 0; }
  #hero .blob { position: absolute; width: 190px; height: 128px; border-radius: 48% 52% 55% 45% / 55% 48% 52% 45%;
    background: var(--animal-primary-bg); left: -26px; top: 50%; transform: translateY(-52%); }
  .herochick { position: relative; z-index: 1; flex: none; width: 118px; height: 115px; }
  .herochick :global(svg) { width: 100%; height: 100%; }
  .hinfo { flex: 1; min-width: 0; position: relative; z-index: 1; display: flex; flex-direction: column; gap: 5px; }
  #mname { font-size:var(--fs-md); font-weight: 900; line-height: 1.6;
    max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hstars { display: flex; }
  .starchip { display: inline-flex; align-items: center; gap: 4px; background: #fff; box-shadow: var(--animal-shadow);
    border-radius: 999px; padding: 2px 10px; font-size: var(--fs-xs); font-weight: 900; color: var(--animal-text); }
  .starchip svg { width: 14px; height: 14px; }
  /* v3.2 成长进度条（星星 → 下一阶段） */
  #mprog { position: relative; z-index: 1; flex: none; }
  #mprog .pbar { height: 10px; border-radius: 999px; background: #fff; box-shadow: inset 0 1px 3px rgba(61,52,40,.12); overflow: hidden; }
  #mprog .pbar i { display: block; height: 100%; border-radius: 999px;
    background: linear-gradient(90deg, #f5c31c, #f0a030); transition: width .6s cubic-bezier(.3,.8,.3,1); }
  #mprog .ptext { margin-top: 2px; font-size: var(--fs-xs); font-weight: 800;
    color: var(--animal-text-2); line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* v3.2 双入口行（闪卡复习 / 我的卡片） */
  #entries { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); margin-top: 6px; flex: none; }
  .entry { min-height: 58px; display: flex; align-items: center; gap: var(--sp-2); padding: 6px 8px;
    border: none; font-family: inherit; width: 100%; cursor: pointer; }
  .entry:active { transform: scale(.98); }
  .entry .fic { width: 36px; height: 36px; border-radius: 12px; display: flex;
    align-items: center; justify-content: center; flex: none; }
  .entry .fic.purple { background: #b58cff; box-shadow: 0 3px 0 #9a5fd4; }
  .entry .fic.gold { background: #f0b429; box-shadow: 0 3px 0 #d99a0e; }
  .entry .fic svg { width: 22px; height: 22px; }
  .entry .ftx { flex: 1; text-align: left; min-width: 0; }
  .entry .ftx b { font-size: var(--fs-xs); font-weight: 900; line-height: 1.55; display: block; }
  .entry .ftx span { display: block; font-size: var(--fs-xs); font-weight: 700; color: var(--animal-text-2); line-height: 1.5; }
  .entry .ftx span :global(rt) { font-size:var(--fs-rt); }

  #parent { margin-top: 6px; flex: none; }
  /* v3.2：家长区单行三钮（纵向预算让给成长 hero；无标签行） */
  .prowrow { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2); }
  .pbtn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    padding: var(--sp-2) var(--sp-1); background: #fff; border: none; border-radius: 14px;
    box-shadow: var(--animal-shadow); font-family: inherit; cursor: pointer; min-width: 0; }
  .pbtn svg { width: 17px; height: 17px; }
  .pbtn b { font-size: 11px; font-weight: 800; color: var(--animal-text-2); white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  /* 小屏保险（SE 类矮视口）：hero 小鸡让位 22px，防底部裁切 */
  @media (max-height: 620px) {
    .herochick { width: 96px; height: 93px; }
  }
</style>
