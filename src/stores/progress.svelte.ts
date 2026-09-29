/* 进度 store：星星/历史/闪卡盒/闪电纪录（localStorage pinyin_v2 持久化） */
import { loadS, save, todayStr, type AppData, type CardRec, type HistEntry } from '../lib/storage'

export const S: AppData = $state(loadS())

export { save, todayStr }

export function totalStars(): number {
  let t = 0
  for (let i = 1; i <= 9; i++) t += S.stars[i] || 0
  return t
}

export function passed(n: number): boolean {
  return (S.stars[n] || 0) >= 1
}

export function levelUnlocked(n: number): boolean {
  if (n === 1) return true
  if (n === 9) {
    for (let i = 1; i <= 8; i++) { if (!passed(i)) return false }
    return true
  }
  return passed(n - 1)
}

export function addHist(e: HistEntry) {
  S.hist.unshift(e)
  if (S.hist.length > 30) S.hist.length = 30
  save(S)
}

export function cardRec(k: string): CardRec {
  if (!S.cards[k]) S.cards[k] = { box: 1, due: '' }
  return S.cards[k]
}

export function dueToday(rec: CardRec): boolean {
  if (!rec.due) return true
  return rec.due <= todayStr()
}
