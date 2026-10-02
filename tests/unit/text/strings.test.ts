/* 文案层单测（src/text/strings.ts）：唯一真相层的取值出口（t/tDef/fmt 占位）、
   课号中文数字、数字读音表、周历字、声音礼仪结构化文案、系统消息注册联动。 */
import { describe, it, expect } from 'vitest'
import {
  strings, t, tRaw, tDef, cnNum, NUM_CN, NUM_PY, WEEK_DAYS, LESSON_SHORT, STROKE_DOT, etiquette,
} from '../../../src/text/strings'
import { T } from '../../../src/lib/ruby'

describe('t / tRaw / tDef 取值出口', () => {
  it('t：纯文本直取', () => {
    expect(t('tabLearn')).toBe('学习')
    expect(tRaw('quickPin')).toBe('常见字快拼')
  })
  it('t：{x} 占位格式化（多占位/数字/缺参保位）', () => {
    expect(t('lessonN', { n: 3 })).toBe('第 3 课')
    expect(t('cardCountN', { a: 12, b: 63 })).toContain('12')   // ziBadge 已随 P1-9 徽章删除
    expect(t('deckCardN', { a: 2, b: 57 })).toContain('2')
  })
  it('tDef：格式化文本 + py 逃生口一并返回（Speak 渲染依据）', () => {
    const d = tDef('lessonN', { n: 5 })
    expect(d.zh).toBe('第 5 课')
    expect(d.py).toBeTruthy()
    const plain = tDef('radioSlogan')
    expect(plain.zh.length).toBeGreaterThan(0)
  })
  it('文案层规模：≥200 键（216 键正本只增不减）', () => {
    expect(Object.keys(strings).length).toBeGreaterThanOrEqual(200)
  })
})

describe('系统消息注册联动（T 层免注音）', () => {
  it('registerSys 注册的三条系统消息 T() 直返纯文本', () => {
    for (const k of ['notReady', 'fallbackHint', 'anchorMissing'] as const) {
      expect(T(strings[k].zh)).toBe(strings[k].zh)
    }
  })
  it('普通文案仍加注音（注册的是消息不是全部）', () => {
    expect(T(t('quickPin'))).toMatch(/<ruby>/)
  })
})

describe('课号中文数字 / 数字读音', () => {
  it('cnNum：1-12 全量；越界回退数字串', () => {
    expect(cnNum(1)).toBe('一')
    expect(cnNum(12)).toBe('十二')
    expect(cnNum('x')).toBe('x')
    expect(cnNum(99)).toBe('99')
    expect(Object.keys(NUM_CN)).toHaveLength(12)
  })
  it('NUM_PY：一~十二读音表齐备', () => {
    expect(NUM_PY['三']).toBe('sān')
    expect(NUM_PY['十二']).toBe('shí èr')
  })
})

describe('周历 / 笔画名 / 礼仪文案', () => {
  it('WEEK_DAYS：周一~周日七字', () => {
    expect(WEEK_DAYS).toEqual(['一', '二', '三', '四', '五', '六', '日'])
  })
  it('STROKE_DOT 与 strokes.json 点笔名对齐', () => {
    expect(STROKE_DOT).toBe('点')
  })
  it('etiquette：三规则 + 场景映射表（家长向，不注音契约）', () => {
    expect(etiquette.rules).toHaveLength(3)
    expect(etiquette.rules.every((r) => r.n && r.t && r.d)).toBe(true)
    expect(etiquette.map.length).toBeGreaterThanOrEqual(5)
    expect(etiquette.map.every(([a, b, auto]) => typeof a === 'string' && typeof b === 'string' && typeof auto === 'boolean')).toBe(true)
  })
})

describe('LESSON_SHORT 课组短名（学习 tab 胶囊）', () => {
  it('11 课登记（L10 缺——拉丁课名走回退）、拼音=拉丁+带调符（码点判定，手工核对格式的机器面）', () => {
    expect(Object.keys(LESSON_SHORT).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12])
    expect(LESSON_SHORT[10]).toBeUndefined()   // 唯一缺册：L10 拉丁开头课名不硬造拼音
    for (const k in LESSON_SHORT) {
      expect(LESSON_SHORT[k].zh.length).toBeGreaterThan(0)
      /* 只允许小写字母/空格/拉丁扩展带调符（U+00C0..U+04FF），且至少一个带调符 */
      let toned = false
      for (const ch of LESSON_SHORT[k].py) {
        const c = ch.codePointAt(0)!
        const legal = c === 0x20 || (c >= 0x61 && c <= 0x7a) || (c >= 0xc0 && c < 0x0500)
        expect(legal, k + ':' + LESSON_SHORT[k].py).toBe(true)
        if (c >= 0xc0) toned = true
      }
      expect(toned, k + ':' + LESSON_SHORT[k].py).toBe(true)
    }
  })
})

describe('v4.7 新键（挑刺修复腿）', () => {
  it('课页头「第 X 步」语义键（P1-7：门槛页头不再是 n/N 完成式）', () => {
    expect(tRaw('lessonStepN')).toContain('步')
    expect(t('lessonStepN', { n: 4 })).toContain('4')
  })
  it('拼音蛋首局引导键（P0-2：先点声母，再点韵母）', () => {
    expect(tRaw('eggHowHint')).toContain('声母')
    expect(tRaw('eggHowHint')).toContain('韵母')
  })
})
