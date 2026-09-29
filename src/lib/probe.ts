/* 动态探针 + 视觉验收辅助（v1 全套移植；仅 ?probe=/?open= 参数时暴露钩子，正常使用零开销）
   ?probe=      普通探针：进第1关 → 答对1题 → 验证反馈层/得分/权重
   ?probe=full  第1关 10 题全对打到结算页
   ?probe=det   小侦探：首题作答 → 验证 M: 权重 + 锚点区
   ?probe=bolt  闪电（冻结计时）：连答2题 → 验证计数器
   ?probe=zi    常见字：首题作答 → 验证 Z:/W: 权重 + 字音 mp3
   ?probe=flash 闪卡：翻面 → 验证背面渲染
   ?open=levels/pairs/practice/history/result/quiz/detect/dfix/bolt/zi/ziword 直接渲染对应界面（截图用） */
import { show, ui } from '../stores/ui.svelte'
import { QZ, startDet, startZi, newSession, showResult, type ResultState } from '../stores/session.svelte'
import { startLevel } from '../stores/session.svelte'
import { BT, startBolt } from '../stores/bolt.svelte'
import { FC, renderFlash, flip } from '../stores/flash.svelte'
import { S } from '../stores/progress.svelte'
import { AUDIO_CACHE } from './audio'
import { buildQuestions, buildDetQs, makeDfix, makeZiQ, shuffle } from './quizEngine'
import { LEVELS, ZWORDS, ZI, PH } from '../data'
import { T } from './ruby'
import type { Question } from './types'

declare global {
  interface Window { __PJ?: any }
}

function el(id: string): HTMLElement | null { return document.getElementById(id) }
function banner(text: string) { ui.probeOn = true; ui.probeText = text }

/* ---------- 动态探针 ---------- */
function probeRun() {
  banner('PROBE: 启动，进入第1关…')
  try {
    show('levels')
    setTimeout(() => {
      el('lv-1')?.click()
      setTimeout(() => {
        const q = QZ.q as any
        if (!q) { banner('PROBE-FAIL: 无题目'); return }
        const opts = document.querySelectorAll('#optbox .opt')
        banner('PROBE: 点击正确选项#' + (q.ans + 1) + '（题型 ' + q.type + '）')
        if (q.type === 'look') {
          ;(opts[q.ans] as HTMLElement).click()
          setTimeout(() => { (document.querySelectorAll('#optbox .opt')[q.ans] as HTMLElement)?.click() }, 350)
        } else {
          ;(opts[q.ans] as HTMLElement).click()
        }
        const fbOn = !!QZ.fb /* 与 v1 一致：点击后同步读反馈层状态 */
        setTimeout(() => {
          banner('PROBE-OK JS存活 ✓ 反馈层即时弹出=' + fbOn
            + ' 得分 ' + QZ.score + '/10 错题权重记录=' + Object.keys(S.weights).length + '对')
        }, 1500)
      }, 800)
    }, 400)
  } catch (e: any) { banner('PROBE-FAIL: ' + (e && e.message)) }
}

function probeFull() {
  banner('PROBE-FULL: 启动…')
  let steps = 0
  try {
    show('levels')
    setTimeout(() => { el('lv-1')?.click(); setTimeout(tick, 600) }, 300)
  } catch (e: any) { banner('PROBE-FAIL: ' + (e && e.message)); return }
  function tick() {
    if (steps++ > 40) { banner('PROBE-FAIL: 步数超限 view=' + ui.view); return }
    if (ui.view === 'result') {
      banner('PROBE-FULL-OK ✓ 10题全对通关 得分=' + QZ.score + '/10 权重对=' + Object.keys(S.weights).length)
      setTimeout(() => { ui.probeOn = false }, 4000)
      return
    }
    if (QZ.fb) { setTimeout(tick, 300); return }
    if (ui.view !== 'quiz') { setTimeout(tick, 300); return }
    const q = QZ.q as any
    const opts = document.querySelectorAll('#optbox .opt')
    banner('PROBE-FULL: 第' + (QZ.i + 1) + '题 ' + q.type)
    if (q.type === 'look') {
      ;(opts[q.ans] as HTMLElement).click()
      setTimeout(() => {
        const os = document.querySelectorAll('#optbox .opt')
        ;(os[q.ans] as HTMLElement)?.click()
        setTimeout(tick, 700)
      }, 350)
    } else {
      ;(opts[q.ans] as HTMLElement).click()
      setTimeout(tick, 700)
    }
  }
}

