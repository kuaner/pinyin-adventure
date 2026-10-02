/* 断言报告原语（flows 基建，非断言本体——断言只写在 specs/）。
   用法：const t = new Tally('规格名'); t.ok(cond, '行为名', extra); 结束时 t.finish() → 汇总打印+exit code。 */
export class Tally {
  constructor(title) {
    this.title = title
    this.pass = 0
    this.fail = 0
    this.failures = []
  }
  ok(cond, name, extra = '') {
    if (cond) { this.pass++; console.log(`  ✓ ${name}${extra ? '  ' + extra : ''}`) }
    else { this.fail++; this.failures.push(name + (extra ? `  ${extra}` : '')); console.log(`  ✗ ${name}${extra ? '  ' + extra : ''}`) }
  }
  /* 页面错误收集器并入汇总（零 pageerror 是硬门槛，与断言同权） */
  pageErrors(errs, label = '全程') {
    this.ok(!errs || errs.length === 0, `${label}零 pageerror`, (errs || []).slice(0, 2).join(' | '))
  }
  finish() {
    console.log(`\n===== ${this.title}：${this.pass} 过 / ${this.fail} 败 =====`)
    if (this.fail) console.log('失败项:\n  - ' + this.failures.join('\n  - '))
    return this.fail === 0 ? 0 : 1
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
