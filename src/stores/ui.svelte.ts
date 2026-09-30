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
  lessonLi: 0,    /* 题内初始字母下标（Bug#12：hero 卡选中的字母带入课内，不再永远从第一个字母起） */
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

export function openLesson(n: number, li = 0) {
  ui.lessonN = n
  ui.lessonLi = Math.max(0, li)
  show('lesson')
}

export function toast(msg: string) {
  /* 统一走 T()——T 自己判断：系统消息（src/text/strings.ts 的 SYS_KEYS 集）不加注音，
     学习内容加注音。注音决策在 T 组件层，不在调用点（kuaner：注音朗读维护在一个组件） */
  ui.toastMsg = T(msg)
  ui.toastOn = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { ui.toastOn = false }, 2600)
}

export function openPair(pi: number) { ui.pairIdx = pi }
export function closePair() { ui.pairIdx = -1 }
