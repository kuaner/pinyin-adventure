/* 识字表选项合法性数据测试（v4.7 P1-10）：
   病灶：toneFlip 索引公式把韵母族与声调槽写反（TONEV[t*4+vi] 应为 TONEV[vi*4+t]），
   「六 liù」翻调跨族产出 liō/liē/liī 乱码拼音（挑刺报告 P1-10，连续 3 轮恒现）。
   立法：全 180 字 × 全选项过「合法音节+合法声调组合」校验——选项只允许
   ①字表内真拼音 ②正确答案的合法变调（同韵母族+异声调）。 */
import { describe, it, expect } from 'vitest'
import { makeZiQ } from '../../../src/lib/quizEngine'
import { ZI } from '../../../src/data'

const TONEV = 'āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ'
const clean = (py: string) => [...py].map((ch) => { const i = TONEV.indexOf(ch); return i >= 0 ? 'aoeiuv'[Math.floor(i / 4)] : ch }).join('')

const dataPy = new Set(ZI.map((z) => z.p))

/* 合法变调：去调基串与答案一致 + 声调符号数=1 */
function isLegalOption(opt: string, ans: string): boolean {
  if (dataPy.has(opt)) return true
  if (clean(opt) !== clean(ans)) return false
  const tones = [...opt].filter((ch) => TONEV.includes(ch)).length
  return tones === 1 && opt !== ans
}

describe('识字表选项合法性（P1-10：liī/liō 乱码根除）', () => {
  it('toneFlip 只在答案自己的韵母族内翻调（跨族=非法）', async () => {
    const { toneFlip } = await import('../../../src/lib/quizEngine')
    /* 报告病灶样本：liù 的翻调必须 ∈ {liū,liú,liǔ}，绝不能是 liō/liē/liī */
    for (let i = 0; i < 60; i++) {
      const f = (toneFlip as (p: string) => string | null)('liù')
      expect(f).not.toBeNull()
      expect(['liū', 'liú', 'liǔ']).toContain(f)
    }
    for (let i = 0; i < 60; i++) {
      const f = (toneFlip as (p: string) => string | null)('mā')
      expect(['mā', 'má', 'mǎ', 'mà'].filter((x) => x !== 'mā')).toContain(f)
    }
  })

  it('全 180 字 × 每字 40 轮出题：全选项合法（真拼音或合法变调）', () => {
    let checked = 0
    for (const z of ZI) {
      for (let r = 0; r < 40; r++) {
        const q = makeZiQ(z, false) as any
        expect(q.opts).toHaveLength(4)
        for (const opt of q.opts) {
          if (!isLegalOption(opt, z.p)) {
            throw new Error(`非法选项：字「${z.h}」答案 ${z.p} 出现乱码选项「${opt}」`)
          }
        }
        checked++
      }
    }
    expect(checked).toBe(ZI.length * 40)
  })

  it('干扰项多样性抽查：连续多轮至少出现一次变调干扰（生成器未被修死）', () => {
    const z = ZI.find((x) => x.h === '六')!
    const variants = new Set<string>()
    for (let r = 0; r < 80; r++) {
      const q = makeZiQ(z, false) as any
      for (const o of q.opts) if (o !== 'liù') variants.add(o)
    }
    /* 修复后 liū/liú/liǔ 三个合法变调应在多轮抽样中出现 */
    expect(['liū', 'liú', 'liǔ'].some((v) => variants.has(v))).toBe(true)
  })
})
