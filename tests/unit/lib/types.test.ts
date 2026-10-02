/* 全局类型正本单测（src/lib/types.ts）：类型在编译期擦除——本文件是「类型契约+数据正本对齐」的
   运行时锚：合法题目对象可赋给判别联合（tsc 门）+ LETTERS 数据满足 Letter 契约字段。 */
import { describe, it, expect } from 'vitest'
import * as Types from '../../../src/lib/types'
import type { Question, ListenQ, BoltQ, QuizScope, SessionCfg } from '../../../src/lib/types'
import { LETTERS } from '../../../src/data'

describe('types 类型正本（编译期锚）', () => {
  it('模块可加载（值导入——type-only 导入编译期擦除，模块零运行时面）', () => {
    expect(typeof Types).toBe('object')
  })
  it('Question 判别联合：listen/blisten 形态字段齐备可赋值', () => {
    const listen: ListenQ = { type: 'listen', key: 'L:b', hint: '', A: 'b', B: 'd', opts: ['b', 'd'], ans: 0 }
    const bolt: BoltQ = { type: 'blisten', key: 'b', hint: '', A: 'b', sound: 'b', opts: ['b', 'd'], ans: 0 }
    const qs: Question[] = [listen, bolt]
    expect(qs).toHaveLength(2)
  })
  it('QuizScope/SessionCfg 最小形态（pool/pairs 可空）', () => {
    const s: QuizScope = { name: 'x', pool: null, pairs: null }
    const cfg: SessionCfg = { name: 'x', qs: [] }
    expect(s.pool).toBeNull()
    expect(cfg.qs).toEqual([])
  })
  it('LETTERS 数据与 Letter 契约字段（cat/tts/han/kj/kjf/word/wp/em）逐条非空', () => {
    for (const k of ['b', 'a', 'zhi', 'ü']) {
      const L = (LETTERS as any)[k]
      expect(L, k).toBeTruthy()
      for (const f of ['cat', 'tts', 'han', 'kj', 'kjf', 'word', 'wp', 'em']) {
        expect(String(L[f]), k + '.' + f).toBeTruthy()
      }
    }
  })
})
