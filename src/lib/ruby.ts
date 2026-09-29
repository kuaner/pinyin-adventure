/* 注音 DSL：'听{tīng}一{yì}听{tīng}' → <ruby>听<rt>tīng</rt></ruby>…
   拉丁字母/emoji/标点原样通过。数据 JSON 里的文案统一带 DSL 标记，渲染时经 T() 转换。 */
export function T(s: string): string {
  return String(s).replace(/([一-鿿])\{([^{}]*)\}/g, (_m, h, p) => `<ruby>${h}<rt>${p}</rt></ruby>`)
}
