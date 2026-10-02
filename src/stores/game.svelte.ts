/* v4.0 游戏岛 store：连击系统（全局复用）+ 错误账本 game_stats_v1 + 游戏会话（60 秒/局）
   + 每日挑战会话。localStorage 键 pinyin_game_v1（带版本号）。
   账本结构（spec）：{ per-letter:{ok,err,last}, per-game:{best,starsToday,lastPlayDay} }，
   每日挑战与镜像对决出题都从它加权抽样。星星产入小鸡成长体系（每游戏每日上限 10 星）。 */
import { show } from './ui.svelte'
import { todayStr, markDay } from './progress.svelte'
import { sndNo, tone, sndStar, playAudio, letterAudio, kjAudio, hasRiddle, riddleAudio, stopAll, unlockMedia, preloadAudioList, pyAudio } from '../lib/audio'
import { HYP } from '../data'
import { G, saveG, checkBadges, celebrateGame } from './growth.svelte'
import { t } from '../text/strings'
import { buildDailyQs, learnedLetters, learnedBlends, learnedToneRows, type DailyQ } from '../lib/gameEngine'
import { markResult } from './weights.svelte'

const KEY = 'pinyin_game_v1'

/* ---------- 错误账本 ---------- */
export interface LetterStat { ok: number; err: number; last: number }
export interface GameRec { best: number; starsToday: number; lastPlayDay: string }
export interface GameLedger {
  v: number
  letters: Record<string, LetterStat>
  games: Record<string, GameRec>
  daily: { day: string; best: number; done: boolean }
  items: Record<string, LetterStat>   /* v4.3 条目账本：拼读对（键=syl 如 ba）/声调音节（键=file 如 ma2） */
}

export function dayNum(d = new Date()): number {
  return Math.floor(d.getTime() / 86400000)
}

function normalize(o: any): GameLedger {
  const out: GameLedger = { v: 1, letters: {}, games: {}, daily: { day: '', best: 0, done: false }, items: {} }
  if (o && typeof o === 'object' && o.v === 1) {
    if (o.letters && typeof o.letters === 'object') {
      for (const k in o.letters) {
        const r = o.letters[k]
        if (r && typeof r === 'object') out.letters[k] = { ok: +r.ok || 0, err: +r.err || 0, last: +r.last || 0 }
      }
    }
    if (o.items && typeof o.items === 'object') {
      /* v4.3 增量字段：旧数据无 items → 默认空表，向后兼容 */
      for (const k in o.items) {
        const r = o.items[k]
        if (r && typeof r === 'object') out.items[k] = { ok: +r.ok || 0, err: +r.err || 0, last: +r.last || 0 }
      }
    }
    if (o.games && typeof o.games === 'object') {
      for (const k in o.games) {
        const r = o.games[k]
        if (r && typeof r === 'object') out.games[k] = { best: +r.best || 0, starsToday: +r.starsToday || 0, lastPlayDay: String(r.lastPlayDay || '') }
      }
    }
    if (o.daily && typeof o.daily === 'object') {
      out.daily = { day: String(o.daily.day || ''), best: +o.daily.best || 0, done: !!o.daily.done }
    }
  }
  return out
}

function loadLedger(): GameLedger {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return normalize(JSON.parse(raw))
  } catch { /* 损坏数据回退默认 */ }
  return normalize(null)
}

export const GD: GameLedger = $state(loadLedger())

export function saveGD() {
  try { localStorage.setItem(KEY, JSON.stringify(GD)) } catch { /* 隐私模式静默 */ }
}

/* 跨天滚存：starsToday 与 daily.done 按日重置（读侧归零，写侧覆盖）。
   注意：本函数有写副作用——只在事件链（开局/结算）里调，禁止进 $derived。
   Bug#39（T2 单测红出）：首建分支 `r = GD.games[id] = {...}` 的局部引用是孤儿原对象，
   且 saveGD 的 stringify 之后对它的续写不回传存内（Svelte5 $state 首建 raw 视图坑）——
   创建后必须二次读取存内记录再续写/返回（fakeResult 抬 best、endGame 记 best/stars 全走这条）。 */
