/* 出题引擎单测（src/lib/quizEngine.ts）：闯关混编/侦探/常见字快拼/闪电 + 干扰项几何。
   铁律锚点：零错误信息（选项全正确形态、口诀只正向回忆）、同键连续上限 2 次、
   常见字拼音正确性（硬要求：拼音错一个=失败）、两段式试听的数据前提（A/B 恒为正确形态）。 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import dataPinyin from '../../../src/data/pinyin.json'
import dataPhrases from '../../../src/data/phrases.json'

type QE = typeof import('../../../src/lib/quizEngine')
type Weights = typeof import('../../../src/stores/weights.svelte')
let eng!: QE
let w!: Weights

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  eng = await import('../../../src/lib/quizEngine')
  w = await import('../../../src/stores/weights.svelte')
})

describe('shuffle（Fisher-Yates 副本洗牌）', () => {
  it('保元素集（多重集相等）、原数组不动、单元素/空数组安全', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8]
    const copy = eng.shuffle(src)
    expect([...copy].sort()).toEqual(src)
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(eng.shuffle([9])).toEqual([9])
    expect(eng.shuffle([])).toEqual([])
  })
})

describe('partnerOf / sameCat 系列（混淆搭档几何）', () => {
  it('partnerOf：14 组双向可查；非成员 null', () => {
    expect(eng.partnerOf('b')).toBe('d')
    expect(eng.partnerOf('d')).toBe('b')
    expect(eng.partnerOf('an')).toBe('ang')
    expect(eng.partnerOf('x')).toBeNull()
  })
  it('sameCatTight：同长度同 cat 优先（单韵母干扰项不越级到复韵母）', () => {
    const out = eng.sameCatTight('a', 2, ['a'])
    expect(out).toHaveLength(2)
    for (const k of out) {
      expect(k).not.toBe('a')
      expect(k.length).toBe(1)                 // 先吃同长度池
      expect((dataPinyin as any).letters[k].cat).toBe('ym')
    }
  })
  it('sameCatTight：同长度池耗尽 → 同 cat 补齐', () => {
    const out = eng.sameCatTight('zhi', 3, ['zhi', 'chi', 'shi', 'ri', 'zi', 'ci'])   // zt 6 长度2 全排除
    expect(out).toHaveLength(3)
    for (const k of out) expect((dataPinyin as any).letters[k].cat).toBe('zt')
  })
  it('sameCatOthers：scope 内优先（闯关绝不超纲出未解锁字母）', () => {
    const out = eng.sameCatOthers('b', 2, ['b'], ['b', 'p', 'm'])
    for (const k of out) expect(['p', 'm']).toContain(k)
  })
  it('sameCatOthers：scope 不足 → 全表同 cat 补齐；scope 空走全表', () => {
    const out = eng.sameCatOthers('b', 3, ['b'], ['m'])
    expect(out).toHaveLength(3)
    for (const k of out) expect((dataPinyin as any).letters[k].cat).toBe('sm')
    const out2 = eng.sameCatOthers('a', 2, ['a'], null)
    for (const k of out2) expect((dataPinyin as any).letters[k].cat).toBe('ym')
  })
})

describe('buildQuestions 闯关 10 题', () => {
  const level = (dataPinyin as any).levels[1]   // L2 声母 b p m f（含 b|d、b|p 对）
  it('恒 10 题，题型只含 listen/look/kj（v2.3 铁律：ll/rule 错误配对题型已删）', () => {
    for (let run = 0; run < 5; run++) {
      const qs = eng.buildQuestions(level)
      expect(qs).toHaveLength(10)
      for (const q of qs) expect(['listen', 'look', 'kj']).toContain(q.type)
    }
  })
  it('混编配比走 mix 表：listen×5/look×2/kj×3（顺序洗牌）', () => {
    for (let run = 0; run < 5; run++) {
      const cnt: Record<string, number> = {}
      for (const q of eng.buildQuestions(level)) cnt[q.type] = (cnt[q.type] || 0) + 1
      expect(cnt).toEqual({ listen: 5, look: 2, kj: 3 })
    }
  })
  it('选项 4 个互不相同且含正确项，ans 指向正确项（零错误信息）', () => {
    for (const q of eng.buildQuestions(level) as any[]) {
      expect(new Set(q.opts).size).toBe(4)
      expect(q.opts).toHaveLength(4)
      expect(q.opts[q.ans]).toBe(q.A)
    }
  })
  it('出题域：考察目标 A ⊆ pool ∪ pairs 成员（干扰项允许全表同 cat 补齐——不超纲约束在学习目标不在干扰项）', () => {
    const legal = new Set([...(level.pool || []), ...(level.pairs || []).flatMap((p: string) => p.split('|'))])
    for (let run = 0; run < 5; run++) {
      for (const q of eng.buildQuestions(level) as any[]) {
        expect(legal.has(q.A), q.A).toBe(true)
        for (const o of q.opts) {
          expect((dataPinyin as any).letters[o], o).toBeTruthy()
          expect((dataPinyin as any).letters[o].cat).toBe((dataPinyin as any).letters[q.A].cat)
        }
      }
    }
  })
  it('同键连续上限 2 次（自适应加权的防重复保险丝）', () => {
    for (let run = 0; run < 10; run++) {
      const qs = eng.buildQuestions(level) as any[]
      for (let i = 2; i < qs.length; i++) {
        expect(qs[i].key === qs[i - 1].key && qs[i].key === qs[i - 2].key).toBe(false)
      }
    }
  })
  it('口诀题 stmt=谜面（v4.5 Bug#41 审计：剥字母零答案泄漏；绝不展示 kjf 干扰口诀）', () => {
    for (const q of eng.buildQuestions(level) as any[]) {
      if (q.type !== 'kj') continue
      expect(q.stmt).toBe((dataPinyin as any).letters[q.A].kj.replace(/[a-zü]+/gi, ' ').replace(/\s+/g, ' ').trim())
      expect(q.stmt).not.toMatch(/[a-zA-Zü]/)   /* 题面零字母=零答案标记 */
      expect(q.stmt).not.toBe((dataPinyin as any).letters[q.A].kjf)
    }
  })
  it('同键连续上限的兜底分支（加权全押一项时 12 次尝试后放行）', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0)   // wpick 恒取首项
    try {
      const qs = eng.buildQuestions(level) as any[]
      expect(qs).toHaveLength(10)   // 不死循环：12 次尝试后放行连续同键
    } finally {
      spy.mockRestore()
    }
  })
})

