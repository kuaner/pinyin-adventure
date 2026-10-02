/* Speak 组件测（v2.6 注音渲染+整段可点播）：文案层 key/数据层 text 反查/模板/plain 三形态；
   可点播示能（canplay/role/小喇叭）；点播走 __AUDIO_LOG（playAudio 验收钩子=声音发出的证据）。 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/svelte'
import Speak from '../../src/components/Speak.svelte'
import { AUDIO_CACHE } from '../../src/lib/audio'
import { manifest } from '../../src/text/manifest'
import { strings } from '../../src/text/strings'

afterEach(() => { cleanup(); delete (window as any).__AUDIO_LOG })

describe('注音渲染', () => {
  it('k=文案层 key：T() 自动注音（ruby 结构）', () => {
    const { container } = render(Speak, { k: 'tabLearn' })
    expect(container.querySelector('ruby')).toBeTruthy()
    expect(container.textContent).toContain('学')
  })
  it('k+vars：占位格式化后注音（第 3 课）', () => {
    const { container } = render(Speak, { k: 'lessonN', vars: { n: 3 } })
    expect(container.textContent).toContain('3')
    expect(container.querySelector('ruby')).toBeTruthy()
  })
  it('text=数据层文案：zhAudio 反查可播（口诀句）', () => {
    const { container } = render(Speak, { text: '右下半圆 b b b' })
    expect(container.querySelector('ruby')).toBeTruthy()
    expect(container.querySelector('svg.sico')).toBeTruthy()
  })
  it('text=无配音文案：纯注音展示，无喇叭无按钮语义', () => {
    const { container } = render(Speak, { text: '自定义无配音的句子' })
    expect(container.querySelector('ruby')).toBeTruthy()
    expect(container.querySelector('svg.sico')).toBeNull()
    expect(container.querySelector('.speak')!.getAttribute('role')).toBeNull()
  })
})

describe('可点播示能与点播', () => {
  it('有配音：canplay + role=button + 整段可点 → __AUDIO_LOG 记录发声（声音发出的证据）', async () => {
    ;(window as any).__AUDIO_LOG = []
    const { container } = render(Speak, { k: 'tabLearn' })
    const el = container.querySelector('.speak')!
    expect(el.classList.contains('canplay')).toBe(true)
    expect(el.getAttribute('role')).toBe('button')
    expect(el.getAttribute('aria-label')).toBe('学习')
    fireEvent.click(el)
    const log = (window as any).__AUDIO_LOG as { name: string }[]
    expect(log).toHaveLength(1)
    expect(log[0].name).toBe(manifest['tabLearn'])        // ui/tab-learn.mp3
    expect(AUDIO_CACHE[manifest['tabLearn']]).toBeTruthy()
  })
  it('plain=true：纯渲染不点击（父级按钮管播放，无双触发）', () => {
    const { container } = render(Speak, { k: 'tabLearn', plain: true })
    const el = container.querySelector('.speak')!
    expect(el.classList.contains('canplay')).toBe(false)
    expect(el.getAttribute('role')).toBeNull()
    expect(el.querySelector('svg.sico')).toBeNull()
  })
  it('系统消息（SYS_SET 注册）不经注音直出纯文本', () => {
    const { container: c1 } = render(Speak, { text: strings.notReady.zh })
    expect(c1.querySelector('ruby')).toBeNull()
    expect(c1.textContent).toBe(strings.notReady.zh)
  })
})
