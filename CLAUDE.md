# 拼音闯关大冒险（pinyin-adventure）

儿童拼音闯关 PWA：8 关冒险 + 易混对大师毕业关、正反小侦探（镜像反写专治）、⚡闪电刷题 5 分钟冲刺、📖常见字快拼（一年级 180 字）、闪卡三盒复习、全量 ruby 拼音注音、纯预生成 mp3 音频。

## 技术栈

- **Svelte 5 + Vite + TypeScript**（无 SvelteKit：单页工具，无路由/SSR 需求）
- **Svelte 5 runes** 状态（`.svelte.ts` 模块级 store：`$state/$derived/$effect`）
- **vite-plugin-pwa**（manifest 自动生成；外壳离线可用，mp3 边播边缓存）
- 零运行时依赖，纯手写 CSS（`src/app.css`）

## 开发

```bash
npm install
npm run dev          # 开发服务器
npm run build        # 生产构建 → dist/（CI 加 GITHUB_PAGES=1 时 base=/pinyin-adventure/）
npm run preview      # 预览生产构建
node scripts/acceptance.mjs   # 验收链（需 preview 在 4173 端口）
node scripts/visual-check.mjs # 视觉度量校验
```

## 结构

```
src/
  main.ts                 # 入口：mount App
  app.css                 # 全局样式（v1 单文件 CSS 逐字移植，类名/id 不变）
  App.svelte              # 视图路由 + 解锁层/弹窗/反馈/探针横幅/toast
  stores/                 # runes 模块 store
    ui.svelte.ts          # 视图路由 show()/toast()/探针横幅/辨析卡弹窗/解锁层
    progress.svelte.ts    # 星星/历史/闪卡盒/闪电纪录（S 单例）
    weights.svelte.ts     # 自适应权重（错×2 封顶 8，连对 2 衰减）+ 正反 70/30 先验 pickDet
    session.svelte.ts     # 10 题会话（闯关/侦探/快拼/专练共用）：answer/反馈/结算/历史
    bolt.svelte.ts        # ⚡闪电会话（5 分钟计时/连对/纪录/礼花）
    flash.svelte.ts       # 闪卡三盒（到期优先排序/自评移动盒子）
  lib/
    audio.ts              # 声音三层：AudioContext 反馈音 / mp3 播放器 / 🔊自检
    ruby.ts               # v2.1 pinyin-pro 引擎：T('答对啦') 逐字自动注音（三层兜底+词组 nowrap）
    icons.ts              # naive-icons 手绘 SVG 内联（MIT 48 枚，Icon.svelte 渲染）
    storage.ts            # localStorage pinyin_v2 读写
    quizEngine.ts         # 出题引擎（闯关混编/侦探/快拼干扰项/闪电抽样）
    probe.ts              # ?probe=/?open= 验收自动化钩子（正常使用零开销）
    types.ts              # 数据结构与题目类型
  components/
    HomePage / LevelMap / QuizPage / ResultsPage / Flashcards /
    PairsPage / PracticePage / HistoryPage / BoltSprint      # 页面
    quiz/ListenQ LookQ                                      # 闯关题型（v2.3：LlQ/RuleQ 已删——零错误信息铁律）
    MirrorDetect（正反判断+修复题） ZiQuiz（看字/词选拼音）   # 题型
    AnchorBar PairModal Feedback Ruby UpdatePrompt           # 通用件（v2.3：解锁层删除，新增更新提示条）
    learn/（v2.2 学习岛）LearnIsland 星图 · LessonPage 五步课 · StrokeAnim 笔顺动画 · ToneDrill/BlendDrill
  data/                   # 全部内容数据（代码里不许内联大数组）
    pinyin.json           # 字母表 57 条(口诀/例词) + 锚点表 + 9 关 + 正反覆盖集
    confusion.json        # 14 组易混对 + 组名
    zi180.json            # 一年级 180 字（拼音逐字核对过）
    words.json            # 30 双字词
    phrases.json          # UI 短语/题型名/夸奖语/自由练习配置
    lessons.json          # 学习岛 12 课（字母/口诀/写法旁白/声调/拼读表）
    strokes.json          # 47 单元笔顺 SVG 几何（v2.3 换血：lasagoo/letter-writing 底本+部编版适配，生成器 gen-strokes-lw.mjs 勿手改；stroke-verify.mjs 自检）
public/audio/             # 根 mimo 305 + hyp/ 441（studycli 真人音）+ lessons/ 146（学习岛 mimo）
scripts/                  # 一次性/验收脚本（extract-data 抽取留档、gen-icons、acceptance、visual-check、stroke-verify、learn-shots）
```

