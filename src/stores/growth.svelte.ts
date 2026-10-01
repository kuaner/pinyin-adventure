/* v3.2 升级体系 store（kuaner 2026-10-01：升级体系重设计——小鸡成长线/卡片收集/庆祝/签到/徽章）。
   localStorage 键 pinyin_growth_v1，结构带版本号 v:1（spec：数据结构一次设计好）。
   结构裁定：collected_cards 与 calendar 不在本地重复存储——
   · 卡片=「学会即解锁」：learn store 课级小测通过 → 该课全部字母卡解锁（单一真相=学习进度，派生）
   · 日历/连击=progress store S.days（markDay 在练习结算/学习岛小测/闪电结算统一记账，派生）
   本 store 只存派生不出来的：成长星星总数（首装从既有星星迁移）/徽章集/进化已看档/
   侦探与听调累计答对/闪电满分旗。 */
import { S, save, totalStars, todayStr, markDay } from './progress.svelte'
import { quizPassed, learnStarSum } from './learn.svelte'
import { toast } from './ui.svelte'
import { sndFanfare, sndMini, sndEvolve, sndGrad } from '../lib/audio'
import { t, type StringKey } from '../text/strings'
import lessonsData from '../data/lessons.json'

const KEY = 'pinyin_growth_v1'

/* ---------- 小鸡成长五阶段（spec 阈值 0/50/150/300/500） ---------- */
export const STAGE_STARS = [0, 50, 150, 300, 500]

export function stageOf(stars: number): number {
  if (stars >= STAGE_STARS[4]) return 4
  if (stars >= STAGE_STARS[3]) return 3
  if (stars >= STAGE_STARS[2]) return 2
  if (stars >= STAGE_STARS[1]) return 1
  return 0
}

export function stageNameKey(i: number): StringKey {
  return ('stageName' + i) as StringKey
}

/* ---------- 卡片图鉴：63 张 = 12 课字母全集（课序即图鉴序） ---------- */
const LESSONS = (lessonsData as any).lessons as { n: number; letters: { k: string }[] }[]
export const CARD_KEYS: string[] = LESSONS.flatMap((l) => l.letters.map((e) => e.k))
const CARD_LESSON: Record<string, number> = {}
for (const l of LESSONS) for (const e of l.letters) CARD_LESSON[e.k] = l.n

export function cardUnlocked(k: string): boolean {
  const n = CARD_LESSON[k]
  return n ? quizPassed(n) : false
}
export function unlockedCardCount(): number {
  let n = 0
  for (const k of CARD_KEYS) if (cardUnlocked(k)) n++
  return n
}

/* ---------- 连击（S.days 派生；今天没学不打断，与 MineTab 旧口径一致） ---------- */
export function streakOf(): number {
  let n = 0
  const d = new Date()
  if (!S.days[todayStr(d)]) d.setDate(d.getDate() - 1)
  while (S.days[todayStr(d)] && n < 365) { n++; d.setDate(d.getDate() - 1) }
  return n
}
export function activeDayCount(): number { return Object.keys(S.days).length }

export function allLessonsPassed(): boolean {
  for (let i = 1; i <= LESSONS.length; i++) if (!quizPassed(i)) return false
  return true
}

/* ---------- 持久化 ---------- */
interface GrowthData {
  v: number
  stars: number        /* 成长星星总数（小鸡阶段依据；练习关星/学习岛课星/升级奖励都汇入） */
  badges: string[]     /* 已得徽章 id */
  seenStage: number    /* 进化动画已播放到的档（-1 未播；进「我的」tab 播放到当前档） */
  det: number          /* 正反判断累计答对 */
  tone: number         /* 听调辨调累计答对 */
  boltPerf: boolean    /* 闪电满分旗（单轮全对且 ≥20 题） */
}

function normalize(o: any): GrowthData {
  return {
    v: 1,
    stars: typeof o.stars === 'number' ? o.stars : 0,
    badges: Array.isArray(o.badges) ? o.badges.filter((x: unknown) => typeof x === 'string') : [],
    seenStage: typeof o.seenStage === 'number' ? o.seenStage : -1,
    det: typeof o.det === 'number' ? o.det : 0,
    tone: typeof o.tone === 'number' ? o.tone : 0,
    boltPerf: !!o.boltPerf,
  }
}

function load(): GrowthData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const o = JSON.parse(raw)
      if (o && typeof o === 'object' && o.v === 1) return normalize(o)
    }
  } catch { /* 损坏数据回退默认 */ }
  /* 首次建账：迁移既有星星（练习关星 + 学习岛课星）——升级用户的小鸡不从零开始 */
  return { v: 1, stars: totalStars() + learnStarSum(), badges: [], seenStage: -1, det: 0, tone: 0, boltPerf: false }
}

export const G: GrowthData = $state(load())

export function saveG() {
  try { localStorage.setItem(KEY, JSON.stringify(G)) } catch { /* 隐私模式静默 */ }
}

/* ---------- 成就徽章（spec ≥10 枚） ---------- */
export interface BadgeDef { id: string; icon: string; name: StringKey; cond: StringKey; bg: string }
export const BADGE_DEFS: BadgeDef[] = [
  { id: 'first', icon: 'flag', name: 'bFirstPass', cond: 'bFirstPassC', bg: '#e6f9f6' },
  { id: 'streak7', icon: 'flame', name: 'bStreak7', cond: 'bStreak7C', bg: '#fdeee7' },
  { id: 'boltperfect', icon: 'rocket', name: 'bBoltPerfect', cond: 'bBoltPerfectC', bg: '#efe9ff' },
  { id: 'allcards', icon: 'star', name: 'bAllCards', cond: 'bAllCardsC', bg: '#fff8e0' },
  { id: 'grad', icon: 'trophy', name: 'bGrad', cond: 'bGradC', bg: '#e6f9f6' },
  { id: 'speed', icon: 'clock', name: 'bSpeed', cond: 'bSpeedC', bg: '#fdeee7' },
  { id: 'tone', icon: 'music', name: 'bTone', cond: 'bToneC', bg: '#efe9ff' },
  { id: 'det', icon: 'search', name: 'bDet', cond: 'bDetC', bg: '#fff8e0' },
  { id: 'coll30', icon: 'gift', name: 'bColl', cond: 'bCollC', bg: '#e6f9f6' },
  { id: 'days30', icon: 'sun', name: 'bDays30', cond: 'bDays30C', bg: '#fff8e0' },
]

