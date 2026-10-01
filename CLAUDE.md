# 拼音闯关大冒险（pinyin-adventure）

儿童拼音闯关 PWA：**v2.4 App 壳 = 底部 tab×3（学习/练习/我的）+ 全屏专注态**，一屏一事零纵向滚动、题内横向翻页、声音礼仪三规则（入口过场音清零/点了才说/一次一路）。内容：学习岛 12 课（**v3.0 按字母分**：每字母=学一学合并页→声调页→自动进下一字母，全部走完→课级拼读（hasBlend 课）→课级小测；**v3.1 字模=笔顺动画**：学一学页唯一 z 即笔顺动画本体（idleDone 空闲定格完整字/进页自动播/可重播），全部播放键 ≥48px 儿童触控；进度=字母 chip 条，小测三题型=听音选字母/看字母选音/听调辨调·仅韵母课）、8 关冒险 + 易混对大师毕业关、正反小侦探、⚡闪电刷题、📖常见字快拼、🎧口诀小广播（63 条连播/循环）、闪卡三盒复习、全量 ruby 注音、纯预生成 mp3；**v3.2 升级体系**=小鸡成长线（五阶段 0/50/150/300/500 星进阶+进化动画）+卡片图鉴（63 张课级解锁）+庆祝仪式（过关/字母/毕业/进化四模式，可跳过）+签到连击+10 枚成就徽章。

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
  App.svelte              # v2.4 壳路由：tab×3（LearnTab/PracticeTab/MineTab）+ 专注态视图 + TabBar
  components/
    TabBar / HSteps（横向翻页容器：拖拽+阈值吸附+页点）   # v2.4 壳件
    home/LearnTab（大卡+12课胶囊条+广播入口） PracticeTab（6模式卡阵） MineTab（小鸡+周历+家长区）
    RadioPage（口诀小广播） parents/SoundEtiquette + SettingsPage   # v2.4 新页
    HomePage.svelte / learn/LearnIsland.svelte             # v2.4 删除（模块入口页作废）
  stores/                 # runes 模块 store
    ui.svelte.ts          # 视图路由 show()/toast()/探针横幅/辨析卡弹窗/解锁层
    progress.svelte.ts    # 星星/历史/闪卡盒/闪电纪录（S 单例）
    growth.svelte.ts      # v3.2 升级体系（成长星星/徽章/庆祝状态机；pinyin_growth_v1 带版本号；卡片=课级进度派生、日历=S.days 派生）
    weights.svelte.ts     # 自适应权重（错×2 封顶 8，连对 2 衰减）+ 正反 70/30 先验 pickDet
    session.svelte.ts     # 10 题会话（闯关/侦探/快拼/专练共用）：answer/反馈/结算/历史
    bolt.svelte.ts        # ⚡闪电会话（5 分钟计时/连对/纪录/礼花）
    flash.svelte.ts       # 闪卡三盒（到期优先排序/自评移动盒子）
  text/                   # v2.6 文案层（唯一真相+配音清单）
    strings.ts            # 全 app 用户可见字符串唯一真相（key→中文，216 键；组件禁字面量中文，lint 强制）
    audio-manifest.json   # 配音清单（gen-audio.ts 产出）：keys=key→文件，zh=数据层文案反查
    manifest.ts           # 清单运行时入口（Speak 点播依据）
  lib/
    audio.ts              # 声音两层：AudioContext 反馈音 / mp3 播放器（🔊自检已删）
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
    AnchorBar PairModal Feedback UpdatePrompt                # 通用件（v2.3：解锁层删除，新增更新提示条）
    Speak.svelte         # v2.6 Ruby 升级：注音渲染+有音频则整段可点击播放（轻按压反馈+小声波纹）；全 app 文案/题面/反馈走它
    PinyinCard（v2.5 统一学习卡片：full=学习岛认识页/口诀广播展开区，card=闪卡，mini=答错反馈；五要素=字模四线三格/真人读音/笔顺动画/口诀/例词；数据 data/pinyin-cards.json）
    growth/（v3.2 升级体系）ChickGrowth（五阶段同坐标系 SVG） · CardAlbum（63 张图鉴 9 张/页横滑） · CelebrationOverlay（quiz/letter/grad/evolve，z120 可跳过） · StreakCalendar · BadgeWall
    learn/（v2.2 学习岛）LearnIsland 星图 · LessonPage v3.0 按字母分课（学一学合并页+声调，lib/lessonUnits.ts 页序推导） · StrokeAnim 笔顺动画 · ToneDrill/BlendDrill
  data/                   # 全部内容数据（代码里不许内联大数组）
    pinyin.json           # 字母表 57 条(口诀/例词) + 锚点表 + 9 关 + 正反覆盖集
    confusion.json        # 14 组易混对 + 组名
    zi180.json            # 一年级 180 字（拼音逐字核对过）
    words.json            # 30 双字词
    phrases.json          # UI 短语/题型名/夸奖语/自由练习配置
    lessons.json          # 学习岛 12 课（字母/口诀/写法旁白/声调/拼读表/hasBlend 动态步数）
    strokes.json          # 47 单元笔顺 SVG 几何（v2.3 换血：lasagoo/letter-writing 底本+部编版适配，生成器 gen-strokes-lw.mjs 勿手改；stroke-verify.mjs 自检）
    pinyin-cards.json     # v2.5 PinyinCard 数据正本（一拼音一条记录，gen-pinyin-cards.mjs 从 pinyin/lessons/strokes 聚合生成，勿手改）
