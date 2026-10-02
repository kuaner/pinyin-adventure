/* StrokeAnim 笔顺动画组件测（纯 DOM 层）：glyph 静态字模档（与动画档同坐标系）、静态帧（前 N 笔）、
   idleDone 定格、笔名清单、播放链（假 rAF+假 timer 驱动 → onstroke/ondone）、compound 单元拆格。
   几何真值由 scripts/stroke-verify.mjs 在真实浏览器验——这里锁结构与状态机。 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { tick } from 'svelte'
import { render, cleanup } from '@testing-library/svelte'
import StrokeAnim from '../../src/components/learn/StrokeAnim.svelte'
import strokesData from '../../src/data/strokes.json'

const ST = strokesData as any

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('glyph 静态字模档（PinyinCard 大字模复用）', () => {
  it('单字母：四线三格 4 线 + 全部笔画 path（与动画档同 viewBox 体系）', () => {
    const { container } = render(StrokeAnim, { unit: 'b', glyph: true })
    const svg = container.querySelector('svg.saglyph')!
    expect(svg).toBeTruthy()
    expect(svg!.getAttribute('viewBox')!.split(' ').map(Number)).toEqual([0, 12, 76, 136])
    expect(container.querySelectorAll('line.grid').length).toBe(4)
    expect(container.querySelectorAll('path.glink').length).toBe(ST.letters.b.strokes.length)
  })
  it('compound 单元（zh）：UNITS 拆格横向排布（viewBox 宽=76×2）', () => {
    const { container } = render(StrokeAnim, { unit: 'zh', glyph: true })
    const svg = container.querySelector('svg.saglyph')!
    expect(svg!.getAttribute('viewBox')!.split(' ')[2]).toBe(String(76 * 2))
    const expectN = ST.units.zh.reduce((a: number, l: string) => a + ST.letters[l].strokes.length, 0)
    expect(container.querySelectorAll('path.glink').length).toBe(expectN)
  })
  it('aria 无障碍：unit+笔顺演示语义', () => {
    const { container } = render(StrokeAnim, { unit: 'b', glyph: true })
    expect(container.querySelector('svg')!.getAttribute('aria-label')).toContain('b')
  })
})

describe('静态帧与定格', () => {
  it('static=2：前 2 笔显形（p-done+编号徽章+dashoffset 0），b 仅 2 笔=全部前缀', () => {
    const { container } = render(StrokeAnim, { unit: 'b', static: 2 })
    const paths = [...container.querySelectorAll('svg.strokeanim path')] as SVGPathElement[]
    const ink = paths.filter((p) => !p.classList.contains('ghost'))
    expect(ink).toHaveLength(2)                                    // b = 竖+右半圆
    expect(ink.filter((p) => p.classList.contains('p-done')).length).toBe(2)
    expect(container.querySelectorAll('.numbg').length).toBe(2)   // static 帧：前 2 笔带编号徽章
    expect(ink.every((p) => p.style.strokeDashoffset === '0')).toBe(true)
  })
  it('static=1：第 2 笔起藏笔（dashoffset 2000）', () => {
    const { container } = render(StrokeAnim, { unit: 'b', static: 1 })
    const ink = ([...container.querySelectorAll('svg.strokeanim path')] as SVGPathElement[]).filter((p) => !p.classList.contains('ghost'))
    expect(ink[0].style.strokeDashoffset).toBe('0')
    expect(ink[1].style.strokeDashoffset).toBe('2000')
    expect(ink[1].classList.contains('p-done')).toBe(false)
  })
  it('idleDone（play=false）：完整字模定格（全部显形、零徽章——BUGS#31①）', () => {
    const { container } = render(StrokeAnim, { unit: 'b', play: false, idleDone: true })
    const ink = ([...container.querySelectorAll('svg.strokeanim path')] as SVGPathElement[]).filter((p) => !p.classList.contains('ghost'))
    expect(ink.every((p) => p.classList.contains('p-done'))).toBe(true)
    expect(container.querySelectorAll('.numbg').length).toBe(0)
    expect(ink.every((p) => p.style.strokeDashoffset === '0')).toBe(true)
  })
  it('空闲无 idleDone：清场只留浅描边（全部藏笔）', () => {
    const { container } = render(StrokeAnim, { unit: 'b', play: false })
    const ink = ([...container.querySelectorAll('svg.strokeanim path')] as SVGPathElement[]).filter((p) => !p.classList.contains('ghost'))
    expect(ink.every((p) => p.style.strokeDashoffset === '2000')).toBe(true)
  })
})

describe('笔名清单（底部同步高亮）', () => {
  it('showList：逐笔清单与 strokes.json 笔名一致（竖→右半圆）', () => {
    const { container } = render(StrokeAnim, { unit: 'b', play: false })
    const items = container.querySelectorAll('.slist .sit')
    expect(items.length).toBe(ST.letters.b.strokes.length)
    expect(items[0].textContent).toContain('1')   // 序号
    expect(items[1].textContent).toContain('yuán')// 笔名（Speak 交错注音：右yòu半bàn圆yuán）
  })
  it('showList=false 隐藏清单（紧凑预览位）', () => {
    const { container } = render(StrokeAnim, { unit: 'b', play: false, showList: false })
    expect(container.querySelector('.slist')).toBeNull()
  })
})

describe('播放链（假 rAF+假 timer 驱动）', () => {
  it('play=true：逐笔推进（onstroke 序列）→ 播完 idleHold 定格 + ondone', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'] })
    const onstroke = vi.fn()
    const ondone = vi.fn()
    const { container } = render(StrokeAnim, { unit: 'b', play: true, onstroke, ondone })
    vi.advanceTimersByTime(50)      // 首笔起笔（rAF 回调链）
    await tick()
    expect(onstroke).toHaveBeenCalled()
    expect(onstroke.mock.calls[0][0]).toBe(0)                 // 全局笔索引 0 起
    expect(onstroke.mock.calls[0][1]).toBe(ST.letters.b.strokes[0].n)
    expect(container.querySelector('path.act')).toBeTruthy()  // 当前笔橙色高亮
    vi.advanceTimersByTime(6000)    // 两笔（dur 650 + GAP 420）+ 富余
    await tick()
    expect(ondone).toHaveBeenCalledTimes(1)
    const ink = ([...container.querySelectorAll('svg.strokeanim path')] as SVGPathElement[]).filter((p) => !p.classList.contains('ghost'))
    expect(ink.every((p) => p.classList.contains('p-done'))).toBe(true)
    expect(container.querySelectorAll('.numbg').length).toBe(0)   // 播完=定格完整字模零徽章
  })
  it('replay：play false→true 重跑（token 作废旧链 → ondone 恰一次）', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'] })
    const ondone = vi.fn()
    const { rerender } = render(StrokeAnim, { unit: 'a', play: false, idleDone: true, ondone })
    vi.advanceTimersByTime(100)
    expect(ondone).not.toHaveBeenCalled()   // 空闲定格不播
    await rerender({ play: true })          // 重播=翻 play（LessonPage 进写法页同一路径）
    vi.advanceTimersByTime(9000)            // a 三笔画完（dur+GAP 链）+ 富余
    await tick()
    expect(ondone).toHaveBeenCalledTimes(1)
  })
  it('unit 切换（a→b）：笔数重算、无残留笔', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'] })
    const { container, rerender } = render(StrokeAnim, { unit: 'a', play: false })
    await rerender({ unit: 'b' })
    vi.advanceTimersByTime(100)
    await tick()
    const ink = ([...container.querySelectorAll('svg.strokeanim path')] as SVGPathElement[]).filter((p) => !p.classList.contains('ghost'))
    expect(ink.length).toBe(ST.letters.b.strokes.length)
  })
})