function probeDet() {
  banner('PROBE-DET: 启动…')
  try {
    setTimeout(() => {
      startDet()
      setTimeout(() => {
        const q = QZ.q as any
        const hasAnchor = !!document.querySelector('#v-quiz .anchorbar')
        banner('PROBE-DET: 首题 ' + q.type + ' 字母 ' + q.X + ' flipped=' + q.flipped + ' 锚点区=' + hasAnchor)
        ;(document.querySelectorAll('#optbox .opt')[q.ans] as HTMLElement)?.click()
        const mkey = 'M:' + q.X
        setTimeout(() => {
          const rec = S.weights[mkey]
          banner('PROBE-DET-OK ✓ 镜像权重[' + mkey + ']=' + (rec ? rec.w : 'MISS')
            + ' 得分=' + QZ.score + ' 反馈层=' + !!QZ.fb + ' 锚点区=' + hasAnchor)
        }, 1200)
      }, 700)
    }, 300)
  } catch (e: any) { banner('PROBE-DET-FAIL: ' + (e && e.message)) }
}

function probeBolt() {
  banner('PROBE-BOLT: 启动…')
  try {
    setTimeout(() => {
      startBolt(true) /* 冻结计时 */
      setTimeout(() => {
        const q = BT.q as any
        banner('PROBE-BOLT: 首题 ' + q.type + ' 答案#' + (q.ans + 1) + ' 选项数=' + document.querySelectorAll('#bopt .opt').length)
        ;(document.querySelectorAll('#bopt .opt')[q.ans] as HTMLElement)?.click()
        setTimeout(() => {
          const q2 = BT.q as any
          const opts2 = document.querySelectorAll('#bopt .opt')
          banner('PROBE-BOLT: 第二题 ' + q2.type + ' 已答=' + BT.n + ' 连对=' + BT.streak)
          ;(opts2[q2.ans] as HTMLElement)?.click()
          setTimeout(() => {
            banner('PROBE-BOLT-OK ✓ 已答=' + BT.n + ' 正确率=' + Math.round(BT.ok * 100 / BT.n)
              + '% 连对=' + BT.streak + ' 计时冻结于=' + timeText()
              + ' 权重对=' + Object.keys(S.weights).length)
          }, 900)
        }, 700)
      }, 700)
    }, 300)
  } catch (e: any) { banner('PROBE-BOLT-FAIL: ' + (e && e.message)) }
}

function timeText(): string {
  const m = Math.floor(BT.left / 60), s2 = BT.left % 60
  return m + ':' + (s2 < 10 ? '0' : '') + s2
}

function probeZi() {
  banner('PROBE-ZI: 启动…')
  try {
    setTimeout(() => {
      startZi()
      setTimeout(() => {
        const q = QZ.q as any
        banner('PROBE-ZI: 首题 ' + q.type + ' 题面=' + (q.z.h || q.z.w) + ' 选项数=' + document.querySelectorAll('#optbox .opt').length)
        ;(document.querySelectorAll('#optbox .opt')[q.ans] as HTMLElement)?.click()
        setTimeout(() => {
          const rec = S.weights[q.key]
          banner('PROBE-ZI-OK ✓ 权重[' + q.key + ']=' + (rec ? rec.w : 'MISS')
            + ' 得分=' + QZ.score + ' 反馈层=' + !!QZ.fb
            + ' 字音mp3=' + (AUDIO_CACHE[q.z.f] ? '已载入' : '未载入'))
        }, 1200)
      }, 700)
    }, 300)
  } catch (e: any) { banner('PROBE-ZI-FAIL: ' + (e && e.message)) }
}

