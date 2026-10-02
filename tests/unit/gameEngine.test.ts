/* 出题引擎（src/lib/gameEngine.ts）单测：
   已学字母派生（绝不超纲）/ 错误账本加权（弱项+高错误率+久未练+镜像）/ 可种子随机（每日挑战日期种子稳定）
   / 干扰项镜像优先 / 条目账本加权 / 每日 10 题混编（听写+镜像+口诀+识字）/ 对决快问题。
   历次 bug 住点：超纲出题、种子不稳（当天题面漂移）、干扰项非混淆搭档。 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import ziData from '../../src/data/zi180.json'
import pinyinData from '../../src/data/pinyin.json'
import lessonsData from '../../src/data/lessons.json'

type Eng = typeof import('../../src/lib/gameEngine')
type GameMod = typeof import('../../src/stores/game.svelte')
type LearnMod = typeof import('../../src/stores/learn.svelte')
let eng: Eng
let game: GameMod
let learn: LearnMod

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  eng = await import('../../src/lib/gameEngine')
  game = await import('../../src/stores/game.svelte')
  learn = await import('../../src/stores/learn.svelte')
})

/* 解锁课 1..n（直改 learn store 的 $state——与产品 quizPassed 同读路径） */
function passLessons(n: number) {
  for (let i = 1; i <= n; i++) learn.L.stars[i] = 3
}

describe('learnedLetters 已学派生（超纲拦截的源头）', () => {
  it('全空 → 回落第 1 课（a o e）', () => {
    expect(eng.learnedLetters().sort()).toEqual(['a', 'e', 'o'])
  })
  it('过课 3 → 课 1-3 字母并集', () => {
    passLessons(3)
    expect(eng.learnedLetters().sort()).toEqual(['a', 'b', 'e', 'f', 'i', 'm', 'o', 'p', 'u', 'ü'])
  })
  it('全 12 课 → 全字母池', () => {
    passLessons(12)
    expect(eng.learnedLetters().length).toBeGreaterThan(50)
  })
})

describe('镜像对', () => {
  it('mirrorOf：b↔d p↔q；非镜像 null', () => {
    expect(eng.mirrorOf('b')).toBe('d')
    expect(eng.mirrorOf('d')).toBe('b')
    expect(eng.mirrorOf('p')).toBe('q')
    expect(eng.mirrorOf('q')).toBe('p')
    expect(eng.mirrorOf('a')).toBeNull()
  })
  it('mirrorPairLearned：双双已学才成对（只学 b 不出对）', () => {
    learn.L.stars[3] = 3                      // bpmf：b 学了，d 没有
    const pool = eng.learnedLetters()
    expect(eng.mirrorPairLearned(pool)).toBeNull()
    learn.L.stars[4] = 3                      // dtnl：d 也学了
    const pool2 = eng.learnedLetters()
    const mp = eng.mirrorPairLearned(pool2)
    expect(mp && mp.sort()).toEqual(['b', 'd'])
  })
})

describe('ledgerWeight 账本加权', () => {
  it('无记录 → 1；镜像字母基数 ×1.5', () => {
    expect(eng.ledgerWeight('a')).toBe(1)
    expect(eng.ledgerWeight('b')).toBe(1.5)
  })
  it('错多加权：err 4（新账）→ 1+6.4+2（错误率≥40% 且 ≥3 笔）', () => {
    game.GD.letters['a'] = { ok: 0, err: 4, last: game.dayNum() }
    expect(eng.ledgerWeight('a')).toBe(1 + 4 * 1.6 + 2)
  })
  it('err 封顶 6：err 10 → 1+9.6+2', () => {
    game.GD.letters['a'] = { ok: 0, err: 10, last: game.dayNum() }
    expect(eng.ledgerWeight('a')).toBe(1 + 6 * 1.6 + 2)
  })
  it('正确率高不加重：ok 10 err 1 → 仅错次项', () => {
    game.GD.letters['a'] = { ok: 10, err: 1, last: game.dayNum() }
    expect(eng.ledgerWeight('a')).toBe(1 + 1.6)
  })
  it('久未练（≥3 天）+1.5', () => {
    game.GD.letters['a'] = { ok: 1, err: 0, last: game.dayNum() - 3 }
    expect(eng.ledgerWeight('a')).toBe(1 + 1.5)
  })
  it('昨日不加重', () => {
    game.GD.letters['a'] = { ok: 1, err: 0, last: game.dayNum() - 1 }
    expect(eng.ledgerWeight('a')).toBe(1)
  })
})

