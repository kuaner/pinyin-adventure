# tests/ — 测试体系（T1 基建 v4.4.0 → T2 全量单测+组件测 v4.5.0 → **T3 e2e 工程化矩阵 v4.6.0**）

质量底线（kuaner 立法）：**bug 对孩子不是 bug，是"我答错了"的挫败——任何逻辑错误都不可接受。**

## 目录（终态）

```
tests/
  unit/            # Vitest 单测（jsdom，runes store 直测；目录 1:1 镜像 src）
    setup.ts       #   全局 stub（媒体静默/jsdom localStorage 接回/SVG getTotalLength/ResizeObserver）
    lib/ stores/ data/ text/   # lib 12 模块 / stores 9 / 数据完整性 / 文案层
  components/      # T2 组件测（@testing-library/svelte，browser condition）
    PinyinCard / Speak / HSteps / StrokeAnim / ToneDrill / LookQ   # 6 组件 448 测试
  e2e/             # T3 工程化矩阵（playwright，真实 preview 全流程）
    run-all.mjs    #   统一 runner（自起 preview 4173 → 串行驱动 specs+cross → flake 加固重试 → 汇总）
    screens.ts     #   屏幕清单注册表：每屏=入口路由+关键断言(ready)+滚动根+ruby 下限——新屏登记即被横切面覆盖
    flows/         #   page-object 操作层（导航与操作只写一次，零断言）
      bootApp.mjs      # 浏览器/页面工厂：种子开页+验收观察者(__AUDIO_LOG/__DOM_LOG/__TLOG)+gotoScreen
      seedState.mjs    # fixtures 种子注入应用侧（用例内禁手工拼 localStorage）+ 账本读取器
      gotoLesson.mjs   # 学习岛：openLesson/swipeLeft/curScope/glyphState/参与证据/拦截卡/ToneDrill
      playGame.mjs     # 游戏岛：真实开局 enterGame/enterDrill/打中当前目标四游戏/HUD/可视区等待
      answerQuiz.mjs   # 各题面作答（两段式适用矩阵在此固化：字母题一点即答/带调题两段式）
      assert.mjs       # Tally 断言报告原语（断言本体只住 specs/）
    specs/         #   断言层（按域组织，测试名=用户可见行为）
      learn/       lessonMatrix（12课×全步骤矩阵） participation（拦截/放行） stroke（字模+四线格） navigation（导航流+sweep）
      games/       hub audioFirst（音序先行） coexist（共存立法） playScoring（计分连击+退场结算）
                   moleRiddle（谜面制+练习制） duelLock（单答锁） eggTone（蛋+音乐会） noLeak（零泄漏审计）
      drills/      bolt listen pairs zi blendTone twoPhase（两段式矩阵） autoAdvance（自动推进+过渡）
      growth/      quizChain album evolve badges daily（每日种子链）
      pwa/         swUpdate（SW更新链） offline（断网重进） audioAssets（音频可达含 riddle/）
    cross/         crossScreens.spec.mjs —— 横切面参数化：遍历 screens.ts 逐屏断言
                   零滚动（doc+tab 容器级）/零横向溢出/零 pageerror/nowrap 短标签单行（rt 豁免）/ruby 注音下限
  fixtures/        # 确定性状态种子（三档 localStorage 快照，全部 e2e 共享）
    seeds.mjs      #   newbie 新生 / mid 中期（L1-4 课+若干星）/ grad 毕业（12课全通）+ 覆盖项 + 课结构推导
```

## 怎么跑

```bash
npm test                # 全部单测+组件测（vitest run，CI 同款）
npm run test:coverage   # +覆盖率报告 → coverage/（低于门槛=退出码非零）
npm run e2e             # e2e 矩阵：自起 preview 4173 → 串行跑 specs/五域 + cross/ → 汇总退出码
npm run e2e -- learn    # 按域跑（learn/games/drills/growth/pwa/cross）
npm run e2e -- mole     # 按文件名子串跑
BASE_URL=https://… npm run e2e   # 打线上跑（不起本地 preview；pwa/swUpdate 需磁盘控制权会自动跳过）
```

