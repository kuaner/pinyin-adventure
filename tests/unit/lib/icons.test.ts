/* naive-icons 图标池单测（src/lib/icons.ts）：v2.1 起 UI emoji 清零的承载体——
   Icon.svelte 按 name 取 { w, s } 渲染；池缺枚=组件渲染空白，故契约逐条锁定。 */
import { describe, it, expect } from 'vitest'
import { ICONS } from '../../../src/lib/icons'

describe('icons 图标池', () => {
  it('规模 ≥48 枚（naive-icons 2026 快照 + 自绘补缺），每枚含权重 w 与 SVG 图元 s', () => {
    const names = Object.keys(ICONS)
    expect(names.length).toBeGreaterThanOrEqual(48)
    for (const n of names) {
      expect(ICONS[n].w, n).toBeTruthy()
      expect(ICONS[n].s, n).toMatch(/<(path|ellipse|circle|rect)/)
    }
  })
  it('核心 UI 图标在池（对勾/叉/火焰/星/锁/喇叭/播放/刷新/喇叭组）', () => {
    for (const n of ['check', 'close', 'flame', 'star', 'star-empty', 'lock', 'headphones', 'play', 'refresh', 'trophy']) {
      expect(ICONS[n], n).toBeTruthy()
    }
  })
  it('游戏岛 6 摊位插画底图依赖的图标在池', () => {
    for (const n of ['balloon', 'fish', 'bee', 'bird', 'ear', 'music']) expect(ICONS[n], n).toBeTruthy()
  })
})