export function gameRec(id: string): GameRec {
  const td = todayStr()
  if (!GD.games[id]) { GD.games[id] = { best: 0, starsToday: 0, lastPlayDay: '' }; saveGD() }
  const r = GD.games[id]!   /* 二次读取=代理视图：此后读写都落在存内状态 */
  if (r.lastPlayDay !== td) { r.starsToday = 0; r.lastPlayDay = td; saveGD() }
  return r
}

export function dailyRec(): { day: string; best: number; done: boolean } {
  const td = todayStr()
  if (GD.daily.day !== td) { GD.daily = { day: td, best: 0, done: false }; saveGD() }
  return GD.daily
}

/* ---------- 纯读侧（模板/derived 安全，零写副作用） ---------- */
export function gameBest(id: string): number {
  const r = GD.games[id]
  return r ? r.best : 0
}

export function dailyView(): { done: boolean; best: number } {
  const d = GD.daily
  return d.day === todayStr() ? { done: d.done, best: d.best } : { done: false, best: 0 }
}

/* 记一笔对错（全部游戏 + 每日挑战共用） */
export function recordLetter(k: string, ok: boolean) {
  if (!k) return
  let r = GD.letters[k]
  if (!r) { r = GD.letters[k] = { ok: 0, err: 0, last: 0 } }
  if (ok) r.ok++
  else r.err++
  r.last = dayNum()
  saveGD()
}

/* v4.3 条目账本记一笔（拼读对/声调音节级）——错过的对子加权多出（itemWeight 消费） */
export function recordItem(k: string, ok: boolean) {
  if (!k) return
  let r = GD.items[k]
  if (!r) { r = GD.items[k] = { ok: 0, err: 0, last: 0 } }
  if (ok) r.ok++
  else r.err++
  r.last = dayNum()
  saveGD()
}

/* ---------- 游戏定义 ---------- */
export interface GameDef { id: string; nameKey: any; hintKey: any }
export const GAME_DEFS: Record<string, GameDef> = {
  balloon: { id: 'balloon', nameKey: 'stallBalloon', hintKey: 'hintBalloon' },
  mole: { id: 'mole', nameKey: 'stallMoleKj', hintKey: 'hintRiddleMole' },
  duel: { id: 'duel', nameKey: 'stallDuel', hintKey: 'hintDuel' },
  fish: { id: 'fish', nameKey: 'stallFish', hintKey: 'hintFish' },
  egg: { id: 'egg', nameKey: 'stallEgg', hintKey: 'hintEgg' },
  tone: { id: 'tone', nameKey: 'stallTone', hintKey: 'hintTone' },
}

/* ---------- 游戏会话状态 ---------- */
export const GS = $state({
  game: '',                       /* 当前游戏 id */
  phase: '' as '' | 'count' | 'play' | 'result',
  countN: 3,                      /* 倒计时显示值（3→0=开始） */
  left: 60,                       /* 剩余秒 */
  score: 0,
  combo: 0,
  maxCombo: 0,
  tries: 0,
  stars: 0,
  record: false,
  win: 0,                         /* 拔河终局：1 推过线赢 / -1 被推过线 / 0 超时自然结算 */
  practice: false,                /* v4.5 Bug#39 练习制：true=无 60s 计时（✕=结算计答对数），点对才换题 */
  target: '',                     /* 当前听音目标字母（蛋合并=syl/音乐会=音节文件名） */
  afile: '',                      /* v4.3 目标音频文件直通（蛋=blend file、音乐会=tone file）：非空时播它 */
  kj: false,                      /* v4.2 口诀地鼠：true=目标音播口诀朗读（kj_{k}），false=呼读音 */
  listened: false,                /* 本目标是否已点听过（未听过时漏掉不罚——孩子还没听到题） */
  frozen: false,                  /* 探针冻结计时（?open= 截图/自动化用） */
  tid: null as ReturnType<typeof setInterval> | null,
  epoch: 0,                       /* 会话代数：作废 Countdown/timeout 链 */
})

export function comboMult(c: number): number { return c >= 6 ? 3 : c >= 3 ? 2 : 1 }

