# tests/ — 测试体系（T1 基建 v4.4.0 → T2 全量单测+组件测 v4.5.0，2026-10-02）

质量底线（kuaner 立法）：**bug 对孩子不是 bug，是"我答错了"的挫败——任何逻辑错误都不可接受。**

## 目录

```
tests/
  unit/            # Vitest 单测（jsdom，runes store 直测；目录 1:1 镜像 src）
    setup.ts       #   全局 stub（媒体静默/jsdom localStorage 接回/SVG getTotalLength/ResizeObserver）
    *.test.ts      #   T1 存量：账本/连击/每日/出题引擎/权重/成长/学习进度
    lib/           #   T2：quizEngine/ruby/audio/storage/lessonUnits/ziGate/hsteps/probe/icons/toneMarks/types/gameEngineEdges
    stores/        #   T2：bolt/flash/session/ui/gameSession/weightsEdges/learnEdges
    data/          #   T2：数据完整性（63 单元三方一致/PAIRS/180 字/关卡引用/hyp 映射）
    text/          #   T2：strings 取值出口 + manifest 配音清单可溯源
  components/      # T2 组件测（@testing-library/svelte，浏览器构建）
    PinyinCard.test.ts   # 三档形态（full/card/mini）+ 点读链
    Speak.test.ts        # 注音渲染 + 可点播示能 + __AUDIO_LOG 发声证据
    HSteps.test.ts       # 轴锁/死区/阈值翻页事件接线（纯逻辑在 unit/lib/hsteps）
    StrokeAnim.test.ts   # glyph 字模/静态帧/idleDone/播放链（假 rAF）
    ToneDrill.test.ts    # 声调小练两段式（arm→answer）+ 4 题结算
    LookQ.test.ts        # 看字选音两段式（session store 状态流）
  e2e/             # 系统回归包（playwright，真实 preview 全流程）
    run-all.mjs    #   统一 runner（自起 preview，串行全跑）
    v30..v431      #   存量验收收编（断言原样，独立可跑）
    regression-*   #   命名回归样例（Bug#36/37）
```

## 怎么跑

```bash
npm test                # 全部单测+组件测（vitest run，CI 同款）
npm run test:coverage   # +覆盖率报告 → coverage/（低于门槛=退出码非零）
npm run e2e             # 回归包：自起 preview 4173 → 串行跑 12 个脚本 → 汇总退出码
npm run e2e -- v43      # 只跑名字前缀匹配的腿
BASE_URL=https://… npm run e2e   # 打线上跑（不起本地 preview）
```

单条 e2e 脚本独立可跑（保持存量习惯）：`node tests/e2e/v40-accept.mjs`（preview 需已在 4173）。

## 覆盖率门槛（T2 落地，只升不降棘轮）

`vitest.config.ts` coverage.thresholds：**src/{lib,stores,data,text} 聚合行覆盖 ≥95%**——
低于门槛=退出码非零=CI 红灯（负面测试实证：抬到 99.9% → exit 1）。v4.5.0 起点实测：

| 层 | 行覆盖 |
|---|---|
| src/lib | 98.0%（quizEngine 97.8 / audio 95 / probe 95.7 / gameEngine 98.2 / 其余 100） |
| src/stores | 98.4%（bolt 98.5 / flash 97.1 / game 99.2 / 其余 100） |
| src/data | 100% |
| src/text | 100% |
| **聚合（门槛组）** | **98.5%** |

.svelte 组件不入阈值组（组件面由 components/ 测试与 e2e 回归包守护），但保留在报告可见
（components/ 现状 ~16%，PinyinCard/HSteps/StrokeAnim/ToneDrill/LookQ/Speak 已挂测）。

## 规矩（2026-10-02 起生效）

1. **修 bug 先写失败测试**：任何 bug 修复前，先在 tests/unit 或 tests/e2e 写一个红灯的复现用例
   （命名回归样例格式见 `regression-bug36-coexist.mjs` 头注），修复后该用例转绿并永久进套件。
   T2 实证三连：Bug#39（gameRec 首建孤儿写丢 best）、Bug#40（过 L10 后每日挑战/对决 TypeError）、
   Bug#41（pyAudio 基母串错序→两段式试听播错键）——全部先红后绿收编。
2. **新功能腿**：acceptance 必含新模块单测 + 关键路径 e2e；新 store/逻辑模块进 `tests/unit/`（1:1 镜像），
   新交互组件进 `tests/components/`，新屏幕进回归包。
3. **覆盖率只升不降**：CI 跑 `npm run test:coverage`，门槛在 vitest 配置里硬执行（见上表）。
4. **e2e 零 pageerror 是硬门槛**：回归包任何脚本出现 pageerror 即失败。
5. 断言即文档：单测用例名写"行为+边界+为什么"（照 `tests/unit/combo.test.ts` 的风格）。

## CI 测试门

`.github/workflows/deploy.yml`：`test`（全部测试+coverage 硬门槛）与 `e2e`（回归包）两个 job 前置，
`build` job `needs: [test, e2e]`——**任何红灯=tag 部署被阻断**（needs 链实证）。
PR / push main 只跑 test+e2e 不部署；release 仍仅 tag 触发。

