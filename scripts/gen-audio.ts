/* v2.6 配音清单生成器（kuaner 文案层+全点击语音架构）：
   扫描 strings.ts（文案层唯一真相）+ PinyinCard 数据（pinyin-cards.json）+ 课程数据
   （lessons.json / pinyin.json 关卡 / confusion.json 辨析提示）+ phrases.json（题型提示/夸奖语池）
   → 对照 public/audio/ 库 diff → 输出待生成清单（key→文件→生成规则）
   → 产出 src/text/audio-manifest.json（keys: key→file；zh: 数据层文案按渲染文本反查 file）。

   生成铁律（2026-09-30 09:20 kuaner："拼音不要自己生成！"）：
   - 纯中文段 = mimo 冰糖（tts.py --batch，风格"幼儿园老师教学，清晰缓慢"，禁拉丁）
   - 含拼音字母的文本 = ffmpeg 拼接：中文段 mimo + 拼音段 hyp 真人库（复用 build_audio.py 规则）
   - 拼接规则：段间 150ms 静音、24kHz mono、mp3 64k、mimo 段去首尾静音
   - 存量 600+ 条不重造：diff 只补缺失；可重复执行（已有文件跳过）

   用法：
     node scripts/gen-audio.ts                # 扫描+写 manifest+打印待生成清单
     node scripts/gen-audio.ts --generate     # 按清单补生成缺失音频
     node scripts/gen-audio.ts --generate --dry-run   # 只打印不落盘
*/
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { strings } from '../src/text/strings.ts'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const AUDIO = path.join(ROOT, 'public', 'audio')
const TTS = path.join(process.env.HOME || '', '.claude/skills/mimo-tts/scripts/tts.py')
const STYLE = '幼儿园老师教学，清晰缓慢'
const CACHE = '/tmp/pinyin_mimo_cache'
const SIL_SEC = 0.15
const SR = 24000

const j = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))
const phrases = j('src/data/phrases.json')
const cards = j('src/data/pinyin-cards.json')
const lessons = j('src/data/lessons.json')
const pinyin = j('src/data/pinyin.json')
const confusion = j('src/data/confusion.json')

