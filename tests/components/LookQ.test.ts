/* LookQ 看字选音组件测（选项两段式·session store 状态流）：
   与 session.armOpt 联动——首点=armed 高亮+播该选项呼读音（试听），再点同项=作答（reveal 计分）；
   选项内容=呼读音汉字圈标注（CIRC），零错误信息（reveal 只亮正确+答错项）。 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { tick } from 'svelte'
import { render, cleanup, fireEvent } from '@testing-library/svelte'
import LookQ from '../../src/components/quiz/LookQ.svelte'
import { QZ, newSession } from '../../src/stores/session.svelte'
import { AUDIO_CACHE } from '../../src/lib/audio'
import type { Question } from '../../src/lib/types'

const lookQ: Question = {
  type: 'look', key: 'L:b', hint: '', A: 'b', B: 'd',
  opts: ['b', 'd', 'p', 'm'], ans: 0,
} as Question

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); delete (window as any).__AUDIO_LOG })

function start(qs: Question[] = [lookQ]) {
  ;(window as any).__AUDIO_LOG = []
  newSession({ name: '测试', qs })
  return render(LookQ, { q: qs[0] })
}

describe('题面结构', () => {
  it('大字模 + 4 宽选项 + 两段式提示语', () => {
    const { container } = start()
    expect(container.querySelector('.glyph')!.textContent).toBe('b')
    expect(container.querySelectorAll('#optbox .opt')).toHaveLength(4)
    expect(container.textContent.length).toBeGreaterThan(0)
  })
})

describe('两段式（arm→answer 状态流）', () => {
  it('首点=试听：armed 高亮 + 「再点确认」文案 + 播该选项呼读音；不计分不推进', async () => {
    const { container } = start()
    const opts = () => container.querySelectorAll('#optbox .opt')
    fireEvent.click(opts()[1])
    await tick()
    expect(opts()[1].className).toContain('armed')
    expect(QZ.armed).toBe(1)
    expect(QZ.score).toBe(0)
    expect(QZ.reveal).toBeNull()
    expect(AUDIO_CACHE['d']).toBeTruthy()   // say('d') 真实播放请求
  })
  it('点别项=切试听；再点正确项=作答（score+1、correct 高亮、fb 弹出）', async () => {
    vi.useFakeTimers()
    const { container } = start()
    const opts = () => container.querySelectorAll('#optbox .opt')
    fireEvent.click(opts()[2])   // 试听 p
    fireEvent.click(opts()[0])   // 切到正确项
    await tick()
    expect(opts()[0].className).toContain('armed')
    fireEvent.click(opts()[0])   // 再点=作答
    await tick()
    expect(QZ.score).toBe(1)
    expect(opts()[0].className).toContain('correct')
    expect(QZ.fb!.good).toBe(true)
  })
  it('答错：wrong 高亮 + 答案正确项同时亮（零错误信息：只强化正确形态）', async () => {
    vi.useFakeTimers()
    const { container } = start()
    const opts = () => container.querySelectorAll('#optbox .opt')
    fireEvent.click(opts()[3])
    fireEvent.click(opts()[3])
    await tick()
    expect(opts()[3].className).toContain('wrong')
    expect(opts()[0].className).toContain('correct')
    expect(QZ.fb!.good).toBe(false)
  })
  it('armed 态点别的选项切换试听不误作答', async () => {
    const { container } = start()
    const opts = () => container.querySelectorAll('#optbox .opt')
    fireEvent.click(opts()[1])
    fireEvent.click(opts()[2])   // 切试听
    await tick()
    expect(QZ.armed).toBe(2)
    expect(QZ.score).toBe(0)
    expect(QZ.reveal).toBeNull()
  })
})
