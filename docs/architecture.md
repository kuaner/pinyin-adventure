# 架构

## 总览

单页应用（无路由库）：`App.svelte` 按 `ui.view` 条件渲染九个视图组件；六个 runes 模块 store 承载全部状态；内容数据全部在 `src/data/*.json`；音频为 `public/audio/` 预生成 mp3。

```
用户操作 → 组件事件 → store 动作（出题/判分/加权/持久化）→ $state 变更 → 组件重渲染
```

## 状态层（src/stores，Svelte 5 runes）

| store | 职责 | 持久化 |
|---|---|---|
| `ui` | 视图路由 `show()`、toast、探针横幅、辨析卡弹窗、解锁层开关 | 否 |
| `progress` | `S` 单例（stars/cards/hist/bolt/mute）+ 关卡解锁判定 + 闪卡盒存取 | localStorage `pinyin_v2` |
| `weights` | 自适应权重（错×2 封顶 8 / 连对 2 衰减）、加权抽样 `wpick`、`pairW`（hot×3/毕业关镜像×2）、`pickDet`（70/30 先验） | 同上（S.weights） |
| `session` | 10 题会话机：`newSession/startLevel/startDet/startZi/startPractice/startPairGroup`、`answer`（判分/联动加权/反馈层/自动下一题）、`endQuiz`（星星/解锁/最易混/历史）、自动读音调度 | 历史写入 S.hist |
| `bolt` | ⚡会话：计时器、无限出题、HUD、结算（今日/历史最佳、礼花） | S.bolt |
| `flash` | 闪卡三盒：牌堆构建（到期优先）、翻面（自动读音）、自评移动盒子 | S.cards |

权重键空间：`b|d`（易混对）/ `L:b`（单字母）/ `M:b`（正反）/ `Z:爸` / `W:山水`。闪电与侦探题共用闯关的权重空间——侦探里写反判错会联动易混对加权（闯关也更常出）。

## 出题引擎（src/lib/quizEngine.ts，纯函数）

- **闯关**：`buildQuestions(scope)` — 混编 `listen×3, look×2, ll×3, rule×2`；`pickKey` 加权抽样（同键连续上限 2）；`makeQ` 生成干扰项（同类同域优先，池不足回退全局同类）。
- **侦探**：`buildDetQs(force)` — djudge/dfix 固定 6:4 模式（force 供截图：首题翻转为真）；`makeDfix` 选项全部正常字形且互不相同（镜像字形会和正常字形撞形），镜像只出现在题面大字。
- **常见字**：`ziQs()` — 8 单字 + 1 随机（字/词）+ 1 词；干扰项 = 声调翻转 + 同韵母 + 同声母异韵 + 随机补齐。
- **闪电**：`makeBoltQ()` — 18% 正反判断（可判断字母时）/ 40% 听选 / 42% 看选；题源 = 已解锁关卡的 pairs+pool 加权并集。

## 数据流（src/data）

`pinyin.json`（字母表 57 + 锚点 24 + 9 关 + 正反集）、`confusion.json`（14 对 + 组名）、`zi180.json`、`words.json`、`phrases.json`（UI 文案/题型名/夸奖语/练习配置）→ `data/index.ts` 统一出口（含 `PMAP` 双向索引、`ZIBY` 字表索引、`keysOf`）。文案统一带注音 DSL，渲染经 `T()` 转 ruby。

## 声音（src/lib/audio.ts）

三层架构（v5c 终局，无设备 TTS）：

1. **AudioContext**：`ac()` 手势内创建/resume（iOS 解锁）；`tone()` 合成反馈音（sndOk/sndNo/sndStar）。
2. **mp3 播放器**：`playAudio(name)` → `${BASE_URL}audio/{name}.mp3`，`AUDIO_CACHE` 复用元素；缺失/失败 → `opts.hint` toast 文字兜底。字母名映射：ü→`v`、ün→`vn`（ASCII 安全文件名）。
3. **自检**：`soundDiag()` 依次播 welcome→right 并报结果（家长向）。

解锁层首触：`ac()` + `preloadAudios()`（10 条高频）+ 手势内播 `welcome.mp3`。

## 验收钩子（src/lib/probe.ts）

仅 `?probe=` / `?open=` 访问时挂载 `window.__PJ`（会话/权重/音频缓存）。六个动态探针覆盖：闯关单题、10 题全通、侦探权重、闪电计数、常见字读音、闪卡翻面。`?open=` 直接渲染任一界面供截图（bolt 冻结计时）。`scripts/acceptance.mjs` + `scripts/visual-check.mjs` 为本地验收链（playwright 390×844）。

## 构建（vite.config.ts）

- `base`：本地 `/`，CI `GITHUB_PAGES=1` 时 `/pinyin-adventure/`。
- PWA：`registerType: autoUpdate`（新版本下次打开生效，不打断儿童答题）；precache 外壳（js/css/html/png/json），mp3 走 `runtimeCaching` CacheFirst（边播边缓存，首载零负担）。
- 音频 URL 不变：`public/audio/*` → `https://kuaner.github.io/pinyin-adventure/audio/*.mp3`。

## 部署（.github/workflows/deploy.yml）

`tag v*` 或手动触发 → `npm ci` → `vite build`（GITHUB_PAGES=1）→ upload-pages-artifact → deploy-pages → tag 时自动建 Release。Pages 站点为 **workflow 部署模式**；兜底预案：`gh api -X PUT repos/kuaner/pinyin-adventure/pages -f build_type=legacy` + 把 dist 推回 main 根目录。
