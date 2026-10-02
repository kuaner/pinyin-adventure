/* 确定性状态种子（T3 fixtures 层）——三档 localStorage 快照，全部 e2e 共享。
   规矩（tests/README.md）：状态一律经 fixtures 种子注入，禁止用例内手工拼 localStorage。
   形状正本=src/stores/*（pinyin_v2 / pinyin_learn / pinyin_growth_v1 / pinyin_game_v1）。
   三档：
     newbie 新生   —— 零进度（首装态）
     mid    中期   —— L1-L4 课通过（4 课进度+若干星，成长星 40）
     grad   毕业   —— 12 课全通（成长星 520+徽章若干+进化账 4 档）
   覆盖项（overrides）只做增量改写，不改三档正本形状。 */

const BOLT0 = { acc: 0, d: '', tacc: 0, td: '' }

const learnAll = () => {
  const stars = {}, best = {}
  for (let i = 1; i <= 12; i++) { stars[i] = 3; best[i] = 5 }
  return { u: 12, stars, best, step: {} }
}

export const SEEDS = {
  newbie: {
    v2: { weights: {}, stars: {}, cards: {}, hist: [], mute: false, bolt: { ...BOLT0 }, days: {} },
    learn: { u: 1, stars: {}, best: {}, step: {} },
    growth: { v: 1, stars: 0, badges: [], seenStage: -1, det: 0, tone: 0, boltPerf: false },
    game: null, /* pinyin_game_v1 缺席=store 首建（normalize(null) 路径） */
  },
  mid: {
    v2: { weights: {}, stars: { 1: 3, 2: 3, 3: 2 }, cards: {}, hist: [], mute: false, bolt: { ...BOLT0 }, days: {} },
    learn: { u: 4, stars: { 1: 3, 2: 3, 3: 3, 4: 2 }, best: { 1: 5, 2: 5, 3: 5, 4: 4 }, step: {} },
    growth: { v: 1, stars: 40, badges: [], seenStage: 1, det: 3, tone: 2, boltPerf: false },
    game: null,
  },
  grad: {
    v2: { weights: {}, stars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 2, 6: 2, 7: 2, 8: 2 }, cards: {}, hist: [], mute: false, bolt: { ...BOLT0 }, days: {} },
    learn: learnAll(),
    growth: { v: 1, stars: 520, badges: ['first', 'coll30', 'grad'], seenStage: 4, det: 12, tone: 9, boltPerf: true },
    game: { v: 1, letters: {}, games: {}, daily: { day: '', best: 0, done: false }, items: {} },
  },
}

/* 弱项账本覆盖（错误账本加权出题的种子素材）：letters/items 键 → {ok,err}（last=今天，日期敏感禁令的合规写法
   =脚本运行时算 dayNum，与 store 同式） */
function ledgerPatchScript({ letters = {}, items = {}, games = {}, daily } = {}) {
  return `;(() => {
  const KEY = 'pinyin_game_v1'
  const led = JSON.parse(localStorage.getItem(KEY) || '{"v":1,"letters":{},"games":{},"daily":{"day":"","best":0,"done":false},"items":{}}')
  const day = Math.floor(Date.now() / 86400000)
  for (const k in ${JSON.stringify(letters)}) led.letters[k] = { ...{ ok: 0, err: 0, last: day }, ...${JSON.stringify(letters)}[k] }
  for (const k in ${JSON.stringify(items)}) led.items[k] = { ...{ ok: 0, err: 0, last: day }, ...${JSON.stringify(items)}[k] }
  for (const k in ${JSON.stringify(games)}) led.games[k] = { ...{ best: 0, starsToday: 0, lastPlayDay: '' }, ...${JSON.stringify(games)}[k] }
  ${daily ? `led.daily = { ...led.daily, ...${JSON.stringify(daily)} }` : ''}
  localStorage.setItem(KEY, JSON.stringify(led))
})()`
}

/* 组装注入脚本：addInitScript 时机=任何页面脚本之前（种子先落、app 后读）。
   opts: mute / learn / growth / v2 增量覆盖；ledger={letters,items,games,daily} 弱项账本覆盖 */
export function seedScript(tier = 'mid', opts = {}) {
  const base = SEEDS[tier]
  if (!base) throw new Error('未知种子档: ' + tier)
  const v2 = { ...base.v2, ...(opts.v2 || {}) }
  if (opts.mute !== undefined) v2.mute = !!opts.mute
  const learn = { ...base.learn, ...(opts.learn || {}) }
  const growth = { ...base.growth, ...(opts.growth || {}) }
  const game = opts.game !== undefined ? opts.game : base.game
  return `;(() => {
  localStorage.clear()
  localStorage.setItem('pinyin_v2', JSON.stringify(${JSON.stringify(v2)}))
  localStorage.setItem('pinyin_learn', JSON.stringify(${JSON.stringify(learn)}))
  localStorage.setItem('pinyin_growth_v1', JSON.stringify(${JSON.stringify(growth)}))
  ${game ? `localStorage.setItem('pinyin_game_v1', JSON.stringify(${JSON.stringify(game)}))` : ''}
})()`
}

/* 便捷：种子 + 账本覆盖一并注入 */
export async function seedState(page, tier = 'mid', opts = {}) {
  await page.addInitScript(seedScript(tier, opts))
  if (opts.ledger && (opts.ledger.letters || opts.ledger.items || opts.ledger.games || opts.ledger.daily)) {
    await page.addInitScript(ledgerPatchScript(opts.ledger))
  }
}

/* 课结构数据（页数/步数矩阵的期望值来源——与 src/lib/lessonUnits 同式推导，node 侧独立复算） */
export function lessonStructure(lessonsJson) {
  const out = {}
  for (const l of lessonsJson.lessons) {
    const letters = l.letters.length
    const tones = (l.tones || []).length
    const tonePages = tones === letters
      ? letters
      : l.letters.filter((e) => (l.tones || []).some((r) => r.base === e.k)).length
    const hasBlend = l.hasBlend ?? !!((l.blends || []).length || (l.ztlist || []).length)
    out[l.n] = {
      letters, hasBlend, tonePages,
      pages: letters + tonePages + (hasBlend ? 1 : 0) + 1,           /* hspage 总数 */
      units: letters + (hasBlend ? 1 : 0) + 1,                        /* chip 单元数（步数） */
    }
  }
  return out
}
