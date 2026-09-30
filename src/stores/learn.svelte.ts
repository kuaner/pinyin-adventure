/* 学习岛进度 store：12 课顺序解锁 + 小测 4/5 门槛 + 星图（localStorage pinyin_learn，独立于 pinyin_v2） */
import { markDay } from './progress.svelte'

const KEY = 'pinyin_learn'

export interface LearnData {
  u: number                     /* 已解锁到第几课（1 起） */
  stars: Record<string, number> /* 课号 → 星（5对=3星，4对=2星） */
  best: Record<string, number>  /* 课号 → 小测最好成绩 */
  step: Record<string, number>  /* 课号 → 五步断点（学习 tab「继续学习 · 步名」） */
}

function load(): LearnData {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '')
    if (o && typeof o === 'object')
      return { u: o.u || 1, stars: o.stars || {}, best: o.best || {}, step: o.step || {} }
  } catch { /* ignore */ }
  return { u: 1, stars: {}, best: {}, step: {} }
}

export const L: LearnData = $state(load())

export function saveLearn() {
  try { localStorage.setItem(KEY, JSON.stringify({ u: L.u, stars: L.stars, best: L.best, step: L.step })) } catch { /* ignore */ }
}

/* 记录五步断点（断点续学 CTA 文案用） */
export function setStep(n: number, s: number) {
  if ((L.step[n] || 1) !== s) { L.step[n] = s; saveLearn() }
}

export function lessonUnlocked(n: number): boolean { return n <= L.u }

export function quizPassed(n: number): boolean { return (L.stars[n] || 0) > 0 }

/* 当前应学的课：第一个未通过的可解锁课 */
export function currentLesson(totalLessons: number): number {
  for (let i = 1; i <= totalLessons; i++) if (!quizPassed(i)) return i
  return totalLessons
}

/* 小测结算：>=4 解锁下一课并记星；返回是否通过 */
export function submitQuiz(n: number, score: number, totalLessons: number): boolean {
  if (score > (L.best[n] || 0)) L.best[n] = score
  markDay()
  if (score >= 4) {
    const st = score >= 5 ? 3 : 2
    if (st > (L.stars[n] || 0)) L.stars[n] = st
    if (L.u < n + 1 && n + 1 <= totalLessons) L.u = n + 1
    saveLearn()
    return true
  }
  saveLearn()
  return false
}

export function learnDoneCount(): number { return Object.keys(L.stars).length }
export function learnStarSum(): number { let t = 0; for (const k in L.stars) t += L.stars[k]; return t }

/* 课目短名（学习 tab 课程胶囊/题内标题）：拉丁开头的课（L10）直接用原文名，不注音 */
const SHORT: Record<number, { zh: string; py: string }> = {
  1: { zh: '单韵母', py: 'dān yùn mǔ' }, 2: { zh: '单韵母', py: 'dān yùn mǔ' },
  3: { zh: '声母', py: 'shēng mǔ' }, 4: { zh: '声母', py: 'shēng mǔ' },
  5: { zh: '声母', py: 'shēng mǔ' }, 6: { zh: '声母', py: 'shēng mǔ' },
  7: { zh: '声母', py: 'shēng mǔ' }, 8: { zh: '声母', py: 'shēng mǔ' },
  9: { zh: '复韵母', py: 'fù yùn mǔ' },
  11: { zh: '后鼻韵母', py: 'hòu bí yùn mǔ' },
  12: { zh: '整体认读', py: 'zhěng tǐ rèn dú' },
}
export function lessonShort(n: number, title: string): { zh?: string; py?: string; raw: string } {
  const s = SHORT[n]
  if (s) return { zh: s.zh, py: s.py, raw: s.zh }
  const first = title.split(/\s/)[0] || title
  return { raw: first }
}
