# tests/ — 测试体系（T1 基建，2026-10-02）

质量底线（kuaner 立法）：**bug 对孩子不是 bug，是"我答错了"的挫败——任何逻辑错误都不可接受。**

## 目录

```
tests/
  unit/            # Vitest 单测（jsdom，runes store 直测）
    setup.ts       #   全局 stub（媒体静默/jsdom localStorage 接回）
    *.test.ts      #   账本/连击/每日/出题引擎/权重/成长/学习进度
  e2e/             # 系统回归包（playwright，真实 preview 全流程）
    run-all.mjs    #   统一 runner（自起 preview，串行全跑）
    v30..v431      #   存量验收收编（断言原样，独立可跑）
    regression-*   #   命名回归样例（Bug#36/37）
```

## 怎么跑

```bash
npm test                # 单测（vitest run，CI 同款）
npm run test:coverage   # 单测+覆盖率报告 → coverage/
npm run e2e             # 回归包：自起 preview 4173 → 串行跑 12 个脚本 → 汇总退出码
npm run e2e -- v43      # 只跑名字前缀匹配的腿
BASE_URL=https://… npm run e2e   # 打线上跑（不起本地 preview）
```

单条 e2e 脚本独立可跑（保持存量习惯）：`node tests/e2e/v40-accept.mjs`（preview 需已在 4173）。

## 规矩（2026-10-02 起生效）

1. **修 bug 先写失败测试**：任何 bug 修复前，先在 tests/unit 或 tests/e2e 写一个红灯的复现用例
   （命名回归样例格式见 `regression-bug36-coexist.mjs` 头注），修复后该用例转绿并永久进套件。
   参考活标本：Bug#38 候选（见下）。
2. **新功能腿**：acceptance 必含新模块单测 + 关键路径 e2e；新 store/逻辑模块进 `tests/unit/`，
   新交互面进回归包（或新增 vXX-accept 收编）。
3. **覆盖率只升不降**：CI 跑 `npm run test:coverage` 出报告；核心逻辑模块（stores/ + lib/）
   现状 92-100%，T2 目标接近全绿——改动不许让现有数字下降。
4. **e2e 零 pageerror 是硬门槛**：回归包任何脚本出现 pageerror 即失败。
5. 断言即文档：单测用例名写"行为+边界+为什么"（照 `tests/unit/combo.test.ts` 的风格）。

## CI 测试门

`.github/workflows/deploy.yml`：`test`（单测+coverage）与 `e2e`（回归包）两个 job 前置，
`build` job `needs: [test, e2e]`——**任何红灯=tag 部署被阻断**（needs 链实证）。
PR / push main 只跑 test+e2e 不部署；release 仍仅 tag 触发。

## 当前已知缺陷候选（T2 队列，先写失败测试再修）

- **Bug#38 候选（每日挑战种子覆盖缺口）**：`buildDailyQs` 的日期种子只覆盖目标字母抽样与洗牌，
  非镜像字母的干扰项 `gameDistractor` 内部走 `Math.random()`（`src/lib/gameEngine.ts` 同 cat/兜底回落分支）
  → 同日重开每日挑战，该类题的选项搭档可漂移。已成立的契约（type+A 序列稳定、镜像对/识字题逐字节面稳定）
  由 `tests/unit/gameEngine.test.ts`「同日两次生成」用例锁定；完整逐字节面稳定的失败测试即在该用例上
  把 `fullySeeded` 条件去掉——修复=gameDistractor 加可选 rng 参数（注入性改动）并由 buildDailyQs 传入
  种子 rng。v40-accept 当年只断言 `type:(A|z:h)` 层，故未覆盖到此。

## 存量收编说明

v30/v31/v312/v32/v40/v401/v41/v42/v43/v431 十腿验收脚本 `git mv` 进 tests/e2e/（历史保留），
**脚本本体零改动**（playwright 导入的 npx 回退路径为本地历史遗产，devDependency 装了 playwright 后
永不触发）。更早的 acceptance-v23/v24/v261/v290/v292/v293/v294 留在 scripts/ 作 v1-v2.9 历史档案
（其断言面是已删除的 v2 时代 UI，不再具备回归意义——repo CLAUDE.md 已注 v293 系列归档）。
