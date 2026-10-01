/* v2.6 文案层：全 app 用户可见字符串唯一真相（kuaner 2026-09-30 12:02 文案层+全点击语音架构）。
   key→中文文本；组件里禁止字面量中文（scripts/check-ruby.mjs lint 强制）。
   - py：多音字/引擎消歧逃生口（hand-rt 平价：组件里原手写 <rt> 的文案迁入时带 py，
     T(zh, py) 渲染结果与原手写 ruby 逐字一致）
   - {x} 占位：t(k, vars) 格式化； Speak 同名 prop
   - 配音清单：scripts/gen-audio.ts 扫描本文件 → public/audio/ui/{key-kebab}.mp3
     → src/text/audio-manifest.json（Speak 点击播放的唯一依据） */
import { registerSys } from '../lib/ruby'

export interface StrDef {
  zh: string
  py?: Record<string, string>
}

function s(zh: string, py?: Record<string, string>): StrDef {
  return py ? { zh, py } : { zh }
}

export const strings = {
  /* ---------- 壳 / tab ---------- */
  tabLearn: s('学习', { 学习: 'xué xí' }),
  tabPractice: s('练习', { 练习: 'liàn xí' }),
  tabMine: s('我的', { 我的: 'wǒ de' }),
  ariaBack: s('返回'),
  ariaExit: s('退出'),
  ariaStroke: s('笔顺演示'),

  /* ---------- 学习 tab ---------- */
  pinyinIsland: s('拼音岛'),
  lessonN: s('第 {n} 课', { 第: 'dì', 课: 'kè' }),
  stepLearn: s('学一学', { 学一学: 'xué yī xué' }),
  stepKnow: s('认识', { 认识: 'rèn shi' }),
  stepWrite: s('写法', { 写法: 'xiě fǎ' }),
  stepTone: s('声调', { 声调: 'shēng diào' }),
  stepBlend: s('拼读', { 拼读: 'pīn dú' }),
  stepQuiz: s('小测', { 小测: 'xiǎo cè' }),
  restudy: s('再学一遍', { 再学一遍: 'zài xué yī biàn' }),
  continueLearning: s('继续学习', { 继续学习: 'jì xù xué xí' }),
  courseMapN: s('课程地图 · {n} 课', { 课程地图: 'kè chéng dì tú', 课: 'kè' }),
  swipeHintH: s('横向滑动', { 横向滑动: 'héng xiàng huá dòng' }),
  radioTitle: s('口诀小广播', { 口诀小广播: 'kǒu jué xiǎo guǎng bō' }),
  radioSlogan: s('想听哪句，点哪句'),

  /* ---------- 练习 tab ---------- */
  practiceField: s('练习场', { 练习场: 'liàn xí chǎng' }),
  todayPracticed: s('今天已经练了 {n} 题'),
  todayAcc: s('· 正确率 {n}%'),
  todayNotYet: s('今天还没练，挑一个开始吧'),
  levelN: s('第 {n} 关', { 第: 'dì', 关: 'guān' }),
  adventure: s('闯关冒险', { 闯关冒险: 'chuǎng guān mào xiǎn' }),
  adventureDesc: s('一关一关，闯到大师关'),
  boltBestN: s('最佳 {n}%'),
  fiveMinutes: s('5 分钟'),
  boltSprint: s('闪电刷题', { 闪电刷题: 'shǎn diàn shuā tí' }),
  boltDesc: s('5 分钟冲刺 · 听一听选出来'),
  ziBadge: s('{a} / {b} 字'),
  quickPin: s('常见字快拼', { 常见字快拼: 'cháng jiàn zì kuài pīn' }),
  quickPinDesc: s('看看字，选出拼音'),
  detStreakN: s('连对 {n}'),
  detective: s('正反小侦探', { 正反小侦探: 'zhèng fǎn xiǎo zhēn tàn' }),
  detectiveDesc: s('b d p q 写反了吗'),
  weakPairsN: s('{n} 组待加强'),
  pairsFourteen: s('14 组'),
  pairsDrill: s('易混对专练', { 易混对专练: 'yì hùn duì zhuān liàn' }),
  pairsDesc: s('一对一对，练清楚'),
  freePick: s('自选字母'),
  freePractice: s('自由练习', { 自由练习: 'zì yóu liàn xí' }),
  freeDesc: s('自己挑字母，想练哪就练哪'),

  /* ---------- 我的 tab ---------- */
  streakDays: s('连续 {n} 天', { 连续: 'lián xù', 天: 'tiān' }),
  chickName: s('小黄鸡', { 小黄鸡: 'xiǎo huáng jī' }),
  levelTag: s('{n} 级', { 级: 'jí' }),
  starLabel: s('星星', { 星星: 'xīng xing' }),
  passLabel: s('通关', { 通关: 'tōng guān' }),
  passCount: s('{n} 关', { 关: 'guān' }),
  flashReview: s('闪卡复习', { 闪卡复习: 'shǎn kǎ fù xí' }),
  flashDesc: s('快忘记的先复习 · 左右滑翻卡'),
  flashDueN: s('{n} 张', { 张: 'zhāng' }),
  thisWeek: s('本周学习', { 本周学习: 'běn zhōu xué xí' }),
  learnedDays: s('已学 {a} / 7 天', { 已学: 'yǐ xué', 天: 'tiān' }),
  parentZone: s('家长区'),
  history: s('学习历史'),
  soundEtiquette: s('声音礼仪'),
  newTag: s('新'),
  settings: s('设置'),

  /* ---------- 关卡地图 ---------- */
  chooseLevel: s('选择关卡', { 选择关卡: 'xuǎn zé guān kǎ' }),
  levelLockedToast: s('先通过上一关才能解锁哦！'),
  graduate: s('毕业'),

  /* ---------- 答题页 ---------- */
  score: s('得分 '),
  qProg: s('第 {a}/10 题', { 第: 'dì', 题: 'tí' }),
  listenAgain: s('再听一遍', { 再听一遍: 'zài tīng yī biàn' }),
  confirmAgain: s('再点一次确认'),
  lookSubHint: s('先点喇叭听一听，再点一次选定'),
  writtenRight: s('写对了'),
  writtenWrong: s('写反了'),
  iWantWrite: s('我要写「'),
  andWord: s('和'),
  distinguish: s('辨一辨'),
  readAloud: s('读一读'),
  continueBtn: s('继续 ›'),

  /* ---------- 答题反馈 / 结算（session store 组装，Feedback 层统一 T() 注音） ---------- */
  fbAnswer: s('正确答案：'),
  fbLookOrdinal: s('{n} 个才是它的读音「{han}」'),
  fbDjFlipped: s('它是写反的「{x}」！看，正确的长这样'),
  fbDjOk: s('它写对了，就是「{x}」'),
  fbDfix: s('写对的「{x}」长这样'),
  fbCorrectPy: s('正确拼音：'),
  fbKjAbout: s('这句口诀说的是：'),
  anchorOf: s('{h}（{p}）的 {x}'),
  perfect: s('完美通关！'),
  great: s('太棒了！'),
  cleared: s('通关啦！'),
  retry: s('再挑战一次吧！'),
  correctOfN: s('答对 {n} / 10 题'),
  detNoStar: s(' · 侦探模式不计星星'),
  ziNoStar: s(' · 快拼模式不计星星'),
  pracNoStar: s(' · 练习模式不计星星'),
  worstZi: s('最容易错的字：'),
  worstPairs: s('最容易混：'),
  willPracticeMore: s('，下次会多练它啦'),
  unlockMaster: s('毕业关「易混对大师」已解锁！'),
  unlockGrad: s('恭喜毕业！你就是易混对大师！'),
  unlockNext: s('解锁下一关！'),
  nextLevel: s('下一关'),
  playAgain: s('再玩一次'),
  backPractice: s('回练习场'),

  /* ---------- 闪电刷题 ---------- */
  hudAnswered: s('已答 '),
  hudAcc: s('正确率 '),
  stopEarly: s('提前结束，看成绩'),
  totalQs: s('总题数'),
  accLabel: s('正确率'),
  bestStreak: s('最长连对'),
  secPerQ: s('秒/题'),
  todayBest: s('今日最佳：'),
  histBest: s('历史最佳：'),
  newRecord: s('破纪录啦！'),
  againRound: s('再来一轮'),
  boltNotAnswered: s('还没来得及答题～'),
  boltGodspeed: s('闪电神速！'),
  boltFastAcc: s('又快又准！'),
  boltDone: s('完成挑战！'),

  /* ---------- 闪卡 ---------- */
  catAll: s('全部'),
  catSm: s('声母'),
  catYm: s('韵母'),
  catZt: s('整体认读'),
  boxLabel: s('盒'),
  boxDone: s('这一盒翻完啦！'),
  boxDoneHint: s('换分类继续，或明天再来'),
  flipHintFront: s('点卡片翻面听读音'),
  flipHintBack: s('点卡片翻回 · 左滑下一张'),
  rateNotYet: s('还不会'),
  rateToday: s('今天再学'),
  rateAlmost: s('快会了'),
  rateTomorrow: s('明天再来'),
  rateGot: s('会啦'),
  rateDays: s('天后再见'),

  /* ---------- 口诀小广播 ---------- */
  radioEmpty: s('口诀还在路上，先回去学一课吧'),
  backIsland: s('回学习岛'),
  entryN: s('第 {n} 条', { 第: 'dì', 条: 'tiáo' }),
  stopChain: s('停止连播', { 停止连播: 'tíng zhǐ lián bō' }),
  chain: s('连播', { 连播: 'lián bō' }),
  loop: s('循环', { 循环: 'xún huán' }),
  kjList: s('口诀单', { 口诀单: 'kǒu jué dān' }),
  swipeNextKj: s('左滑，下一句', { 左滑: 'zuǒ huá', 下一句: 'xià yī jù' }),
  listenKjSeeStroke: s('听口诀，看笔顺'),
  tapHearThis: s('点一点，听这句'),

  /* ---------- 学习岛课程页 ---------- */
  seeAgain: s('再看一遍', { 再看一遍: 'zài kàn yī biàn' }),
  watchWriteLine: s('看一遍，再写一遍', { 看一遍: 'kàn yī biàn', 再写一遍: 'zài xiě yī biàn' }),
  tapHearSound: s('点一点，听读音'),
  quizReady: s('准备好了吗', { 准备好了吗: 'zhǔn bèi hǎo le ma' }),
  startQuiz: s('开始小测', { 开始小测: 'kāi shǐ xiǎo cè' }),
  quizQn: s('第{n}题', { 第: 'dì', 题: 'tí' }),
  listenChoose: s('听一听，选出来', { 听一听: 'tīng yī tīng', 选出来: 'xuǎn chū lái' }),
  lookHowRead: s('看一看，它怎么读', { 看一看: 'kàn yī kàn' }),
  gotNGreat: s('对了{n}题，太棒了！', { 对了: 'duì le' }),
  backMap: s('回课程地图', { 回课程地图: 'huí kè chéng dì tú' }),
  gotNScore: s('对了{n}题', { 对了: 'duì le' }),
  almostMsg: s('差一点点！再学一遍，你一定可以的', { 差一点点: 'chà yī diǎn diǎn' }),
  gateNotDone: s('还有 {n} 个拼音没学完，先学完再来吧', { 还有: 'hái yǒu', 个: 'gè', 拼音: 'pīn yīn', 没学完: 'méi xué wán', 先学完: 'xiān xué wán', 再来吧: 'zài lái ba' }),
  gateGoLearn: s('跳回去学', { 跳回去学: 'tiào huí qù xué' }),
  gateForce: s('我还要试试', { 我还要试试: 'wǒ hái yào shì shi' }),
  swipeNextStep: s('左滑，下一步', { 左滑: 'zuǒ huá', 下一步: 'xià yī bù' }),
  seeStroke: s('看笔顺', { 看笔顺: 'kàn bǐ shùn' }),

  /* ---------- 声调 / 拼读 drill ---------- */
  toneName1: s('一声'),
  toneName2: s('二声'),
  toneName3: s('三声'),
  toneName4: s('四声'),
  toneTip1: s('平平走'),
  toneTip2: s('往上扬'),
  toneTip3: s('拐个弯'),
  toneTip4: s('往下降'),
  followMe: s('跟我读'),
  earPractice: s('小耳朵练一练'),
  whichTone: s('听一听，是第几声？'),
  heardN: s('听对了 {n} 个'),
  goodEars: s('小耳朵真灵！'),
  listenMore: s('再多听几遍就更棒啦'),
  tonePracticeAgain: s('再练一次'),
  tonePracticeDone: s('练好啦'),
  ztDirect: s('整体认读，直接读成一个音'),
  fourTonesRead: s('四个声调，读一读'),
  tapFollow: s('点一点，跟读一遍'),
  blendIt: s('拼一拼'),
  emptyBlend: s('这一课的内容在前面的步骤里，往回滑一滑吧'),

  /* ---------- 锚点 / 辨析卡 / 易混对 ---------- */
  rememberAnchor: s('记住：{h}（{p}）的 {x}'),
  ariaHearAnchor: s('听锚点读音'),
  groupCount: s('{n} 组'),
  pairsGuide: s('点一对，学口诀；准备好了就开练'),
  startGroupN: s('开始专练这 {n} 组'),
  swipeNextGroup: s('左滑，下一组', { 左滑: 'zuǒ huá', 下一组: 'xià yī zǔ' }),
  specialDrill: s('专练'),

  /* ---------- 更新提示 / 设置 / 礼仪（家长向，可不注音） ---------- */
  newVersion: s('有新版本啦！'),
  chickUpdate: s('小鸡叼来了新内容，点它更新'),
  update: s('更新'),
  settingsTitle: s('设置'),
  muteMode: s('静音模式'),
  muteDesc: s('关闭全部声音（默认关）。孩子界面不显示此状态，没有认知负担。'),
  aboutData: s('关于数据'),
  dataDesc: s('全部学习进度只保存在本机浏览器（localStorage），不联网、不上传、无账号。'),
  soundSource: s('声音来源'),
  soundSourceDesc: s('拼音读音=真人音频库，界面文字=预生成配音（无设备合成）。声音礼仪详情见「声音礼仪」页。'),
  verLine: s('拼音闯关大冒险 · 拼音岛'),
  etiquetteTitle: s('声音礼仪 · 全局规则'),
  etiquetteIntro: s('什么时候有声音、什么时候安静——三条规则 + 一张声音地图。'),
  soundMap: s('声音地图'),
  soundMapHead: s('场景 → 有没有声音'),
  deletedNote: s('已删除清单：入口过场语音、自动播放语音、翻页音、按钮杂音——全部为 0。'),

  /* ---------- 历史页（家长向） ---------- */
  histTitle: s('学习历史'),
  histCount: s('{n} 条'),
  learnProgressN: s('学习岛课程进度（第 {n} 课已解锁）'),
  goLearn: s('去学习 ›'),
  histEmpty: s('还没有记录，快去闯关吧！'),
  histScore: s('{n}分'),
  swipeMoreHist: s('左滑，更多记录'),
  clearHist: s('清空记录'),
  clearConfirm: s('只清空历史成绩，保留闯关进度和星星，确定吗？'),

  /* ---------- 音频兜底 / 提示 ---------- */
  fallbackHint: s('语音未准备好 · 读音像「{han}」'),
  notReady: s('语音未准备好'),
  anchorMissing: s('锚点音频缺失：{f}'),
  ziMissing: s('字音缺失：{f}'),
  flashDoneToast: s('换分类继续，或明天再来'),

  /* ---------- 闪卡清单行（deckline，动态数字 → 渲染层 Speak text） ---------- */
  deckRoundLeft: s('本轮翻完！还有 {n} 张待复习'),
  deckAllDone: s('今天的复习完成啦！明天再来'),
  deckDueToday: s('今天待复习 {n} 张 · '),
  deckFree: s('自由翻看 · '),
  deckCardN: s('卡片 {a}/{b}'),

  /* ---------- v3.2 升级体系（小鸡成长线/卡片图鉴/庆祝仪式/签到连击/成就徽章） ---------- */
  myCards: s('我的卡片', { 我的卡片: 'wǒ de kǎ piàn' }),
  myCardsDesc: s('学会的拼音都在这里'),
  cardCountN: s('{a} / {b} 张', { 张: 'zhāng' }),
  albumTitle: s('卡片图鉴', { 卡片图鉴: 'kǎ piàn tú jiàn' }),
  albumLocked: s('还没学到', { 还没学到: 'hái méi xué dào' }),
  stageName0: s('蛋宝宝', { 蛋宝宝: 'dàn bǎo bao' }),
  stageName1: s('破壳小鸡', { 破壳小鸡: 'pò ké xiǎo jī' }),
  stageName2: s('小黄鸡', { 小黄鸡: 'xiǎo huáng jī' }),
  stageName3: s('大母鸡', { 大母鸡: 'dà mǔ jī' }),
  stageName4: s('小雄鹰', { 小雄鹰: 'xiǎo xióng yīng' }),
  stageNextN: s('还差 {n} 颗星星长大', { 还差: 'hái chà', 颗: 'kē', 星星: 'xīng xing', 长大: 'zhǎng dà' }),
  growthMax: s('已经长大啦！', { 已经: 'yǐ jīng', 长大: 'zhǎng dà' }),
  celebQuiz: s('小测过关！', { 小测: 'xiǎo cè', 过关: 'guò guān' }),
  celebStarsN: s('星星 +{n}', { 星星: 'xīng xing' }),
  celebLetterN: s('你学会了 {x}！', { 学会: 'xué huì' }),
  gradTitle: s('毕业快乐！', { 毕业: 'bì yè', 快乐: 'kuài lè' }),
  gradMsg: s('你认识了全部拼音，真了不起！', { 认识: 'rèn shi', 全部: 'quán bù', 拼音: 'pīn yīn', 真了不起: 'zhēn liǎo bù qǐ' }),
  evolveToN: s('进化成了 {x}！', { 进化: 'jìn huà' }),
  tapSkip: s('点一下继续', { 点一下: 'diǎn yī xià', 继续: 'jì xù' }),
  badgeTitle: s('成就徽章', { 成就徽章: 'chéng jiù huī zhāng' }),
  badgeOfN: s('{a} / {b}'),
  badgeGotN: s('获得徽章「{x}」！', { 获得: 'huò dé', 徽章: 'huī zhāng' }),
  checkinDone: s('今天已签到', { 今天: 'jīn tiān', 签到: 'qiān dào' }),
  checkinTodo: s('学一课，就签到啦', { 学: 'xué', 一课: 'yí kè', 签到: 'qiān dào' }),
  /* 徽章名与条件（图鉴格子小字，t() 纯文本——MineTab prow 标签同例不注音；解锁 toast 走 T() 自动注音） */
  bFirstPass: s('初次通关', { 初次通关: 'chū cì tōng guān' }),
  bFirstPassC: s('第一次闯关成功'),
  bStreak7: s('连续 7 天', { 连续: 'lián xù', 天: 'tiān' }),
  bStreak7C: s('连续学习 7 天'),
  bBoltPerfect: s('闪电满分', { 闪电: 'shǎn diàn', 满分: 'mǎn fēn' }),
  bBoltPerfectC: s('闪电刷题全部答对'),
  bAllCards: s('全字母收集', { 收集: 'shōu jí' }),
  bAllCardsC: s('收齐 63 张卡片', { 收齐: 'shōu qí', 张: 'zhāng', 卡片: 'kǎ piàn' }),
  bGrad: s('毕业', { 毕业: 'bì yè' }),
  bGradC: s('12 课全部通过', { 课: 'kè', 全部: 'quán bù', 通过: 'tōng guò' }),
  bSpeed: s('速读王', { 速读王: 'sù dú wáng' }),
  bSpeedC: s('一轮刷题 40 题以上', { 一轮: 'yì lún', 题以上: 'tí yǐ shàng' }),
  bTone: s('声调大师', { 声调: 'shēng diào', 大师: 'dà shī' }),
  bToneC: s('听调辨调答对 30 次'),
  bDet: s('小侦探', { 小侦探: 'xiǎo zhēn tàn' }),
  bDetC: s('正反判断答对 30 次'),
  bColl: s('收集家', { 收集家: 'shōu jí jiā' }),
  bCollC: s('收集 30 张卡片', { 收集: 'shōu jí', 张: 'zhāng', 卡片: 'kǎ piàn' }),
  bDays30: s('坚持 30 天', { 坚持: 'jiān chí', 天: 'tiān' }),
  bDays30C: s('累计学习 30 天', { 累计: 'lěi jì', 学习: 'xué xí', 天: 'tiān' }),

  /* ---------- v4.0 嘉年华游戏岛（hub/每日挑战/连击/四游戏） ---------- */
  islandTitle: s('游戏岛', { 游戏岛: 'yóu xì dǎo' }),
  islandSlogan: s('今天先玩哪一个？'),
  dailyTitle: s('每日挑战', { 每日: 'měi rì', 挑战: 'tiǎo zhàn' }),
  dailyDesc: s('10 题混编 · 连击翻倍', { 题: 'tí', 混编: 'hùn biān', 连击: 'lián jī', 翻倍: 'fān bèi' }),
  dailyDone: s('今日已完成', { 今日: 'jīn rì', 已完成: 'yǐ wán chéng' }),
  dailyBestN: s('今日最佳 {n} 分', { 今日: 'jīn rì', 最佳: 'zuì jiā', 分: 'fēn' }),
  stallBalloon: s('气球大作战', { 气球: 'qì qiú', 大作战: 'dà zuò zhàn' }),
  stallMole: s('打地鼠', { 打地鼠: 'dǎ dì shǔ' }),
  stallDuel: s('镜像大对决', { 镜像: 'jìng xiàng', 大对决: 'dà duì jué' }),
  stallFish: s('小猫钓鱼', { 小猫: 'xiǎo māo', 钓鱼: 'diào yú' }),
  stallEgg: s('拼音蛋', { 拼音蛋: 'pīn yīn dàn' }),
  stallTone: s('声调音乐会', { 声调: 'shēng diào', 音乐会: 'yīn yuè huì' }),
  comingSoon: s('敬请期待', { 敬请期待: 'jìng qǐ qī dài' }),
  bestN: s('最佳 {n}', { 最佳: 'zuì jiā' }),
  newGame: s('新游戏', { 新游戏: 'xīn yóu xì' }),
  hintBalloon: s('听读音，点爆对的气球', { 听读音: 'tīng dú yīn', 点爆: 'diǎn bào', 气球: 'qì qiú' }),
  hintMole: s('听读音，打到对的地鼠', { 听读音: 'tīng dú yīn', 打: 'dǎ', 地鼠: 'dì shǔ' }),
  hintDuel: s('答对推绳，答错被推', { 答对: 'dá duì', 推绳: 'tuī shéng', 答错: 'dá cuò' }),
  hintFish: s('听读音，钓对的鱼', { 听读音: 'tīng dú yīn', 钓: 'diào', 鱼: 'yú' }),
  listenThenAct: s('先点喇叭听一听', { 先: 'xiān', 点: 'diǎn', 喇叭: 'lǎ ba', 听一听: 'tīng yī tīng' }),
  maxCombo: s('最高连对', { 最高: 'zuì gāo', 连对: 'lián duì' }),
  starsGot: s('星星', { 星星: 'xīng xing' }),
  playAgainGame: s('再玩一次', { 再玩一次: 'zài wán yī cì' }),
  backGameIsland: s('回游戏岛', { 回游戏岛: 'huí yóu xì dǎo' }),
  timeUp: s('时间到！', { 时间到: 'shí jiān dào' }),
  duelWinTitle: s('把绳子拔过线，赢啦！', { 绳子: 'shéng zi', 拔: 'bá', 赢啦: 'yíng la' }),
  duelLoseTitle: s('被拔过线啦，再练练！', { 拔: 'bá', 再练练: 'zài liàn liàn' }),
  celebGame: s('玩得漂亮！', { 玩得漂亮: 'wán de piào liang' }),
  goCount: s('开始！', { 开始: 'kāi shǐ' }),
  comboMult2: s('连击 ×2', { 连击: 'lián jī' }),
  comboMult3: s('连击 ×3', { 连击: 'lián jī' }),
  dailyQProg: s('第 {n} / 10 题', { 第: 'dì', 题: 'tí' }),
  dailyAllDone: s('今日挑战完成！', { 今日: 'jīn rì', 挑战: 'tiǎo zhàn', 完成: 'wán chéng' }),
  dailyRecord: s('今日新纪录！', { 今日: 'jīn rì', 新纪录: 'xīn jì lù' }),
  gameComboN: s('连对 {n}', { 连对: 'lián duì' }),
  gameScore: s('得分'),
  gotStarsN: s('星星 +{n}', { 星星: 'xīng xing' }),
  bestScoreN: s('最佳 {n} 分', { 最佳: 'zuì jiā', 分: 'fēn' }),
  comboBreak: s('连击断了，稳住！', { 连击: 'lián jī', 断: 'duàn', 稳住: 'wěn zhù' }),
  adventureEntry: s('闯关冒险', { 闯关冒险: 'chuǎng guān mào xiǎn' }),
  freeEntry: s('自由练习', { 自由练习: 'zì yóu liàn xí' }),
} as const

