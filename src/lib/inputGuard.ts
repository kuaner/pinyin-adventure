/* 输入守卫（v4.7 P1-2/P1-3 统一收口，挑刺报告 2026-10-03）：
   全题型面共用的可复用时间窗守卫，三类门：
   ① 进题宽限（openQuestion）：切题后 ENTRY_MS 内的首击忽略——判定反馈期的连点
      不得打进下一题（跨题泄漏：上一题的确认点击替孩子"盲答"没听过的题）。
   ② 判定冷却（judgeHold）：作答判定后 JUDGE_MS 内继续关门——与①衔接覆盖
      「判定→反馈→切题」全窗口（反馈自动推进 550-1600ms，窗内点击一律不收）。
   ③ 谜面播完门（holdAnswer/releaseAnswer）：题面音频未播完不接受作答——
      谜面音晚于点击才播=答案先于题目被提交（镜像对决实测病灶）。
      onend 主路 release，兜底由调用方设超时（音频缺失/静音/onend 缺席不卡死）。
   ④ 两段式确认间隔（markArm/confirmOk）：确认击与试听击最小间隔 CONFIRM_MS（400ms）
      ——77ms 双击曾瞬间穿透两段式直接判定（声调练一练实测）。
   全部 API 接受显式 now（默认 performance.now()）——单测以纯时钟驱动。 */

export const GUARD_CONFIRM_MS = 400
export const GUARD_ENTRY_MS = 450
export const GUARD_JUDGE_MS = 450

let armAt = -Infinity
let blockUntil = -Infinity      /* ①+② 共用：answerOpen 的时间窗 */
let riddleUntil = -Infinity     /* ③：谜面 hold 的到期时刻（releaseAnswer 置 -Infinity） */

const now0 = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/* ④ 试听击打点（每次试听/切试听都重新起算） */
export function markArm(now: number = now0()): void {
  armAt = now
}

/* ④ 确认击是否已过最小间隔 */
export function confirmOk(now: number = now0()): boolean {
  return now - armAt >= GUARD_CONFIRM_MS
}

/* ① 进题宽限：新题装好即调（同时清谜面 hold——新题的谜面门由新一轮 holdAnswer 重新设）。
   ms 可调：闪电刷题=街机节奏，用短窗 300ms（仍在立法 300-500 带内） */
export function openQuestion(now: number = now0(), ms: number = GUARD_ENTRY_MS): void {
  blockUntil = now + ms
  riddleUntil = -Infinity
}

/* ② 判定冷却：作答判定落地即调（ms 同上可调） */
export function judgeHold(now: number = now0(), ms: number = GUARD_JUDGE_MS): void {
  blockUntil = now + ms
}

/* ③ 谜面 hold：forMs=兜底时长（onend 缺席时的最大等待）；releaseAnswer 主路放行 */
export function holdAnswer(forMs: number, now: number = now0()): void {
  riddleUntil = now + forMs
}

export function releaseAnswer(): void {
  riddleUntil = -Infinity
}

/* 作答是否可收（①②③合流出口；组件在 onclick/pointerdown 入口调用） */
export function answerOpen(now: number = now0()): boolean {
  const t = now
  return t >= blockUntil && t >= riddleUntil
}
