/* 答题会话 store：闯关/小侦探/常见字/专练/自由练习共用一套 10 题会话流程
   （反馈层文案、结算、解锁、历史写入与 v1 行为正本一致） */
import { show, ui } from './ui.svelte'
import { S, save, addHist } from './progress.svelte'
import { markResult, getW } from './weights.svelte'
import { playAudio, say, sndOk, sndNo, sndStar } from '../lib/audio'
import { buildQuestions, buildDetQs, ziQs, partnerOf, practiceScope } from '../lib/quizEngine'
import { LETTERS, PAIRS, PMAP, ZIBY, LEVELS, GRPNAME, PH, ANCHORS } from '../data'
import { T } from '../lib/ruby'
import { stamp, type HistEntry } from '../lib/storage'
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
  show('quiz')
}

/* ---------- 各模式入口 ---------- */
export function startLevel(n: number) {
  const L = LEVELS[n - 1]
  playAudio(n === 9 ? 'levelup' : 'go')
  newSession({
    name: T('第') + n + T('关') + ' · ' + T(L.name),
    level: L,
    levelNo: n,
    qs: buildQuestions(L),
  })
}

export function startDet() {
  playAudio('go')
  newSession({ name: DETNAME, det: true, qs: buildDetQs(false) })
}

export function startZi() {
  playAudio('go')
  newSession({ name: T('常见字快拼'), zi: true, qs: ziQs() })
}

export function startPractice(kind: string) {
  const L = practiceScope(kind)
  newSession({ name: T(L.name), level: L, pkind: kind, qs: buildQuestions(L) })
}

export function startPairGroup(grp: string) {
  const ps = PAIRS.filter((p) => p.grp === grp).map((p) => p.a + '|' + p.b)
  const L = { name: GRPNAME[grp] + '专练', pool: null as string[] | null, pairs: ps }
  newSession({ name: T(GRPNAME[grp]) + T('专练'), level: L, qs: buildQuestions(L) })
}

/* ---------- 答题 ---------- */
export function armLook(idx: number) {
  if (QZ.armed === idx) { answer(idx); return }
  QZ.armed = idx
  const q = QZ.q as any
  say(q.opts[idx])
}

export function answer(idx: number) {
  const q = QZ.q as any
  if (!q) return
  const ok = idx === q.ans
  const wrong: number[] = []
  if (!ok) {
    wrong.push(idx)
    if (q.type === 'look' && QZ.armed >= 0) wrong.push(QZ.armed)
  }
  QZ.reveal = { correct: q.ans, wrong }
  markResult(q.key, ok)
  /* 镜像错误联动：小侦探里写反判错 → 对应易混对也加权（闯关会多练它） */
  if (!ok && (q.type === 'djudge' || q.type === 'dfix')) {
    const pp = partnerOf(q.X)
    if (pp && PMAP[q.X + '|' + pp] !== undefined) markResult(q.X + '|' + pp, false)
  }
  if (ok) {
    QZ.score++
    if (q.type === 'djudge' || q.type === 'dfix') playAudio('duila', { hint: '🔊 短语音频缺失：duila' })
    else sndOk()
  } else {
    if (q.type === 'djudge' || q.type === 'dfix') playAudio('fanla', { hint: '🔊 短语音频缺失：fanla' })
    else sndNo()
    QZ.miss[q.key] = (QZ.miss[q.key] || 0) + 1
  }
  showFeedback(ok, q)
}

function showFeedback(ok: boolean, q: any) {
  let desc = ''
  let glyph = ''
  if (q.type === 'listen') {
    glyph = q.A
    desc = T('正确答案：') + q.A + '（' + LETTERS[q.A].em + ' ' + T(LETTERS[q.A].word) + '）'
  } else if (q.type === 'look') {
    glyph = q.A
    desc = T('第') + (q.ans + 1) + T(' 个才是它的读音「' + LETTERS[q.A].han + '」')
  } else if (q.type === 'djudge') {
    glyph = q.X
    desc = (q.flipped
      ? T('它是写反的「' + q.X + '」！看，正确的长这样')
      : T('它写对了，就是「' + q.X + '」'))
      + ((ANCHORS_REF[q.X]) ? ('<br>' + ANCHORS_REF[q.X].h + '（' + ANCHORS_REF[q.X].p + '）' + T('的') + ' ' + q.X) : '')
  } else if (q.type === 'dfix') {
    glyph = q.X
    desc = T('写对的「' + q.X + '」长这样')
      + ((ANCHORS_REF[q.X]) ? ('<br>' + ANCHORS_REF[q.X].h + '（' + ANCHORS_REF[q.X].p + '）' + T('的') + ' ' + q.X) : '')
  } else if (q.type === 'zi') {
    glyph = q.z.h
    desc = T('正确拼音：') + '<b>' + q.z.p + '</b>'
  } else if (q.type === 'zword') {
    glyph = q.z.w
    desc = T('正确拼音：') + '<b>' + q.z.p + '</b>'
  } else if (q.type === 'kj') {
    glyph = q.A
    desc = T('这句口诀说的是：') + q.A + '（' + T(LETTERS[q.A].kj) + '）'
  } else {
    glyph = q.A
    desc = T('正确答案：') + q.A
  }
  if (ok && (q.type === 'zi' || q.type === 'zword')) playAudio(q.z.f, { hint: '字音缺失：' + q.z.f })
  QZ.fb = {
    good: ok,
    icon: ok ? 'celebrate' : (q.type === 'djudge' ? 'detect' : 'cheer'),
    text: ok ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : CHEER[Math.floor(Math.random() * CHEER.length)],
    glyph,
    desc,
  }
  if (ok) QZ.star++
  QZ.fbt = setTimeout(() => { QZ.fbt = null; hideFeedback(); nextQ() }, ok ? 900 : 1500)
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
  show('home')
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
    if (stars >= 1 && lvNo === 8) unlockMsg = T('毕业关「易混对大师」已解锁！')
    else if (stars >= 1 && lvNo === 9) unlockMsg = T('恭喜毕业！你就是易混对大师！')
    else if (stars >= 1) unlockMsg = T('解锁下一关！')
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
  QZ.result = { sc, stars, unlockMsg, wlabel, lvNo: lvNo || null }
  show('result')
  if (stars > 0) sndStar()
}

/* 供视觉验收（?open=result）：直接渲染结算页 */
export function showResult(res: ResultState) {
  QZ.result = res
  show('result')
}

/* ---------- 自动读音（listen/ll 400ms、zi/zword 350ms） ---------- */
export function scheduleAutoSay(delay: number, play: () => void) {
  const seq = QZ.seq
  const tk = QZ.tk
  setTimeout(() => {
    if (QZ.tk === tk && QZ.seq === seq && ui.view === 'quiz') play()
  }, delay)
}