function condMet(id: string): boolean {
  switch (id) {
    case 'first': {
      for (const k in S.stars) if ((S.stars[k] || 0) > 0) return true
      for (let i = 1; i <= LESSONS.length; i++) if (quizPassed(i)) return true
      return false
    }
    case 'streak7': return streakOf() >= 7
    case 'boltperfect': return G.boltPerf
    case 'allcards': return unlockedCardCount() >= CARD_KEYS.length
    case 'grad': return allLessonsPassed()
    case 'tone': return G.tone >= 30
    case 'det': return G.det >= 30
    case 'coll30': return unlockedCardCount() >= 30
    case 'days30': return activeDayCount() >= 30
    default: return false   /* speed=事件型（onBoltEnd 一次性判） */
  }
}

/* 徽章解锁：入账（立即持久化）+ toast（多枚同时解锁按 2.8s 间隔排队，不互相顶掉） */
function grantBadge(id: string, delayMs: number) {
  if (G.badges.includes(id)) return
  G.badges.push(id)
  saveG()
  const def = BADGE_DEFS.find((b) => b.id === id)
  setTimeout(() => { if (def) toast(t('badgeGotN', { x: t(def.name) })) }, delayMs)
}

export function checkBadges() {
  let changed = false
  let delay = 0
  for (const b of BADGE_DEFS) {
    if (!G.badges.includes(b.id) && condMet(b.id)) { grantBadge(b.id, delay); delay += 2800; changed = true }
  }
  if (changed) saveG()
}

/* ---------- 庆祝仪式状态机（overlay 组件渲染；z 最高、2.5s 自动散场、可点击跳过） ---------- */
export type CeMode = '' | 'quiz' | 'letter' | 'grad' | 'evolve'
export const CE = $state({
  mode: '' as CeMode,
  letter: '',       /* letter 模式：学会的字母 */
  stage: 0,         /* evolve 模式：进化到的档 */
  gain: 0,          /* quiz 模式：星星进账 */
  epoch: 0,         /* 庆祝代数：作废过期自动散场定时器 */
})
let ceTimer: ReturnType<typeof setTimeout> | null = null

function startCe(mode: CeMode, ms: number) {
  CE.epoch++
  if (ceTimer) clearTimeout(ceTimer)
  const e = CE.epoch
  ceTimer = setTimeout(() => { if (CE.epoch === e) dismissCe() }, ms)
}

export function dismissCe() {
  CE.epoch++
  CE.mode = ''
}

export function celebrateQuiz(gain: number) {
  CE.gain = gain
  CE.mode = 'quiz'
  sndFanfare()
  startCe('quiz', 2600)
}

export function celebrateLetter(k: string) {
  CE.letter = k
  CE.mode = 'letter'
  sndMini()
  startCe('letter', 2000)
}

export function celebrateGrad() {
  CE.mode = 'grad'
  sndGrad()
  startCe('grad', 5200)
}

export function celebrateEvolve(stage: number) {
  CE.stage = stage
  CE.mode = 'evolve'
  sndEvolve()
  startCe('evolve', 2400)
}

/* 进化动画已看档推进（进「我的」tab 时调用：播当前档进化并立即记账，防重播） */
export function evolvePending(): number {
  const st = stageOf(G.stars)
  return st > G.seenStage ? st : -1
}
export function commitEvolve(stage: number) {
  if (stage > G.seenStage) { G.seenStage = stage; saveG() }
}

/* ---------- 触发点接线 ---------- */

/* 学习岛小测过关（LessonPage 小测步；4/5 门槛已由 learn.submitQuiz 把关）
   wasAll=过关前是否已 12 课全通（防复玩毕业课重放毕业典礼）。
   星星：首过 +5（spec：小测 4/5 过关 → 星星+5）；复玩巩固 +2（防 30 秒重刷把成长线打穿） */
export function onLearnQuizPass(wasPassed: boolean, wasAll: boolean) {
  const gain = wasPassed ? 2 : 5
  G.stars += gain
  saveG()
  if (!wasAll && allLessonsPassed()) {
    celebrateGrad()
    grantBadge('grad', 5400)
  } else {
    celebrateQuiz(gain)
  }
  if (!wasPassed) grantBadge('first', 3000)
  checkBadges()
  return gain
}

/* 听调辨调答对（学习岛小测 tone 题） */
export function addToneCorrect() {
  G.tone++
  saveG()
  checkBadges()
}

/* 正反判断答对（小侦探会话） */
export function addDetCorrect() {
  G.det++
  saveG()
  checkBadges()
}

/* 闪电结算：学习内容记签到（任意内容学习过即算）；满分/速读徽章事件型判定 */
export function onBoltEnd(n: number, ok: number) {
  if (n >= 10) markDay()
  if (n >= 20 && ok === n) G.boltPerf = true
  let delay = 0
  if (n >= 20 && ok === n && !G.badges.includes('boltperfect')) { grantBadge('boltperfect', delay); delay += 2800 }
  if (n >= 40 && !G.badges.includes('speed')) { grantBadge('speed', delay) }
  checkBadges()
}
