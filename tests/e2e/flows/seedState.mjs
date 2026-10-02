/* seedState flow：fixtures 种子注入的应用侧封装（T3 规矩：状态一律经 fixtures，用例内禁手工拼 localStorage）。
   re-export fixtures 正本（SEEDS/seedScript/lessonStructure）+ 页面级读取器。 */
export { SEEDS, seedScript, seedState, lessonStructure } from '../../fixtures/seeds.mjs'

/* 页面内读取 localStorage 层数据（断言用只读） */
export const storeOf = (page, key) => page.evaluate((k) => {
  try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null }
}, key)

export const ledgerOf = (page) => storeOf(page, 'pinyin_game_v1')
export const growthOf = (page) => storeOf(page, 'pinyin_growth_v1')
export const learnOf = (page) => storeOf(page, 'pinyin_learn')

/* 账本合计（ok/err 总量断言用） */
export async function ledgerSum(page, field = 'letters') {
  const led = await ledgerOf(page)
  const rows = Object.values((led || {})[field] || {})
  return {
    ok: rows.reduce((a, r) => a + (r.ok || 0), 0),
    err: rows.reduce((a, r) => a + (r.err || 0), 0),
    keys: Object.keys((led || {})[field] || {}),
  }
}
