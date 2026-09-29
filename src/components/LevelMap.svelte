<script lang="ts">
  /* 关卡地图：8 关顺序解锁 + 毕业关（1-8 全通解锁） */
  import { LEVELS } from '../data'
  import { S, levelUnlocked } from '../stores/progress.svelte'
  import { startLevel } from '../stores/session.svelte'
  import { show, toast } from '../stores/ui.svelte'
  import { T } from '../lib/ruby'
</script>

<section id="v-levels" class="view on">
  <div class="topbar">
    <button class="backbtn" data-back="home" onclick={() => show('home')}>‹</button>
    <h2><ruby>选<rt>xuǎn</rt></ruby><ruby>择<rt>zé</rt></ruby><ruby>关<rt>guān</rt></ruby><ruby>卡<rt>kǎ</rt></ruby></h2>
  </div>
  <div id="lvgrid">
    {#each LEVELS as L (L.n)}
      {@const st = S.stars[L.n] || 0}
      {@const un = levelUnlocked(L.n)}
      <button
        class={'lvlcard' + (un ? '' : ' locked') + (L.boss ? ' boss' : '')}
        id="lv-{L.n}"
        onclick={() => un ? startLevel(L.n) : toast(T('先{xiān}通{tōng}过{guò}上{shàng}一{yí}关{guān}才{cái}能{néng}解{jiě}锁{suǒ}哦{ó}！'))}
      >
        <div class="lvnum">{un ? L.em : '🔒'}</div>
        <div class="lvinfo">
          <div class="lvname">{@html T('第{dì}')}{L.n}{@html T('关{guān}')} · {@html T(L.name)}{L.boss ? ' <span class="bosstag">' + T('毕{bì}业{yè}') + '</span>' : ''}</div>
          <div class="lvsub">{@html T(L.sub)}</div>
        </div>
        <div class="lvstars">{'⭐'.repeat(st)}{'☆'.repeat(3 - st)}</div>
      </button>
    {/each}
  </div>
</section>
