/* 单测全局环境补齐：jsdom 没有真实媒体播放与滚动，全部静默 stub。
   单测只验逻辑与 DOM，不验真实发声（声音本体是预生成 mp3，属 e2e 面）。
   AudioContext 不 stub —— audio.ts 内部 try/catch 兜底（jsdom 无 AudioContext → 静默降级），正好走产品同款降级路径。 */

// 媒体播放：jsdom 的 play() 是 "not implemented"（报错+拒绝 promise），静默化
window.HTMLMediaElement.prototype.play = () => Promise.resolve()
window.HTMLMediaElement.prototype.pause = () => {}

// 视图切换 show() 里的滚动
window.scrollTo = () => {}

/* Node ≥26 的实验性全局 localStorage/sessionStorage（无 --localstorage-file 时值为 undefined）
   会触发 vitest getWindowKeys 的跳过规则（'localStorage' in global → 不拷贝 jsdom 的实现），
   结果全局 storage 恒为 undefined。从 vitest 暴露的 global.jsdom（真 jsdom 实例）取回真 Storage。 */
const jsdomWin = (globalThis as any).jsdom?.window as Window | undefined
if (jsdomWin) {
  for (const k of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, k, { value: (jsdomWin as any)[k], configurable: true, writable: true })
  }
}
