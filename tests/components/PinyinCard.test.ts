/* PinyinCard 三档形态组件测（full=学习岛学一学/口诀广播，card=闪卡，mini=答错反馈）。
   五要素（字模=笔顺动画本体/真人读音/口诀/例词）逐档断言；点读链走 AUDIO_CACHE（jsdom 媒体静默）。 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/svelte'
import PinyinCard from '../../src/components/PinyinCard.svelte'
import { AUDIO_CACHE } from '../../src/lib/audio'
import cardsData from '../../src/data/pinyin-cards.json'

afterEach(() => { cleanup(); delete (window as any).__AUDIO_LOG })

const cardB = (cardsData as any).cards.find((c: any) => c.k === 'b')

describe('full 档（学习岛学一学页）', () => {
  it('五要素在位：字模按钮/读音键/重播键/口诀/例词（63 卡正本数据）', () => {
    const { container } = render(PinyinCard, { k: 'b', mode: 'full' })
    expect(container.querySelector('[data-pc="b"]')).toBeTruthy()
    expect(container.querySelector('[data-pcmain="b"]')).toBeTruthy()
    expect(container.querySelector('[data-pcread="b"]')).toBeTruthy()
    expect(container.querySelector('[data-pcreplay="b"]')).toBeTruthy()
    expect(container.querySelector('[data-pckj="b"]')).toBeTruthy()
    const kjText = container.querySelector('[data-pckj="b"]')!.textContent!
    expect(kjText).toContain('b b b')                    // 口诀字母段（Speak 逐字注音，汉字与拼音交错）
    expect(container.querySelector('.pc-word')!.textContent).toContain('luó')      // 例词拼音（交错注音）
    expect(container.querySelector('.pc-em')!.textContent).toContain(cardB.em)     // 例词 emoji
  })
  it('点字模=呼读音 + onread 回调（BUGS#33 参与旗A 的挂点）', () => {
    const onread = vi.fn()
    const { container } = render(PinyinCard, { k: 'b', mode: 'full', onread })
    fireEvent.click(container.querySelector('[data-pcmain="b"]')!)
    expect(onread).toHaveBeenCalledTimes(1)
    expect(AUDIO_CACHE['b']).toBeTruthy()                // say('b') → audio/hyp/b.mp3
  })
  it('点读音键：onread + 呼读音；点重播键：sayAudio 口诀旁白', () => {
    const onread = vi.fn()
    const { container } = render(PinyinCard, { k: 'b', mode: 'full', onread })
    fireEvent.click(container.querySelector('[data-pcread="b"]')!)
    expect(onread).toHaveBeenCalledTimes(1)
    expect(AUDIO_CACHE['b']).toBeTruthy()
    fireEvent.click(container.querySelector('[data-pcreplay="b"]')!)
    expect(AUDIO_CACHE[cardB.sayAudio]).toBeTruthy()     // lessons/write_b
  })
  it('点口诀：播 kj 口诀朗读（lessons/kj_b）', () => {
    const { container } = render(PinyinCard, { k: 'b', mode: 'full' })
    fireEvent.click(container.querySelector('[data-pckj="b"]')!)
    expect(AUDIO_CACHE[cardB.kjAudio]).toBeTruthy()
  })
})

describe('card 档（闪卡）', () => {
  it('正面：大字模 + 口诀；无笔顺重播键（翻面才播）', () => {
    const { container } = render(PinyinCard, { k: 'b', mode: 'card', flipped: false })
    expect(container.querySelector('.pcc-front')!.textContent).toContain('b')
    expect(container.querySelector('.pcc-kj')).toBeTruthy()
    expect(container.querySelector('.pcc-back')).toBeNull()
  })
  it('翻面：笔顺动画挂载（svg.strokeanim）+ 呼读音 + 例词行', () => {
    const { container } = render(PinyinCard, { k: 'b', mode: 'card', flipped: true })
    expect(container.querySelector('.pcc-back')).toBeTruthy()
    expect(container.querySelector('svg.strokeanim')).toBeTruthy()
    expect(container.querySelector('.pcc-tts')!.textContent).toContain(cardB.tts)
    expect(container.querySelector('.pcc-word')!.textContent).toContain('萝luó')   // 例词（Speak 交错注音）
  })
})

describe('mini 档（答错反馈弹层）', () => {
  it('字模 + 口诀一行 + 呼读音键；点字模/读音键都播呼读', () => {
    const { container } = render(PinyinCard, { k: 'd', mode: 'mini' })
    const root = container.querySelector('[data-pcmini="d"]')
    expect(root).toBeTruthy()
    expect(root!.querySelector('.pcm-g')!.textContent).toContain('d')
    fireEvent.click(root!.querySelector('.pcm-g')!)
    expect(AUDIO_CACHE['d']).toBeTruthy()
    fireEvent.click(root!.querySelector('.pcm-say')!)
    expect(AUDIO_CACHE['d']).toBeTruthy()
  })
})

describe('数据兜底', () => {
  it('非卡册单元退回 LETTERS 数据；无笔顺数据走字体字模分支', () => {
    const { container } = render(PinyinCard, { k: 'an', mode: 'full' })
    expect(container.querySelector('[data-pc="an"]')).toBeTruthy()
    // 'an' 在 pinyin-cards.json 里有（63 卡全覆盖）——真实兜底单元用拼一个未知 k 验证
    const { container: c2 } = render(PinyinCard, { k: '@unknown@', mode: 'full' })
    expect(c2.querySelector('.pc-big')!.textContent).toContain('@unknown@')   // 字体字模兜底
  })
})
