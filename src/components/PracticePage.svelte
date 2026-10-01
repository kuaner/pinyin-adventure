<script lang="ts">
  /* 自由练习：声母/韵母/整体认读/全部大混战 */
  import { PH } from '../data'
  import { startPractice } from '../stores/session.svelte'
  import { show } from '../stores/ui.svelte'
  import Speak from './Speak.svelte'
  import Icon from './Icon.svelte'
</script>

<section id="v-practice" class="view on">
  <div class="topbar">
    <button class="backbtn" data-back="home" onclick={() => show('practice')}>‹</button>
    <h2><Icon name="dumbbell" size={26} /> <Speak k="freePractice" /></h2>
  </div>
  <!-- v2.8：四卡弹性等分填满内容区（消除底部空白） -->
  <div id="pgroups2" style="display:flex;flex-direction:column;gap:var(--sp-3);flex:1;min-height:0">
    {#each PH.practice as it (it.kind)}
      <button
        class="btn {it.kind === 'all' ? 'purple' : 'blue'}"
        style="flex-direction:column;gap:var(--sp-1);flex:1;min-height:0"
        onclick={() => startPractice(it.kind)}
      >
        <span><Icon name={it.icon} size={22} /> <Speak text={it.btn} plain /></span>
      </button>
    {/each}
  </div>
</section>
