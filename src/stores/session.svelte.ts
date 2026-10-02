/* 答题会话 store：闯关/小侦探/常见字/专练/自由练习共用一套 10 题会话流程
   （反馈层文案、结算、解锁、历史写入与 v1 行为正本一致） */
import { show } from './ui.svelte'
import { S, save, addHist } from './progress.svelte'
import { markResult, getW } from './weights.svelte'
import { recordLetter } from './game.svelte'
import { say, sndOk, sndNo, sndStar, playAudio, pyAudio } from '../lib/audio'
import { openQuestion, judgeHold, markArm, confirmOk, answerOpen } from '../lib/inputGuard'
import { HYP } from '../data'
import { buildQuestions, buildDetQs, ziQs, partnerOf, practiceScope } from '../lib/quizEngine'
import { LETTERS, PAIRS, PMAP, ZIBY, LEVELS, GRPNAME, PH, ANCHORS } from '../data'
import { T } from '../lib/ruby'
import { t } from '../text/strings'
import { stamp, type HistEntry } from '../lib/storage'
import { addDetCorrect, checkBadges } from './growth.svelte'
import type { Question, SessionCfg } from '../lib/types'

const ANCHORS_REF = ANCHORS as Record<string, { h: string; p: string; em: string }>

export interface FbState { good: boolean; icon: string; text: string; glyph: string; desc: string }
export interface ResultState { sc: number; stars: number; unlockMsg: string; wlabel: string; lvNo: number | null }

const PRAISE: string[] = (PH as any).praise
const CHEER: string[] = (PH as any).cheer
const DETNAME = T((PH as any).detName)

export const QZ = $state({
  tk: 0,          // 会话代数（作废旧定时器）
  seq: 0,         // 题目代数（自动读音定时器作废）
  fbt: null as ReturnType<typeof setTimeout> | null,
  cfg: null as SessionCfg | null,
  i: 0,
  score: 0,
  miss: {} as Record<string, number>,
  q: null as Question | null,
  armed: -1,
  done: false,
  reveal: null as { correct: number; wrong: number[] } | null,
  fb: null as FbState | null,
  star: 0,        // floatstar 渲染 key
  result: null as ResultState | null,
})

export function newSession(cfg: SessionCfg) {
  if (QZ.fbt) { clearTimeout(QZ.fbt); QZ.fbt = null }
  QZ.tk++
  QZ.cfg = cfg
  QZ.i = 0
  QZ.score = 0
  QZ.miss = {}
  QZ.q = cfg.qs[0]
  QZ.armed = -1
  QZ.done = false
  QZ.reveal = null
  QZ.fb = null
  QZ.result = null
  QZ.seq++
  openQuestion()   /* P1-2 进题宽限：切题首击忽略（判定反馈期连点不泄漏进新题） */
  show('quiz')
}

/* ---------- 各模式入口（v2.4 声音礼仪 R1：安静进入 —— 零入口过场音） ---------- */
export function startLevel(n: number) {
  const L = LEVELS[n - 1]
  newSession({
    name: T(t('levelN', { n })) + ' · ' + T(L.name),
    level: L,
    levelNo: n,
    qs: buildQuestions(L),
  })
}

export function startDet() {
  newSession({ name: DETNAME, det: true, qs: buildDetQs(false) })
}

export function startZi() {
  newSession({ name: T(t('quickPin')), zi: true, qs: ziQs() })
}

export function startPractice(kind: string) {
  const L = practiceScope(kind)
  newSession({ name: T(L.name), level: L, pkind: kind, qs: buildQuestions(L) })
}

export function startPairGroup(grp: string) {
  const ps = PAIRS.filter((p) => p.grp === grp).map((p) => p.a + '|' + p.b)
  const L = { name: GRPNAME[grp] + t('specialDrill'), pool: null as string[] | null, pairs: ps }
  newSession({ name: T(GRPNAME[grp]) + T(t('specialDrill')), level: L, qs: buildQuestions(L) })
}

