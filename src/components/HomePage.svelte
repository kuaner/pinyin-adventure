<script lang="ts">
  /* 首页：八个模式入口 + 🔊 音频自检（家长）。v2.1：emoji→naive-icons，手写 ruby→<Ruby> 纯文本自动注音 */
  import { show } from '../stores/ui.svelte'
  import { startDet, startZi } from '../stores/session.svelte'
  import { startBolt } from '../stores/bolt.svelte'
  import { totalStars } from '../stores/progress.svelte'
  import { renderFlash } from '../stores/flash.svelte'
  import { soundDiag } from '../lib/audio'
  import Ruby from './Ruby.svelte'
  import Icon from './Icon.svelte'
</script>

<section id="v-home" class="view on">
  <button class="diagbtn" id="diagbtn" type="button" onclick={soundDiag} aria-label="音频自检"><Icon name="headphones" size={26} /></button>
  <div class="hero-emoji"><Icon name="bird" size={64} /></div>
  <div class="appname"><Ruby text="拼音闯关大冒险" /></div>
  <div class="subtitle"><Ruby text="跟小鸡一起学拼音 · 专治 b d 分不清" /></div>
  <div class="starsline" id="homestars"><Ruby text="星星" />：{totalStars()} <Ruby text="颗" /></div>
  <div class="menu">
    <button class="btn green" data-go="learn" style="flex-direction:column;gap:1px;min-height:80px" onclick={() => show('learn')}>
      <span><Icon name="bulb" size={26} /> <Ruby text="学习岛" /></span>
      <span style="font-size:15px;font-weight:700;opacity:.92;line-height:1.8"><Ruby text="零基础课程 · 一个脚印一个脚印学" /></span>
    </button>
    <button class="btn" data-go="levels" onclick={() => show('levels')}><Icon name="flag" size={26} /> <Ruby text="闯关冒险" /></button>
    <button class="btn teal" data-go="detect" onclick={startDet}><Icon name="search" size={26} /> <Ruby text="正反小侦探" /></button>
    <button class="btn red" data-go="bolt" style="flex-direction:column;gap:1px;min-height:80px" onclick={() => startBolt(false)}>
      <span><Icon name="rocket" size={26} /> <Ruby text="闪电刷题" /></span>
      <span style="font-size:15px;font-weight:700;opacity:.92;line-height:1.8"><Ruby text="5分钟冲刺 · 正确率冲" />95%</span>
    </button>
    <button class="btn pink" data-go="zi" style="flex-direction:column;gap:1px;min-height:80px" onclick={startZi}>
      <span><Icon name="book" size={26} /> <Ruby text="常见字快拼" /></span>
      <span style="font-size:15px;font-weight:700;opacity:.92;line-height:1.8"><Ruby text="一年级字表 · 看字选拼音" /></span>
    </button>
    <button class="btn purple" data-go="pairs" onclick={() => show('pairs')}><Icon name="bee" size={26} /> <Ruby text="易混对专练" /></button>
    <button class="btn blue" data-go="flash" onclick={() => { renderFlash(); show('flash') }}><Icon name="bookmark" size={26} /> <Ruby text="闪卡复习" /></button>
    <button class="btn green" data-go="practice" onclick={() => show('practice')}><Icon name="dumbbell" size={26} /> <Ruby text="自由练习" /></button>
    <button class="btn ghost" data-go="history" onclick={() => show('history')}><Icon name="file" size={26} /> <Ruby text="历史成绩" /></button>
  </div>
  <div class="foot">全部数据保存在本机 · 无需联网 · 家长点右上 <Icon name="headphones" size={14} /> 可自检音频</div>
</section>
