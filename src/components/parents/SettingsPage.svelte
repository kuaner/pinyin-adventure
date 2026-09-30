<script lang="ts">
  /* 设置页（v2.4 家长区）：R4 静音总开关在这里 —— 孩子界面不显示此状态。家长向文本不注音 */
  import { S, save } from '../../stores/progress.svelte'
  import { stopAll } from '../../lib/audio'
  import { show } from '../../stores/ui.svelte'
  import { t } from '../../text/strings'

  function toggleMute() {
    S.mute = !S.mute
    if (S.mute) stopAll()
    save(S)
  }
</script>

<section id="v-settings" class="view on" data-screen="settings">
  <div class="ltop">
    <button class="cbtn" data-back="mine" onclick={() => show('mine')} aria-label="返回"><svg viewBox="0 0 24 24" fill="none" stroke="#794f27" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5L7.5 12l7 7" /></svg></button>
    <div class="ltt">{t('settingsTitle')}</div>
    <div style="width:38px;flex:none"></div>
  </div>

  <div class="card setcard">
    <div class="setrow">
      <div class="stx"><b>{t('muteMode')}</b><span>{t('muteDesc')}</span></div>
      <button class="switch" class:on={S.mute} id="mutesw" onclick={toggleMute} aria-label="mute">
        <i></i>
      </button>
    </div>
  </div>

  <div class="card setcard">
    <div class="setrow col">
      <div class="stx"><b>{t('aboutData')}</b><span>{t('dataDesc')}</span></div>
    </div>
    <div class="setrow col" style="border-bottom:none">
      <div class="stx"><b>{t('soundSource')}</b><span>{t('soundSourceDesc')}</span></div>
    </div>
  </div>

  <div class="ver">{t('verLine')}</div>
</section>

<div class="verrow">版本 {__APP_VERSION__} · Powered by openduo.ai</div>


<style>
.verrow { text-align: center; font-size: 13px; color: #9f927d; padding: 18px 0 6px; font-weight: 700; }
  #v-settings { padding: calc(var(--sat) + 10px) 16px 14px; }
  .ltop { display: flex; align-items: center; gap: 10px; height: 44px; flex: none; margin-bottom: 10px; }
  .cbtn { width: 38px; height: 38px; border-radius: 50%; background: #fff; box-shadow: var(--animal-shadow); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .cbtn svg { width: 18px; height: 18px; }
  .ltt { flex: 1; text-align: center; font-size: 16px; font-weight: 900; }
  .setcard { padding: 4px 16px; margin-bottom: 12px; flex: none; }
  .setrow { display: flex; align-items: center; gap: 14px; padding: 13px 0; border-bottom: 1px solid var(--animal-border-light); }
  .setrow.col { flex-direction: column; align-items: flex-start; gap: 2px; }
  .stx { flex: 1; }
  .stx b { font-size: 15px; font-weight: 900; display: block; }
  .stx span { font-size: 12px; font-weight: 700; color: var(--animal-text-2); line-height: 1.6; display: block; margin-top: 2px; }
  .switch { flex: none; width: 54px; height: 32px; border-radius: 999px; background: #e8e2d6; border: none; position: relative;
    cursor: pointer; transition: background .2s; }
  .switch i { position: absolute; top: 3px; left: 3px; width: 26px; height: 26px; border-radius: 50%; background: #fff;
    box-shadow: 0 2px 4px rgba(61,52,40,.2); transition: left .2s; }
  .switch.on { background: var(--animal-primary); }
  .switch.on i { left: 25px; }
  .ver { text-align: center; font-size: 11px; font-weight: 700; color: var(--animal-text-dis); margin-top: 6px; }
</style>
