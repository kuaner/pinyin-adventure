/* localStorage 持久化层（键 pinyin_v2，无历史迁移包袱） */

export const KEY = 'pinyin_v2'

export interface WRec { w: number; streak: number }
export interface CardRec { box: number; due: string }
export interface HistEntry { d: string; lv: string; sc: number; st: number; wp: string }
export interface BoltRec { acc: number; d: string; tacc: number; td: string }

export interface AppData {
  weights: Record<string, WRec>
  stars: Record<string, number>
  cards: Record<string, CardRec>
  hist: HistEntry[]
  mute: boolean
  bolt: BoltRec
  days: Record<string, 1>   /* 活动日（YYYY-MM-DD → 1）：我的 tab 周历条 */
}

export function loadS(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const o = JSON.parse(raw)
      if (o && typeof o === 'object') {
        return {
          weights: o.weights || {},
          stars: o.stars || {},
          cards: o.cards || {},
          hist: o.hist || [],
          mute: !!o.mute,
          bolt: o.bolt || { acc: 0, d: '', tacc: 0, td: '' },
          days: o.days || {},
        }
      }
    }
  } catch { /* 损坏数据回退默认 */ }
  return { weights: {}, stars: {}, cards: {}, hist: [], mute: false, bolt: { acc: 0, d: '', tacc: 0, td: '' }, days: {} }
}

export function save(d: AppData) {
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* 隐私模式等写入失败静默 */ }
}

export function todayStr(d = new Date()): string {
  const m = d.getMonth() + 1, dd = d.getDate()
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd
}

export function stamp(): string {
  const d = new Date()
  const p = (x: number) => (x < 10 ? '0' : '') + x
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes())
}
