<script lang="ts">
  /* v3.2 成就徽章墙（spec 要素5）：≥10 枚（已得=彩底+图标+名；未得=灰剪影+条件说明）。
     解锁瞬间=toast（store grantBadge）+ 新得徽章弹跳（本会话新得记 CSS 动画 class）。 */
  import { G, BADGE_DEFS } from '../../stores/growth.svelte'
  import { t } from '../../text/strings'
  import Icon from '../Icon.svelte'

  /* 本会话新得徽章 → 弹跳一次（挂载时已有的徽章不跳；untrack 挂载基线） */
  const fresh = $state<Record<string, boolean>>({})
  let known: string[] = []
  $effect(() => {
    const cur = G.badges
    if (!known.length) { known = [...cur]; return }   /* 首跑记基线：存量徽章不弹 */
    for (const id of cur) if (!known.includes(id)) { fresh[id] = true; known = [...cur] }
  })
</script>

<div class="card" id="badgewall" data-badgewall style="margin-top: 6px">
  <div class="sec-label">
    <b>{t('badgeTitle')}</b>
    <span class="cnt">{t('badgeOfN', { a: G.badges.length, b: BADGE_DEFS.length })}</span>
  </div>
  <div class="bgrid">
    {#each BADGE_DEFS as b (b.id)}
      {@const got = G.badges.includes(b.id)}
      <div class="bd" class:got data-badge={b.id}>
        <div class="bic" class:bounce={got && fresh[b.id]} style:background={got ? b.bg : '#f4f0e4'}>
          <Icon name={b.icon} size={22} />
        </div>
        <i>{got ? t(b.name) : t(b.cond)}</i>
      </div>
    {/each}
  </div>
</div>

<style>
  #badgewall { padding: var(--sp-2) var(--sp-3); flex: none; }
  .sec-label { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-2); }
  .sec-label b { font-size: var(--fs-xs); color: var(--animal-text-2); }
  .cnt { font-size: var(--fs-xs); font-weight: 900; color: #c77800; background: #fff8e0;
    border-radius: 999px; padding: 2px 9px; }
  .bgrid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px var(--sp-1); }
  .bd { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; }
  .bic { width: 30px; height: 30px; border-radius: 50%; background: #f4f0e4; display: flex;
    align-items: center; justify-content: center; }
  .bd:not(.got) .bic { filter: grayscale(1); opacity: .32; }
  .bd:not(.got) .bic :global(svg) { opacity: .9; }
  .bd .bic :global(svg) { width: 18px; height: 18px; }
  .bd i { font-style: normal; font-size: 10px; font-weight: 800; color: var(--animal-text-2);
    line-height: 1.25; text-align: center; max-width: 100%;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .bd.got i { color: var(--animal-text); }
  .bic.bounce { animation: bw-bounce .7s cubic-bezier(.25,1.5,.4,1) 2; }
  @keyframes bw-bounce {
    0%, 100% { transform: scale(1); }
    35% { transform: scale(1.28) rotate(-6deg); }
    70% { transform: scale(.92) rotate(4deg); }
  }
  @media (prefers-reduced-motion: reduce) { .bic.bounce { animation: none; } }
</style>
