/* 生成 src/data/pinyin-cards.json —— PinyinCard 统一学习卡片的数据正本（一拼音一条记录）。
   唯一真相 + 清单生成模式：从 pinyin.json（字形/口诀/例词）+ lessons.json（口诀/旁白音频）
   + strokes.json（笔顺覆盖）聚合；数据改动后重跑本脚本，缺失字段自动暴露。
   用法: node scripts/gen-pinyin-cards.mjs */
import { readFileSync, writeFileSync } from 'node:fs'

const py = JSON.parse(readFileSync(new URL('../src/data/pinyin.json', import.meta.url), 'utf8'))
const lessons = JSON.parse(readFileSync(new URL('../src/data/lessons.json', import.meta.url), 'utf8'))
const strokes = JSON.parse(readFileSync(new URL('../src/data/strokes.json', import.meta.url), 'utf8'))

const CAT_ORDER = { sm: 0, ym: 1, zt: 2 }
/* lessons.json 里的字母补充字段（kjAudio 口诀音频 / sayAudio 写法旁白 / say 笔顺旁白文本） */
const lessonBy = new Map()
for (const l of lessons.lessons) for (const e of l.letters) if (!lessonBy.has(e.k)) lessonBy.set(e.k, e)

const hasStroke = (k) => !!(strokes.letters[k] || strokes.units[k])

const out = []
for (const [k, L] of Object.entries(py.letters)) {
  const le = lessonBy.get(k) || {}
  const rec = {
    k,
    cat: L.cat,
    tts: L.tts,                       // 呼读音标注（bō）
    han: L.han || le.han || '',       // 直注汉字（音频缺失兜底）
    kj: L.kj || le.kj || '',          // 口诀文本
    kjAudio: le.kjAudio || '',        // 口诀音频（audio/lessons/kj_*）
    word: L.word || le.word || '',    // 例词
    wp: L.wp || le.wp || '',
    em: L.em || le.em || '',
    say: le.say || '',                // 笔顺旁白文本
    sayAudio: le.sayAudio || '',
    stroke: hasStroke(k),             // 笔顺数据是否覆盖
  }
  if (!rec.kj) console.warn('WARN no kj:', k)
  if (!rec.stroke && L.cat !== 'zt') console.warn('WARN no stroke:', k)
  out.push(rec)
}
/* v3.0 补漏（BUGS#29 合并页发现）：lessons.json 里有、pinyin.json 没有的课内单元
   （er/üe/ong/wu/yi/yu——v2.9 写法页直挂 StrokeAnim 掩盖了缺口；合并页=唯一笔顺载体，必须全覆盖）。
   字段从 lessons.json 聚合（kj/han/say/音频/例词课程数据齐全）；tts 缺省用键名（PinyinCard 已有 C.tts||k 兜底） */
const CAT_BY_KIND = { sm: 'sm', ym: 'ym', fu: 'ym', zt: 'zt' }
for (const l of lessons.lessons) {
  for (const e of l.letters) {
    if (py.letters[e.k] || out.some((r) => r.k === e.k)) continue
    const rec = {
      k: e.k,
      cat: CAT_BY_KIND[l.kind] || 'ym',
      tts: e.k,
      han: e.han || '',
      kj: e.kj || '',
      kjAudio: e.kjAudio || '',
      word: e.word || '',
      wp: e.wp || '',
      em: e.em || '',
      say: e.say || '',
      sayAudio: e.sayAudio || '',
      stroke: hasStroke(e.k),
    }
    if (!rec.kj) console.warn('WARN no kj:', e.k)
    if (!rec.stroke) console.warn('WARN no stroke:', e.k)
    out.push(rec)
  }
}
out.sort((a, b) => CAT_ORDER[a.cat] - CAT_ORDER[b.cat] || a.k.localeCompare(b.k))

const json = { generated: 'scripts/gen-pinyin-cards.mjs', count: out.length, cards: out }
writeFileSync(new URL('../src/data/pinyin-cards.json', import.meta.url), JSON.stringify(json, null, 1) + '\n')
console.log('pinyin-cards.json:', out.length, 'records')
