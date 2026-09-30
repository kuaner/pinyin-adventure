<script lang="ts">
  /* v2.6 Speak：Ruby 升级版（kuaner 文案层+全点击语音架构）——注音渲染 + 有音频则整段可点击播放
     （轻按压反馈 + 小声波纹动效）；无音频 = 纯注音展示。语音零自动，播放只由点击触发（声音礼仪 R2）。
     <Speak k="continueLearning" />              文案层 key（strings.ts 唯一真相）
     <Speak k="lessonN" vars={{ n: 3 }} />       带占位（模板含 {x} 无配音，纯渲染）
     <Speak text={data.hint} />                  数据层动态文案（zh 反查 audio-manifest.json）
     <Speak text={x} py={{ 长得: 'zhǎng de' }} /> Ruby 原语义（多音字逃生口）
     plain：纯注音渲染不点击（父级按钮已管播放的标签，避免双触发） */
  import { T } from '../lib/ruby'
  import { tDef, type StringKey } from '../text/strings'
  import { manifest, zhAudio } from '../text/manifest'
  import { playAudio } from '../lib/audio'

  let {
    k, vars, text, py, plain = false, class: cls = '',
  }: {
    k?: StringKey; vars?: Record<string, string | number>
    text?: string; py?: Record<string, string>
    plain?: boolean; class?: string
  } = $props()

  const def = $derived(k ? tDef(k, vars) : undefined)
  const zh = $derived(def ? def.zh : (text ?? ''))
  const pyMap = $derived(py ?? def?.py)
  const file = $derived(
    plain || !zh ? '' : (k ? manifest[k] || '' : '') || zhAudio[zh] || '',
  )

  function tap() { if (file) playAudio(file, { hint: '' }) }
  function key(e: KeyboardEvent) { if (file && e.key === 'Enter') tap() }
</script>

<span
  class="speak {cls}"
  class:canplay={!!file}
  role={file ? 'button' : undefined}
  tabindex={file ? 0 : undefined}
  aria-label={file ? zh : undefined}
  onclick={file ? tap : undefined}
  onkeydown={file ? key : undefined}
>{@html T(zh, pyMap)}{#if file}<svg class="sico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.6L12.4 19V5L7.6 9.5H4z" fill="currentColor" /><path d="M15.5 8.6a5 5 0 010 6.8M18 6.2a8.4 8.4 0 010 11.6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" /></svg>{/if}</span>

<style>
  .speak { border-radius: 6px; }
  .speak.canplay { cursor: pointer; transition: transform .12s ease; -webkit-tap-highlight-color: transparent; }
  .speak.canplay:active { transform: scale(.93); }
  /* 可点播示能：小喇叭图标（BUGS#22①——原三根 2.5px 竖条静态下形似省略号"…"，
     kuaner 读作"文字未超宽仍显示截断符"；换喇叭图标后示能语义不变、不可能再误读） */
  .sico { width: .72em; height: .72em; margin-left: .32em; vertical-align: -.06em;
    opacity: .5; pointer-events: none; }
</style>