/* ---------- 答题（v4.2c Bug#37：两段式试听回归——v1 正本行为） ----------
   首点=播该选项读音+高亮"试听"态（不计对错不推进）→ 再点同项=作答；
   点别的选项=切试听那项。无音频（hyp 缺失）首点退化为仅高亮，仍不计分。
   v4.5 两段式适用矩阵（Bug#38）：listen 题（选项=已学单字母，视觉即身份）**一点即答**——
   试听=挨个点听暴力匹配，毁掉检索练习；look/kj/zi（带调音节串选项，孩子读不出）保留两段式 */
export function armOpt(idx: number) {
  const q0 = QZ.q as any
  /* P1-2 守卫：判定/进题窗口内一切输入不收 */
  if (QZ.reveal || !answerOpen()) return
  if (q0?.type === 'listen' || (QZ.armed === idx && confirmOk())) { answer(idx); return }
  if (QZ.armed === idx) return   /* P1-3：确认间隔未到，保持试听态（77ms 双击不穿透） */
  QZ.armed = idx
  markArm()   /* P1-3：试听击打点（确认击 ≥400ms 后才可判定） */
  const q = QZ.q as any
  if (!q) return
  if (q.type === 'zi' || q.type === 'zword') {
    /* 拼音全拼选项 → hyp 音节键（部分覆盖：缺失仅高亮不播） */
    const f = pyAudio(q.opts[idx])
    if (HYP[f]) playAudio(f)
  } else {
    say(q.opts[idx])
  }
}

export function answer(idx: number) {
  const q = QZ.q as any
  if (!q) return
  if (QZ.reveal) return   /* v4.5 单答锁（#42 同族）：reveal 态忽略一切作答——
                             一点即答（Bug#38 矩阵）后反馈期的连点/幽灵点不得重复计分 */
  QZ.armed = -1   /* 试听态交还给 reveal 态（correct/wrong 高亮） */
  judgeHold()   /* P1-2 判定冷却：反馈窗（自动推进 0.8/1.6s）内连点不外泄 */
  const ok = idx === q.ans
  const wrong: number[] = []
  if (!ok) {
    wrong.push(idx)
    if (q.type === 'look' && QZ.armed >= 0) wrong.push(QZ.armed)
  }
  QZ.reveal = { correct: q.ans, wrong }
  markResult(q.key, ok)
  if (q.A && LETTERS[q.A]) recordLetter(q.A, ok)   /* v4.2：字母题同步记游戏错误账本（练习馆出题加权数据源） */
  if (ok && QZ.cfg!.det) addDetCorrect()   /* v3.2 小侦探徽章计数 */
  /* 镜像错误联动：小侦探里写反判错 → 对应易混对也加权（闯关会多练它） */
  if (!ok && (q.type === 'djudge' || q.type === 'dfix')) {
    const pp = partnerOf(q.X)
    if (pp && PMAP[q.X + '|' + pp] !== undefined) markResult(q.X + '|' + pp, false)
  }
  /* v2.6 零自动播放：答对答错一律只留叮/嘟非语音（duila/fanla 语音废除） */
  if (ok) {
    QZ.score++
    sndOk()
  } else {
    sndNo()
    QZ.miss[q.key] = (QZ.miss[q.key] || 0) + 1
  }
  showFeedback(ok, q)
}

