<script lang="ts">
  /* v3.2 每日签到+连击（spec 要素4）：本周日历（✓星/空白/今天描边）+ 火焰连击计数。
     数据=S.days（markDay：练习结算/学习岛小测/闪电结算统一记账——学习过任意内容即算签到），连击派生。 */
  import { S } from '../../stores/progress.svelte'
  import { todayStr } from '../../lib/storage'
  import { streakOf } from '../../stores/growth.svelte'
  import { t, WEEK_DAYS } from '../../text/strings'
  import Icon from '../Icon.svelte'

  const now = new Date()
  const dow = now.getDay() === 0 ? 7 : now.getDay()          /* 一=1…日=7 */
  const weekDays = (() => {
    const out: { key: string; hit: boolean; isToday: boolean; label: string }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() - (dow - 1) + i)
      const key = todayStr(d)
      out.push({ key, hit: !!S.days[key], isToday: key === todayStr(), label: WEEK_DAYS[i] })
    }
    return out
  })()
  const hitToday = !!S.days[todayStr()]
  const streak = streakOf()
</script>

<div class="card" id="streakcal" data-streakcal style="margin-top: 6px">
  <div class="sec-label">
    <b>{t('thisWeek')}</b>
    <span class="right">
      {#if hitToday}<span class="ck"><Icon name="check" size={13} />{t('checkinDone')}</span>{/if}
      <span class="flame" data-streak><Icon name="flame" size={14} /> {t('streakDays', { n: streak })}</span>
    </span>
  </div>
  <div id="wrow">
    {#each weekDays as d (d.key)}
      <div class="wday" class:hit={d.hit} class:today={d.isToday}>
        <div class="wc">{#if d.hit}<Icon name="star" size={13} />{/if}</div>
        <i>{d.label}</i>
      </div>
    {/each}
  </div>
</div>

<style>
  #streakcal { padding: var(--sp-2) var(--sp-3); flex: none; }
  .sec-label { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-1); margin-bottom: var(--sp-2); }
  .sec-label b { font-size: var(--fs-xs); color: var(--animal-text-2); flex: none; }
  .right { display: inline-flex; align-items: center; gap: 6px; min-width: 0; white-space: nowrap; }
  .ck { display: inline-flex; align-items: center; gap: 3px; font-size: var(--fs-xs); font-weight: 800;
    color: var(--animal-primary-active); white-space: nowrap; }
  .ck :global(svg) { width: 13px; height: 13px; flex: none; }
  .flame { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-xs); font-weight: 900;
    color: #e2711d; background: #fdeee7; border-radius: 999px; padding: 3px 9px; white-space: nowrap; flex: none; }
  .flame :global(svg) { width: 13px; height: 13px; flex: none; }
  #wrow { display: flex; justify-content: space-between; }
  .wday { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .wday i { font-style: normal; font-size: var(--fs-xs); font-weight: 800; color: var(--animal-text-2); }
  .wday .wc { width: 28px; height: 28px; border-radius: 50%; background: #f4f0e4; display: flex;
    align-items: center; justify-content: center; }
  .wday.hit .wc { background: var(--animal-primary); }
  .wday.hit .wc :global(svg) { width: 13px; height: 13px; }
  .wday.today .wc { box-shadow: 0 0 0 2.5px var(--animal-warning); background: #fff; }
</style>