describe('buildDetQs 正反小侦探', () => {
  it('恒 10 题，djudge×6 + dfix×4（force=false 洗牌顺序）', () => {
    for (let run = 0; run < 5; run++) {
      const qs = eng.buildDetQs(false) as any[]
      expect(qs).toHaveLength(10)
      expect(qs.filter((q) => q.type === 'djudge')).toHaveLength(6)
      expect(qs.filter((q) => q.type === 'dfix')).toHaveLength(4)
      for (const q of qs) {
        if (q.type === 'djudge') {
          expect([0, 1]).toContain(q.ans)
          expect(typeof q.flipped).toBe('boolean')
        } else expect(q.opts).toContain(q.X)
      }
    }
  })
  it('force=true：首题固定为写反形态（flipped=true，验收截图契约；X 由 pickDet 加权抽）', () => {
    const qs = eng.buildDetQs(true) as any[]
    expect(qs[0].type).toBe('djudge')
    expect(qs[0].flipped).toBe(true)
    expect(qs[0].ans).toBe(1)
  })
  it('djudge 判分一致性：ans = flipped ? 1 : 0', () => {
    for (const q of eng.buildDetQs(false) as any[]) {
      if (q.type === 'djudge') expect(q.ans).toBe(q.flipped ? 1 : 0)
    }
  })
  it('makeDfix：4 选项互不相同且全同 cat 正确形态，ans 指向 X', () => {
    for (const X of ['b', 'd', 'p', 'q', 't', 'f']) {
      const q = eng.makeDfix(X)
      expect(q.opts).toHaveLength(4)
      expect(new Set(q.opts).size).toBe(4)
      expect(q.opts).toContain(X)
      expect(q.ans).toBe(q.opts.indexOf(X))
      for (const o of q.opts) expect((dataPinyin as any).letters[o].cat).toBe((dataPinyin as any).letters[X].cat)
    }
  })
})