单条 spec 独立可跑：`node tests/e2e/specs/learn/lessonMatrix.spec.mjs`（preview 需已在 4173）。

## 工程规矩（T3 立法，2026-10-02 生效）

1. **断言只写在 specs/（含 cross/）**：flows/ 只管操作复用——同一导航逻辑禁止在两处出现；
   新增操作先问 flows 里有没有，没有才加 flows。
2. **测试名=用户可见行为**（"答对后 0.8s 自动出下一题"），不测内部实现细节（实现重构测试不红）。
3. **状态一律经 fixtures 三档种子注入**（tests/fixtures/seeds.mjs），用例内禁手工拼 localStorage；
   弱项/账本覆盖走 seedState 的 ledger 覆盖项。
4. **新屏幕必须登记 screens.ts**：入口路由+ready 断言+seed 档+ruby 下限——登记即自动被横切面
   （零滚动/零 pageerror/nowrap/ruby）覆盖，不需要手写横切断言。
5. **存量 v*-accept 断言已全部迁入 specs 对应域并删除脚本**（T3 收编，无双轨）：
   v30→learn/{lessonMatrix,navigation} · v31→learn/stroke · v312→learn/stroke+pwa/audioAssets ·
   v32→growth/{quizChain,album,evolve,badges} · v40→games/{hub,playScoring}+growth/daily ·
   v401→learn/participation · v41→games/audioFirst · v42→games/{hub,moleRiddle}+drills/{bolt,listen,pairs,zi} ·
   v43→games/{eggTone,hub}+drills/blendTone · v431→games/{coexist,hub}+drills/{twoPhase,listen} ·
   bug36→games/coexist · bug37→drills/twoPhase · bug38→drills/{autoAdvance,twoPhase} ·
   bug39→games/moleRiddle · bug40→games/eggTone · bug41→games/noLeak · bug42→games/duelLock。
   更早的 v1-v2.9 脚本仍在 scripts/ 作历史档案（断言面是已删除的 v2 时代 UI）。
6. **修 bug 先写失败测试**：任何 bug 修复前先写红灯复现用例（本目录规矩沿用 T1/T2；
   T3 红出并修掉的：woff2 不入 SW precache=断网字体闪退→globPatterns 补 woff2）。

## 覆盖率门槛（T2 落地，只升不降棘轮）

`vitest.config.ts` coverage.thresholds：**src/{lib,stores,data,text} 聚合行覆盖 ≥95%**——
低于门槛=退出码非零=CI 红灯。v4.5.0 起点实测：聚合 98.5%（lib 98.0 / stores 98.4 / data 100 / text 100）。

## CI 测试门

`.github/workflows/deploy.yml`（T3 重构）：`unit`（单测+coverage 硬门槛）与 `e2e`（矩阵，**仅 tag 触发**）
两个 job 独立——**main push / PR 只跑 unit（省 e2e 12 分钟重复）**；tag 流水 `build.needs:[unit, e2e]`
红灯阻断部署。e2e job 按域分片（unit→build 前的 5 域并行 shard）可选启用，默认串行全跑。

## T2 修掉的产品 bug（先红后绿，单测收编）

Bug#38 每日种子覆盖缺口 / Bug#39 $state 首建孤儿写 / Bug#40 复合单元崩题 / Bug#41 pyAudio 基母错序——
详见 git 历史 v4.5.0 提交说明。

## T3 新增覆盖面（v*-accept 没有、本腿补齐）

- **12 课×全步骤矩阵全量化**：全部 12 课页数/步数（fixtures 推导对拍）+ 代表课全步骤走查（参与证据→声调→自动推进→chip ✓）
- **PWA 三面**：SW 更新链（prompt 立法：提示条不自动刷→点击→ready 后 reload）、断网重进（缓存命中零网络+外壳可用）、音频可达（预载缓存+点击<100ms+riddle 谜面库 51 条点名）
- **横切面参数化**：23 屏清单遍历（零滚动/零横向溢出/零 pageerror/nowrap/ruby）——新屏登记即覆盖
- **升级体系事件链**：小测过关→庆祝+星+徽章→卡片图鉴口径→进化记账→签到阈值→徽章兑现