public/audio/             # 根 mimo 305 + hyp/ 441（studycli 真人音）+ lessons/ 146（学习岛 mimo）
scripts/                  # 一次性/验收脚本（gen-audio.ts=v2.6 配音清单生成器：扫描 strings+数据→diff→补生成，mimo 冰糖/hyp 拼接铁律）（extract-data 抽取留档、gen-icons、acceptance、visual-check、stroke-verify、learn-shots）
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
7. **注音收口+文案层**（Bug#2 → v2.6）：数据层纯文本；用户可见字符串唯一真相=src/text/strings.ts（key→中文），组件/stores 禁中文字面量；渲染走 `<Speak k=…/>`（注音+点播）；`node scripts/check-ruby.mjs` 是 lint 门槛（字面量=exit 2）。
8. **PWA 更新**（v2.3 照 bambu-nfc）：registerType 'prompt' + UpdatePrompt（onNeedRefresh 提示条 + visibilitychange 主动 SW.update()）；改回 autoUpdate 前先想清楚儿童场景。
9. **声音礼仪三规则**（v2.4）：R1 零过场音（入口/切tab/翻页静音，grep 验收 `lessons/open_|lessons/step_|playAudio('go')`=0）；R2 声音只从点读/听题/对错反馈三处来（v2.6 起全 app 零自动语音：题面音一律 🔊 大按钮点播，孩子控节奏；文案层 Speak 有音频即可点播）；R3 一次一路（audio.ts 单通道锁 stopAll()，新声音停旧声）；R4 静音总开关只在家长区设置页；R5 唯一例外=口诀连播（手动开启）。
10. **零纵向滚动**（v2.4 立，v2.9.3 架构根治 BUGS#24 两次复发）：滚动禁令容器级自扛，不靠祖先链继承——课页最外层 `#lesson-root`（height:100dvh + overflow hidden/**clip** + flex column，固定件 flex:none / 舞台 flex:1 1 0；v3.0 加 clip=连编程滚动都不可能，scrollIntoView 连带滚祖先类 bug 根绝，BUGS#30）、三 tab 屏 `#tab-view-root`（height:calc(100dvh - var(--tabbar-h)) + overflow:hidden）各自硬锁；内容放不下=卡内压缩/横滑胶囊条消化（L12 18 chip 条、整体认读 zt 分页 2×2），绝不出现纵向滚动。**验收必须真实切换流**（tab→进课→返回→换课 × 12 课 × 全单元 chip × 切字母 × 3 档视口），只验初始状态=BUGS#24 同款复发；v3.0 起 `node scripts/v30-accept.mjs`（结构反转+零左移+零滚动+自动推进，28 断言）+ `node scripts/v31-accept.mjs`（v3.1 字模合体：单 z 断言+idleDone 定格+全部播放键 ≥48px 几何实测，27 断言）+ `node scripts/v312-accept.mjs`（v3.1.2 音频智能预载+四线格：预载集进 pinyin-audio 缓存+点击→可播 <100ms+ui 短语元素级在播+格线加深/字模占满几何，16 断言；BASE_URL 可指线上直接验生产预载）+ 笔顺 `stroke-verify.mjs`（47 单元）+ 升级体系 `node scripts/v32-accept.mjs`（触发点接线 16 断言：过关庆祝/星星+5/卡片解锁/进化记账/签到阈值/徽章兑现）+ 截图 `node scripts/v32-shots.mjs`（我的tab/图鉴/三种庆祝/五阶段）；v293 系列归档为 v2.9 历史记录。

## 发布流程

1. 更新 `package.json` 的 `version`
2. `git add -A && git commit && git push origin main`
3. `git tag vX.Y.Z && git push origin vX.Y.Z` → Actions（`.github/workflows/deploy.yml`）：`npm ci` → `vite build`（GITHUB_PAGES=1）→ **强推 dist→gh-pages 分支** → 自动建 Release
4. **Pages 为 legacy 模式（v2.9.4 起）**：source=gh-pages 分支，分支推送后自动构建上线（一般 1-3 分钟）。背景：v2.9.4 腿一次误诊排查中迁移（deployments API 记录缺失+本地构建哈希差被误读为"部署失效"；sha1 复核证明 serving 当时其实正常）——legacy 流已验证可用故维持；如需切回 workflow 模式：`gh api -X PUT repos/kuaner/pinyin-adventure/pages -f build_type=workflow` 并恢复 actions/deploy-pages（必须带 `environment: github-pages`，环境白名单已含 v* tag 策略）
5. **发版验真硬门槛（BUGS#28 教训）**：run 绿灯≠验证完成。发版后必须比对**线上与本地 `dist/` 的 sha1**（index.html+css+js 三件），且本地比对构建**必须带 `GITHUB_PAGES=1`**（base 重写字体 URL→css 哈希不同，漏了会误诊"线上没更新"）；只比文件名不够，必须 sha1

## 验收探针

- `?probe=` / `full` / `det` / `bolt` / `zi` / `flash`：动态探针（进题→作答→验证权重/计数/反馈层）
- `?open=levels|pairs|practice|history|result|quiz|detect|dfix|bolt|zi|ziword`：直接渲染对应界面（截图用；bolt 冻结计时）
- `window.__PJ`：会话/权重/音频缓存钩子（仅带参访问时挂载）
- 笔顺几何自检 `node scripts/stroke-verify.mjs`（47 单元×2 帧截图+几何断言）；**笔顺动画验收 `BASE_URL=… node scripts/stroke-anim-verify.mjs`（v2.4.4：a/b/ü/üe 连拍 3 帧字节+dashoffset 双证据、真实路径进入时机、47 单元时长断言）**；注音 lint `node scripts/check-ruby.mjs`；全量验收 `node scripts/acceptance-v24.mjs`