/* ---------- 拼接规则移植自 build_audio.py ---------- */
const SM = [...'bpmfdtnlgkhjqxzcsryw', 'zh', 'ch', 'sh']
const YM = [...'aoeiuv', 'ai', 'ei', 'ui', 'ao', 'ou', 'iu', 'ie', 've', 'er', 'an', 'en', 'in', 'un', 'vn', 'ang', 'eng', 'ing', 'ong']
const ZT = ['zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si', 'yi', 'wu', 'yu', 'ye', 'yue', 'yin', 'yun', 'yuan', 'ying']
const LETTER_SET = new Set([...SM, ...YM, ...ZT])
const _TONES: Record<string, string> = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' }
const DEACCENT = new Map<string, [string, number]>()
for (const [b, ms] of Object.entries(_TONES)) for (let i = 0; i < ms.length; i++) DEACCENT.set(ms[i], [b, i + 1])
const DEMAP = new Map([...DEACCENT].map(([k, v]) => [k, v[0]]))
const LATIN_RUN = /[A-Za-zÀ-ÿĀ-ǜ]+/
const EDGE_RE = /^[\s，。、！？；：（）()【】《》,.!?;:~～—…"'「」·]+|[\s，。、！？；：（）()【】《》,.!?;:~～—…"'「」·]+$/g

function deaccent(tok: string): [string, number] {
  let tone = 0
  for (const ch of tok) { const d = DEACCENT.get(ch); if (d) tone = d[1] }
  let base = ''
  for (const ch of tok) base += DEMAP.get(ch) ?? ch
  return [base.replace(/ü/g, 'v'), tone]
}

function hypFile(tok: string): string {
  const [base, tone] = deaccent(tok)
  if (!LETTER_SET.has(base)) throw new Error(`未知拼音 token: ${tok}`)
  const t = tone && fs.existsSync(path.join(AUDIO, 'hyp', `${base}${tone}.mp3`)) ? `${base}${tone}` : base
  if (!fs.existsSync(path.join(AUDIO, 'hyp', `${t}.mp3`))) throw new Error(`hyp 缺文件: ${tok} → ${t}.mp3`)
  return path.join(AUDIO, 'hyp', `${t}.mp3`)
}

type Seg = { kind: 'mimo'; text: string } | { kind: 'hyp'; tok: string }
/* 拼音 token（呼读音归 hyp 真人库）；非拼音拉丁 run（版本号 v2.6 等）留在 mimo 段读字母名 */
function isPyTok(run: string, text: string, at: number): boolean {
  if (!LETTER_SET.has(deaccent(run)[0])) return false
  const next = text[at + run.length] || ''
  if (/[0-9A-Za-z]/.test(next)) return false   /* v2.6 这类：拉丁后邻字母数字=非拼音语境 */
  return true
}
function tokenize(text: string): Seg[] {
  const t = text.normalize('NFC')
  const segs: Seg[] = []
  let buf = ''
  let pos = 0
  const flush = (s: string) => {
    const clean = s.replace(EDGE_RE, '')
    if (clean) segs.push({ kind: 'mimo', text: clean })
  }
  for (const m of t.matchAll(new RegExp(LATIN_RUN.source, 'g'))) {
    if (isPyTok(m[0], t, m.index!)) {
      flush(buf + t.slice(pos, m.index!))
      buf = ''
      segs.push({ kind: 'hyp', tok: m[0] })
    } else {
      buf += t.slice(pos, m.index!) + m[0]   /* 非拼音拉丁并入 mimo 段 */
    }
    pos = m.index! + m[0].length
  }
  flush(buf)
  if (!segs.length) throw new Error(`解构为空: ${text}`)
  return segs
}

const hasLatin = (s: string) => LATIN_RUN.test(s.normalize('NFC'))

/* ---------- 目标清单 ---------- */
interface Item {
  key: string            // manifest key
  zh: string             // 文本
  file: string           // audio/ 相对路径
  rule: 'mimo' | 'concat' | 'exists' | 'render-only'
  src: string            // 来源说明
}
const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()).replace(/ü/g, 'v')  /* ü→v ASCII 安全名（铁律） */
const safe = (f: string) => f.replace(/ü/g, 'v')

const items: Item[] = []
const zhIndex: Record<string, string> = {}

/* 1. 文案层静态 key（含 {x} 占位 = 模板，render-only） */
for (const key in strings) {
  const zh = strings[key].zh
  if (zh.includes('{')) {
    items.push({ key, zh, file: '', rule: 'render-only', src: 'strings(模板)' })
    continue
  }
  items.push({ key, zh, file: `ui/${kebab(key)}.mp3`, rule: hasLatin(zh) ? 'concat' : 'mimo', src: 'strings' })
}

/* 2. phrases.json 数据池（题型提示/名称/夸奖语/自由练习） */
const PH_ID: [string, string][] = [
  ['detName', phrases.detName],
  ...Object.keys(phrases.hints || {}).map((k) => [`hint-${k}`, (phrases.hints as any)[k]] as [string, string]),
  ...Object.keys(phrases.hintsV5 || {}).map((k) => [`hintv5-${k}`, (phrases.hintsV5 as any)[k]] as [string, string]),
  ...Object.keys(phrases.kindNames || {}).map((k) => [`kind-${k}`, (phrases.kindNames as any)[k]] as [string, string]),
  ...(phrases.praise || []).map((z: string, i: number) => [`praise-${i}`, z] as [string, string]),
  ...(phrases.cheer || []).map((z: string, i: number) => [`cheer-${i}`, z] as [string, string]),
  ...(phrases.practice || []).flatMap((p: any) => [[`prac-${p.kind}-btn`, p.btn], [`prac-${p.kind}-desc`, p.desc]] as [string, string][]),
]
for (const [id, zh] of PH_ID) {
  if (!zh) continue
  items.push({ key: id, zh, file: `ui/phrase-${id}.mp3`, rule: hasLatin(zh) ? 'concat' : 'mimo', src: 'phrases' })
}

