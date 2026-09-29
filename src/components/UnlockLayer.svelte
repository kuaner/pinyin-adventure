<script lang="ts">
  /* 声音解锁层（首触解锁 = 播 welcome.mp3，iOS 音频解锁） */
  import { ui } from '../stores/ui.svelte'
  import { ac, preloadAudios, playAudio } from '../lib/audio'

  let fading = $state(false)

  function unlockAudio() {
    ac()                                   /* ① AudioContext 在手势内创建/恢复（反馈音用） */
    preloadAudios()                        /* ② 预载 10 条高频音频 */
    playAudio('welcome', { hint: '🔊 欢迎语音缺失（audio/welcome.mp3）' }) /* ③ 手势内播 mp3 → iOS 解锁音频 */
    fading = true
    setTimeout(() => { ui.unlockOn = false; fading = false }, 250)
  }
</script>

{#if ui.unlockOn}
  <div id="unlock" class="on" style={fading ? 'transition:opacity .25s;opacity:0' : ''}>
    <div class="ulcard">
      <div class="ulemoji">🐣</div>
      <div class="ultitle"><ruby>拼<rt>pīn</rt></ruby><ruby>音<rt>yīn</rt></ruby><ruby>闯<rt>chuǎng</rt></ruby><ruby>关<rt>guān</rt></ruby><ruby>大<rt>dà</rt></ruby><ruby>冒<rt>mào</rt></ruby><ruby>险<rt>xiǎn</rt></ruby></div>
      <button class="btn green" id="ulgo" type="button" onclick={unlockAudio}>🔊 <ruby>点<rt>diǎn</rt></ruby><ruby>一<rt>yí</rt></ruby><ruby>下<rt>xià</rt></ruby>，<ruby>开<rt>kāi</rt></ruby><ruby>启<rt>qǐ</rt></ruby><ruby>声<rt>shēng</rt></ruby><ruby>音<rt>yīn</rt></ruby></button>
      <div class="ulsub"><ruby>听<rt>tīng</rt></ruby><ruby>一<rt>yì</rt></ruby><ruby>听<rt>tīng</rt></ruby>、<ruby>读<rt>dú</rt></ruby><ruby>一<rt>yì</rt></ruby><ruby>读<rt>dú</rt></ruby>，<ruby>学<rt>xué</rt></ruby><ruby>拼<rt>pīn</rt></ruby><ruby>音<rt>yīn</rt></ruby><ruby>更<rt>gèng</rt></ruby><ruby>轻<rt>qīng</rt></ruby><ruby>松<rt>sōng</rt></ruby>！</div>
      <div class="ulnote">若手机设为静音，请先取消静音</div>
    </div>
  </div>
{/if}
