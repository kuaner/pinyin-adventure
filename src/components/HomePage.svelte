<script lang="ts">
  /* 首页：八个模式入口 + 🔊 音频自检（家长） */
  import { show } from '../stores/ui.svelte'
  import { startDet, startZi } from '../stores/session.svelte'
  import { startBolt } from '../stores/bolt.svelte'
  import { totalStars } from '../stores/progress.svelte'
  import { renderFlash } from '../stores/flash.svelte'
  import { soundDiag } from '../lib/audio'
</script>

<section id="v-home" class="view on">
  <button class="diagbtn" id="diagbtn" type="button" onclick={soundDiag}>🔊</button>
  <div class="hero-emoji">🐣</div>
  <div class="appname"><ruby>拼<rt>pīn</rt></ruby><ruby>音<rt>yīn</rt></ruby><ruby>闯<rt>chuǎng</rt></ruby><ruby>关<rt>guān</rt></ruby><ruby>大<rt>dà</rt></ruby><ruby>冒<rt>mào</rt></ruby><ruby>险<rt>xiǎn</rt></ruby></div>
  <div class="subtitle"><ruby>跟<rt>gēn</rt></ruby><ruby>小<rt>xiǎo</rt></ruby><ruby>鸡<rt>jī</rt></ruby><ruby>一<rt>yì</rt></ruby><ruby>起<rt>qǐ</rt></ruby><ruby>学<rt>xué</rt></ruby><ruby>拼<rt>pīn</rt></ruby><ruby>音<rt>yīn</rt></ruby> · <ruby>专<rt>zhuān</rt></ruby><ruby>治<rt>zhì</rt></ruby> b d <ruby>分<rt>fēn</rt></ruby><ruby>不<rt>bù</rt></ruby><ruby>清<rt>qīng</rt></ruby></div>
  <div class="starsline" id="homestars"><ruby>星<rt>xīng</rt></ruby><ruby>星<rt>xīng</rt></ruby>：{totalStars()} <ruby>颗<rt>kē</rt></ruby></div>
  <div class="menu">
    <button class="btn" data-go="levels" onclick={() => show('levels')}>🚩 <ruby>闯<rt>chuǎng</rt></ruby><ruby>关<rt>guān</rt></ruby><ruby>冒<rt>mào</rt></ruby><ruby>险<rt>xiǎn</rt></ruby></button>
    <button class="btn teal" data-go="detect" onclick={startDet}>🔍 <ruby>正<rt>zhèng</rt></ruby><ruby>反<rt>fǎn</rt></ruby><ruby>小<rt>xiǎo</rt></ruby><ruby>侦<rt>zhēn</rt></ruby><ruby>探<rt>tàn</rt></ruby></button>
    <button class="btn red" data-go="bolt" style="flex-direction:column;gap:1px;min-height:80px" onclick={() => startBolt(false)}><span>⚡ <ruby>闪<rt>shǎn</rt></ruby><ruby>电<rt>diàn</rt></ruby><ruby>刷<rt>shuā</rt></ruby><ruby>题<rt>tí</rt></ruby></span><span style="font-size:15px;font-weight:700;opacity:.92;line-height:1.8">5<ruby>分<rt>fēn</rt></ruby><ruby>钟<rt>zhōng</rt></ruby><ruby>冲<rt>chōng</rt></ruby><ruby>刺<rt>cì</rt></ruby> · <ruby>正<rt>zhèng</rt></ruby><ruby>确<rt>què</rt></ruby><ruby>率<rt>lǜ</rt></ruby><ruby>冲<rt>chōng</rt></ruby>95%</span></button>
    <button class="btn pink" data-go="zi" style="flex-direction:column;gap:1px;min-height:80px" onclick={startZi}><span>📖 <ruby>常<rt>cháng</rt></ruby><ruby>见<rt>jiàn</rt></ruby><ruby>字<rt>zì</rt></ruby><ruby>快<rt>kuài</rt></ruby><ruby>拼<rt>pīn</rt></ruby></span><span style="font-size:15px;font-weight:700;opacity:.92;line-height:1.8"><ruby>一<rt>yī</rt></ruby><ruby>年<rt>nián</rt></ruby><ruby>级<rt>jí</rt></ruby><ruby>字<rt>zì</rt></ruby><ruby>表<rt>biǎo</rt></ruby> · <ruby>看<rt>kàn</rt></ruby><ruby>字<rt>zì</rt></ruby><ruby>选<rt>xuǎn</rt></ruby><ruby>拼<rt>pīn</rt></ruby><ruby>音<rt>yīn</rt></ruby></span></button>
    <button class="btn purple" data-go="pairs" onclick={() => show('pairs')}>⚔️ <ruby>易<rt>yì</rt></ruby><ruby>混<rt>hùn</rt></ruby><ruby>对<rt>duì</rt></ruby><ruby>专<rt>zhuān</rt></ruby><ruby>练<rt>liàn</rt></ruby></button>
    <button class="btn blue" data-go="flash" onclick={() => { renderFlash(); show('flash') }}>🃏 <ruby>闪<rt>shǎn</rt></ruby><ruby>卡<rt>kǎ</rt></ruby><ruby>复<rt>fù</rt></ruby><ruby>习<rt>xí</rt></ruby></button>
    <button class="btn green" data-go="practice" onclick={() => show('practice')}>🎯 <ruby>自<rt>zì</rt></ruby><ruby>由<rt>yóu</rt></ruby><ruby>练<rt>liàn</rt></ruby><ruby>习<rt>xí</rt></ruby></button>
    <button class="btn ghost" data-go="history" onclick={() => show('history')}>📜 <ruby>历<rt>lì</rt></ruby><ruby>史<rt>shǐ</rt></ruby><ruby>成<rt>chéng</rt></ruby><ruby>绩<rt>jì</rt></ruby></button>
  </div>
  <div class="foot">全部数据保存在本机 · 无需联网 · 家长点右上 🔊 可自检音频</div>
</section>
