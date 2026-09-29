/* UI 全局状态：视图路由 + toast + 探针横幅 + 辨析卡弹窗 + 解锁层 */
import { T } from '../lib/ruby'

export type View = 'home' | 'levels' | 'quiz' | 'result' | 'flash' | 'pairs' | 'practice' | 'history' | 'bolt'

export const ui = $state({
  view: 'home' as View,
  toastMsg: '',
  toastOn: false,
  probeText: '',
  probeOn: false,
  pairIdx: -1,   // 辨析卡弹窗（-1 关闭）
  unlockOn: true, // 声音解锁层
})

let toastTimer: ReturnType<typeof setTimeout> | null = null

export function show(v: View) {
  ui.view = v
  window.scrollTo(0, 0)
}

export function toast(msg: string) {
  ui.toastMsg = T(msg)
  ui.toastOn = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { ui.toastOn = false }, 2600)
}

export function openPair(pi: number) { ui.pairIdx = pi }
export function closePair() { ui.pairIdx = -1 }
