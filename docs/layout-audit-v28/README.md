# v2.8.0 布局系统级修复·验收截图（22 屏）

kuaner 2026-09-30："文字溢出/显示很小/大面积空白，没有一套设计架构" → 排版立法 + 逐屏过堂。

验收三问（每屏程序化检测+人工目验双证据）：①文字溢出 ②字号缩小（可读文本<14px / 注音 rt<11px） ③内容区底部空白>1/3（附零纵向滚动断言）。

## 结论：22/22 屏三项全零

| 屏 | 溢出 | 小字 | 空白 | 纵滚 |
|---|---|---|---|---|
| 01-learn-tab | 0 | 0 | 0 | 0 |
| 02-practice-tab | 0 | 0 | 0 | 0 |
| 03-mine-tab | 0 | 0 | 0 | 0 |
| 04-lesson-1renshi | 0 | 0 | 0 | 0 |
| 05-lesson-2xiefa | 0 | 0 | 0 | 0 |
| 06-lesson-3shengdiao | 0 | 0 | 0 | 0 |
| 07-lesson-4pindu | 0 | 0 | 0 | 0 |
| 08-lesson-5xiaoce | 0 | 0 | 0 | 0 |
| 09-level-map | 0 | 0 | 0 | 0 |
| 10-quiz-listen | 0 | 0 | 0 | 0 |
| 11-result | 0 | 0 | 0 | 0 |
| 12-flashcards | 0 | 0 | 0 | 0 |
| 13-pairs | 0 | 0 | 0 | 0 |
| 14-detect | 0 | 0 | 0 | 0 |
| 15-bolt | 0 | 0 | 0 | 0 |
| 16-zi | 0 | 0 | 0 | 0 |
| 17-ziword | 0 | 0 | 0 | 0 |
| 18-radio | 0 | 0 | 0 | 0 |
| 19-history | 0 | 0 | 0 | 0 |
| 20-settings | 0 | 0 | 0 | 0 |
| 21-sound | 0 | 0 | 0 | 0 |
| 22-free | 0 | 0 | 0 | 0 |

检测与截图：`BASE_URL=… node scripts/layout-audit-v28.mjs --final`（?open=/?learn 深链逐屏，390×844@2x）。

## 立法内容（app.css）
- 字号阶梯：--fs-xs 14 / --fs-rt 13 / --fs-sm 15 / --fs-md 17 / --fs-lg 24 / --fs-xl 28 / --fs-hero 120 + 展示字模/emoji 档，全库 font-size 只准引用变量
- 间距节奏：--sp-1..7 = 4/8/12/16/24/32/48
- rt 比例式 clamp(11px,.55em,13px)——拼音音节宽过汉字是溢出系统性根源
- 内容区铁律：prose break-all+anywhere、flex 子项 min-width:0、内容不足 flex-grow 填充
