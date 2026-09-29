<script lang="ts">
  /* 自由练习：声母/韵母/整体认读/全部大混战 */
  import { PH } from '../data'
  import { startPractice } from '../stores/session.svelte'
  import { show } from '../stores/ui.svelte'
  import { T } from '../lib/ruby'
</script>

<section id="v-practice" class="view on">
  <div class="topbar">
    <button class="backbtn" data-back="home" onclick={() => show('home')}>‹</button>
    <h2><ruby>自<rt>zì</rt></ruby><ruby>由<rt>yóu</rt></ruby><ruby>练<rt>liàn</rt></ruby><ruby>习<rt>xí</rt></ruby></h2>
  </div>
  <div id="pgroups2" style="display:flex;flex-direction:column;gap:11px">
    {#each PH.practice as it (it.kind)}
      <button
        class="btn {it.kind === 'all' ? 'purple' : 'blue'}"
        style="flex-direction:column;gap:1px;min-height:78px"
        onclick={() => startPractice(it.kind)}
      >
        <span>{@html T(it.btn)}</span>
        <span style="font-size:15px;font-weight:700;opacity:.92;line-height:1.8">{@html T(it.desc)}</span>
      </button>
    {/each}
  </div>
</section>
