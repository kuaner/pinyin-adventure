<script lang="ts">
  /* v2.4 App 壳：底部 tab ×3 常驻（学习/练习/我的），active = 药丸底色 + 主色；
     题内/礼仪页 = 全屏专注态，TabBar 由父级 v-if 移出（打样：translateY(100%) 滑出） */
  import { ui, show, TAB_VIEWS, type View } from '../stores/ui.svelte'
  import Ruby from './Ruby.svelte'

  const TABS: { v: View; label: string; py: string }[] = [
    { v: 'learn', label: '学习', py: 'xué xí' },
    { v: 'practice', label: '练习', py: 'liàn xí' },
    { v: 'mine', label: '我的', py: 'wǒ de' },
  ]
</script>

<nav id="tabbar" data-tabbar>
  {#each TABS as t (t.v)}
    <button class="tab" class:on={ui.view === t.v} data-tab={t.v} onclick={() => show(t.v)} aria-label={t.label}>
      <span class="tic">
        {#if t.v === 'learn'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20v-7" /><path d="M12 13c0-4 2.5-7 7-7 0 4.5-2.5 7-7 7z" /><path d="M12 13c0-3-2-5.5-5.5-5.5 0 3.5 2 5.5 5.5 5.5z" /></svg>
        {:else if t.v === 'practice'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2z" /></svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7.5" /><path d="M9.5 12h.01M14.5 12h.01" stroke-width="3" /><path d="M10.7 15h2.6l-1.3 1.8z" fill="currentColor" stroke="none" /><path d="M5 8.5C4 5.5 5.5 3.5 8 3c.3 1.6 1.2 2.8 2.5 3.5M19 8.5c1-3-.5-5-3-5.5-.3 1.6-1.2 2.8-2.5 3.5" /></svg>
        {/if}
      </span>
      <span class="tl"><Ruby text={t.label} py={{ [t.label]: t.py }} /></span>
    </button>
  {/each}
</nav>
<style>
  #tabbar { position: absolute; left: 0; right: 0; bottom: 0; height: 84px; z-index: 50; display: flex;
    background: rgba(255,255,254,.92); backdrop-filter: blur(8px); border-top: 1px solid var(--animal-border-light);
    padding: 8px 10px calc(env(safe-area-inset-bottom) + 14px); transition: transform .22s ease; }
  .tab { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
    border: none; background: none; font-family: inherit; color: var(--animal-text-2); cursor: pointer; border-radius: 16px; }
  .tab svg { width: 25px; height: 25px; }
  .tab .tl { font-size: 12px; font-weight: 800; position: relative; }
  .tab .tl :global(rt) { font-size: 8px; font-weight: 700; letter-spacing: .5px; }
  .tab.on { color: var(--animal-primary-active); }
  .tab.on .tic { background: var(--animal-primary-bg); }
  .tic { width: 46px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 999px;
    transition: background .15s; }
</style>
