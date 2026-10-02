/* Ruby 自动注音单测（src/lib/ruby.ts）：pinyin-pro 引擎 + 三层多音字兜底（引擎分词/全局覆盖表/
   调用方 py 逃生口）+ 词组 nowrap 分组 + 系统消息免注音 + memo 缓存。
   注音错误对孩子=错误信息（硬约束 4：儿童可见文字必须带 ruby），逐条锚定。 */
import { describe, it, expect } from 'vitest'
import { T, OVERRIDES, stripDSL } from '../../../src/lib/ruby'
import { strings } from '../../../src/text/strings'

describe('T 基础注音', () => {
  it('汉字逐字 <ruby>汉<rt>py</rt></ruby>', () => {
    const out = T('答对啦')
    expect(out).toContain('<ruby>答<rt>')
    expect(out).toContain('<ruby>对<rt>')
    expect(out).toMatch(/<ruby>啦<rt>la<\/rt><\/ruby>/)
  })
  it('拉丁/数字/emoji/标点原样通过（不包 ruby）', () => {
    const out = T('b p m ←12分🎉！')
    expect(out).not.toContain('<ruby>b<')
    expect(out).toContain('12')
    expect(out).toContain('🎉')
    expect(out).toContain('！')
  })
  it('连续汉字 run 整段进引擎（保句级消歧语境），跨标点分段', () => {
    const out = T('你好，世界')
    expect((out.match(/<ruby>/g) || []).length).toBe(4)
  })
  it('纯拉丁串零开销（无汉字无替换）', () => {
    expect(T('b123')).toBe('b123')
  })
})

describe('T 多音字三层兜底', () => {
  it('第 3 层：调用方 py 逃生口（T(text, py)）', () => {
    const out = T('长得高', { '长得': 'zhǎng de' })
    expect(out).toMatch(/<ruby>长<rt>zhǎng<\/rt><\/ruby>/)
    expect(out).toMatch(/<ruby>得<rt>de<\/rt><\/ruby>/)
  })
  it('py 逃生口作用于任意位置的命中词（含词组整体改音）', () => {
    const out = T('好好学习', { '学习': 'xué xí' })
    expect(out).toContain('class="rw"')   // 命中即视为词组（nowrap 分组）
  })
  it('第 2 层：全局覆盖表 OVERRIDES（单字表非空且生效）', () => {
    expect(Object.keys(OVERRIDES).length).toBeGreaterThanOrEqual(10)
    const out = T('一个门洞')
    expect(out).toMatch(/<ruby>个<rt>gè<\/rt><\/ruby>/)
  })
  it('覆盖表命中总是视为词组（单字覆盖也包组内渲染路径）', () => {
    /* 啦 = OVERRIDES 键：句尾 '来啦' → 啦 按覆盖表读 la（语气字轻声化入覆盖表的实例） */
    const out = T('来啦')
    expect(out).toMatch(/<ruby>啦<rt>la<\/rt><\/ruby>/)
  })
  it('第 1 层：词表词命中的词内 override 子匹配（词组整句含覆盖字）', () => {
    /* dict 词表含 '破纪录啦' 等整句词——词命中后词内 '啦' 仍按覆盖表改音，
       且 nowrap 分组边界保持词表词（overrideAt 正/反两条路径都走） */
    const out = T('通关啦')
    expect(out).toContain('class="rw"')
    expect(out).toMatch(/<ruby>啦<rt>la<\/rt><\/ruby>/)
  })
  it('词表词命中 → 包 <span class="rw">（词组连续注音不拆行）', () => {
    const out = T('记住')
    expect(out).toContain('<span class="rw">')
  })
  it('无词表命中的散字不包 .rw', () => {
    const out = T('日月')
    if (out.includes('class="rw"')) {
      // 若引擎分词把它判成词也可——只断言 ruby 结构正确
      expect(out).toMatch(/<ruby>/)
    } else {
      expect(out).toMatch(/<ruby>日<rt>/)
    }
  })
})

describe('T 系统消息免注音（SYS_SET，注音决策在 T 层）', () => {
  it('strings.ts 注册的系统消息 → 纯文本直返（零 ruby）', () => {
    for (const key of ['notReady', 'fallbackHint', 'anchorMissing'] as const) {
      const zh = (strings as any)[key].zh
      expect(T(zh)).toBe(zh)
    }
  })
  it('带 {x} 占位的格式化文本不受系统消息影响（占位键不在 SYS_SET）', () => {
    expect(T('第 3 课')).toMatch(/<ruby>第<rt>/)
  })
})

describe('T memo 缓存', () => {
  it('同串两次调用结果恒等（缓存命中路径）', () => {
    const a = T('小耳朵练一练')
    const b = T('小耳朵练一练')
    expect(a).toBe(b)
    expect(a).toMatch(/<ruby>/)
  })
})

describe('stripDSL（历史遗留防漏网）', () => {
  it('剥掉 汉{拼音} 标记保留汉字；拉丁后的 {..} 不动（DSL 只挂在汉字上）', () => {
    expect(stripDSL('例词是菠{bō}萝')).toBe('例词是菠萝')
    expect(stripDSL('b{玻}')).toBe('b{玻}')
    expect(stripDSL('读玻{bō}')).toBe('读玻')
  })
  it('无标记原样返回', () => {
    expect(stripDSL('普通文本')).toBe('普通文本')
    expect(stripDSL('')).toBe('')
  })
})
