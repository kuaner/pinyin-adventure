/* ⚡闪电刷题 store：5 分钟无限连续出题、每题 2 选项、今日/历史最佳（v1 行为正本移植） */
import { show, ui } from './ui.svelte'
import { S, save, todayStr } from './progress.svelte'
import { markResult } from './weights.svelte'
import { playAudio, sndOk, sndNo } from '../lib/audio'
import { makeBoltQ, BT_KEYS } from '../lib/quizEngine'
import { T } from '../lib/ruby'
import type { BoltQ } from '../lib/types'

export const BT = $state({
  tid: null as ReturnType<typeof setInterval> | null,
  done: true,
  left: 300,
  n: 0,
  ok: 0,
  streak: 0,
  best: 0,
  durs: [] as number[],
  q: null as BoltQ | null,
  q0: 0,
  reveal: null as { correct: number; wrong: number[] } | null,
  resultOn: false,
  record: false,
  confetti: [] as number[],
})

function boltTick() {
  if (BT.done) return
  BT.left--
  if (BT.left <= 0) endBolt()
}

export function startBolt(freeze: boolean) {
  if (BT.tid) { clearInterval(BT.tid); BT.tid = null }
  BT.done = false
  BT.left = 300
  BT.n = 0
  BT.ok = 0
  BT.streak = 0
  BT.best = 0
  BT.durs = []
  BT_KEYS.length = 0
  BT.reveal = null
  BT.resultOn = false
  BT.record = false
  BT.confetti = []
  show('bolt')
  BT.q = makeBoltQ()
  BT.q0 = Date.now()
  /* v2.4 声音礼仪 R1：安静进入，无过场音 */
  if (!freeze) BT.tid = setInterval(boltTick, 1000)
}

export function boltAnswer(idx: number) {
  if (BT.done) return
  const q = BT.q!
  const ok = idx === q.ans
  const wrong: number[] = []
  if (!ok) wrong.push(idx)
  BT.reveal = { correct: q.ans, wrong }
  markResult(q.key, ok)
  BT.n++
  BT.durs.push(Date.now() - BT.q0)
  if (ok) {
    BT.ok++
    BT.streak++
    if (BT.streak > BT.best) BT.best = BT.streak
    sndOk()
  } else {
    BT.streak = 0
    sndNo()
    /* 零错误信息铁律：答错只强化正确答案——播正确字母的读音（"这是 l，l l l"） */
    say(q.A)
  }
  const qRef = q
  setTimeout(() => {
    if (!BT.done && ui.view === 'bolt') {
      BT.q = makeBoltQ()
      BT.q0 = Date.now()
      BT.reveal = null
      void qRef
    }
  }, ok ? 220 : 1000)
}

export function endBolt() {
  if (BT.done && !BT.n) return
  BT.done = true
  if (BT.tid) { clearInterval(BT.tid); BT.tid = null }
  const acc = BT.n ? Math.round(BT.ok * 100 / BT.n) : 0
  const sum = BT.durs.reduce((a, b) => a + b, 0)
  const avg = BT.n ? (sum / BT.n / 1000) : 0
  void avg
  const prevBest = S.bolt.acc || 0
  const td = todayStr()
  let record = false
  if (BT.n >= 10) {
    if (acc > prevBest) { S.bolt.acc = acc; S.bolt.d = td; record = true }
    if (S.bolt.td !== td) { S.bolt.td = td; S.bolt.tacc = 0 }
    if (acc > S.bolt.tacc) S.bolt.tacc = acc
    save(S)
  }
  BT.record = record
  BT.resultOn = true
  if (record) {
    playAudio('star')
    BT.confetti = Array.from({ length: 14 }, (_, i) => i)
  }
}

/* 结算文案（组件渲染时取） */
export function boltTitle(): string {
  const acc = BT.n ? Math.round(BT.ok * 100 / BT.n) : 0
  return BT.n === 0
    ? T('还没来得及答题～')
    : acc >= 90 ? T('闪电神速！')
    : acc >= 75 ? T('又快又准！')
    : T('完成挑战！')
}

export function boltAcc(): number { return BT.n ? Math.round(BT.ok * 100 / BT.n) : 0 }
export function boltAvg(): number {
  const sum = BT.durs.reduce((a, b) => a + b, 0)
  return BT.n ? (sum / BT.n / 1000) : 0
}

/* 闪电页 ✕：进行中=提前结束看结算；结算页上=回主页 */
export function boltQuit() {
  if (!BT.done) { endBolt(); return }
  show('practice')
}
