/* 自适应权重 store：错×2 封顶 8 / 连对 2 次衰减；正反小侦探 70/30 先验（kuaner 第6步优化）
   —— 孩子越混什么，越常练什么 */
import { S, save } from './progress.svelte'
import { DETSET, COREDET, PAIRS } from '../data'
import type { QuizScope } from '../lib/types'

export function getW(k: string): number {
  const r = S.weights[k]
  return r ? r.w : 1
}

export function markResult(k: string, ok: boolean) {
  let r = S.weights[k]
  if (!r) { r = S.weights[k] = { w: 1, streak: 0 } }
  if (!ok) {
    r.w = Math.min(r.w * 2, 8)
    r.streak = 0
  } else {
    r.streak++
    if (r.streak >= 2) {
      r.w = Math.max(1, Math.floor(r.w / 2))
      r.streak = 0
    }
  }
  save(S)
}

export interface WItem { k: string; w: number }

export function wpick(items: WItem[]): WItem {
  let tot = 0
  for (const it of items) tot += it.w
  let r = Math.random() * tot
  for (const it of items) {
    r -= it.w
    if (r <= 0) return it
  }
  return items[items.length - 1]
}

/* 易混对在关卡里的抽样权重：hot 高压 ×3（如 n|l）；毕业关镜像组 ×2 */
export function pairW(k: string, level: QuizScope | null): number {
  let w = getW(k)
  const pi = PAIRS.findIndex((p) => p.a + '|' + p.b === k)
  if (pi >= 0) {
    if (level && level.hot && level.hot.indexOf(k) >= 0) w *= 3
    if (level && level.boss && PAIRS[pi].grp === 'mirror') w *= 2
  }
  return w
}

/* 正反小侦探字母抽样：核心混淆组（b d p q t f）基数 5 ≈70%，外围基数 1 ≈30%，
   叠加自适应权重（M: 前缀），同字母不连续出现 */
export function pickDet(used: string[]): string {
  const items: WItem[] = DETSET.map((k) => ({
    k,
    w: Math.max(1, getW('M:' + k)) * (COREDET.indexOf(k) >= 0 ? 5 : 1),
  }))
  const n = used.length
  let c = ''
  for (let t = 0; t < 12; t++) {
    c = wpick(items).k
    if (!(n >= 1 && used[n - 1] === c)) return c
  }
  return c
}