## 数据格式

- **注音（v2.1 pinyin-pro 引擎）**：数据 JSON 存纯汉字文案，渲染时 `<Ruby text>` / `T()` 自动注音（`lib/ruby.ts`）；多音字兜底 = 全局覆盖表 `data/pinyin-overrides.json`（17 词条，与 `scripts/check-pinyin.mjs` 回归校验同源）+ 组件 `py` 参数逃生口；`data/pinyin-dict.json` words 键供词边界（nowrap 分组），不供读音。
- **字母表**：`{cat: sm|ym|zt, tts: 呼读音, han: 直注汉字, kj/kjf: 正确/干扰口诀, word/wp/em: 例词}`。
- **localStorage**：键 `pinyin_v2`，结构 `{weights, stars, cards, hist, mute, bolt}`；无历史迁移（v1 键 `pinyin_app_v1` 已废弃，kuaner 定：无兼容包袱）。
- **权重键**：`b|d` 易混对 / `L:b` 单字母 / `M:b` 正反字母 / `Z:爸`、`W:山水` 常见字词。

## 硬约束

1. **音频纯 mp3**：`playAudio(name)` = `audio/{name}.mp3`，缺失 → toast 文字兜底（读音像「玻」）。**全仓禁 speechSynthesis / 设备 TTS**（v5c kuaner 定夺："系统tts效果太差，放弃"；`grep -c speechSynthesis` 全仓必须 = 0）。
2. **新增音频的 TTS 文本禁拉丁字母**（mimo 会把拉丁字母念成字母名——anchor_*.mp3 重录的教训，见 git 历史 7f7446c）；ü 用文件名 `v.mp3`、ün 用 `vn.mp3`（ASCII 安全名）。
3. **行为零回退**：v1 单文件 index.html（git 历史 c3e0655 及之前）是行为正本，改交互前先对照它逐模式核对。
4. 儿童可见文字必须带 ruby 注音；家长向文本（历史表格/诊断 toast/隐私说明）可不注音。
5. 数据改动进 `src/data/*.json`，不在组件里内联大数组。
6. **零错误信息铁律**（v2.3）：面向孩子的题目不得以任何形式展示错误配对/错误形态/错误口诀——ll 听看一致、rule 错句判断、"看大字选一样"已全面删除；闯关=listen/look/kj（口诀正向回忆），闪电=blisten(70%)/bkj(30%)；答错只展示正确答案+读音。
7. **注音收口**（Bug#2）：数据层纯文本，渲染层中文一律 T()/Ruby；`node scripts/check-ruby.mjs` 是 lint 门槛（裸中文插值=warning）。
8. **PWA 更新**（v2.3 照 bambu-nfc）：registerType 'prompt' + UpdatePrompt（onNeedRefresh 提示条 + visibilitychange 主动 SW.update()）；改回 autoUpdate 前先想清楚儿童场景。

## 发布流程

1. 更新 `package.json` 的 `version`
2. `git add -A && git commit && git push origin main`
3. `git tag vX.Y.Z && git push origin vX.Y.Z` → Actions（`.github/workflows/deploy.yml`）：`npm ci` → `vite build`（GITHUB_PAGES=1）→ 部署 Pages → 自动建 Release
4. Pages 为 **workflow 部署模式**（`build_type=workflow`）；若需回退：`gh api -X PUT repos/kuaner/pinyin-adventure/pages -f build_type=legacy`

## 验收探针

- `?probe=` / `full` / `det` / `bolt` / `zi` / `flash`：动态探针（进题→作答→验证权重/计数/反馈层）
- `?open=levels|pairs|practice|history|result|quiz|detect|dfix|bolt|zi|ziword`：直接渲染对应界面（截图用；bolt 冻结计时）
- `window.__PJ`：会话/权重/音频缓存钩子（仅带参访问时挂载）
- 笔顺自检 `node scripts/stroke-verify.mjs`（47 单元×2 帧截图+几何断言）；注音 lint `node scripts/check-ruby.mjs`；全量验收 `node scripts/acceptance-v23.mjs`
