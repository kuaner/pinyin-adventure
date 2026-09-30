<script lang="ts">
  /* 结算页：星星结算 + 解锁提示 + 最易混项 + 三按钮（下一关/再玩一次/回主页） */
  import { QZ, startLevel, startDet, startZi, newSession } from '../stores/session.svelte'
  import { show } from '../stores/ui.svelte'
  import { buildQuestions } from '../lib/quizEngine'
  import { t, type StringKey } from '../text/strings'
  import Speak from './Speak.svelte'
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
  <div id="rtitle">{#if r}<Speak k={({ 3: 'perfect', 2: 'great', 1: 'cleared' } as Record<string, StringKey>)[r.stars] ?? 'retry'} />{/if}</div>
  <div id="rscore"><Speak k="correctOfN" vars={{ n: r?.sc ?? 0 }} />{#if r && !r.lvNo}{#if cfg?.det}<Speak k="detNoStar" />{:else if cfg?.zi}<Speak k="ziNoStar" />{:else}<Speak k="pracNoStar" />{/if}{/if}</div>
  <div id="rworst" style="display:{r?.wlabel ? 'inline-block' : 'none'}">{#if r?.wlabel}<Speak text={(cfg?.zi ? t('worstZi') : t('worstPairs')) + r.wlabel + t('willPracticeMore')} />{/if}</div>
  <div id="runlock">{#if r?.unlockMsg}<Speak text={r.unlockMsg} />{/if}</div>
  <div class="rbtns">
    <button class="btn" id="rnext" style="display:{r && r.lvNo && r.stars >= 1 && r.lvNo < 9 ? 'flex' : 'none'}" onclick={() => r?.lvNo && startLevel(r.lvNo + 1)}><Speak k="nextLevel" plain /> <Icon name="arrow-right" size={20} /></button>
    <button class="btn blue" id="ragain" onclick={again}><Icon name="refresh" size={20} /> <Speak k="playAgain" plain /></button>
    <button class="btn ghost" id="rhome" onclick={() => show('practice')}><Speak k="backPractice" plain /></button>
  </div>
</section>
