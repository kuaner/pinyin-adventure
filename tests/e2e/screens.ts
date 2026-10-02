/* 屏幕清单注册表（T3 终态结构）：每屏 = 入口路由 + 关键断言（ready 选择器）+ 横切面元数据。
   新屏幕登记进 SCREENS 即自动被 cross/ 横切面（零滚动/零 pageerror/nowrap/ruby）覆盖——
   横切断言只写 cross/，本表只声明"这屏从哪进、渲染完成的标志、横切参数"。
   node 原生跑（type stripping，v26+）：纯数据+类型，禁 enum/namespace。 */

export type SeedTier = 'newbie' | 'mid' | 'grad'

export interface ScreenDef {
  id: string
  name: string
  url: string            /* 入口路由（相对 BASE，?open= 深链 / ?learn= 课深链） */
  ready: string          /* 关键断言：渲染完成的标志性选择器（横切面等它出现再断言） */
  seed: SeedTier         /* 状态档（fixtures/seeds.mjs 三档之一） */
  tab?: boolean          /* tab 屏（存在 #tab-view-root 容器滚动根，需容器级零滚动断言） */
  rubyMin: number        /* 儿童注音 rt 下限（家长向屏=0：历史/设置/声音礼仪） */
  area: 'learn' | 'games' | 'drills' | 'growth' | 'pwa' | 'core' | 'parents'
  note?: string
}

export const SCREENS: ScreenDef[] = [
  /* —— 三 tab 屏（容器滚动根 #tab-view-root） —— */
  { id: 'learntab', name: '学习 tab', url: '/?open=learn', ready: '#v-learntab', seed: 'mid', tab: true, rubyMin: 1, area: 'learn' },
  { id: 'island', name: '游戏岛（练习 tab）', url: '/?open=island', ready: '#v-island #stalls', seed: 'mid', tab: true, rubyMin: 1, area: 'games' },
  { id: 'mine', name: '我的 tab', url: '/?open=mine', ready: '#v-minetab', seed: 'mid', tab: true, rubyMin: 1, area: 'growth' },

  /* —— 学习域 —— */
  { id: 'lesson-l1', name: '课页 L1', url: '/?open=lesson&learn=1', ready: '#v-lesson .hspage', seed: 'newbie', rubyMin: 1, area: 'learn' },
  { id: 'levels', name: '关卡地图', url: '/?open=levels', ready: '#v-levels', seed: 'mid', rubyMin: 1, area: 'learn' },
  { id: 'quiz', name: '闯关答题', url: '/?open=quiz', ready: '#v-quiz', seed: 'newbie', rubyMin: 1, area: 'learn' },
  { id: 'radio', name: '口诀小广播', url: '/?open=radio', ready: '#v-radio .hspage', seed: 'mid', rubyMin: 1, area: 'learn' },

  /* —— 复习/练习域（v2.4 遗产入口，e2e 覆盖面保持） —— */
  { id: 'flash', name: '闪卡复习', url: '/?open=flash', ready: '#v-flash', seed: 'mid', rubyMin: 1, area: 'core' },
  { id: 'pairs', name: '易混对特训', url: '/?open=pairs', ready: '#v-pairs', seed: 'mid', rubyMin: 1, area: 'drills' },
  { id: 'free', name: '自由练习配置', url: '/?open=free', ready: '#v-practice', seed: 'mid', rubyMin: 1, area: 'core' },
  { id: 'result', name: '结算页', url: '/?open=result', ready: '#v-result', seed: 'newbie', rubyMin: 1, area: 'core' },

  /* —— 练习馆六入口 —— */
  { id: 'bolt', name: '闪电刷题', url: '/?open=bolt', ready: '#v-bolt', seed: 'mid', rubyMin: 1, area: 'drills', note: '冻结计时入口（probe 同源）' },
  { id: 'ldrill', name: '听写专练', url: '/?open=ldrill', ready: '#v-ldrill [data-q]', seed: 'mid', rubyMin: 1, area: 'drills' },
  { id: 'zihall', name: '识字表闯关', url: '/?open=zihall', ready: '#v-zihall .zcell', seed: 'mid', rubyMin: 1, area: 'drills' },
  { id: 'blenddrill', name: '拼读专练', url: '/?open=blenddrill', ready: '#v-bquiz [data-q]', seed: 'mid', rubyMin: 1, area: 'drills' },
  { id: 'tonedrill', name: '声调专练', url: '/?open=tonedrill', ready: '#v-tquiz [data-q]', seed: 'mid', rubyMin: 1, area: 'drills' },

  /* —— 游戏进行态（count=冻结倒计时，稳定可断言） —— */
  { id: 'game-count', name: '游戏倒计时', url: '/?open=game&g=balloon&st=count', ready: '#gcount', seed: 'mid', rubyMin: 1, area: 'games' },

  /* —— 每日挑战 / 成长 —— */
  { id: 'daily', name: '每日挑战', url: '/?open=daily', ready: '#dqcard', seed: 'mid', rubyMin: 1, area: 'growth' },
  { id: 'album', name: '卡片图鉴', url: '/?open=album', ready: '#v-album [data-albumpage="0"]', seed: 'mid', rubyMin: 1, area: 'growth' },

  /* —— 家长向（注音豁免，硬约束 #4） —— */
  { id: 'history', name: '历史页', url: '/?open=history', ready: '#v-history', seed: 'mid', rubyMin: 0, area: 'parents' },
  { id: 'sound', name: '声音礼仪', url: '/?open=sound', ready: '#v-sound', seed: 'newbie', rubyMin: 0, area: 'parents' },
  { id: 'settings', name: '家长设置', url: '/?open=settings', ready: '#v-settings', seed: 'newbie', rubyMin: 0, area: 'parents' },
]

/* 横切面 nowrap 抽查选择器：短标签立法面（课内字母 chip/摊位名/入口名/tab 标签）。
   断言=单行（高度 ≤ 2.2×字号；含 rt 注音元素豁免——ruby 双行是注音立法合法形态）+ 文档零横向溢出。
   注意 #caps .cap（学习 tab 课程胶囊）是"课号+字母"两行堆叠设计，不是 nowrap 面，不入清单 */
export const NOWRAP_SELECTORS = [
  '[data-lchips] .lchip',
  '#stalls .sname',
  '#drillgrid .dname',
  '#tabbar .tab .tl',
]
