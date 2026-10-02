/* 配音清单运行时入口单测（src/text/manifest.ts）：
   keys=文案 key→音频文件（Speak 点播唯一依据）；zh=数据层文案反查（数据段+文案层静态 key 合并，
   模板 {x} 不可播不进表）。配音不是黑盒的运行时半边。 */
import { describe, it, expect } from 'vitest'
import { manifest, zhAudio } from '../../../src/text/manifest'
import { strings } from '../../../src/text/strings'
import rawManifest from '../../../src/text/audio-manifest.json'
import { PH } from '../../../src/data'
import dataPinyin from '../../../src/data/pinyin.json'
import confusion from '../../../src/data/confusion.json'

describe('manifest keys（文案层配音面）', () => {
  it('非空且值全为 audio/ 相对路径 .mp3（无 .mp3.mp3——BUGS#23 同源契约）', () => {
    const keys = Object.keys(manifest)
    expect(keys.length).toBeGreaterThanOrEqual(200)
    for (const k of keys) {
      expect(manifest[k], k).toMatch(/^(ui|lessons|hyp)\/[\w-]+\.mp3$/)
      expect(manifest[k].includes('.mp3.mp3'), k).toBe(false)
    }
  })
  it('key 全部可溯源：与 gen-audio.ts 的生成方案一一对应（strings 直键 + phrases 族 + 关卡名/辨析提示）', () => {
    const ph = PH as any
    const dataP = dataPinyin
    const conf = confusion
    /* gen-audio.ts 的四个来源，逐族复算（新增来源族时此处同步=有意识的清单扩张） */
    const derived = new Set<string>([
      ...Object.keys(ph.hints || {}).map((x) => 'hint-' + x),
      ...Object.keys(ph.hintsV5 || {}).map((x) => 'hintv5-' + x),
      ...Object.keys(ph.kindNames || {}).map((x) => 'kind-' + x),
      'detName',
      ...(ph.praise || []).map((_: string, i: number) => 'praise-' + i),
      ...(ph.cheer || []).map((_: string, i: number) => 'cheer-' + i),
      ...(ph.practice || []).map((p: any) => 'prac-' + p.kind + '-btn'),
      ...(dataP.levels as any[]).map((lv) => 'lv-name-' + lv.n),
      ...(conf.pairs as any[]).map((p: any) => 'tip-' + p.a + '-' + p.b),
    ])
    for (const k of Object.keys(manifest)) {
      const ok = (strings as any)[k] !== undefined || derived.has(k)
      expect(ok, k).toBe(true)
    }
  })
})

describe('zhAudio 反查表（数据层+静态 key 合并）', () => {
  it('数据段完整并入（口诀/写法旁白等数据层文案可反查）', () => {
    const dataZh = (rawManifest as any).zh as Record<string, string>
    expect(Object.keys(dataZh).length).toBeGreaterThan(0)
    for (const zh in dataZh) expect(zhAudio[zh]).toBe(dataZh[zh])
    expect(zhAudio['右下半圆 b b b']).toBe('lessons/kj_b')
  })
  it('文案层静态 key 并入：有音频且无占位的 zh 可反查', () => {
    const tabLearn = (strings as any).tabLearn.zh
    expect(zhAudio[tabLearn]).toBe('ui/tab-learn.mp3')
  })
  it('模板键（含 {x}）不进反查表（模板不可播契约）', () => {
    const tpl = (strings as any).lessonN.zh   // '第 {n} 课'
    expect(tpl.includes('{')).toBe(true)
    expect(zhAudio[tpl]).toBeUndefined()
  })
})
