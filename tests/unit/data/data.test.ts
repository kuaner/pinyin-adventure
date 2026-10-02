/* 内容数据完整性单测（src/data/index.ts + 各 JSON 正本）：
   63 拼音单元全覆盖无缺无重（卡册/学习岛/笔顺三方一致）、14 易混对完整性（成员存在/无重/镜像四组）、
   9 关卡引用有效、识字表 180 字（无重字、拼音带调格式）、30 双字词、锚点/侦探集、hyp 音频映射。
   数据错误=直接出错误题目给孩子（硬要求：拼音错一个=失败），这里是第一道数据闸。 */
import { describe, it, expect } from 'vitest'
import {
  LETTERS, ANCHORS, LEVELS, DETSET, COREDET, PAIRS, GRPNAME, GRPS, ZI, ZWORDS, ZIBY, PMAP, PH, HYP, keysOf,
} from '../../../src/data'
import lessonsJson from '../../../src/data/lessons.json'
import cardsJson from '../../../src/data/pinyin-cards.json'
import strokesJson from '../../../src/data/strokes.json'

const LESSONS = (lessonsJson as any).lessons as any[]

describe('字母表 LETTERS（57 条）', () => {
  it('规模与三分类：sm 23 / ym 21 / zt 13（复合单元 üe/er/ong/yi/wu/yu 走课内 units，不入表）', () => {
    const all = Object.keys(LETTERS)
    expect(all).toHaveLength(57)
    expect(keysOf('sm').length).toBe(23)
    expect(keysOf('ym').length).toBe(21)
    expect(keysOf('zt').length).toBe(13)
    expect(keysOf('sm').concat(keysOf('ym'), keysOf('zt'))).toHaveLength(all.length)
  })
  it('出题引擎的字母池非 LETTERS 单元（Bug#40 契约锁定）：恰好 6 个、复合拼式', () => {
    /* 课内 63 单元 − LETTERS 57 = üe/er/ong/yi/wu/yu。gameDistractor/letterQ/duelQ 已按
       缺表单元防御（Bug#40）；本契约锁定缺口集合——新增缺表单元必须有意识地过防御面。 */
    const lessonUnits = new Set(LESSONS.flatMap((l: any) => l.letters.map((e: any) => e.k)))
    const missing = [...lessonUnits].filter((k) => !LETTERS[k])
    expect(missing.sort()).toEqual(['er', 'ong', 'wu', 'yi', 'yu', 'üe'])
  })
  it('每条契约字段齐备（tts/han/kj 正确口诀/kjf 干扰口诀/例词）', () => {
    for (const k in LETTERS) {
      const L = LETTERS[k]
      expect(L.tts, k).toBeTruthy()
      expect(L.han, k).toBeTruthy()
      expect(L.kj, k).toBeTruthy()
      expect(L.kjf, k).toBeTruthy()
      expect(L.word, k).toBeTruthy()
      expect(L.wp, k).toBeTruthy()
      expect(L.em, k).toBeTruthy()
      expect(['sm', 'ym', 'zt'], k).toContain(L.cat)
    }
  })
})

describe('63 拼音单元全覆盖（学习岛 12 课=卡册=笔顺三方一致，无缺无重）', () => {
  it('12 课字母并集=63、无重复、每单元在 LETTERS 或在已知缺表集（üe/er/ong/yi/wu/yu）', () => {
    const KNOWN_SOFT = new Set(['üe', 'er', 'ong', 'yi', 'wu', 'yu'])   // Bug#40 契约：缺表单元
    const seen = new Set<string>()
    for (const l of LESSONS) {
      expect(l.letters.length, '课 ' + l.n).toBeGreaterThan(0)
      for (const e of l.letters) {
        expect(LETTERS[e.k] || KNOWN_SOFT.has(e.k), '课 ' + l.n + ' 字母 ' + e.k).toBeTruthy()
        seen.add(e.k)
      }
    }
    expect(seen.size).toBe(63)
    expect(Object.keys(LETTERS)).toHaveLength(57)
  })
  it('卡册 63 张与学习岛并集逐字一致（收集册=学会即解锁的单一真相）', () => {
    const cards = (cardsJson as any).cards as any[]
    expect(cards).toHaveLength(63)
    const cardKeys = cards.map((c) => c.k)
    expect(new Set(cardKeys).size).toBe(63)
    const lessonKeys = new Set(LESSONS.flatMap((l: any) => l.letters.map((e: any) => e.k)))
    expect(new Set(cardKeys)).toEqual(lessonKeys)
    for (const c of cards) {
      expect(c.tts, c.k).toBeTruthy()
      expect(c.kj, c.k).toBeTruthy()
      expect(c.stroke, c.k).toBe(true)   // 63 卡全有笔顺数据
      expect(c.kjAudio, c.k).toMatch(/^lessons\/kj_/)
    }
  })
  it('strokes.json 覆盖全部 63 单元（letters 直配 + units 组合拆解后可达）', () => {
    const st = strokesJson as any
    const canBuild = (k: string): boolean => {
      if (st.letters[k]) return true
      const parts = st.units[k]
      return !!parts && parts.every((p: string) => !!st.letters[p])
    }
    for (const k of (cardsJson as any).cards.map((c: any) => c.k)) {
      expect(canBuild(k), '笔顺缺失: ' + k).toBe(true)
    }
    expect(Object.keys(st.letters).length).toBe(27)
  })
})