/* 3. 课程数据：关卡名 / 辨析提示 */
;(pinyin.levels as any[]).forEach((lv) => {
  if (!lv.name || hasLatin(lv.name)) return
  items.push({ key: `lv-name-${lv.n}`, zh: lv.name, file: `ui/phrase-lv-name-${lv.n}.mp3`, rule: 'mimo', src: 'pinyin.levels' })
})
;(confusion.pairs as any[]).forEach((p) => {
  if (!p.tip) return
  items.push({ key: `tip-${p.a}-${p.b}`, zh: p.tip, file: safe(`ui/phrase-tip-${p.a}-${p.b}.mp3`), rule: hasLatin(p.tip) ? 'concat' : 'mimo', src: 'confusion.pairs' })
})

/* 4. PinyinCard/课程数据正本：kj/say 已有音频（lessons/ 146 条存量，只反查不重造） */
for (const c of cards.cards as any[]) {
  if (c.kjAudio && c.kj) zhIndex[c.kj] = c.kjAudio
  if (c.sayAudio && c.say) zhIndex[c.say] = c.sayAudio
}
for (const ls of lessons.lessons as any[]) {
  for (const e of ls.letters as any[]) {
    if (e.kjAudio && e.kj) zhIndex[e.kj] = e.kjAudio
    if (e.sayAudio && e.say) zhIndex[e.say] = e.sayAudio
  }
}

/* ---------- diff 音频库 ---------- */
const fexists = (rel: string) => !!rel && fs.existsSync(path.join(AUDIO, rel))
for (const it of items) {
  if (it.rule === 'render-only') continue
  if (fexists(it.file)) it.rule = 'exists'
}

const todo = items.filter((i) => i.rule === 'mimo' || i.rule === 'concat')
const ro = items.filter((i) => i.rule === 'render-only')
const done = items.filter((i) => i.rule === 'exists')

console.log(`配音清单：strings ${Object.keys(strings).length} 键 + 数据短语 ${PH_ID.length} 条 + 关卡名/辨析提示`)
console.log(`  已覆盖 ${done.length} / 待生成 ${todo.length} / 模板渲染态 ${ro.length}`)
console.log('\n待生成清单（key → 文件 → 规则）：')
for (const i of todo) console.log(`  [${i.rule}] ${i.key} → ${i.file}  「${i.zh}」`)

/* ---------- 写 manifest ---------- */
const manifestPath = path.join(ROOT, 'src', 'text', 'audio-manifest.json')
const keys: Record<string, string> = {}
for (const i of done) keys[i.key] = i.file
fs.writeFileSync(manifestPath, JSON.stringify({ keys, zh: zhIndex }, null, 1) + '\n')
console.log(`\nmanifest → src/text/audio-manifest.json（keys ${Object.keys(keys).length}，zh 反查 ${Object.keys(zhIndex).length}）`)

/* ---------- 生成 ---------- */
const DRY = process.argv.includes('--dry-run')
const GEN = process.argv.includes('--generate')
if (!GEN) {
  console.log('\n（--generate 补生成；--dry-run 只演示）')
  process.exit(0)
}

const run = (cmd: string[]) => execFileSync(cmd[0], cmd.slice(1), { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
const probeDur = (p: string) => {
  try { return parseFloat(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p])) } catch { return -1 }
}
const fragName = (t: string) => 'frag_' + Math.abs([...t].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)).toString(36) + '_' + t.length

