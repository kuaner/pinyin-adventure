# 拼音闯关大冒险 🐣

给学拼音的小朋友（幼小衔接/一年级）的闯关练习应用。针对"记不牢、左右镜像写反、易混淆"三个痛点设计。

**在线使用**：<https://kuaner.github.io/pinyin-adventure/>

## 玩法
- **闯关冒险**：按课本顺序 8 关（单韵母→声母→复韵母→前后鼻音→整体认读）+ 易混对大师毕业关，每关 10 题混编（听音选字/看字选音/听看一致/口诀判断），星星结算
- **正反小侦探**：字母正写/镜像翻转辨别 + 写反修复题；核心混淆组 b d p q t f 占 ~70% 反复考察，配锚点记忆（"记住：爸（bà）的 b"）
- **⚡闪电刷题**：5 分钟限时无限连续出题，每题 2 选项，正确率/连对实时计数，今日最佳 vs 历史最佳（v2.3 听写主打：真人音二选一、干扰项=混淆搭档 ~70% + 口诀正向回忆 ~30%）
- **常见字快拼**：一年级 180 字 + 30 词，看字选拼音，出题即读字
- **易混对专练**：b↔d、p↔q 镜像组，n↔l、f↔h 近音组，an↔ang、ui↔iu 韵母组，配课本口诀辨析卡
- **闪卡复习**：Leitner 三盒间隔复习（会啦 3 天后见 / 快会了明天见 / 还不会今天再见）
- **全部界面文字带拼音注音**（学拼音的孩子不识字也能自己玩）

## 智能
- **自适应出题**：答错的混淆对权重翻倍（封顶 8，连对两次衰减）——越混什么越练什么
- 正反判错联动易混对加权；历史成绩页：家长可见"最容易混""最容易错的字"

## 技术
- **Svelte 5 + Vite + TypeScript** 工程化（v2.0 起对齐 bambu-nfc 规范；v1 为单文件 HTML，行为正本见 git 历史）
- **纯预生成 mp3 读音**（mimo-v2.5-tts，音色 冰糖，305 条，清单见 public/audio/MANIFEST.txt；v.mp3=ü、vn.mp3=ün），无设备 TTS
- PWA：可加桌面，外壳离线可用；**更新走 prompt 提示条**（小鸡举牌"有新版本啦！"，回前台自动查新），全部数据 localStorage 本地保存（键 `pinyin_v2`）
- 部署：push tag `v*` → GitHub Actions 自动构建发布 Pages

## 致谢

- [lasagoo/letter-writing](https://github.com/lasagoo/letter-writing) —— v2.3 笔顺数据底本（52 字母逐笔 path + 四线三格，MIT）。部编版适配（u/w 拆笔、k 并笔、a/t 竖右弯、自补 ü/ê）见 `scripts/gen-strokes-lw.mjs`
- [hanyu-pinyin-audio](https://github.com/) studycli 音节真人读音（audio/hyp/）
- naive-icons 手绘图标（MIT 快照，`src/lib/icons.ts`）
- [pinyin-pro](https://github.com/zh-lx/pinyin-pro) 注音引擎

开发与结构详见 [CLAUDE.md](CLAUDE.md) / [PRODUCT.md](PRODUCT.md) / [DESIGN.md](DESIGN.md) / [docs/architecture.md](docs/architecture.md)。

由 [Duoduo](https://openduo.ai) 与 kuaner 共同维护。