function probeFlash() {
  banner('PROBE-FLASH: 启动…')
  try {
    renderFlash()
    show('flash')
    setTimeout(() => {
      const k = FC.deck[FC.idx]
      flip()
      setTimeout(() => {
        banner('PROBE-OK 闪卡 ✓ 牌堆=' + FC.deck.length + '张 当前=' + k + ' 翻面=' + (FC.flipped ? '背面(口诀+例词)' : '正面'))
      }, 600)
    }, 400)
  } catch (e: any) { banner('PROBE-FAIL: ' + (e && e.message)) }
}

/* ---------- 视觉验收辅助：?open=xxx 直接渲染对应界面 ---------- */
function openView(v: string) {
  if (v === 'levels') show('levels')
  else if (v === 'pairs') show('pairs')
  else if (v === 'practice') show('practice')
  else if (v === 'history') show('history')
  else if (v === 'result') {
    const res: ResultState = { sc: 8, stars: 2, unlockMsg: T('🎉 解锁下一关！'), wlabel: 'b↔d', lvNo: 2 }
    showResult(res)
  } else if (v === 'quiz') {
    let qs = buildQuestions(LEVELS[0])
    let tries = 0
    while ((qs[0] as any).type !== 'listen' && tries++ < 60) qs = buildQuestions(LEVELS[0])
    newSession({ name: T('第') + 1 + T('关') + ' · ' + T(LEVELS[0].name), level: LEVELS[0], levelNo: 1, qs })
  } else if (v === 'detect') {
    newSession({ name: T((PH as any).detName), det: true, qs: buildDetQs(true) })
  } else if (v === 'dfix') {
    const dq = makeDfix('b')
    newSession({ name: T((PH as any).detName), det: true, qs: [dq].concat(buildDetQs(false).slice(1)) })
  } else if (v === 'bolt') {
    startBolt(true) /* 冻结计时，供截图 */
  } else if (v === 'zi') {
    startZi()
  } else if (v === 'ziword') {
    const pool = shuffle(ZI)
    const qs: Question[] = [makeZiQ(ZWORDS[0], true)]
    for (let i = 0; i < 9; i++) qs.push(makeZiQ(pool[i], false))
    newSession({ name: '📖 ' + T('常见字快拼'), zi: true, qs })
  }
}

/* ---------- 启动入口（App onMount 调用） ---------- */
export function initApp() {
  const s = location.search
  /* 验收自动化钩子：仅带 open=/probe 参数时暴露（正常使用不挂载） */
  if (s.indexOf('open=') >= 0 || s.indexOf('probe') >= 0) {
    window.__PJ = {
      Q: () => QZ,
      BT: () => BT,
      FC, S,
      AUDIO: AUDIO_CACHE,
      show, startLevel,
    }
  }
  if (s.indexOf('probe') >= 0 && s.indexOf('det') >= 0) setTimeout(probeDet, 500)
  else if (s.indexOf('probe') >= 0 && s.indexOf('bolt') >= 0) setTimeout(probeBolt, 500)
  else if (s.indexOf('probe') >= 0 && s.indexOf('zi') >= 0) setTimeout(probeZi, 500)
  else if (s.indexOf('probe') >= 0 && s.indexOf('flash') >= 0) setTimeout(probeFlash, 500)
  else if (s.indexOf('probe') >= 0 && s.indexOf('full') >= 0) setTimeout(probeFull, 500)
  else if (s.indexOf('probe') >= 0) setTimeout(probeRun, 500)
  else {
    const mo = s.match(/open=(\w+)/)
    if (mo) {
      setTimeout(() => { openView(mo[1]) }, 400)
      setTimeout(() => {
        if (ui.unlockOn) {
          /* 与 v1 一致：open 验收模式自动解锁音频 */
          ui.unlockOn = false
        }
      }, 250)
    }
  }
}
