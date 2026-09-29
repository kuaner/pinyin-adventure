<script lang="ts">
  /* 历史成绩（家长向表格，行内容不注音） */
  import { S, save } from '../stores/progress.svelte'
  import { show } from '../stores/ui.svelte'
  import { T } from '../lib/ruby'
  import Ruby from './Ruby.svelte'
  import Icon from './Icon.svelte'
</script>

<section id="v-history" class="view on">
  <div class="topbar">
    <button class="backbtn" data-back="home" onclick={() => show('home')}>‹</button>
    <h2><Ruby text="历史成绩" /></h2>
  </div>
  <div id="histlist">
    {#if S.hist.length === 0}
      <div class="hempty">{@html T('还没有记录，快去闯关吧！')}</div>
    {:else}
      {#each S.hist as r (r.d + r.lv + r.sc)}
        <div class="hitem">
          <div class="ht">{r.d}</div>
          <div class="hl">{@html r.lv}</div>
          <div class="hs">{#if r.st >= 0}{#each Array(r.st)}<Icon name="star" size={16} />{/each} {/if}{r.sc}分</div>
          {#if r.wp}<div class="hs" style="color:#C77B1E">{r.wp}</div>{/if}
        </div>
      {/each}
    {/if}
  </div>
  <button class="btn ghost small" id="hclear" style="margin-top:8px" onclick={() => {
    if (confirm('只清空历史成绩，保留闯关进度和星星，确定吗？')) { S.hist = []; save(S) }
  }}>{@html T('清空记录')}</button>
</section>