## T2 修掉的产品 bug（先红后绿，单测收编）

- **Bug#38（每日挑战种子覆盖缺口）**：`gameDistractor` 加可选 rng 参数（缺省 Math.random=行为不变），
  `letterQ` 传入日期种子 rng——同日两次生成 10 题逐字节面稳定（用例去掉 fullySeeded 条件后转绿）。
- **Bug#39（$state 首建孤儿写）**：`gameRec` 首建后二次读取存内记录再续写/返回——修前 fakeResult 的
  best 抬升写在不回传的孤儿对象上（Svelte5 $state 首建分支 raw 视图坑）。
- **Bug#40（复合单元崩题）**：üe/er/ong/yi/wu/yu 是课内单元但不在 LETTERS——过 L10 后
  buildDailyQs 100% TypeError、镜像对决 ~10% 崩。修=gameDistractor/letterQ/duelQ 防御读 +
  无口诀单元不出口诀题（回退听写，stmt 恒非空）。
- **Bug#41（两段式试听播错键）**：pyAudio 基母串 'aeiouü'（a,e,i,o,u 序）与 TONE_VOWELS
  （a,o,e,i,u 序）错位 → e/i/o 调族整体错键（shí→sho4）。修=基母串改 'aoeiuv'（与 ziGate BASEV 同款）。

## 产品码可测性改动清单（T2，行为零变化逐条）

1. `src/lib/hsteps.ts` 新建：HSteps 的轴锁/阈值/橡皮筋抽纯函数（pickAxis/flipsPage/dragOffset），
   HSteps.svelte 改为调用——逐行等价抽取，组件测=纯函数单测+事件接线两层。
2. `src/lib/gameEngine.ts`：gameDistractor 第三可选参数 rng（缺省 Math.random）；letterQ/duelQ/letterQ
   防御读（Bug#38/#40 修复面，见上）。
3. `src/lib/audio.ts`：pyAudio 基母串一字修正（Bug#41）。
4. `src/stores/game.svelte.ts`：gameRec 首建分支改二次读取（Bug#39）。

## 存量收编说明

v30/v31/v312/v32/v40/v401/v41/v42/v43/v431 十腿验收脚本 `git mv` 进 tests/e2e/（历史保留），
**脚本本体零改动**（playwright 导入的 npx 回退路径为本地历史遗产，devDependency 装了 playwright 后
永不触发）。更早的 acceptance-v23/v24/v261/v290/v292/v293/v294 留在 scripts/ 作 v1-v2.9 历史档案
（其断言面是已删除的 v2 时代 UI，不再具备回归意义——repo CLAUDE.md 已注 v293 系列归档）。

## v4.5 游戏五连修（2026-10-02，Bug#38-#42 + 测试修复腿）

- **Bug#42 镜像对决双中**：`inputLock` 输入闸（单答锁+切题宽假期 320ms+动画期锁）+反馈只亮点过的
  选项（picked，答对不全员刷红）。回归=`regression-bug42-duel-single-answer.mjs`（真实 CDP 触摸连答
  10 题+页内定时探针枪+账本恰好 10 记）。
- **Bug#39 口诀地鼠谜面制**：出题播谜面（`riddle/*` mimo 中文 51 条，`scripts/gen-riddles.mjs` 派生+
  组合式口诀跳过）；点对播整句口诀奖励再换题；练习制（无 60s 计时、✕=结算、错点晃动+地鼠不走+可重听）。
  回归=`regression-bug39-mole-riddle.mjs`。
- **Bug#40 蛋半两行网格**：decoyKeys 首分支缺截断（整池上屏挤 7-8 块）修复+grid 布局
  （块 ≥56px/字模 30px/间距 10px）。回归=`regression-bug40-egg-grid.mjs`（3 轮几何硬断言）。
- **Bug#41 视觉去答**：音乐会 🔊 旁只显基础音节；**全游戏泄漏审计**——对决/每日/闯关/闪电口诀题面
  谜面化（`riddleText` 剥字母）+口诀题音频改谜面（`riddleAudio`）。回归=`regression-bug41-no-leak.mjs`
  （四面板文字零字母+音乐会无调号）。
- **Bug#38 两段式适用矩阵**：listen 类（选项=已学单字母）一点即答（session.armOpt/dailyArm/
  ListenDrill/LessonPage.armQuiz 四入口）；zi/look/tone 保留两段式；连续出题面切题滑入（.qslide）+
  session 反馈自动推进定档对 0.8s/错 1.6s。回归=`regression-bug38-auto-advance.mjs`+bug37 样例（矩阵版）。
- **v312 flake 加固**：A2 计时前预热重载；run-all 首败自动重试一次（重试过=绿+⟲flake 标注）。
- 单测 448→**453**（Bug#15 spy 用例修复 2 条：AbortError/NotAllowedError 静默走 toastOn 可观察断言；
  riddle 函数 4 条；矩阵/谜面契约更新 5 条）。