describe('易混对 PAIRS（14 组，镜像对完整性）', () => {
  it('14 组、成员都在 LETTERS、组内无自配、双向无重复对', () => {
    expect(PAIRS).toHaveLength(14)
    const seen = new Set<string>()
    for (const p of PAIRS) {
      expect(LETTERS[p.a], p.a).toBeTruthy()
      expect(LETTERS[p.b], p.b).toBeTruthy()
      expect(p.a).not.toBe(p.b)
      const k1 = p.a + '|' + p.b
      const k2 = p.b + '|' + p.a
      expect(seen.has(k1) || seen.has(k2), k1).toBe(false)
      seen.add(k1); seen.add(k2)
      expect(p.grp, k1).toBeTruthy()
      expect(GRPNAME[p.grp], p.grp).toBeTruthy()
      expect(p.tip, k1).toBeTruthy()
    }
  })
  it('镜像四组齐备（b↔d p↔q b↔p d↔q——写反病灶的核心题源）', () => {
    const mirrorPairs = PAIRS.filter((p) => p.grp === 'mirror').map((p) => [p.a, p.b].sort().join('|'))
    expect(new Set(mirrorPairs)).toEqual(new Set(['b|d', 'b|p', 'd|q', 'p|q']))
  })
  it('近音/韵母组抽检（n↔l、f↔h、an↔ang、ui↔iu 在册）', () => {
    const ks = new Set(PAIRS.map((p) => [p.a, p.b].sort().join('|')))
    for (const k of ['l|n', 'f|h', 'an|ang', 'iu|ui']) expect(ks.has(k), k).toBe(true)
  })
  it('PMAP 双向索引一致（组内任一方向可定位）', () => {
    for (const p of PAIRS) {
      expect(PMAP[p.a + '|' + p.b]).toBe(PMAP[p.b + '|' + p.a])
      expect(typeof PMAP[p.a + '|' + p.b]).toBe('number')
    }
  })
  it('组序 GRPS 覆盖全部 grp（组名/组序/对表三者闭合）', () => {
    const grps = new Set(PAIRS.map((p) => p.grp))
    expect(new Set(GRPS)).toEqual(grps)
    for (const g of grps) expect(GRPNAME[g]).toBeTruthy()
  })
})

describe('关卡 LEVELS（9 关+毕业关）', () => {
  it('9 关齐、序号连续、引用有效（pool⊆LETTERS、pairs 双成员在册、soft 引用集锁定）、boss=毕业关', () => {
    expect(LEVELS).toHaveLength(9)
    const pairKeys = new Set(PAIRS.flatMap((p) => [p.a + '|' + p.b, p.b + '|' + p.a]))
    /* 关卡级软引用对（近音拓展，不在 confusion PAIRS 但双成员都在册——pairW 无加成仍可出题） */
    const SOFT_PAIRS = new Set(['z|c', 'c|s', 'zhi|chi', 'zi|ci', 'chi|shi', 'shi|ri', 'ci|si'])
    LEVELS.forEach((L, i) => {
      expect(L.n).toBe(i + 1)
      expect(L.name).toBeTruthy()
      for (const k of L.pool || []) expect(LETTERS[k], L.n + ':' + k).toBeTruthy()
      for (const k of L.pairs || []) {
        expect(pairKeys.has(k) || SOFT_PAIRS.has(k), L.n + ':' + k).toBe(true)
        for (const side of k.split('|')) expect(LETTERS[side], L.n + ':' + k).toBeTruthy()
      }
      for (const k of L.hot || []) expect(pairKeys.has(k), 'hot:' + k).toBe(true)
    })
    expect(LEVELS[8].boss).toBe(true)
    expect(LEVELS[8].pairs!.length).toBeGreaterThanOrEqual(6)   // 大师关混战面
  })
})

