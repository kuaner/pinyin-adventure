/* v4.0 游戏岛 store：连击系统（全局复用）+ 错误账本 game_stats_v1 + 游戏会话（60 秒/局）
   + 每日挑战会话。localStorage 键 pinyin_game_v1（带版本号）。
   账本结构（spec）：{ per-letter:{ok,err,last}, per-game:{best,starsToday,lastPlayDay} }，
   每日挑战与镜像对决出题都从它加权抽样。星星产入小鸡成长体系（每游戏每日上限 10 星）。 */
import { show } from './ui.svelte'
import { todayStr, markDay } from './progress.svelte'
import { sndNo, tone, sndStar, playAudio, letterAudio, kjAudio, stopAll, unlockMedia, preloadAudioList } from '../lib/audio'
import { G, saveG, checkBadges, celebrateGame } from './growth.svelte'
import { t } from '../text/strings'
import { buildDailyQs, learnedLetters, type DailyQ } from '../lib/gameEngine'
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
}

export function dayNum(d = new Date()): number {
  return Math.floor(d.getTime() / 86400000)
}

function normalize(o: any): GameLedger {
  const out: GameLedger = { v: 1, letters: {}, games: {}, daily: { day: '', best: 0, done: false } }
  if (o && typeof o === 'object' && o.v === 1) {
    if (o.letters && typeof o.letters === 'object') {
      for (const k in o.letters) {
        const r = o.letters[k]
        if (r && typeof r === 'object') out.letters[k] = { ok: +r.ok || 0, err: +r.err || 0, last: +r.last || 0 }
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
   注意：本函数有写副作用——只在事件链（开局/结算）里调，禁止进 $derived */
export function gameRec(id: string): GameRec {
  const td = todayStr()
  let r = GD.games[id]
  if (!r) { r = GD.games[id] = { best: 0, starsToday: 0, lastPlayDay: '' }; saveGD() }
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

/* ---------- 游戏定义 ---------- */
export interface GameDef { id: string; nameKey: any; hintKey: any }
export const GAME_DEFS: Record<string, GameDef> = {
  balloon: { id: 'balloon', nameKey: 'stallBalloon', hintKey: 'hintBalloon' },
  mole: { id: 'mole', nameKey: 'stallMole', hintKey: 'hintMole' },
  duel: { id: 'duel', nameKey: 'stallDuel', hintKey: 'hintDuel' },
  fish: { id: 'fish', nameKey: 'stallFish', hintKey: 'hintFish' },
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
  target: '',                     /* 当前听音目标字母 */
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
  GS.score = 0
  GS.combo = 0
  GS.maxCombo = 0
  GS.stars = 0
  GS.record = false
  GS.win = 0
  GS.target = ''
  GS.listened = false
  GS.frozen = frozen
  show('game')
  gameRec(id) /* 跨天滚存先行（结算产星上限依赖今天的空账） */
  if (frozen) return
  /* v4.1 声音先行：开局点击的手势栈内统一解锁一次（媒体元素+AudioContext），
     3-2-1 期间并行预载本局字母池读音（对决加口诀）——首播零网络等待 */
  unlockMedia()
  try {
    const names = learnedLetters().flatMap((k) => (id === 'duel' ? [letterAudio(k), kjAudio(k)] : [letterAudio(k)]))
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
  GS.tid = setInterval(() => {
    if (GS.phase !== 'play') return
    GS.left--
    if (GS.left <= 0) endGame()
  }, 1000)
}

function stopTimers() {
  if (GS.tid) { clearInterval(GS.tid); GS.tid = null }
}

/* ---------- 连击判定（全部游戏入口） ---------- */
export function gameHit(letter: string, ok: boolean) {
  if (GS.phase !== 'play') return
  recordLetter(letter, ok)
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

/* 退出：rAF/setInterval 由游戏组件 effect 清理；这里停会话层计时 */
export function quitGame() {
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
   播放失败/静音静默降级（hint 置空不弹 toast），游戏照常不阻塞。 */
export function askTarget(k: string) {
  GS.target = k
  GS.listened = true
  stopAll()                          /* 连续自动播防重叠：新目标音开播前停旧音频 */
  playAudio(letterAudio(k))          /* hyp 真人库，失败静默 */
}

export function listenTarget() {
  if (!GS.target) return
  GS.listened = true
  playAudio(letterAudio(GS.target))  /* 🔊=重听当前目标音 */
}

/* ---------- 每日挑战会话 ---------- */
export const DC = $state({
  i: 0,
  qs: [] as DailyQ[],
  score: 0,
  combo: 0,
  maxCombo: 0,
  ok: 0,
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
  DC.reveal = null
  DC.done = false
  DC.record = false
  DC.stars = 0
  dailyRec()
  show('daily')
  dailySpeak()
}

/* v4.1 每日挑战出题自动读音（游戏/挑战场景推翻 v2.6 零自动播放）：听写题=呼读音、
   口诀题=口诀朗读；zi 题是"看字选拼音"视觉识字通道，播读音=直接报答案，不自动播；
   🔊 重听保留。静音/失败静默降级不阻塞。 */
function dailySpeak() {
  const q = DC.qs[DC.i]
  if (!q || q.type === 'zi' || !q.A) return
  stopAll()
  if (q.type === 'bkj') playAudio(kjAudio(q.A))
  else playAudio(letterAudio(q.sound))
}

export function dailyAnswer(idx: number) {
  if (DC.done || DC.reveal) return
  const q = DC.qs[DC.i]
  if (!q) return
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
  DC.i++
  if (DC.i >= DC.qs.length) { endDaily() } else { dailySpeak() }
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
