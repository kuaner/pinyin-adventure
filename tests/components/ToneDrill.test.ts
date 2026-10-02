/* ToneDrill 声调练习组件测：四声演示（点读+ontone 参与证据）+ 听调辨调小练的两段式试听
   （v4.2c Bug#37 同款：首点=播该调读音+高亮，再点同项=作答，点别项=切试听）+ 4 题结算。
   音频证据走 __AUDIO_LOG（真实播放请求层），对错判定用 Math.random 固定种子。 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { tick } from 'svelte'
import { render, cleanup, fireEvent } from '@testing-library/svelte'
import ToneDrill from '../../src/components/learn/ToneDrill.svelte'
import lessonsData from '../../src/data/lessons.json'

const L1 = (lessonsData as any).lessons.find((l: any) => l.n === 1)
const ROWS = L1.tones   // [{base:'a', display:'ā', tones:[{t,display,file:a1..a4}]} ×3 rows]

afterEach(() => { cleanup(); delete (window as any).__AUDIO_LOG; vi.restoreAllMocks() })

function audioLog(): { name: string }[] {
  return (window as any).__AUDIO_LOG || []
}

describe('四声演示（学习岛声调页）', () => {
  it('四声行在位（四线格符号+带调音节）；点读播该调真人音 + ontone 参与证据（BUGS#33 旗B）', () => {
    const ontone = vi.fn()
    ;(window as any).__AUDIO_LOG = []
    const { container } = render(ToneDrill, { rows: ROWS, ontone })
    const rows = container.querySelectorAll('.tonerow')
    expect(rows).toHaveLength(4)
    expect(container.textContent).toContain(ROWS[0].display)
    fireEvent.click(rows[0])
    expect(ontone).toHaveBeenCalledWith(0)   // 行下标 0 起
    expect(audioLog().some((e) => e.name === ROWS[0].tones[0].file)).toBe(true)   // a1
  })
  it('跟我读（playAll）：四声依次点播', async () => {
    vi.useFakeTimers()
    ;(window as any).__AUDIO_LOG = []
    const { container } = render(ToneDrill, { rows: ROWS })
    const btns = [...container.querySelectorAll('button')]
    fireEvent.click(btns.find((b) => b.className.includes('teal'))!)
    vi.advanceTimersByTime(4 * 1500 + 2000)
    for (const tn of ROWS[0].tones) expect(audioLog().some((e) => e.name === tn.file)).toBe(true)
  })
})

describe('听调辨调两段式（Bug#37 状态流）', () => {
  async function startQuiz(container: HTMLElement) {
    const btns = [...container.querySelectorAll('button')]
    fireEvent.click(btns.find((b) => b.className.includes('green'))!)
    await tick()   // quizOn 翻转 → 小练面板渲染（Svelte 批量更新）
  }
  function mount() {
    ;(window as any).__AUDIO_LOG = []
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0)   // qTone 恒 1（一声题）
    return render(ToneDrill, { rows: ROWS })
  }
  it('出题不自动播音（v2.6 零自动播放——孩子点 🔊 控节奏）', async () => {
    const { container } = mount()
    await startQuiz(container)
    expect(container.querySelectorAll('.topt')).toHaveLength(4)
    expect(audioLog()).toHaveLength(0)
  })
  it('首点=试听：播该调读音 + armed 高亮，不计对错', async () => {
    const { container } = mount()
    await startQuiz(container)
    const topts = container.querySelectorAll('.topt')
    fireEvent.click(topts[1])   // 试听二声
    await tick()
    expect(audioLog().some((e) => e.name === ROWS[0].tones[1].file)).toBe(true)   // a2
    expect(topts[1].className).toContain('armed')
    expect(container.querySelectorAll('.dot.ok')).toHaveLength(0)   // 未计分
  })
  it('点别项=切试听；再点同项=作答（对：绿高亮+进度点亮；topt[i] 值=第 i+1 声）', async () => {
    vi.useFakeTimers()
    const { container } = mount()
    await startQuiz(container)
    const topts = () => container.querySelectorAll('.topt')
    fireEvent.click(topts()[2])   // 试听三声
    fireEvent.click(topts()[0])   // 切到一声（=qTone，Math.random 固定 0）
    await tick()
    expect(topts()[0].className).toContain('armed')
    fireEvent.click(topts()[0])   // 再点=作答
    await tick()
    expect(container.querySelectorAll('.dot.ok')).toHaveLength(1)
    expect(topts()[0].className).toContain('right')
    vi.advanceTimersByTime(760)   // 对 750ms → 下一题
  })
  it('答错：wrong 高亮 + 只展示正确项（零错误信息），1500ms 后推进', async () => {
    vi.useFakeTimers()
    const { container } = mount()
    await startQuiz(container)
    const topts = () => container.querySelectorAll('.topt')
    fireEvent.click(topts()[3])   // 试听四声
    fireEvent.click(topts()[3])   // 作答=错
    await tick()
    expect(topts()[3].className).toContain('wrong')
    expect(topts()[0].className).toContain('right')
    expect(container.querySelectorAll('.dot.ok')).toHaveLength(0)
    vi.advanceTimersByTime(1510)
  })
  it('reveal 态再点不响应（已作答锁定）；4 题完=结算（听对 N 次+夸奖语）', async () => {
    vi.useFakeTimers()
    const { container } = mount()
    await startQuiz(container)
    const topts = () => [...container.querySelectorAll('.topt')]
    for (let i = 0; i < 4; i++) {
      const opts = topts()
      fireEvent.click(opts[0])
      fireEvent.click(opts[0])   // 全对（qTone 恒 1 → 第 0 个选项=一声）
      await tick()
      vi.advanceTimersByTime(760)
      await tick()
      if (i < 3) expect(container.querySelectorAll('.topt')).toHaveLength(4)
    }
    expect(container.querySelector('.qresult')).toBeTruthy()
    expect(container.querySelector('.qresult')!.textContent).toContain('4')
    // 结算页双按钮：再练一遍 / 完成
    const done = [...container.querySelectorAll('button')].find((b) => b.className.includes('green'))!
    const ondone = vi.fn()
    void ondone
    fireEvent.click(done)
    // 点完成后组件回演示态（quizOn=false）——ondone 由父级传，未传不崩
  })
  it('quiz 内 🔊 重听=播当前题目标调', async () => {
    vi.useFakeTimers()
    const { container } = mount()
    await startQuiz(container)
    fireEvent.click(container.querySelector('.replay')!)
    expect(audioLog().some((e) => e.name === ROWS[0].tones[0].file)).toBe(true)   // a1（qTone=1）
  })
})
