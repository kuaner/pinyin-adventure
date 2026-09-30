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
>{@html T(zh, pyMap)}{#if file}<i class="swave" aria-hidden="true"><b></b><b></b><b></b></i>{/if}</span>

<style>
  .speak { border-radius: 6px; }
  .speak.canplay { cursor: pointer; transition: transform .12s ease; -webkit-tap-highlight-color: transparent; }
  .speak.canplay:active { transform: scale(.93); }
  /* 小声波纹：三根跳动的细条，随文字基线，弱存在感 */
  .swave { display: inline-flex; align-items: flex-end; gap: 1.5px; height: .58em; margin-left: .3em;
    vertical-align: baseline; opacity: .5; pointer-events: none; }
  .swave b { width: 2.5px; border-radius: 2px; background: currentColor; transform-origin: bottom;
    animation: swv 1.1s ease-in-out infinite; }
  .swave b:nth-child(1) { height: 46%; }
  .swave b:nth-child(2) { height: 100%; animation-delay: .18s; }
  .swave b:nth-child(3) { height: 68%; animation-delay: .36s; }
  @keyframes swv { 0%, 100% { transform: scaleY(.5); } 50% { transform: scaleY(1); } }
  @media (prefers-reduced-motion: reduce) { .swave b { animation: none; } }
</style>