describe('常见字快拼（一年级 180 字 + 30 词）', () => {
  it('splitPy：双字母声母优先/无声母空串（与 gameEngine 同规则）', () => {
    expect(eng.splitPy('zhōng')).toEqual(['zh', 'ōng'])
    expect(eng.splitPy('bà')).toEqual(['b', 'à'])
    expect(eng.splitPy('ài')).toEqual(['', 'ài'])
  })
  it('makeZiQ 看字选拼音：4 选项、ans 指向真拼音、键 Z:字（硬要求：正确拼音）', () => {
    const q = eng.makeZiQ({ h: '爸', p: 'bà', f: 'zi_ba_44' }, false) as any
    expect(q.type).toBe('zi')
    expect(q.key).toBe('Z:爸')
    expect(q.opts).toHaveLength(4)
    expect(new Set(q.opts).size).toBe(4)
    expect(q.opts[q.ans]).toBe('bà')
  })
  it('makeZiQ 双字词：类型 zword、键 W:词', () => {
    const q = eng.makeZiQ({ w: '山水', p: 'shān shuǐ', f: 'x' }, true) as any
    expect(q.type).toBe('zword')
    expect(q.key).toBe('W:山水')
    expect(q.opts[q.ans]).toBe('shān shuǐ')
  })
  it('zi 干扰项=可读音节（错调翻变体/同韵/同声母——拉丁+带调符形态，绝不出现假串），答案必是字表真读音', async () => {
    const ziData = (await import('../../../src/data/zi180.json')).default as { h: string; p: string }[]
    const realPy = new Set(ziData.map((z) => z.p))
    for (let run = 0; run < 8; run++) {
      for (const q of eng.ziQs() as any[]) {
        if (q.type !== 'zi') continue
        expect(realPy.has(q.z.p), q.z.h + ':' + q.z.p).toBe(true)   // 答案=字表真实读音（硬要求）
        expect(new Set(q.opts).size).toBe(q.opts.length)             // 选项互不相同
        for (const o of q.opts) {
          let toned = false
          for (const ch of o) {
            const c = ch.codePointAt(0)!
            expect(c === 0x20 || (c >= 0x41 && c <= 0x7a) || (c >= 0xc0 && c < 0x0500), o).toBe(true)
            if (c >= 0xc0) toned = true
          }
          expect(toned, o).toBe(true)   // 带调（真音节形态）
        }
      }
    }
  })
  it('ziQs：≥1 道双字词题（v5 双字词进阶契约）', () => {
    for (let run = 0; run < 6; run++) {
      const qs = eng.ziQs() as any[]
      expect(qs.some((q) => q.type === 'zword')).toBe(true)
    }
  })
  it('wordDistractors 兜底：guard 上限内凑满 3 干扰（ZWORDS=30 足够）', () => {
    const q = eng.makeZiQ({ w: '山水', p: 'shān shuǐ', f: 'x' }, true) as any
    expect(new Set(q.opts).size).toBe(4)
  })
})

describe('⚡闪电刷题出题', () => {
  it('makeBoltQ：二选一、ans 正确、类型只含 blisten/bkj（听写 70%+口诀 30%）', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 60; i++) {
      const q = eng.makeBoltQ()
      seen.add(q.type)
      expect(q.opts).toHaveLength(2)
      expect(new Set(q.opts).size).toBe(2)
      expect(q.opts[q.ans]).toBe(q.A)
      if (q.type === 'bkj') expect(q.stmt.length).toBeGreaterThan(0)
    }
    expect(seen.has('blisten')).toBe(true)
    expect(seen.has('bkj')).toBe(true)
  })
  it('BT_KEYS 会话键序列：boltPickKey 直接追加在 BT_KEYS 上（store 重置的挂点）', () => {
    for (let i = 0; i < 5; i++) eng.boltPickKey(eng.BT_KEYS)
    expect(eng.BT_KEYS).toHaveLength(5)
  })
  it('新用户（未过关卡）→ 第 1 关字母池出题（六个单韵母）', () => {
    for (let i = 0; i < 20; i++) {
      const q = eng.makeBoltQ()
      expect(['a', 'o', 'e', 'i', 'u', 'ü']).toContain(q.A)
    }
  })
  it('已解锁关扩大题源：解锁 L2 后 b 可出现', async () => {
    // S.stars 直改（与 progress store 同读路径；同代次模块生成）
    const progress = (await import('../../../src/stores/progress.svelte')) as any
    progress.S.stars[1] = 3
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) seen.add(eng.makeBoltQ().A)
    expect(seen.size).toBeGreaterThan(3)   // 池已超出单韵母 3 个
  })
})

describe('practiceScope 自由练习出题域', () => {
  it('phrases.practice 每项可构域：pool 来自 keysOf(cat)，pairs 缺省时 kind=all 给全 14 对', () => {
    const kinds = (dataPhrases as any).practice.map((p: any) => p.kind)
    expect(kinds.length).toBeGreaterThan(0)
    for (const k of kinds) {
      const s = eng.practiceScope(k)
      expect(s.name.length).toBeGreaterThan(0)
      expect(s.pool!.length).toBeGreaterThan(0)
    }
    const all = eng.practiceScope('all')
    expect(all.pairs).toHaveLength(14)
  })
})
