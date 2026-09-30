<script lang="ts">
  /* 关卡地图：8 关顺序解锁 + 毕业关（1-8 全通解锁） */
  import { LEVELS } from '../data'
  import { S, levelUnlocked } from '../stores/progress.svelte'
  import { startLevel } from '../stores/session.svelte'
  import { show, toast } from '../stores/ui.svelte'
  import { T } from '../lib/ruby'
  import Ruby from './Ruby.svelte'
  import Icon from './Icon.svelte'
</script>

<section id="v-levels" class="view on">
  <div class="topbar">
    <button class="backbtn" data-back="home" onclick={() => show('home')}>‹</button>
    <h2><Ruby text="选择关卡" /></h2>
  </div>
  <div id="lvgrid">
    {#each LEVELS as L (L.n)}
      {@const st = S.stars[L.n] || 0}
      {@const un = levelUnlocked(L.n)}
      <button
        class={'lvlcard' + (un ? '' : ' locked') + (L.boss ? ' boss' : '')}
        id="lv-{L.n}"
        onclick={() => un ? startLevel(L.n) : toast(T('先通过上一关才能解锁哦！'))}
      >
        <div class="lvnum">{#if un}<Icon name={L.icon} size={32} />{:else}<Icon name="lock" size={30} />{/if}</div>
        <div class="lvinfo">
          <div class="lvname">{@html T('第')}{L.n}{@html T('关')} · {@html T(L.name)}{L.boss ? ' <span class="bosstag">' + T('毕业') + '</span>' : ''}</div>
          <div class="lvsub">{@html T(L.sub)}</div>
        </div>
        <div class="lvstars">{#each Array(st) as _, i}<Icon name="star" size={19} />{/each}{#each Array(3 - st) as _, i}<span class="starempty"><Icon name="star-empty" size={19} /></span>{/each}</div>
      </button>
    {/each}
  </div>
</section>
