<script lang="ts">
  /* 声音解锁层（首触解锁 = 播 welcome.mp3，iOS 音频解锁）。v2.1：emoji→Icon，手写 ruby→Ruby */
  import { ui } from '../stores/ui.svelte'
  import { ac, preloadAudios, playAudio } from '../lib/audio'
  import Ruby from './Ruby.svelte'
  import Icon from './Icon.svelte'

  let fading = $state(false)

  function unlockAudio() {
    ac()                                   /* ① AudioContext 在手势内创建/恢复（反馈音用） */
    preloadAudios()                        /* ② 预载 10 条高频音频 */
    playAudio('welcome', { hint: '欢迎语音缺失（audio/welcome.mp3）' }) /* ③ 手势内播 mp3 → iOS 解锁音频 */
    fading = true
    setTimeout(() => { ui.unlockOn = false; fading = false }, 250)
  }
</script>

{#if ui.unlockOn}
  <div id="unlock" class="on" style={fading ? 'transition:opacity .25s;opacity:0' : ''}>
    <div class="ulcard">
      <div class="ulemoji"><Icon name="bird" size={72} /></div>
      <div class="ultitle"><Ruby text="拼音闯关大冒险" /></div>
      <button class="btn green" id="ulgo" type="button" onclick={unlockAudio}><Icon name="headphones" size={26} /> <Ruby text="点一下，开启声音" /></button>
      <div class="ulsub"><Ruby text="听一听、读一读，学拼音更轻松！" /></div>
      <div class="ulnote">若手机设为静音，请先取消静音</div>
    </div>
  </div>
{/if}
