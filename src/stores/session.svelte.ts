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
    name: T('第{dì}') + n + T('关{guān}') + ' · ' + T(L.name),
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
  newSession({ name: '📖 ' + T('常{cháng}见{jiàn}字{zì}快{kuài}拼{pīn}'), zi: true, qs: ziQs() })
}

export function startPractice(kind: string) {
  const L = practiceScope(kind)
  newSession({ name: T(L.name), level: L, pkind: kind, qs: buildQuestions(L) })
}

export function startPairGroup(grp: string) {
  const ps = PAIRS.filter((p) => p.grp === grp).map((p) => p.a + '|' + p.b)
  const L = { name: GRPNAME[grp] + '专练', pool: null as string[] | null, pairs: ps }
  newSession({ name: T(GRPNAME[grp]) + T('专{zhuān}练{liàn}'), level: L, qs: buildQuestions(L) })
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
    desc = T('正{zhèng}确{què}答{dá}案{àn}：') + q.A + '（' + LETTERS[q.A].em + ' ' + T(LETTERS[q.A].word) + '）'
  } else if (q.type === 'look') {
    glyph = q.A
    desc = T('第{dì}') + (q.ans + 1) + T(' 个{gè}才{cái}是{shì}它{tā}的{de}读{dú}音{yīn}「' + LETTERS[q.A].han + '」')
  } else if (q.type === 'll') {
    glyph = q.sound
    desc = T('听{tīng}到{dào} ') + q.sound + T('，看{kàn}到{dào} ') + q.A + '，' + (q.same ? T('一{yí}样{yàng}～') : T('不{bù}一{yí}样{yàng}哦{ó}'))
  } else if (q.type === 'djudge') {
    glyph = q.X
    desc = (q.flipped
      ? T('它{tā}是{shì}写{xiě}反{fǎn}的{de}「' + q.X + '」！看{kàn}，正{zhèng}确{què}的{de}长{zhǎng}这{zhè}样{yàng}')
      : T('它{tā}写{xiě}对{duì}了{le}，就{jiù}是{shì}「' + q.X + '」'))
      + ((ANCHORS_REF[q.X]) ? ('<br>💡 ' + ANCHORS_REF[q.X].h + '（' + ANCHORS_REF[q.X].p + '）' + T('的{de}') + ' ' + q.X) : '')
  } else if (q.type === 'dfix') {
    glyph = q.X
    desc = T('写{xiě}对{duì}的{de}「' + q.X + '」长{zhǎng}这{zhè}样{yàng}')
      + ((ANCHORS_REF[q.X]) ? ('<br>💡 ' + ANCHORS_REF[q.X].h + '（' + ANCHORS_REF[q.X].p + '）' + T('的{de}') + ' ' + q.X) : '')
  } else if (q.type === 'zi') {
    glyph = q.z.h
    desc = T('正{zhèng}确{què}拼{pīn}音{yīn}：') + '<b>' + q.z.p + '</b>'
  } else if (q.type === 'zword') {
    glyph = q.z.w
    desc = T('正{zhèng}确{què}拼{pīn}音{yīn}：') + '<b>' + q.z.p + '</b>'
  } else {
    glyph = q.A
    desc = T('正{zhèng}确{què}口{kǒu}诀{jué}：') + T(LETTERS[q.A].kj)
  }
  if (ok && (q.type === 'zi' || q.type === 'zword')) playAudio(q.z.f, { hint: '🔊 字{zì}音{yīn}缺失：' + q.z.f })
  QZ.fb = {
    good: ok,
    icon: ok ? '🎉' : (q.type === 'll' || q.type === 'djudge' ? '👀' : '💪'),
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
    if (stars >= 1 && lvNo === 8) unlockMsg = T('👑 毕{bì}业{yè}关{guān}「易{yì}混{hùn}对{duì}大{dà}师{shī}」已{yǐ}解{jiě}锁{suǒ}！')
    else if (stars >= 1 && lvNo === 9) unlockMsg = T('🎓 恭{gōng}喜{xǐ}毕{bì}业{yè}！你{nǐ}就{jiù}是{shì}易{yì}混{hùn}对{duì}大{dà}师{shī}！')
    else if (stars >= 1) unlockMsg = T('🎉 解{jiě}锁{suǒ}下{xià}一{yí}关{guān}！')
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
