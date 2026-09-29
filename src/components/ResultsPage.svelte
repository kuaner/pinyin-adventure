<script lang="ts">
  /* 结算页：星星结算 + 解锁提示 + 最易混项 + 三按钮（下一关/再玩一次/回主页） */
  import { QZ, startLevel, startDet, startZi, newSession } from '../stores/session.svelte'
  import { show } from '../stores/ui.svelte'
  import { buildQuestions } from '../lib/quizEngine'
  import { T } from '../lib/ruby'

  const r = $derived(QZ.result)
  const cfg = $derived(QZ.cfg)

  function again() {
    const c = cfg
    if (!c) return
    if (c.det) startDet()
    else if (c.zi) startZi()
    else if (c.levelNo) startLevel(c.levelNo)
    else if (c.level) newSession({ name: c.name, level: c.level, pkind: c.pkind, qs: buildQuestions(c.level) })
  }
</script>

<section id="v-result" class="view on">
  <div id="rstars"><span class={'rstar' + (r && r.stars >= 1 ? ' on' : '')}>⭐</span><span class={'rstar' + (r && r.stars >= 2 ? ' on' : '')}>⭐</span><span class={'rstar' + (r && r.stars >= 3 ? ' on' : '')}>⭐</span></div>
  <div id="rtitle">{@html r ? (r.stars === 3 ? T('完{wán}美{měi}通{tōng}关{guān}！') : r.stars === 2 ? T('太{tài}棒{bàng}了{le}！') : r.stars === 1 ? T('通{tōng}关{guān}啦{la}！') : T('再{zài}挑{tiǎo}战{zhàn}一{yí}次{cì}吧{ba}！')) : ''}</div>
  <div id="rscore">{@html T('答{dá}对{duì} ')}{r?.sc ?? 0} / 10 {@html T('题{tí}')}{@html r && !r.lvNo ? (cfg?.det ? T(' · 侦{zhēn}探{tàn}模{mó}式{shì}不{bú}计{jì}星{xīng}星{xīng}') : (cfg?.zi ? T(' · 快{kuài}拼{pīn}模{mó}式{shì}不{bú}计{jì}星{xīng}星{xīng}') : T(' · 练{liàn}习{xí}模{mó}式{shì}不{bú}计{jì}星{xīng}星{xīng}'))) : ''}</div>
  <div id="rworst" style="display:{r?.wlabel ? 'inline-block' : 'none'}">{@html r?.wlabel ? ((cfg?.zi ? T('最{zuì}容{róng}易{yì}错{cuò}的{de}字{zì}：') : T('最{zuì}容{róng}易{yì}混{hùn}：')) + r.wlabel + T('，下{xià}次{cì}会{huì}多{duō}练{liàn}它{tā}啦{la}')) : ''}</div>
  <div id="runlock">{@html r?.unlockMsg ?? ''}</div>
  <div class="rbtns">
    <button class="btn" id="rnext" style="display:{r && r.lvNo && r.stars >= 1 && r.lvNo < 9 ? 'flex' : 'none'}" onclick={() => r?.lvNo && startLevel(r.lvNo + 1)}>{@html T('下{xià}一{yí}关{guān}')} ➜</button>
    <button class="btn blue" id="ragain" onclick={again}>🔄 {@html T('再{zài}玩{wán}一{yí}次{cì}')}</button>
    <button class="btn ghost" id="rhome" onclick={() => show('home')}>{@html T('回{huí}主{zhǔ}页{yè}')}</button>
  </div>
</section>