function synthMimoFrags(frags: Map<string, string>) {
  fs.mkdirSync(CACHE, { recursive: true })
  const list: string[] = []
  for (const [frag, text] of frags) {
    const out = path.join(CACHE, frag + '.wav')
    if (fs.existsSync(out) && fs.statSync(out).size > 1000) continue
    if (hasLatin(text)) console.warn(`  [warn] mimo 段含非拼音拉丁（读字母名）: ${text}`)
    list.push(`${frag}|${text}|${STYLE}`)
  }
  if (!list.length) return
  const lf = path.join(CACHE, '.batch_' + Date.now() + '.txt')
  fs.writeFileSync(lf, list.join('\n'))
  run(['python3', TTS, '--batch', lf, '--outdir', CACHE, '--voice', '冰糖'])
  fs.unlinkSync(lf)
  const bad: string[] = []
  for (const [frag] of frags) {
    const out = path.join(CACHE, frag + '.wav')
    if (!fs.existsSync(out) || fs.statSync(out).size < 1000) bad.push(frag)
  }
  if (bad.length) throw new Error(`tts.py 批量缺产物 ${bad.length} 条: ${bad.slice(0, 5).join(',')}`)
}

function buildSegment(src: string, outWav: string, isMimo: boolean) {
  const af = isMimo
    ? 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse'
    : ''
  run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src,
    ...(af ? ['-af', af] : []), '-ar', String(SR), '-ac', '1', outWav])
}

function concatMp3(target: string, segWavs: string[], silWav: string) {
  const lst = target + '.concat.txt'
  fs.writeFileSync(lst, segWavs.map((w, i) => (i ? `file '${silWav}'\n` : '') + `file '${w}'\n`).join(''))
  const tmp = target + '.tmp.mp3'
  run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
    '-c:a', 'libmp3lame', '-b:a', '64k', '-ar', String(SR), '-ac', '1', tmp])
  fs.unlinkSync(lst)
  const d = probeDur(tmp)
  if (d <= 0.2) throw new Error(`输出过短 ${target}: ${d}s`)
  fs.renameSync(tmp, target)
}

if (DRY) {
  console.log('\n[dry-run] 待合成 mimo 段：')
  const frags = new Set<string>()
  for (const it of todo) {
    if (it.rule === 'mimo') frags.add(it.zh)
    else for (const s of tokenize(it.zh)) if (s.kind === 'mimo') frags.add(s.text)
  }
  for (const f of frags) console.log('  [frag]', f)
  process.exit(0)
}

fs.mkdirSync(CACHE, { recursive: true })

/* 静音段 */
const silWav = path.join(CACHE, 'sil.wav')
run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `anullsrc=r=${SR}:cl=mono`, '-t', String(SIL_SEC), silWav])

/* 收集全部 mimo 段并批量合成（缓存命中自动跳过） */
const frags = new Map<string, string>()
for (const it of todo) {
  if (it.rule === 'mimo') frags.set(fragName(it.zh), it.zh)
  else for (const s of tokenize(it.zh)) if (s.kind === 'mimo') frags.set(fragName(s.text), s.text)
}
console.log(`\nmimo 段共 ${frags.size} 条 → 合成中（冰糖）…`)
synthMimoFrags(frags)

/* 逐条产出 */
let made = 0
for (const it of todo) {
  const target = path.join(AUDIO, it.file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  if (it.rule === 'mimo') {
    const frag = path.join(CACHE, fragName(it.zh) + '.wav')
    buildSegment(frag, frag + '.norm.wav', true)
    run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', frag + '.norm.wav', '-c:a', 'libmp3lame', '-b:a', '64k', '-ar', String(SR), '-ac', '1', target])
    fs.unlinkSync(frag + '.norm.wav')
  } else {
    const wavs: string[] = []
    for (const s of tokenize(it.zh)) {
      if (s.kind === 'mimo') {
        const w = path.join(CACHE, fragName(s.text) + '.norm.wav')
        buildSegment(path.join(CACHE, fragName(s.text) + '.wav'), w, true)
        wavs.push(w)
      } else {
        const w = path.join(CACHE, 'hyp_' + fragName(s.tok) + '.wav')
        buildSegment(hypFile(s.tok), w, false)
        wavs.push(w)
      }
    }
    concatMp3(target, wavs, silWav)
  }
  made++
  const d = probeDur(target)
  console.log(`  ✓ ${it.file}（${d.toFixed(1)}s）${it.zh.slice(0, 24)}`)
}
console.log(`\n补生成 ${made}/${todo.length} 条`)