function showFeedback(ok: boolean, q: any) {
  let desc = ''
  let glyph = ''
  const anchorTail = (x: string) => (ANCHORS_REF[x]
    ? '<br>' + t('anchorOf', { h: ANCHORS_REF[x].h, p: ANCHORS_REF[x].p, x })
    : '')
  if (q.type === 'listen') {
    glyph = q.A
    desc = t('fbAnswer') + q.A + '（' + LETTERS[q.A].em + ' ' + T(LETTERS[q.A].word) + '）'
  } else if (q.type === 'look') {
    glyph = q.A
    desc = t('fbLookOrdinal', { n: q.ans + 1, han: LETTERS[q.A].han })
  } else if (q.type === 'djudge') {
    glyph = q.X
    desc = (q.flipped ? t('fbDjFlipped', { x: q.X }) : t('fbDjOk', { x: q.X })) + anchorTail(q.X)
  } else if (q.type === 'dfix') {
    glyph = q.X
    desc = t('fbDfix', { x: q.X }) + anchorTail(q.X)
  } else if (q.type === 'zi') {
    glyph = q.z.h
    desc = t('fbCorrectPy') + '<b>' + q.z.p + '</b>'
  } else if (q.type === 'zword') {
    glyph = q.z.w
    desc = t('fbCorrectPy') + '<b>' + q.z.p + '</b>'
  } else if (q.type === 'kj') {
    glyph = q.A
    desc = t('fbKjAbout') + q.A + '（' + T(LETTERS[q.A].kj) + '）'
  } else {
    glyph = q.A
    desc = t('fbAnswer') + q.A
  }
  /* v2.6 零自动播放：选对读字废除，zi 题面自带的 🔊 重听键点播 */
  QZ.fb = {
    good: ok,
    icon: ok ? 'celebrate' : (q.type === 'djudge' ? 'detect' : 'cheer'),
    text: ok ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : CHEER[Math.floor(Math.random() * CHEER.length)],
    glyph,
    desc,
  }
  if (ok) QZ.star++
  QZ.fbt = setTimeout(() => { QZ.fbt = null; hideFeedback(); nextQ() }, ok ? 800 : 1600)   /* v4.5 Bug#38：对~0.8s 错~1.6s 自动推进 */
}

export function hideFeedback() { QZ.fb = null }

export function nextQ() {
  hideFeedback()
  QZ.i++
  if (QZ.i >= 10) { endQuiz(); return }
  QZ.q = QZ.cfg!.qs[QZ.i]
  QZ.armed = -1
  QZ.reveal = null
  QZ.seq++
  openQuestion()   /* P1-2 进题宽限 */
}

export function fbSkip() {
  if (QZ.fbt) { clearTimeout(QZ.fbt); QZ.fbt = null; hideFeedback(); nextQ() }
}

/* 答题页 ✕：作废定时器回主页 */
export function quitQuiz() {
  if (QZ.fbt) { clearTimeout(QZ.fbt); QZ.fbt = null }
  QZ.tk++
  QZ.seq++
  hideFeedback()
  show('practice')  /* v2.4：闯关从练习 tab 进入，退回练习 tab */
}

function endQuiz() {
  QZ.done = true
  const sc = QZ.score
  const stars = sc >= 9 ? 3 : sc >= 7 ? 2 : sc >= 6 ? 1 : 0
  const lvNo = QZ.cfg!.levelNo
  let unlockMsg = ''
  if (lvNo) {
    if (stars > (S.stars[lvNo] || 0)) S.stars[lvNo] = stars
    save(S)
    if (stars >= 1 && lvNo === 8) unlockMsg = t('unlockMaster')
    else if (stars >= 1 && lvNo === 9) unlockMsg = t('unlockGrad')
    else if (stars >= 1) unlockMsg = t('unlockNext')
  }
  let worst: string | null = null
  let wv = 0
  for (const k in QZ.miss) {
    if (QZ.miss[k] > 0) {
      const w = QZ.miss[k] * getW(k)
      if (w > wv) { wv = w; worst = k }
    }
  }
  let wlabel = ''
  if (worst) {
    if (worst.slice(0, 2) === 'Z:') {
      const zc = worst.slice(2)
      wlabel = zc + '(' + (ZIBY[zc] ? ZIBY[zc].p : '') + ')'
    } else if (worst.slice(0, 2) === 'W:') {
      wlabel = worst.slice(2)
    } else {
      wlabel = worst.replace('|', '↔').replace('L:', '')
    }
  }
  const entry: HistEntry = { d: stamp(), lv: QZ.cfg!.name, sc, st: lvNo ? stars : -1, wp: wlabel }
  addHist(entry)
  checkBadges()   /* v3.2：练习关星入账后统一查徽章（初次通关/连击/坚持天数在各类触发点都汇到这里查） */
  QZ.result = { sc, stars, unlockMsg, wlabel, lvNo: lvNo || null }
  show('result')
  if (stars > 0) sndStar()
}

/* 供视觉验收（?open=result）：直接渲染结算页 */
export function showResult(res: ResultState) {
  QZ.result = res
  show('result')
}

/* v2.6 零自动播放：scheduleAutoSay 全删——题面读音一律 🔊 点播（QuizPage/ListenQ/ZiQuiz/BoltSprint） */