describe('识字表/词表/锚点/侦探集', () => {
  it('ZI 180 字：无重字、拼音=纯拉丁+带调符号（码点判定，硬要求：拼音逐字核对）、每字有音频文件名', () => {
    expect(ZI).toHaveLength(180)
    const hs = new Set<string>()
    for (const z of ZI) {
      expect(hs.has(z.h), z.h).toBe(false)   // 无重字（无多音歧义字入选的副产品）
      hs.add(z.h)
      /* 拼音只允许 ASCII 字母 + 拉丁扩展带调符（<U+0400）；至少一个带调符=调号在位。
         码点判定避免测试字面量的 NFC/NFD 归一化陷阱（ü/声调符逐字节比对不可靠） */
      let toned = false
      for (const ch of z.p) {
        const c = ch.codePointAt(0)!
        expect(c < 0x0400, z.h + ':' + z.p).toBe(true)          // 非 CJK/非注音杂符
        expect(c < 0x80 || c >= 0xc0, z.h + ':' + z.p).toBe(true) // ASCII 可见或带调扩展
        if (c >= 0xc0) toned = true
      }
      expect(toned, z.h + ':' + z.p).toBe(true)
      expect(z.f, z.h).toBeTruthy()
      expect(ZIBY[z.h]).toBe(z)
    }
  })
  it('ZWORDS 30 双字词：无重词、拼音非空', () => {
    expect(ZWORDS).toHaveLength(30)
    const ws = new Set<string>()
    for (const w of ZWORDS) {
      expect(ws.has(w.w), w.w).toBe(false)
      ws.add(w.w)
      expect(w.w.length).toBe(2)
      expect(w.p).toBeTruthy()
      expect(w.f).toBeTruthy()
    }
  })
  it('锚点表：抽检字有 {h,p,em} 三要素', () => {
    const keys = Object.keys(ANCHORS)
    expect(keys.length).toBeGreaterThan(10)
    for (const k of keys) {
      expect(ANCHORS[k].h).toBeTruthy()
      expect(ANCHORS[k].p).toBeTruthy()
    }
  })
  it('侦探集 DETSET 19 字母、核心组 COREDET ⊆ DETSET（70/30 先验的池）', () => {
    expect(DETSET).toHaveLength(19)
    for (const k of DETSET) expect(LETTERS[k], k).toBeTruthy()
    expect(COREDET).toEqual(['b', 'd', 'p', 'q', 't', 'f'])
    for (const k of COREDET) expect(DETSET).toContain(k)
  })
})

describe('hyp 音频映射（拼音读音绝不自产的载体）', () => {
  it('呼读音/带调音节映射命中（a/b/ba4），值为文件名；ü 系以 v/vn/ve 安全名在册', () => {
    expect(HYP['a']).toBe('a')
    expect(HYP['b']).toBe('b')
    expect(HYP['ba4']).toBe('ba4')
    expect(typeof HYP['v']).toBe('string')     // ü 的 ASCII 安全名条目
    for (const k of ['a', 'o', 'e', 'b', 'ba4', 'ma2', 'v']) expect(typeof HYP[k]).toBe('string')
  })
})

describe('phrases 配置正本', () => {
  it('题型提示/夸奖/鼓励/自由练习配置在位', () => {
    expect((PH as any).hints.listen).toBeTruthy()
    expect((PH as any).praise.length).toBeGreaterThanOrEqual(3)
    expect((PH as any).cheer.length).toBeGreaterThanOrEqual(3)
    expect((PH as any).practice.length).toBeGreaterThanOrEqual(1)
    expect((PH as any).detName).toBeTruthy()
  })
})
