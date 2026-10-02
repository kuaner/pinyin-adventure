/* Bug#39 口诀地鼠谜面制：从 pinyin.json 口诀正本派生"谜面"（形状描述，剥离全部字母读音）
   → mimo-tts 批量清单（纯中文合法；拼音读音零合成铁律）。
   规则：kj 串剥掉全部 [a-zü] 词元 → 剩余即谜面；剩余为空或仍含字母=组合式口诀
   （"a 和 i 挨在一起 ai"类——谜面本身构成答案读音）→ 跳过（任务书：按数据实情定）。
   文件名=letterAudio ASCII 安全名（ü→v）。输出 list 供 mimo 批处理 + 校验报告。 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/pinyin.json'), 'utf8'))
const arr = Object.entries(data.letters).map(([k, v]) => ({ k, ...v }))

const safe = (k) => (k === 'ü' ? 'v' : k) /* ASCII 安全名（audio.ts letterAudio 同款） */

const lines = []
const skipped = []
for (const L of arr) {
  if (!L.kj) continue
  /* 组合式口诀判定：字母词元去重 >1 种（"a 和 i 挨在一起 ai"类）——谜面本身构成答案读音，跳过 */
  const toks = L.kj.match(/[a-zü]+/gi) || []
  if (new Set(toks.map((t) => t.toLowerCase())).size > 1) { skipped.push({ k: L.k, kj: L.kj }); continue }
  const riddle = L.kj.replace(/[a-zü]+/gi, ' ').replace(/\s+/g, ' ').trim()
  if (!riddle) { skipped.push({ k: L.k, kj: L.kj }); continue }
  lines.push(`${safe(L.k)}|${riddle}|猜谜语，语速慢，字正腔圆，最后留一点悬念`)
}
fs.writeFileSync('/tmp/riddle-list.txt', '# 谜面清单（gen-riddles.mjs 产出；文件名|文本|风格）\n' + lines.join('\n') + '\n')
console.log(`谜面 ${lines.length} 条 → /tmp/riddle-list.txt`)
console.log(`跳过 ${skipped.length} 条（组合式/含字母残留）:`)
for (const s of skipped) console.log('  ', JSON.stringify(s))
/* 硬校验：清单零拉丁字母（mimo 拉丁坑） */
const bad = lines.filter((l) => /[a-zA-Zü]/.test(l.split('|')[1]))
if (bad.length) { console.error('拉丁残留！', bad); process.exit(2) }
console.log('校验：清单零拉丁字母 ✓')
