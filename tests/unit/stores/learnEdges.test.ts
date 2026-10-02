/* 学习进度边界单测（src/stores/learn.svelte.ts，与 learnProgress.test.ts 互补）：
   五步断点记账（幂等不重复写）、课目短名回退（L10 拉丁开头课不在 LESSON_SHORT）。 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

let learn!: typeof import('../../../src/stores/learn.svelte')

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  learn = await import('../../../src/stores/learn.svelte')
})

describe('setStep 断点记账', () => {
  it('记录断点并持久化；同值重设不重复写', () => {
    learn.setStep(2, 3)
    expect(learn.L.step[2]).toBe(3)
    const raw1 = localStorage.getItem('pinyin_learn')
    learn.setStep(2, 3)
    expect(localStorage.getItem('pinyin_learn')).toBe(raw1)
    learn.setStep(2, 4)
    expect(JSON.parse(localStorage.getItem('pinyin_learn')!).step['2']).toBe(4)
  })
})

describe('lessonShort 课目短名', () => {
  it('LESSON_SHORT 命中：组名+手核拼音（L1/L11）', () => {
    const s = learn.lessonShort(1, '第 1 课 单韵母 a o e')
    expect(s.zh).toBe('单韵母')
    expect(s.py).toBe('dān yùn mǔ')
    expect(s.raw).toBe('单韵母')
    expect(learn.lessonShort(11, 'x').py).toBe('hòu bí yùn mǔ')
  })
  it('未登记课（L10）回退：取标题首个空格段（拉丁开头课名不硬造拼音）', () => {
    const s = learn.lessonShort(10, 'ie üe er 与前鼻韵母')
    expect(s.zh).toBeUndefined()
    expect(s.raw).toBe('ie')
  })
  it('空标题兜底', () => {
    expect(learn.lessonShort(10, '').raw).toBe('')
  })
})
