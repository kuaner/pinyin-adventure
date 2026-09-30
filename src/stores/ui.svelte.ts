/* UI 全局状态：v2.4 App 壳路由 + toast + 探针横幅 + 辨析卡弹窗
   壳 = 底部 tab ×3（learn/practice/mine，TabBar 常驻）；其余视图 = 全屏专注态（TabBar 隐藏） */
import { T } from '../lib/ruby'

export type View =
  | 'learn' | 'practice' | 'mine'                       /* 三个 tab */
  | 'lesson' | 'levels' | 'quiz' | 'result' | 'flash' | 'pairs' | 'free'
  | 'history' | 'bolt' | 'sound' | 'settings' | 'radio' /* 专注态 */

export const TAB_VIEWS: View[] = ['learn', 'practice', 'mine']

export const ui = $state({
  view: 'learn' as View,
  lessonN: 1,     /* 题内课号（?learn=N 深链 / 学习 tab CTA 直达） */
  toastMsg: '',
  toastOn: false,
  probeText: '',
  probeOn: false,
  pairIdx: -1,   // 辨析卡弹窗（-1 关闭）
})

let toastTimer: ReturnType<typeof setTimeout> | null = null

export function show(v: View) {
  ui.view = v
  window.scrollTo(0, 0)
}

export function openLesson(n: number) {
  ui.lessonN = n
  show('lesson')
}

export function toast(msg: string, opts: { plain?: boolean } = {}) {
  /* plain=系统状态消息不加注音（Bug#14 架构修复：toast 管道区分学习文本 vs 系统文本） */
  ui.toastMsg = opts.plain ? msg : T(msg)
  ui.toastOn = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { ui.toastOn = false }, 2600)
}

export function openPair(pi: number) { ui.pairIdx = pi }
export function closePair() { ui.pairIdx = -1 }