/* 连击音阶升调：五声音阶阶梯（WebAudio 合成，非语音） */
const LADDER = [523, 587, 659, 784, 880, 1046, 1175, 1319, 1568, 1760]
function comboTone(c: number) {
  const f = LADDER[Math.min(Math.max(c - 1, 0), LADDER.length - 1)]
  tone(f, 0, 0.14, 'triangle', 0.15)
  tone(f * 1.5, 0.07, 0.18, 'sine', 0.1)
}

/* 各游戏在 phase→play 时通过 epoch 感知开局重置自身 */
export function startGame(id: string, frozen = false) {
  stopTimers()
  GS.epoch++
  GS.game = id
  GS.phase = 'count'
  GS.left = 60
  GS.practice = id === 'mole' /* v4.5 Bug#39：口诀地鼠退街机计时→练习制（点对才换题，✕=结算答对数） */
  GS.score = 0
  GS.combo = 0
  GS.maxCombo = 0
  GS.stars = 0
  GS.record = false
  GS.win = 0
  GS.target = ''
  GS.afile = ''
  GS.kj = id === 'mole' /* v4.2 口诀地鼠：认知路径=口诀→形（气球/钓鱼仍=呼读音→形） */
  GS.listened = false
  GS.frozen = frozen
  show('game')
  gameRec(id) /* 跨天滚存先行（结算产星上限依赖今天的空账） */
  if (frozen) return
  /* v4.1 声音先行：开局点击的手势栈内统一解锁一次（媒体元素+AudioContext），
     3-2-1 期间并行预载本局音频（地鼠=口诀、对决=呼读+口诀、蛋=拼读合成音、音乐会=四声音节、其余=呼读）——首播零网络等待 */
  unlockMedia()
  try {
    let names: string[] = []
    if (id === 'egg') names = learnedBlends().map((b) => b.file)
    else if (id === 'tone') names = learnedToneRows().flatMap((r) => r.tones.map((x) => x.file))
    else names = learnedLetters().flatMap((k) =>
      id === 'mole' ? (hasRiddle(k) ? [riddleAudio(k), kjAudio(k)] : [])   /* v4.5 谜面制：谜面+点对奖励整句口诀 */
      : id === 'duel' ? [letterAudio(k), kjAudio(k)]
      : [letterAudio(k)])
    preloadAudioList(names)
  } catch { /* 预载失败静默，首播走网络 */ }
  const e = GS.epoch
  let n = 3
  GS.countN = 3
  const step = () => {
    if (GS.epoch !== e) return
    n--
    GS.countN = n
    if (n > 0) { tone(660, 0, 0.12, 'sine', 0.12); setTimeout(step, 900) }
    else { tone(1046, 0, 0.3, 'triangle', 0.15); toPlay() }
  }
  tone(660, 0, 0.12, 'sine', 0.12)
  setTimeout(step, 900)
}

export function toPlay(frozen = false) {
  GS.epoch++
  GS.phase = 'play'
  GS.left = 60
  GS.frozen = frozen
  if (frozen) return
  stopTimers()
  if (GS.practice) return   /* v4.5 Bug#39 练习制（口诀地鼠）：无倒计时，点对才换题，✕=结算 */
  GS.tid = setInterval(() => {
    if (GS.phase !== 'play') return
    GS.left--
    if (GS.left <= 0) endGame()
  }, 1000)
}

function stopTimers() {
  if (GS.tid) { clearInterval(GS.tid); GS.tid = null }
}

/* ---------- 连击判定（全部游戏入口） ----------
   ledger='letter'（默认）记字母账本；ledger='item' 记 v4.3 条目账本（拼读对/声调音节） */
export function gameHit(letter: string, ok: boolean, ledger: 'letter' | 'item' = 'letter') {
  if (GS.phase !== 'play') return
  if (ledger === 'item') recordItem(letter, ok)
  else recordLetter(letter, ok)
  if (ok) {
    GS.combo++
    GS.tries++
    if (GS.combo > GS.maxCombo) GS.maxCombo = GS.combo
    const mult = comboMult(GS.combo)
    GS.score += 10 * mult
    comboTone(GS.combo)
  } else {
    if (GS.combo >= 3) tone(220, 0.05, 0.2, 'square', 0.08)
    GS.combo = 0
    sndNo()
  }
}

