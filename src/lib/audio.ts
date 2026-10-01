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

/* ---------- v3.2 庆祝音（WebAudio 合成，非语音；静音总开关 tone() 内自检） ---------- */
/* 小测过关：叮咚上行琶音（C5-E5-G5-C6-E6） */
export function sndFanfare() {
  tone(523, 0, 0.12, 'triangle', 0.14)
  tone(659, 0.1, 0.12, 'triangle', 0.14)
  tone(784, 0.2, 0.12, 'triangle', 0.14)
  tone(1046, 0.3, 0.28, 'triangle', 0.16)
  tone(1319, 0.42, 0.34, 'sine', 0.12)
}
/* 字母学完（迷你庆祝）：三音小上行 */
export function sndMini() { tone(659, 0, 0.09); tone(880, 0.09, 0.09); tone(1175, 0.18, 0.22) }
/* 进化：加速上行 + 高音亮相 */
export function sndEvolve() {
  tone(392, 0, 0.1, 'triangle', 0.13)
  tone(523, 0.09, 0.1, 'triangle', 0.13)
  tone(659, 0.18, 0.1, 'triangle', 0.13)
  tone(784, 0.27, 0.1, 'triangle', 0.14)
  tone(1046, 0.36, 0.16, 'triangle', 0.15)
  tone(1319, 0.52, 0.42, 'sine', 0.15)
}
/* 毕业典礼：号角式长琶音（两段上行 + 长尾音） */
export function sndGrad() {
  tone(523, 0, 0.14, 'triangle', 0.14)
  tone(659, 0.12, 0.14, 'triangle', 0.14)
  tone(784, 0.24, 0.14, 'triangle', 0.14)
  tone(1046, 0.36, 0.14, 'triangle', 0.15)
  tone(784, 0.52, 0.12, 'triangle', 0.13)
  tone(1046, 0.64, 0.12, 'triangle', 0.13)
  tone(1319, 0.76, 0.5, 'triangle', 0.16)
  tone(1568, 0.98, 0.7, 'sine', 0.12)
}

/* ---------- 第二层：mp3 播放器（缺文件 → 文字兜底，绝不走设备 TTS） ---------- */
export const AUDIO_CACHE: Record<string, HTMLAudioElement> = {}

export function letterAudio(k: string): string {
  /* ü 系复韵母的呼读音在 hyp 库用 ASCII 安全名（v/vn/ve，硬约束#2） */
  if (k === 'ü') return 'v'
  if (k === 'ün') return 'vn'
  if (k === 'üe') return 've'
  return k
}

export function audioURL(name: string): string {
  const h = HYP[name]
  /* BUGS#23 顺带修：audio-manifest.json 的值自带 .mp3 后缀（ui/step-tone.mp3），
     无条件追加曾拼出 .mp3.mp3 → 服务器 SPA fallback 回 HTML（200 但非音频）→ UI 短语点播全哑 */
  const n = name.replace(/\.mp3$/, '')
  return import.meta.env.BASE_URL + 'audio/' + (h ? 'hyp/' + h : n) + '.mp3'
}

export interface PlayOpts { hint?: string; onerror?: () => void; onend?: () => void; nobreak?: boolean }

function playMimo(name: string, opts: PlayOpts): HTMLAudioElement | null {
  /* hyp 播放失败 → 回落现有 mimo 同名文件（audio/{name}.mp3，只回落一次） */
  try {
    const m = new Audio(audioURL(name))
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
    markAudio(name)
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

/* v4.1 声音先行·开局解锁：在开局点击（点摊位/开始）的手势调用栈内统一解锁一次——
   AudioContext resume + 媒体元素 sticky activation；此后 3-2-1 倒计时结束的 setTimeout
   链里自动播目标音合法（用户已与页面交互）。静音/失败静默，绝不阻塞开局。 */
let UNLOCKED = false
export function unlockMedia() {
  if (UNLOCKED) { ac(); return }
  try {
    const a = new Audio()
    a.muted = true
    const p = a.play()
    if (p && p.catch) p.catch(() => { /* 无声源被拒无妨——sticky activation 已随点击建立 */ })
  } catch { /* ignore */ }
  ac()
  UNLOCKED = true
}

/* 口诀朗读音频（v4.1 镜像对决/每日挑战 bkj 题自动读音用）：audio/lessons/kj_{k}.mp3，63 条全覆盖 */
export function kjAudio(k: string): string {
  return 'lessons/kj_' + letterAudio(k)
}

/* 验收钩子：脚本预置 window.__AUDIO_LOG=[] 时记录每次播音事件（play() 发起时刻），
   供时序断言（声音先于元素）。正常使用零开销（未预置=跳过） */
function markAudio(name: string) {
  try {
    const L = (window as any).__AUDIO_LOG
    if (Array.isArray(L)) L.push({ name, t: performance.now() })
  } catch { /* ignore */ }
}

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

/* ---------- BUGS#23 智能预载：进课时并行预取本课音频集 ----------
   根因：GitHub Pages 冷请求延迟 ~1.2s（4KB 文件也要等网络往返），SW CacheFirst 只帮第二次。
   修法：进课即 fetch → 直接写入 SW 的运行时缓存 pinyin-audio（vite.config.ts runtimeCaching 同名），
   后续 playAudio 的 Audio 请求 = CacheFirst 命中，首次点击即播零网络等待。
   直接 Cache API 写入比等 SW active 更确定（首访 SW 还在安装时预载照样生效）。
   Promise.allSettled 语义：单条失败静默、绝不阻塞页面渲染；重复调用按名字幂等跳过。 */
const PRELOADED = new Set<string>()
/* 与 vite.config.ts workbox runtimeCaching.cacheName 同源——改名时两处同步 */
const AUDIO_SW_CACHE = 'pinyin-audio'

async function preloadOne(name: string): Promise<void> {
  const url = audioURL(name)
  /* ① 元素预热：按 preloadAudios 同款把 Audio 元素灌进 AUDIO_CACHE——首次点击不再新建/装载，
     play() 直接命中已就绪元素（cache.put 只暖 SW 缓存时，首播仍要 ~150ms 媒体管线开销，实测 177ms） */
  if (!AUDIO_CACHE[name]) {
    try {
      const el = new Audio(url)
      el.preload = 'auto'
      el.load()
      AUDIO_CACHE[name] = el
    } catch { /* ignore */ }
  }
  /* ② Cache API 直写 SW 运行时缓存（CacheFirst 的读取源）——元素被浏览器回收后重载也零网络 */
  if (typeof caches !== 'undefined' && caches.open) {
    const cache = await caches.open(AUDIO_SW_CACHE)
    if (await cache.match(url)) return
    const resp = await fetch(url)
    if (resp.ok) await cache.put(url, resp)
    else throw new Error(String(resp.status))
  } else {
    /* 无 Cache API 的环境退回纯 fetch（至少暖 HTTP 缓存） */
    const r = await fetch(url)
    if (!r.ok) throw new Error(String(r.status))
  }
}

export function preloadAudioList(names: string[]): Promise<PromiseSettledResult<void>[]> {
  const jobs: Promise<void>[] = []
  for (const n of names) {
    if (!n || PRELOADED.has(n)) continue
    PRELOADED.add(n)
    jobs.push(preloadOne(n))
  }
  return Promise.allSettled(jobs)
}
