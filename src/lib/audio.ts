/* 声音三层架构（v5c 终局：纯预生成 mp3，无设备 TTS 层）
   第一层 AudioContext 解锁与反馈音合成；第二层 mp3 播放器；第三层 🔊 自检 */
import { LETTERS, HYP } from '../data'
import { S } from '../stores/progress.svelte'
import { toast } from '../stores/ui.svelte'
import { T } from './ruby'

/* ---------- 第一层：AudioContext 触屏解锁 + WebAudio 反馈音 ---------- */
let AC: AudioContext | null = null

export function ac(): AudioContext | null {
  if (!AC) {
    try { AC = new (window.AudioContext || (window as any).webkitAudioContext)() } catch { /* 无 WebAudio */ }
  }
  if (AC && AC.state === 'suspended') { try { AC.resume() } catch { /* ignore */ } }
  return AC
}

export function tone(freq: number, delay: number, dur: number, type?: OscillatorType, vol?: number) {
  if (S.mute) return
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

export interface PlayOpts { hint?: string; onerror?: () => void; onend?: () => void }

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
  try {
    let a = AUDIO_CACHE[name]
    if (!a) { a = new Audio(audioURL(name)); AUDIO_CACHE[name] = a }
    try { a.currentTime = 0 } catch { /* ignore */ }
    const p = a.play()
    if (p && p.catch) p.catch(() => {
      if (HYP[name] && !a.dataset.mimoFb) {
        a.dataset.mimoFb = '1'
        playMimo(name, opts)
      } else {
        if (opts.hint) toast(opts.hint)
        if (opts.onerror) opts.onerror()
      }
    })
    if (opts.onend) a.onended = () => { if (opts.onend) opts.onend() }
    return a
  } catch {
    if (opts.hint) toast(opts.hint)
    if (opts.onerror) opts.onerror()
    return null
  }
}

export function say(k: string) {
  const L = LETTERS[k]
  if (!L) return
  playAudio(letterAudio(k), { hint: T('语音未准备好 · 读音像「' + L.han + '」') })
}

export function preloadAudios() {
  for (const n of ['welcome', 'right', 'wrong', 'go', 'star', 'levelup', 'next', 'timeout', 'unlock', 'byebye']) {
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

/* ---------- 第三层：🔊 诊断按钮 = 音频自检（依次播 welcome/right 并显示结果） ---------- */
export function soundDiag() {
  toast('🔊 音频自检中…')
  playAudio('welcome', {
    hint: '自检：welcome ✗ 缺失或无法播放（检查 audio/ 目录）',
    onerror() { toast('🔊 音频自检失败：welcome ✗') },
    onend() {
      playAudio('right', {
        hint: '自检：welcome ✓ · right ✗',
        onerror() { toast('🔊 音频自检：welcome ✓ · right ✗ 缺失') },
        onend() { toast('🔊 音频自检通过 ✓ welcome + right 都正常') },
      })
    },
  })
}
