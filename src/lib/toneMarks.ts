/* 四声符号几何共享（ToneDrill 声调演示 + LessonPage 小测听调题同一套图形）。
   名称文案（一声/二声…）在渲染点经 strings.ts 取，本模块只放几何与配色。 */
export const TONE_MARKS: { t: number; d: string }[] = [
  { t: 1, d: 'M6 14 H50' },
  { t: 2, d: 'M8 24 L48 4' },
  { t: 3, d: 'M6 6 L27 24 L50 6' },
  { t: 4, d: 'M8 4 L48 24' },
]

export const TONE_COLORS = ['#2A9D8F', '#E76F51', '#6C86E8', '#B77DEE']