describe('ledgerPick / pickWeighted 加权抽样', () => {
  it('弱项权重高 → 统计上更多被抽中（种子化可复现）', () => {
    game.GD.letters['a'] = { ok: 0, err: 6, last: game.dayNum() }   // a=重病号
    const pool = ['a', 'o', 'e']
    const rng = eng.mulberry32(42)
    const count: Record<string, number> = { a: 0, o: 0, e: 0 }
    for (let i = 0; i < 600; i++) count[eng.ledgerPick(pool, rng)]++
    expect(count['a']).toBeGreaterThan(count['o'] + count['e'])
  })
  it('pickWeighted：rng=0 抽最重项，rng→1 兜底返回末项', () => {
    const items = [{ k: 'x', w: 5 }, { k: 'y', w: 1 }]
    expect(eng.pickWeighted(items, (i) => i.w, () => 0).k).toBe('x')
    expect(eng.pickWeighted(items, (i) => i.w, () => 0.999999).k).toBe('y')
  })
})

describe('可种子随机（每日挑战日期种子的地基）', () => {
  it('mulberry32：同种子序列恒等，异种子序列相异', () => {
    const a1 = eng.mulberry32(7)
    const a2 = eng.mulberry32(7)
    const seq1 = Array.from({ length: 5 }, () => a1())
    const seq2 = Array.from({ length: 5 }, () => a2())
    expect(seq1).toEqual(seq2)
    const b1 = eng.mulberry32(8)
    expect(Array.from({ length: 5 }, () => b1())).not.toEqual(seq1)
    for (const v of seq1) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThan(1)
  })
  it('daySeed：同日串恒等；异日串（几乎必然）相异', () => {
    expect(eng.daySeed('2026-10-01')).toBe(eng.daySeed('2026-10-01'))
    expect(eng.daySeed('2026-10-01')).not.toBe(eng.daySeed('2026-10-02'))
    expect(eng.daySeed('2026-10-01')).not.toBe(eng.daySeed('2025-10-01'))
  })
  it('seededShuffle：确定性置换且保元素集', () => {
    const arr = ['a', 'b', 'c', 'd', 'e']
    const s1 = eng.seededShuffle(arr, eng.mulberry32(9))
    const s2 = eng.seededShuffle(arr, eng.mulberry32(9))
    expect(s1).toEqual(s2)
    expect([...s1].sort()).toEqual(arr)
    expect(arr).toEqual(['a', 'b', 'c', 'd', 'e'])   // 原数组不动
  })
  it('splitPy：zh/ch/sh 双字母声母优先；无声母=空串', () => {
    expect(eng.splitPy('ba')).toEqual(['b', 'a'])
    expect(eng.splitPy('zhi')).toEqual(['zh', 'i'])
    expect(eng.splitPy('zhuang')).toEqual(['zh', 'uang'])
    expect(eng.splitPy('ang')).toEqual(['', 'ang'])
    expect(eng.splitPy('a')).toEqual(['', 'a'])
  })
})

describe('gameDistractor 干扰项（混淆搭档优先）', () => {
  it('b 的干扰项=d（镜像搭档已学时）', () => {
    const pool = ['b', 'd', 'a', 'o']
    expect(eng.gameDistractor('b', pool)).toBe('d')
  })
  it('无镜像搭档 → 同 cat 回落（随机取，断言落在同 cat 集内）', () => {
    const pool = ['b', 'p', 'm', 'f']
    expect(['p', 'm', 'f']).toContain(eng.gameDistractor('b', pool))
  })
  it('干扰项永不出现在排除池外（不超纲）', () => {
    const pool = ['a', 'o', 'e', 'i']
    for (const k of pool) expect(pool).toContain(eng.gameDistractor(k, pool))
  })
})

describe('itemWeight 条目账本加权（v4.3 拼读对/声调音节）', () => {
  it('无记录 → 1；错多加权且封顶；久未练回火；无镜像乘数', () => {
    expect(eng.itemWeight('ba1')).toBe(1)
    game.GD.items['ba1'] = { ok: 0, err: 2, last: game.dayNum() }
    expect(eng.itemWeight('ba1')).toBe(1 + 2 * 1.8)
    game.GD.items['ma2'] = { ok: 0, err: 20, last: game.dayNum() - 5 }
    expect(eng.itemWeight('ma2')).toBe(1 + 6 * 1.8 + 2 + 1.5)
  })
})

describe('learnedBlends / learnedToneRows（拼读/声调题源，绝不超纲）', () => {
  it('全空回落：blends=第 3 课（首个拼读课），tones=第 1 课', () => {
    const bs = eng.learnedBlends()
    expect(bs.length).toBe(14)                        // L3 全部 blends
    expect(bs.every((b) => /^[bpmf]/.test(b.syl))).toBe(true)
    const ts = eng.learnedToneRows()
    expect(ts.length).toBe(3)                         // L1 三行
    expect(ts[0].base).toBe('a')
  })
  it('过课 3 → 只含 L3 的 blends/tones；未过课不混入', () => {
    learn.L.stars[3] = 3
    const bs = eng.learnedBlends()
    expect(bs.every((b) => b.syl.length > 0 && !!b.file)).toBe(true)
    const l3 = (lessonsData as any).lessons.find((x: any) => x.n === 3)
    const ts = eng.learnedToneRows()
    expect(ts.map((r: any) => r.base)).toEqual(l3.tones.map((r: any) => r.base))
  })
})