export type StringKey = keyof typeof strings

/* ---------- 取值 ---------- */
export function tRaw(k: StringKey): string {
  return strings[k].zh
}

/* {x} 占位格式化 */
function fmt(zh: string, vars?: Record<string, string | number>): string {
  if (!vars) return zh
  return zh.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? '{' + name + '}'))
}

/** 文案取值（唯一出口）：t('lessonN', { n: 3 }) → '第 3 课' */
export function t(k: StringKey, vars?: Record<string, string | number>): string {
  return fmt(strings[k].zh, vars)
}

/** 带 py 定义的取值（Speak 渲染用）：返回格式化文本 + 引擎逃生口 */
export function tDef(k: StringKey, vars?: Record<string, string | number>): { zh: string; py?: Record<string, string> } {
  const d = strings[k]
  return { zh: fmt(d.zh, vars), py: d.py }
}

/* 周历星期一~日单字（MineTab weekDays） */
export const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日']

/* 学习岛课组短标签（learn store lessonShort：课号→组名+手核拼音） */
export const LESSON_SHORT: Record<number, { zh: string; py: string }> = {
  1: { zh: '单韵母', py: 'dān yùn mǔ' }, 2: { zh: '单韵母', py: 'dān yùn mǔ' },
  3: { zh: '声母', py: 'shēng mǔ' }, 4: { zh: '声母', py: 'shēng mǔ' },
  5: { zh: '声母', py: 'shēng mǔ' }, 6: { zh: '声母', py: 'shēng mǔ' },
  7: { zh: '声母', py: 'shēng mǔ' }, 8: { zh: '声母', py: 'shēng mǔ' },
  9: { zh: '复韵母', py: 'fù yùn mǔ' },
  11: { zh: '后鼻韵母', py: 'hòu bí yùn mǔ' },
  12: { zh: '整体认读', py: 'zhěng tǐ rèn dú' },
}

