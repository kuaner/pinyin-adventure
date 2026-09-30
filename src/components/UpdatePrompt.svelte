<script lang="ts">
  /* PWA 更新提示条（v2.3，照 bambu-nfc UpdatePrompt 模式）：
     registerSW onNeedRefresh → 小鸡举牌"有新版本啦！" → 点击 updateSW()（skipWaiting+reload）。
     兜底：visibilitychange 回前台时 reg.update() 主动查新（加桌面后长期不刷新的场景）。 */
  import { onMount } from 'svelte'
  import Speak from './Speak.svelte'
  import Icon from './Icon.svelte'

  let needUpdate = $state(false)
  let updateSW: (() => Promise<void>) | null = null

  onMount(() => {
    if (!('serviceWorker' in navigator)) return
    import('virtual:pwa-register').then(({ registerSW }) => {
      updateSW = registerSW({
        onNeedRefresh() {
          needUpdate = true
        },
      })
    })
    /* 回前台主动查新：新 SW 装好进入 waiting 后 workbox 回调 onNeedRefresh */
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => {}))
    })
  })

  let reloading = $state(false)
  function handleUpdate() {
    /* Bug#11+Bug#16：reload 必须等新 SW 完全激活（预缓存做完）再刷——
       controllerchange 触发时 SW 刚接管但预缓存可能未完，立刻 reload 会白屏；
       修=等 navigator.serviceWorker.ready 确认新 SW ready 再 reload */
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      navigator.serviceWorker.ready.then(() => {
        window.location.reload()
      }).catch(() => { window.location.reload() })
    })
    updateSW?.().catch(() => {})
    /* 兜底放宽到 3s，给预缓存足够时间 */
    setTimeout(() => {
      if (!reloading) { reloading = true; window.location.reload() }
    }, 3000)
  }
</script>

{#if needUpdate}
  <div class="updwrap" data-update="on">
    <div class="updbar">
      <div class="updchick"><Icon name="bird" size={30} /></div>
      <div class="updboard">
        <div class="updtitle"><Speak k="newVersion" /></div>
        <div class="upddesc"><Speak k="chickUpdate" /></div>
      </div>
      <button class="updgo" type="button" data-update-go onclick={handleUpdate}>
        <Icon name="refresh" size={18} /> <Speak k="update" plain />
      </button>
    </div>
  </div>
{/if}

<style>
  .updwrap { position: fixed; left: 0; right: 0; bottom: 0; z-index: 200; padding: 0 14px calc(env(safe-area-inset-bottom) + 14px);
    pointer-events: none; display: flex; justify-content: center; }
  .updbar { pointer-events: auto; width: min(100%, 400px); background: #fff; border: 2.5px solid #eee4d3; border-radius: 20px;
    box-shadow: 0 5px 0 #e3d9c8; padding: 12px 14px; display: flex; align-items: center; gap: 12px;
    animation: updin .4s cubic-bezier(.2, 1.4, .4, 1); }
  @keyframes updin { 0% { transform: translateY(80px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
  .updchick { flex: 0 0 52px; height: 52px; border-radius: 50%; background: #e6f7f2; display: flex; align-items: center;
    justify-content: center; animation: bob 2.4s ease-in-out infinite; }
  .updboard { flex: 1; min-width: 0; }
  .updtitle { font-size: 19px; font-weight: 900; color: #264653; line-height: 1.8; }
  .upddesc { font-size: 14px; font-weight: 700; color: #8a7a68; line-height: 1.8; }
  .updgo { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; border: none; cursor: pointer;
    background: #2A9D8F; color: #fff; font-family: inherit; font-size: 17px; font-weight: 900;
    border-radius: 50px; padding: 11px 20px; box-shadow: 0 4px 0 #129d8f; }
  .updgo:active { transform: translateY(3px); box-shadow: 0 1px 0 #129d8f; }
</style>
