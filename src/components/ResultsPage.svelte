<script lang="ts">
  /* 结算页：星星结算 + 解锁提示 + 最易混项 + 三按钮（下一关/再玩一次/回主页） */
  import { QZ, startLevel, startDet, startZi, newSession } from '../stores/session.svelte'
  import { show } from '../stores/ui.svelte'
  import { buildQuestions } from '../lib/quizEngine'
  import { T } from '../lib/ruby'
  import Icon from './Icon.svelte'

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
  <div id="rstars"><span class={'rstar' + (r && r.stars >= 1 ? ' on' : '')}><Icon name="star" size={60} /></span><span class={'rstar' + (r && r.stars >= 2 ? ' on' : '')}><Icon name="star" size={60} /></span><span class={'rstar' + (r && r.stars >= 3 ? ' on' : '')}><Icon name="star" size={60} /></span></div>
  <div id="rtitle">{@html r ? (r.stars === 3 ? T('完美通关！') : r.stars === 2 ? T('太棒了！') : r.stars === 1 ? T('通关啦！') : T('再挑战一次吧！')) : ''}</div>
  <div id="rscore">{@html T('答对 ')}{r?.sc ?? 0} / 10 {@html T('题')}{@html r && !r.lvNo ? (cfg?.det ? T(' · 侦探模式不计星星') : (cfg?.zi ? T(' · 快拼模式不计星星') : T(' · 练习模式不计星星'))) : ''}</div>
  <div id="rworst" style="display:{r?.wlabel ? 'inline-block' : 'none'}">{@html r?.wlabel ? ((cfg?.zi ? T('最容易错的字：') : T('最容易混：')) + r.wlabel + T('，下次会多练它啦')) : ''}</div>
  <div id="runlock">{@html r?.unlockMsg ?? ''}</div>
  <div class="rbtns">
    <button class="btn" id="rnext" style="display:{r && r.lvNo && r.stars >= 1 && r.lvNo < 9 ? 'flex' : 'none'}" onclick={() => r?.lvNo && startLevel(r.lvNo + 1)}>{@html T('下一关')} ➜</button>
    <button class="btn blue" id="ragain" onclick={again}>🔄 {@html T('再玩一次')}</button>
    <button class="btn ghost" id="rhome" onclick={() => show('home')}>{@html T('回主页')}</button>
  </div>
</section>