/* 星星档：得分→星（回合结算）；每游戏每日上限 10 星 */
export function starsFor(score: number): number {
  if (score >= 400) return 5
  if (score >= 300) return 4
  if (score >= 220) return 3
  if (score >= 140) return 2
  if (score >= 70) return 1
  return 0
}

export function endGame(win = 0) {
  if (GS.phase !== 'play') return
  stopTimers()
  GS.win = win
  GS.phase = 'result'
  const id = GS.game
  const rec = gameRec(id)
  if (win === 1) GS.score += 100 /* 拔河把绳子推过线的胜利奖励 */
  const earned = Math.min(starsFor(GS.score), Math.max(0, 10 - rec.starsToday))
  GS.stars = earned
  if (GS.score > rec.best) { rec.best = GS.score; GS.record = true }
  rec.starsToday += earned
  rec.lastPlayDay = todayStr()
  saveGD()
  if (GS.tries >= 8 || GS.score >= 80) markDay()
  /* 星星入小鸡成长体系 + 庆祝仪式（星星飞入 overlay） */
  if (earned > 0) {
    G.stars += earned
    saveG()
    celebrateGame(earned)
  } else if (GS.record) {
    sndStar()
  }
  checkBadges()
}

/* 退出：rAF/setInterval 由游戏组件 effect 清理；这里停会话层计时。
   v4.5 练习制（口诀地鼠）：✕=结束练习走结算（答对数/星/最佳照常），而非静默退出 */
export function quitGame() {
  if (GS.practice && GS.phase === 'play') { endGame(); return }
  stopTimers()
  GS.epoch++
  GS.phase = ''
  GS.target = ''
  show('practice')
}

/* ---------- 听音目标（气球/地鼠/钓鱼共用；v4.1 声音先行制 Bug#34） ----------
   每换目标自动播目标音（游戏场景推翻 v2.6 零自动播放，kuaner 2026-10-01 定）：
   声音开播 300ms 后元素才出现（各游戏挂 this 之后），🔊=随时重听不是唯一来源。
   自动播即算"已听过"——等待窗超时未击一律 miss 清连击，绝不静默推进。
   v4.2 口诀地鼠：GS.kj=true 时播口诀朗读（kj_{k} 真人库）而非呼读音——认知路径=口诀→形。
   播放失败/静音静默降级（hint 置空不弹 toast），游戏照常不阻塞。 */
export function askTarget(k: string, file = '') {
  GS.target = k
  GS.afile = file
  GS.listened = true
  stopAll()                          /* 连续自动播防重叠：新目标音开播前停旧音频 */
  playAudio(file || (GS.kj ? kjAudio(k) : letterAudio(k)))   /* hyp 真人库，失败静默 */
}

export function listenTarget() {
  if (!GS.target) return
  GS.listened = true
  playAudio(GS.afile || (GS.kj ? kjAudio(GS.target) : letterAudio(GS.target)))  /* 🔊=重听当前目标音 */
}

/* ---------- 每日挑战会话 ---------- */
export const DC = $state({
  i: 0,
  qs: [] as DailyQ[],
  score: 0,
  combo: 0,
  maxCombo: 0,
  ok: 0,
  armed: -1,   /* v4.2c Bug#37 两段式试听：首点=播音高亮，再点同项=作答 */
  reveal: null as null | { correct: number; wrong: number[] },
  done: false,
  record: false,
  stars: 0,
  fbt: null as ReturnType<typeof setTimeout> | null,
})

export function startDaily() {
  if (DC.fbt) { clearTimeout(DC.fbt); DC.fbt = null }
  DC.i = 0
  DC.qs = buildDailyQs()
  DC.score = 0
  DC.combo = 0
  DC.maxCombo = 0
  DC.ok = 0
  DC.armed = -1
  DC.reveal = null
  DC.done = false
  DC.record = false
  DC.stars = 0
  dailyRec()
  show('daily')
  dailySpeak()
}

