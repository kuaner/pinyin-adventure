<script lang="ts">
  /* 历史成绩（家长向表格，行内容不注音）+ 学习岛课程进度 */
  import { S, save } from '../stores/progress.svelte'
  import { show } from '../stores/ui.svelte'
  import { T } from '../lib/ruby'
  import { L as LRN } from '../stores/learn.svelte'
  import lessonsData from '../data/lessons.json'
  import Ruby from './Ruby.svelte'
  import Icon from './Icon.svelte'

  const LESSONS = (lessonsData as any).lessons as { n: number; label: string }[]
</script>

<section id="v-history" class="view on">
  <div class="topbar">
    <button class="backbtn" data-back="home" onclick={() => show('home')}>‹</button>
    <h2><Ruby text="历史成绩" /></h2>
  </div>
  <div class="learnprog">
    <div class="lptitle">🌱 学习岛课程进度（第 {LRN.u} 课已解锁）</div>
    <div class="lpmap">
      {#each LESSONS as ls (ls.n)}
        <div class="lpcell" class:done={(LRN.stars[ls.n] || 0) > 0} class:lock={ls.n > LRN.u}>
          <span class="lpn">{ls.n}</span>
          <span class="lpl">{ls.label}</span>
          <span class="lps">{#if LRN.stars[ls.n]}⭐{LRN.stars[ls.n]}{:else if ls.n > LRN.u}🔒{:else}▶{/if}</span>
        </div>
      {/each}
    </div>
    <button class="btn teal small" style="margin-top:8px" onclick={() => show('learn')}>去学习岛</button>
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

<style>
  .learnprog { background: #fff; border: 2px solid #eee4d3; border-radius: 18px; padding: 12px 14px; margin-bottom: 14px; }
  .lptitle { font-size: 15px; font-weight: 800; color: #264653; margin-bottom: 8px; }
  .lpmap { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .lpcell { border: 1.5px solid #eee4d3; border-radius: 10px; padding: 5px 4px; text-align: center;
    font-size: 12px; font-weight: 700; color: #8a7a68; display: flex; flex-direction: column; gap: 2px; }
  .lpcell.done { border-color: #bfe8df; background: #e6f7f2; color: #1f7a68; }
  .lpcell.lock { opacity: .5; }
  .lpn { font-size: 11px; color: #b7ab97; }
  .lpl { font-size: 13px; }
  .lps { font-size: 12px; }
</style>
