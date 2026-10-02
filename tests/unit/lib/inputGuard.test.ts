/* 输入守卫单测（v4.7 P1-2/P1-3 统一收口）：
   - 判定后冷却（judgeHold）+ 进题宽限（openQuestion）→ answerOpen 门
   - 谜面未播完不接受作答（holdAnswer/releaseAnswer）
   - 两段式确认击与试听击最小间隔 ≥400ms（markArm/confirmOk，77ms 双击穿透根除）
   全部 API 接受显式 now（ms 时钟）——测试不依赖真实时间。 */
import { describe, it, expect } from 'vitest'
import {
  markArm, confirmOk, openQuestion, judgeHold, holdAnswer, releaseAnswer,
  answerOpen, GUARD_CONFIRM_MS, GUARD_ENTRY_MS, GUARD_JUDGE_MS,
} from '../../../src/lib/inputGuard'

describe('inputGuard 进题宽限/判定冷却（P1-2）', () => {
  it('openQuestion 后 ENTRY_MS 内 answerOpen=false（进题首击忽略）', () => {
    openQuestion(1000)
    expect(answerOpen(1000 + GUARD_ENTRY_MS - 1)).toBe(false)
    expect(answerOpen(1000 + GUARD_ENTRY_MS)).toBe(true)
  })
  it('judgeHold 后 JUDGE_MS 内 answerOpen=false（判定后连点不泄漏进下一题）', () => {
    judgeHold(2000)
    expect(answerOpen(2000 + 100)).toBe(false)
    expect(answerOpen(2000 + GUARD_JUDGE_MS)).toBe(true)
  })
  it('进题宽限与判定冷却可叠加（后写者覆盖窗口）', () => {
    openQuestion(3000)
    judgeHold(3100)
    expect(answerOpen(3100 + 200)).toBe(false)
    expect(answerOpen(3100 + GUARD_JUDGE_MS)).toBe(true)
  })
  it('未设任何门时恒开放（兜底不阻塞正常作答）', () => {
    expect(answerOpen(999999)).toBe(true)
  })
})

describe('inputGuard 谜面播完门（P1-2 谜面未播完不接受作答）', () => {
  it('holdAnswer 期间 answerOpen=false，到期自动放行', () => {
    openQuestion(1000) /* 清状态 */
    holdAnswer(2500, 1000)
    expect(answerOpen(3000)).toBe(false)
    expect(answerOpen(1000 + 2500)).toBe(true)
  })
  it('releaseAnswer 立即放行（onend 主路）', () => {
    holdAnswer(8000, 5000)
    expect(answerOpen(5400)).toBe(false)
    releaseAnswer()
    expect(answerOpen(5400)).toBe(true)
  })
})

describe('inputGuard 两段式确认间隔（P1-3：≥400ms）', () => {
  it('markArm 后 77ms 的确认击被拒（报告实测穿透间隔）', () => {
    markArm(1000)
    expect(confirmOk(1077)).toBe(false)
  })
  it('间隔恰为 GUARD_CONFIRM_MS-1 拒、≥GUARD_CONFIRM_MS 过', () => {
    markArm(2000)
    expect(confirmOk(2000 + GUARD_CONFIRM_MS - 1)).toBe(false)
    expect(confirmOk(2000 + GUARD_CONFIRM_MS)).toBe(true)
  })
  it('切试听别的选项后重置计时（点别项=重新起算）', () => {
    markArm(1000)
    markArm(3000)
    expect(confirmOk(3300)).toBe(false)
    expect(confirmOk(3400)).toBe(true)
  })
  it('常量与立法一致：CONFIRM=400、ENTRY/JUDGE ∈ [300,500]', () => {
    expect(GUARD_CONFIRM_MS).toBe(400)
    expect(GUARD_ENTRY_MS).toBeGreaterThanOrEqual(300)
    expect(GUARD_ENTRY_MS).toBeLessThanOrEqual(500)
    expect(GUARD_JUDGE_MS).toBeGreaterThanOrEqual(300)
    expect(GUARD_JUDGE_MS).toBeLessThanOrEqual(500)
  })
})
