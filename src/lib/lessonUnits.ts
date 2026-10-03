/* v3.0 学习流程结构反转（BUGS#28+#29）的页面/单元推导——LessonPage 与 LearnTab（断点 CTA）共用。
   结构：按字母分不再按步骤分——每个字母 = 合并页（学一学：字模+口诀+读音+笔顺同屏）+ 声调页（有数据时）；
   走完再进下一字母；全部字母走完 → 课级拼读页（hasBlend 课）→ 课级小测页。
   声调页数据契约：tones 行数 === 字母数 → 按位置对应（L1-L11 全部如此，含 y→yi / w→wu / ü→yu 别名行）；
   行数不等（L12 整体认读 16 字母 vs 6 行）→ 按 base 精确匹配，匹配不到的字母不设声调页
   （v2.9 的 clamp 行为会放错音，如 chi 页播 yi 的四声——本版顺带修正）。 */

export interface LessonLike {
  letters: { k: string }[]
  tones?: { base: string }[] | null
  blends?: unknown[] | null
  ztlist?: unknown[] | null
  hasBlend?: boolean
}

export type LessonPage = { t: 'learn'; li: number } | { t: 'tone'; li: number } | { t: 'blend' } | { t: 'quiz' }

export function lessonHasBlend(l: LessonLike): boolean {
  return (l.hasBlend ?? !!((l.blends || []).length || (l.ztlist || []).length)) as boolean
}

/* 字母 li 的声调行下标；无对应行返回 -1 */
export function toneRowOf(l: LessonLike, li: number): number {
  const rows = l.tones || []
  if (!rows.length) return -1
  if (rows.length === l.letters.length) return li
  return rows.findIndex((r) => r.base === l.letters[li].k)
}

/* 课内全部页（扁平有序）：每字母 [学一学, 声调?] → 拼读? → 小测 */
export function lessonPages(l: LessonLike): LessonPage[] {
  const out: LessonPage[] = []
  l.letters.forEach((_, li) => {
    out.push({ t: 'learn', li })
    if (toneRowOf(l, li) >= 0) out.push({ t: 'tone', li })
  })
  if (lessonHasBlend(l)) out.push({ t: 'blend' })
  out.push({ t: 'quiz' })
  return out
}

/* 单元数（进度指示口径）：每字母 1 单元 + 拼读? + 小测 */
export function unitCountOf(l: LessonLike): number {
  return l.letters.length + (lessonHasBlend(l) ? 1 : 0) + 1
}

/* 页号 → 单元下标（0 起）：字母单元=li，拼读=letters.length，小测=+1 */
export function unitIndexOf(l: LessonLike, pageIdx: number): number {
  const pages = lessonPages(l)
  const p = pages[Math.max(0, Math.min(pageIdx, pages.length - 1))]
  if (!p) return 0
  if (p.t === 'blend') return l.letters.length
  if (p.t === 'quiz') return l.letters.length + (lessonHasBlend(l) ? 1 : 0)
  return p.li
}

/* v4.8 Bug#43：首页课程卡单主角 = 「当前在学单元」——断点所在字母单元；
   断点已到课级单元（拼读/小测）或越界（重学/已过关）→ 回落首字母 */
export function heroLetterIndexOf(l: LessonLike, pageIdx: number): number {
  const ui = unitIndexOf(l, pageIdx)
  return ui < l.letters.length ? ui : 0
}
