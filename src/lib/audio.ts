/* 声音两层架构（v5c 终局：纯预生成 mp3，无设备 TTS 层；v2.3 删解锁层与自检：
   AudioContext 在 playAudio/tone 内部 lazy unlock，进 app 直达首页。
   v2.4 声音礼仪：R3 一次一路 —— 单通道锁，新声音触发旧声音立即 stop） */
import { LETTERS, HYP } from '../data'
import { S } from '../stores/progress.svelte'
import { toast } from '../stores/ui.svelte'
import { t } from '../text/strings'

/* ---------- 第一层：AudioContext 触屏解锁 + WebAudio 反馈音 ---------- */
let AC: AudioContext | null = null

export function ac(): AudioContext | null {
  if (!AC) {
    try { AC = new (window.AudioContext || (window as any).webkitAudioContext)() } catch { /* 无 WebAudio */ }
  }
  if (AC && AC.state === 'suspended') { try { AC.resume() } catch { /* ignore */ } }
  return AC
}

/* ---------- R3 单通道：同一时刻只有一路声音 ---------- */
let CUR: HTMLAudioElement | null = null
let OnStop: (() => void) | null = null   /* 当前路的停止回调（口诀连播链等） */

export function stopAll() {
  OnStop = null
  if (CUR) {
    try { CUR.pause() } catch { /* ignore */ }
    CUR = null
  }
}

export function tone(freq: number, delay: number, dur: number, type?: OscillatorType, vol?: number) {
  if (S.mute) return
  if (delay <= 0) stopAll() /* 反馈音也走单通道：叮/嘟打断在播读音 */
  const c = ac()
  if (!c) return
  try {
    const t0 = c.currentTime + delay
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type || 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(vol || 0.16, t0 + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g)
    g.connect(c.destination)
    o.start(t0)
    o.stop(t0 + dur + 0.05)
  } catch { /* ignore */ }
}

export function sndOk() { tone(784, 0, 0.12); tone(1046, 0.1, 0.22) }
export function sndNo() { tone(196, 0, 0.16, 'square', 0.09); tone(147, 0.14, 0.24, 'square', 0.09) }
export function sndStar() { tone(659, 0, 0.1); tone(784, 0.09, 0.1); tone(1046, 0.18, 0.3) }

/* ---------- 第二层：mp3 播放器（缺文件 → 文字兜底，绝不走设备 TTS） ---------- */
export const AUDIO_CACHE: Record<string, HTMLAudioElement> = {}

export function letterAudio(k: string): string {
  return k === 'ü' ? 'v' : (k === 'ün' ? 'vn' : k)
}

export function audioURL(name: string): string {
  const h = HYP[name]
  return import.meta.env.BASE_URL + 'audio/' + (h ? 'hyp/' + h : name) + '.mp3'
}

export interface PlayOpts { hint?: string; onerror?: () => void; onend?: () => void; nobreak?: boolean }

function playMimo(name: string, opts: PlayOpts): HTMLAudioElement | null {
  /* hyp 播放失败 → 回落现有 mimo 同名文件（audio/{name}.mp3，只回落一次） */
  try {
    const m = new Audio(import.meta.env.BASE_URL + 'audio/' + name + '.mp3')
    AUDIO_CACHE[name] = m
    const p = m.play()
    if (p && p.catch) p.catch(() => {
      if (opts.hint) toast(opts.hint)
      if (opts.onerror) opts.onerror()
    })
    if (opts.onend) m.onended = () => { if (opts.onend) opts.onend() }
    return m
  } catch {
    if (opts.hint) toast(opts.hint)
    if (opts.onerror) opts.onerror()
    return null
  }
}

export function playAudio(name: string, opts: PlayOpts = {}): HTMLAudioElement | null {
  if (S.mute) { if (opts.onerror) opts.onerror(); return null }
  if (!opts.nobreak) { stopAll(); OnStop = opts.onend || null }
  ac() /* 首次任意播放即静默解锁 WebAudio（v2.3：解锁层删除后的替代路径） */
  try {
    let a = AUDIO_CACHE[name]
    if (!a) { a = new Audio(audioURL(name)); AUDIO_CACHE[name] = a }
    try { a.currentTime = 0 } catch { /* ignore */ }
    const p = a.play()
    if (p && p.catch) p.catch((err: DOMException) => {
      /* Bug#15: AbortError=被 stopAll 停（一次一路锁的正常操作）≠ 文件缺失；
         NotAllowedError=iOS 手势时序 ≠ 文件缺失——都静默，只对真加载失败弹 toast */
      if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return
      if (HYP[name] && !a.dataset.mimoFb) {
        a.dataset.mimoFb = '1'
        playMimo(name, opts)
      } else {
        if (opts.hint) toast(opts.hint)
        if (opts.onerror) opts.onerror()
      }
    })
    if (opts.onend) a.onended = () => {
      if (CUR === a) { CUR = null; OnStop = null }
      opts.onend!()
    }
    CUR = a
    return a
  } catch {
    if (opts.hint) toast(opts.hint)
    if (opts.onerror) opts.onerror()
    return null
  }
}

/* 当前是否在播（口诀连播 UI 态用） */
export function isPlaying(): boolean { return !!CUR }

export function say(k: string) {
  const L = LETTERS[k]
  if (!L) return
  playAudio(letterAudio(k), { hint: t('fallbackHint', { han: L.han }) })
}

export function preloadAudios() {
  for (const n of ['star', 'duila', 'fanla']) {
    if (!AUDIO_CACHE[n]) {
      try {
        const a = new Audio(audioURL(n))
        a.preload = 'auto'
        a.load()
        AUDIO_CACHE[n] = a
      } catch { /* ignore */ }
    }
  }
}
