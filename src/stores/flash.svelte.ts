/* 闪卡 store：Leitner 三盒（当天/明天/三天），分类页签，到期优先（v1 行为正本移植） */
import { S, save, todayStr, cardRec, dueToday } from './progress.svelte'
import { LETTERS } from '../data'
import { say, sndOk, sndStar, tone } from '../lib/audio'
import { toast } from './ui.svelte'
import { t } from '../text/strings'
import { shuffle } from '../lib/quizEngine'

export const FC = $state({
  cat: 'all' as 'all' | 'sm' | 'ym' | 'zt',
  deck: [] as string[],
  idx: 0,
  flipped: false,
})

export function setCat(cat: 'all' | 'sm' | 'ym' | 'zt') {
  FC.cat = cat
  renderFlash()
}

function buildDeck() {
  const keys: string[] = []
  for (const k in LETTERS) {
    if (FC.cat === 'all' || LETTERS[k].cat === FC.cat) keys.push(k)
  }
  const due: string[] = []
  const rest: string[] = []
  keys.forEach((x) => { (dueToday(cardRec(x)) ? due : rest).push(x) })
  rest.sort((a, b) => (cardRec(a).due < cardRec(b).due ? -1 : 1))
  FC.deck = shuffle(due).concat(rest)
  FC.idx = 0
  FC.flipped = false
}

export function renderFlash() {
  buildDeck()
}

export function flip() {
  if (FC.idx >= FC.deck.length) {
    toast(t('flashDoneToast'))
    return
  }
  FC.flipped = !FC.flipped
  if (FC.flipped) say(FC.deck[FC.idx])
}

export function currentKey(): string { return FC.deck[FC.idx] || '' }

export function rate(r: number) {
  if (FC.idx >= FC.deck.length) return
  const k = FC.deck[FC.idx]
  const rec = cardRec(k)
  const d = new Date()
  rec.box = r
  if (r === 2) d.setDate(d.getDate() + 1)
  else if (r === 3) d.setDate(d.getDate() + 3)
  rec.due = todayStr(d)
  save(S)
  FC.idx++
  FC.flipped = false
  if (r === 3) sndStar()
  else if (r === 2) sndOk()
  else tone(392, 0, 0.15)
}

/* 牌堆信息行（组件渲染时取） */
export function deckInfo(): string {
  let dueN = 0
  FC.deck.forEach((k) => { if (dueToday(cardRec(k))) dueN++ })
  if (FC.idx >= FC.deck.length) {
    return dueN > 0
      ? t('deckRoundLeft', { n: dueN })
      : t('deckAllDone')
  }
  return (dueN > 0
    ? t('deckDueToday', { n: dueN })
    : t('deckFree'))
    + t('deckCardN', { a: FC.idx + 1, b: FC.deck.length })
}
