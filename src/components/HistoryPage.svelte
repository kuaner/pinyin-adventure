<script lang="ts">
  /* 历史成绩（家长向表格，行内容不注音） */
  import { S, save } from '../stores/progress.svelte'
  import { show } from '../stores/ui.svelte'
  import { T } from '../lib/ruby'
</script>

<section id="v-history" class="view on">
  <div class="topbar">
    <button class="backbtn" data-back="home" onclick={() => show('home')}>‹</button>
    <h2><ruby>历<rt>lì</rt></ruby><ruby>史<rt>shǐ</rt></ruby><ruby>成<rt>chéng</rt></ruby><ruby>绩<rt>jì</rt></ruby></h2>
  </div>
  <div id="histlist">
    {#if S.hist.length === 0}
      <div class="hempty">{@html T('还{hái}没{méi}有{yǒu}记{jì}录{lù}，快{kuài}去{qù}闯{chuǎng}关{guān}吧{ba}！')}</div>
    {:else}
      {#each S.hist as r (r.d + r.lv + r.sc)}
        <div class="hitem">
          <div class="ht">{r.d}</div>
          <div class="hl">{@html r.lv}</div>
          <div class="hs">{r.st >= 0 ? '⭐'.repeat(r.st) + ' ' : ''}{r.sc}分</div>
          {#if r.wp}<div class="hs" style="color:#C77B1E">{r.wp}</div>{/if}
        </div>
      {/each}
    {/if}
  </div>
  <button class="btn ghost small" id="hclear" style="margin-top:8px" onclick={() => {
    if (confirm('只清空历史成绩，保留闯关进度和星星，确定吗？')) { S.hist = []; save(S) }
  }}>{@html T('清{qīng}空{kōng}记{jì}录{lù}')}</button>
</section>
