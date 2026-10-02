/* localStorage 持久化层单测（src/lib/storage.ts）：
   损坏 JSON/非对象/缺字段兜底（任务边界向：localStorage 损坏）、写入失败静默（隐私模式）、日期串格式。 */
import { describe, it, expect, beforeEach } from 'vitest'
import { KEY, loadS, save, todayStr, stamp, type AppData } from '../../../src/lib/storage'

beforeEach(() => { localStorage.clear() })

describe('loadS 读取兜底', () => {
  it('合法数据原样读回', () => {
    const d: AppData = {
      weights: { 'b|d': { w: 4, streak: 0 } }, stars: { 1: 3 } as any, cards: { b: { box: 2, due: '2026-10-01' } },
      hist: [{ d: '10月1日 10:00', lv: 'x', sc: 8, st: 2, wp: 'b↔d' }], mute: true,
      bolt: { acc: 90, d: '2026-10-01', tacc: 80, td: '2026-09-30' }, days: { '2026-10-01': 1 },
    }
    save(d)
    expect(loadS()).toEqual(d)
  })
  it('损坏 JSON → 默认空账（不抛错）', () => {
    localStorage.setItem(KEY, '{broken json!!')
    const d = loadS()
    expect(d.weights).toEqual({})
    expect(d.hist).toEqual([])
    expect(d.mute).toBe(false)
    expect(d.bolt).toEqual({ acc: 0, d: '', tacc: 0, td: '' })
  })
  it('非对象（数字/字符串/null）→ 默认空账', () => {
    localStorage.setItem(KEY, '42')
    expect(loadS().stars).toEqual({})
    localStorage.setItem(KEY, '"str"')
    expect(loadS().hist).toEqual([])
    localStorage.setItem(KEY, 'null')
    expect(loadS().mute).toBe(false)
  })
  it('缺字段逐项补默认（老版本/手改数据不崩）', () => {
    localStorage.setItem(KEY, JSON.stringify({ weights: { 'L:b': { w: 2, streak: 1 } } }))
    const d = loadS()
    expect(d.weights['L:b']!.w).toBe(2)
    expect(d.cards).toEqual({})
    expect(d.days).toEqual({})
    expect(d.bolt.acc).toBe(0)
  })
})

describe('save 写入', () => {
  it('写入后可读回（roundtrip）', () => {
    const d = loadS()
    d.mute = true
    d.stars[3] = 2
    save(d)
    expect(loadS().mute).toBe(true)
    expect(loadS().stars[3]).toBe(2)
  })
  it('写入失败（隐私模式 setItem 抛错）→ 静默不抛', () => {
    const orig = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new Error('quota') }
    try {
      expect(() => save(loadS())).not.toThrow()
    } finally {
      Storage.prototype.setItem = orig
    }
  })
})

describe('日期工具', () => {
  it('todayStr：单位月/日补零（YYYY-MM-DD）', () => {
    expect(todayStr(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(todayStr(new Date(2026, 10, 25))).toBe('2026-11-25')
    expect(todayStr(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
  it('todayStr 缺省=今天（与系统日期同日）', () => {
    const now = new Date()
    expect(todayStr()).toBe(todayStr(now))
  })
  it('stamp：中文时间戳「M月D日 HH:MM」两位补零', () => {
    const s = stamp()
    expect(s).toMatch(/^\d{1,2}月\d{1,2}日 \d{2}:\d{2}$/)
  })
})