describe('buildDailyQs 每日 10 题', () => {
  it('恒 10 题，题型只含 blisten/bkj/zi', () => {
    const qs = eng.buildDailyQs()
    expect(qs).toHaveLength(10)
    for (const q of qs) expect(['blisten', 'bkj', 'zi']).toContain(q.type)
  })
  it('同日两次生成：10 题逐字节面稳定（种子契约，Bug#38 修复后全题型——T2）', () => {
    /* Bug#38（tests/README T2 队列项）：修复前非镜像字母的干扰项 gameDistractor 走
       Math.random 不进日期种子 → 同日重开该类题的选项搭档可漂移。
       本用例先于修复写成（fullySeeded 条件已去除）= 失败测试先行；修复 = gameDistractor
       加可选 rng 注入参数并由 letterQ 传入种子 rng（产品码 diff 已在提交说明逐条列明）。 */
    passLessons(4)
    const q1 = eng.buildDailyQs()
    const q2 = eng.buildDailyQs()
    const key = (q: any) => q.type + ':' + (q.A || q.z?.h)
    expect(q1.map(key)).toEqual(q2.map(key))
    expect(q2).toEqual(q1)
  })
  it('只用已学字母（超纲拦截）：过课 1-2 时字母题 A/opts 全在池内', () => {
    passLessons(2)                                    // a o e i u ü
    const pool = new Set(eng.learnedLetters())
    const qs = eng.buildDailyQs()
    for (const q of qs) {
      if (q.type === 'zi') continue
      expect(pool.has(q.A)).toBe(true)
      for (const o of q.opts) expect(pool.has(o)).toBe(true)
    }
  })
  it('镜像对在池内时必出 2 道镜像听写（b/d 各一）', () => {
    passLessons(4)                                    // bpmf+dtnl → b,d 都已学
    const qs = eng.buildDailyQs()
    const blistenA = qs.filter((q) => q.type === 'blisten').map((q) => q.A)
    expect(blistenA).toContain('b')
    expect(blistenA).toContain('d')
  })
  it('zi 题自洽：opts[ans]=正确拼音、4 选项、字在识字表', () => {
    passLessons(1)
    const ziSet = new Set(ziData.map((z) => z.h))
    const qs = eng.buildDailyQs().filter((q) => q.type === 'zi')
    expect(qs.length).toBeGreaterThanOrEqual(2)
    for (const q of qs) {
      expect(q.opts).toHaveLength(4)
      expect(q.z && ziSet.has(q.z.h)).toBe(true)
      expect(q.opts[q.ans]).toBe(q.z!.p)
    }
  })
  it('字母题选项=二选一且含正确项', () => {
    passLessons(1)
    for (const q of eng.buildDailyQs()) {
      if (q.type === 'zi') continue
      expect(q.opts).toHaveLength(2)
      expect(q.opts).toContain(q.A)
      expect(q.ans).toBe(q.opts.indexOf(q.A))
    }
  })
  it('口诀题 stmt=谜面（v4.5 Bug#41 审计：剥字母零答案泄漏；正向回忆）', () => {
    passLessons(1)
    for (const q of eng.buildDailyQs()) {
      if (q.type !== 'bkj') continue
      expect(q.stmt.length).toBeGreaterThan(0)
      expect(q.stmt).toBe((pinyinData as any).letters[q.A].kj.replace(/[a-zü]+/gi, ' ').replace(/\s+/g, ' ').trim())
      expect(q.stmt).not.toMatch(/[a-zA-Zü]/)
    }
  })
})

describe('duelQ 镜像对决快问题', () => {
  it('ans 恒指向正确字母；选项二选一；口诀题带谜面 stmt（零字母）', () => {
    const pool = ['b', 'd', 'p', 'q']
    for (let i = 0; i < 50; i++) {
      const q = eng.duelQ(pool)
      expect(q.opts).toHaveLength(2)
      expect(q.opts[q.ans]).toBe(q.A)
      expect(pool).toContain(q.A)
      if (q.kj) {
        expect(q.stmt).toBe((pinyinData as any).letters[q.A].kj.replace(/[a-zü]+/gi, ' ').replace(/\s+/g, ' ').trim())
        expect(q.stmt).not.toMatch(/[a-zA-Zü]/)
      }
    }
  })
})
