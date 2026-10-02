/* 四声符号几何共享单测（src/lib/toneMarks.ts）：ToneDrill 声调演示与 LessonPage 小测听调题
   必须是同一套图形——几何改这里两处同步，配色同理。 */
import { describe, it, expect } from 'vitest'
import { TONE_MARKS, TONE_COLORS } from '../../../src/lib/toneMarks'

describe('toneMarks 四声符号', () => {
  it('四声齐备 t=1..4，path 各不相同（平/升/折/降的几何差异）', () => {
    expect(TONE_MARKS.map((m) => m.t)).toEqual([1, 2, 3, 4])
    expect(new Set(TONE_MARKS.map((m) => m.d)).size).toBe(4)
    for (const m of TONE_MARKS) expect(m.d).toMatch(/^M[\d.]/)
  })
  it('配色四色互异', () => {
    expect(TONE_COLORS).toHaveLength(4)
    expect(new Set(TONE_COLORS).size).toBe(4)
  })
})
