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
out.sort((a, b) => CAT_ORDER[a.cat] - CAT_ORDER[b.cat] || a.k.localeCompare(b.k))

const json = { generated: 'scripts/gen-pinyin-cards.mjs', count: out.length, cards: out }
writeFileSync(new URL('../src/data/pinyin-cards.json', import.meta.url), JSON.stringify(json, null, 1) + '\n')
console.log('pinyin-cards.json:', out.length, 'records')