/* 课号中文数字（LessonPage cn()） */
export const NUM_CN: Record<number, string> = {
  1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九', 10: '十', 11: '十一', 12: '十二',
}
export function cnNum(x: number | string): string {
  return NUM_CN[+x] || String(x)
}

/* 笔画名数据契约（对照 strokes.json 的 n 字段），非界面文案 */
export const STROKE_DOT = '点'

/* 中文数字读音（数字不归注音引擎管，手写 rt 平价用） */
export const NUM_PY: Record<string, string> = {
  一: 'yī', 二: 'èr', 三: 'sān', 四: 'sì', 五: 'wǔ', 六: 'liù', 七: 'qī', 八: 'bā', 九: 'jiǔ', 十: 'shí',
  十一: 'shí yī', 十二: 'shí èr',
}

/* 声音礼仪页结构化文案（家长向长文案，数组形态不适合单 key） */
export const etiquette = {
  rules: [
    { n: '①', t: '安静进入', d: '打开 App、翻页、切标签页：零语音。不再有"准备开始"盖住读音。', num: '0', bg: '#e6f9f6' },
    { n: '②', t: '点了才说', d: '声音只从三处来：点读、听题、对错反馈。没有别的声音。', num: '3', bg: '#fff8e0' },
    { n: '③', t: '一次一路', d: '同一时刻只有一路声音；新声音一响，旧声音立刻停。', num: '1', bg: '#efe9ff' },
  ],
  map: [
    ['进入 App / 切 tab / 翻页', '静', false],
    ['点字母、点汉字、点文案', '真人读音', true],
    ['听写 / 听音辨调题', '题目音（大喇叭点播）', true],
    ['答对 / 答错', '反馈音（叮 / 嘟）', true],
    ['口诀连播（手动开启）', '广播', true],
  ] as [string, string, boolean][],
}

/* 系统消息注册（T 层不加注音）——SYS_SET 匹配的是格式化前的 zh 文本；带 {x} 占位的键格式化后不匹配，
   仅起纯文本键的免注音作用（占位键的免注音属 Bug#14 腿设计欠账，见 BUGS#17 备注） */
registerSys([strings.notReady, strings.fallbackHint, strings.anchorMissing].map((d) => d.zh))