/* v4.1 每日挑战出题自动读音（游戏/挑战场景推翻 v2.6 零自动播放）：听写题=呼读音、
   口诀题=谜面朗读（v4.5 Bug#41 审计：整句口诀含答案读音不作题面通道）；zi 题是"看字选拼音"
   视觉识字通道，播读音=直接报答案，不自动播；🔊 重听保留。静音/失败静默降级不阻塞。 */
function dailySpeak() {
  const q = DC.qs[DC.i]
  if (!q || q.type === 'zi' || !q.A) return
  stopAll()
  if (q.type === 'bkj') playAudio(riddleAudio(q.A))
  else playAudio(letterAudio(q.sound))
}

export function dailyAnswer(idx: number) {
  if (DC.done || DC.reveal) return
  const q = DC.qs[DC.i]
  if (!q) return
  DC.armed = -1
  const ok = idx === q.ans
  DC.reveal = { correct: q.ans, wrong: ok ? [] : [idx] }
  if (q.type === 'zi') {
    /* 识字题错题走既有权重层（Z: 键），供下次快拼/每日加权 */
    markResult(q.key, ok)
  } else {
    recordLetter(q.A, ok)
  }
  if (ok) {
    DC.ok++
    DC.combo++
    if (DC.combo > DC.maxCombo) DC.maxCombo = DC.combo
    DC.score += 10 * comboMult(DC.combo)
    comboTone(DC.combo)
  } else {
    if (DC.combo >= 3) tone(220, 0.05, 0.2, 'square', 0.08)
    DC.combo = 0
    sndNo()
  }
  DC.fbt = setTimeout(dailyNext, ok ? 750 : 1400)
}

export function dailyNext() {
  if (DC.fbt) { clearTimeout(DC.fbt); DC.fbt = null }
  if (DC.done) return
  DC.reveal = null
  DC.armed = -1
  DC.i++
  if (DC.i >= DC.qs.length) { endDaily() } else { dailySpeak() }
}

/* v4.2c Bug#37 两段式试听：首点=播该选项读音+高亮（不计分不推进）→ 再点同项=作答；
   点别的选项=切试听。字母选项=呼读音；zi 拼音选项=hyp 音节（缺失仅高亮，立法明许）。
   v4.5 两段式适用矩阵（Bug#38）：字母选项题（blisten/bkj）一点即答；zi（带调拼音，读不出）保留两段式 */
export function dailyArm(idx: number) {
  const q0 = DC.qs[DC.i]
  if ((q0 && q0.type !== 'zi') || DC.armed === idx) { dailyAnswer(idx); return }
  const q = DC.qs[DC.i]
  if (!q || DC.reveal) return
  DC.armed = idx
  if (q.type === 'zi') {
    const f = pyAudio(q.opts[idx])
    if (HYP[f]) playAudio(f)
  } else {
    playAudio(letterAudio(q.opts[idx]))
  }
}

function endDaily() {
  DC.done = true
  const rec = dailyRec()
  const stars = DC.ok >= 10 ? 5 : DC.ok >= 9 ? 4 : DC.ok >= 7 ? 3 : DC.ok >= 6 ? 2 : DC.ok >= 4 ? 1 : 0
  if (DC.score > rec.best) { rec.best = DC.score; DC.record = true }
  rec.done = true
  saveGD()
  markDay()
  DC.stars = stars
  if (stars > 0) {
    G.stars += stars
    saveG()
    celebrateGame(stars)
  } else if (DC.record) {
    sndStar()
  }
  checkBadges()
}

export function quitDaily() {
  if (DC.fbt) { clearTimeout(DC.fbt); DC.fbt = null }
  DC.done = true
  show('practice')
}

/* 供视觉验收（?open=game）：直接落结算态（best 同步抬到得分，画面语义一致） */
export function fakeResult(id: string, score = 180) {
  GS.game = id
  GS.phase = 'result'
  GS.score = score
  GS.combo = 0
  GS.maxCombo = 6
  GS.win = 0
  GS.left = 0
  const rec = gameRec(id)
  if (score > rec.best) rec.best = score
  GS.stars = Math.min(starsFor(score), Math.max(0, 10 - rec.starsToday))
  GS.record = false
}

export function gameTitle(): string {
  const def = GAME_DEFS[GS.game]
  return def ? t(def.nameKey) : ''
}
