# 设计说明（v2.1 animal-island 设计语言）

## 视觉语言

动物岛手绘田园风（设计源：[animal-island-ui](https://github.com/…/animal-island-ui) MIT，token 全套移植）：
奶油波点壁纸 + 粉彩波点分区 + 胶囊按钮 + 手绘线条图标（naive-icons）+ 按压硬投影（按下位移模拟物理按压）。
暖棕文字 + teal 主行动色，可爱但不花哨。

## 设计 token（`src/app.css` `:root`）

| token | 值 | 用途 |
|---|---|---|
| `--animal-primary` | `#19c8b9` | 主行动色（投影 `--press-teal:#129d8f`） |
| `--animal-success / warning / error` | `#6fba2c / #f5c31c / #e05a5a` | 功能色（rating 三档 / 星星 / 错误） |
| `--animal-text / -2 / -dis` | `#794f27 / #9f927d / #c4b89e` | 暖棕文字三级 |
| `--animal-bg / -2` | `#f8f8f0 / #f0e8d8` | 奶油底 / 次级底 |
| `--animal-border(-light)` | `#dcd8d1 / #e8e2d6` | 卡片描边 |
| `--animal-r-sm/-/‑lg/-pill` | `16 / 18 / 24 / 50px` | 圆角四级（pill=胶囊） |
| `--animal-shadow-sm/-/-lg` | `0 2/3/8px …rgba(61,52,40,.06/.1/.14)` | 柔影三级 |
| 按压投影 | `--press-*` 系列 | 糖果按压（:active 位移 4px + 影收短） |

按钮多色板（波点 12 色饱和化）：blue `#6c86e8` · purple `#b77dee` · pink `#f29cb6` · orange `#e59266` · red=error · green=success。

## 波点壁纸（零图片，radial-gradient 双层错位）

- 全局：奶油底 `#f7f3df`（body）
- 分区（`#v-*` 页面 id）：levels 绿 `#e8f5e8` · result 黄 `#fff8e0` · flash 蓝 `#e8edff` · pairs 粉 `#fde4e8` · practice 桃 `#fff0e8` · bolt 橙 `#fff0e8` · history 棕 `#f5f0e0`
- 每层 = 大点 1.5px@28px 网格 + 小点 1px@14px 错位（CSS 抄自 animal-island Background，MIT）

## 字体

- **Nunito**（woff2 内联 `src/assets/fonts/`，latin 500/700/900，经 vite 带正确 base+hash）——拼音/数字圆润字形
- 中文走系统栈（PingFang/HarmonyOS/MiSans——手机原生，零下载；animal-island 的 Noto Sans SC 中文 woff2 单字重 1.1MB×3，为儿童移动端加载考虑不引入）
- 声调字符（ā ǎ ǜ…）Nunito latin 子集缺字时自动回落系统圆体

## 图标系统（naive-icons，MIT，48×48 手绘 SVG）

`src/lib/icons.ts` 内联 **48 枚**；`<Icon name size flip label>`（`src/components/Icon.svelte`）。

trophy star check close flame rocket rainbow gift bulb refresh thumbs-up(👍/flip-y👎)
eye music book map lock flag search home clock play bird bee owl ladybug butterfly
pencil smile balloon heart arrow-right headphones sun cloud moon bell anchor
bookmark dumbbell file snail flower strawberry apple watermelon fish cat dog

- **UI emoji 全量替换**（🔊→headphones、⭐→star、⚡→rocket、🎉→rainbow、👍👎→thumbs-up、✅❌→check/close、💡→bulb、🔄→refresh、🔥→flame、👀→eye、🚩→flag、🔒→lock、🃏→bookmark、🎯→dumbbell、📜→file、⚔️→bee、🐣→bird）
- **内容数据 emoji 保留**（例词 🐰🍉、锚点图——教学实物图，且联动 mp3 文件名）
- 反馈层 icon 走语义名（session 存 `celebrate/detect/cheer` → Feedback 映射 rainbow/eye/dumbbell）

## Ruby 注音（v2.1 pinyin-pro 引擎，kuaner 指定的架构升级）

```
<Ruby text="答对啦，你真棒" />            → 逐字自动注音
<Ruby text="长得高" py={{ 长得: 'zhǎng de' }} />  → 组件级逃生口
```

- **引擎**：npm `pinyin-pro@3.x`，整 run 一次调用（句级分词上下文保语境）
- **三层兜底**：① pinyin-pro 分词消歧 ② 全局覆盖表（`src/data/pinyin-overrides.json`，17 词条 + 词内语气字白名单 3 字）③ 调用方 `py` 参数
- **词边界**：`pinyin-dict.json` words 键（v1 DSL 提取的 UI 词表，542 runs ground truth）→ 命中词包 `<span class="rw">`（nowrap，词组连续注音不拆行）；词表词常含整句，**词内逐位再跑覆盖子匹配**（「这句话说得对吗」内的 说得=de）
- **排版（pinyin-annotator 儿童规范）**：rt `clamp(10px,.5em,13px)`、暖棕 `#8a7a68`、letter-spacing .5px、行高 1.25 放宽
- **回归校验**：`node scripts/check-pinyin.mjs`（引擎 vs v1 DSL 人工核对注音逐字对比）。终态 27 差异全部为已裁决项：
  - 接受 engine、判 v1 错：「一」变调 yì/yi（人教版标准，v1 有 yí 滥用）、语音 yǔ、挑战 tiǎo、袄 ǎo、长得长 zhǎng
  - gen-dict 曾把 ym/zt 条目 han+tts 坍缩成全局字音（音/围/邮/耶/鹰/阿/欸）——那是音频数据不是文案注音，engine 正确
- **覆盖表条目**（17）：啦 la · 哦 ó · 喔 ō · 个 gè · 讷 né · 雌 cī · 说得 de · 长得 zhǎng de · 来得及 dé · 肚子/蚊子/椰子/椅子 zi · 斧头 tou · 椰子树 · 切个 qiē · 关卡 kǎ

## bundle 体积（pinyin-pro 上车）

| | raw | gzip |
|---|---|---|
| v2.0（词典版） | 129.21 kB | 44.10 kB |
| v2.1（pinyin-pro） | 450.44 kB | 191.11 kB |
| 增量 | +321 kB | +147 kB |

优于预期（+500KB~1MB）；Pages 可接受，PWA 本地缓存后二次访问无感。CSS +24 kB（波点/token/字体）、Nunito 3×16 kB。
