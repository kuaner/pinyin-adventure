/* 一次性抽取脚本：从单文件 index.html（行为正本）抽数据层 → src/data/*.json
   用法：node scripts/extract-data.mjs   （重构完成后此脚本仅作留档，不再需要） */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const html = readFileSync(join(root, 'index.html'), 'utf8')

function evalChunk(code) {
  return new Function(code + '\n;return {LETTERS,PAIRS,GRPNAME,ZI,ZWORDS,ANCHORS,LEVELS,DETSET,COREDET,DETNAME,HINT,KINDNAME,PRAISE,CHEER};')()
}

const chunk1 = html.slice(html.indexOf('/* ================= 注音 DSL'), html.indexOf('/* ================= 存储引擎'))
// PRAISE/CHEER 定义在答题流程段，单独切出来拼进同一求值
const praiseStart = html.indexOf('var PRAISE=')
const cheerEnd = html.indexOf('\n', html.indexOf('var CHEER='))
const praiseChunk = html.slice(praiseStart, cheerEnd)

const D = evalChunk(chunk1 + '\n' + praiseChunk)

// ---- 校验 ----
if (!D.LETTERS || Object.keys(D.LETTERS).length < 50) throw new Error('LETTERS 抽取异常')
if (D.ZI.length !== 180) throw new Error('ZI 应为 180 字，实际 ' + D.ZI.length)
if (D.ZWORDS.length !== 30) throw new Error('ZWORDS 应为 30 词，实际 ' + D.ZWORDS.length)
if (D.LEVELS.length !== 9) throw new Error('LEVELS 应为 9 关')
if (!D.LEVELS[8].pairs || D.LEVELS[8].pairs.length !== 14) throw new Error('毕业关 pairs 应为 14 组')
if (D.DETSET.length !== 19 || D.COREDET.length !== 6) throw new Error('DETSET/COREDET 异常')

mkdirSync(join(root, 'src/data'), { recursive: true })

// ---- pinyin.json：字母表 + 锚点表 + 关卡 + 正反覆盖集 ----
writeFileSync(join(root, 'src/data/pinyin.json'), JSON.stringify({
  letters: D.LETTERS,
  anchors: D.ANCHORS,
  levels: D.LEVELS,
  detSet: D.DETSET,
  coreDet: D.COREDET,
}, null, 1))

// ---- confusion.json：易混对 + 组名 ----
writeFileSync(join(root, 'src/data/confusion.json'), JSON.stringify({
  pairs: D.PAIRS,
  groupNames: D.GRPNAME,
  groupOrder: ['mirror', 'near', 'nasal', 'final'],
}, null, 1))

// ---- zi180.json / words.json ----
writeFileSync(join(root, 'src/data/zi180.json'), JSON.stringify(D.ZI, null, 1))
writeFileSync(join(root, 'src/data/words.json'), JSON.stringify(D.ZWORDS, null, 1))

// ---- phrases.json：UI 短语/提示/题型名/夸奖语 + 自由练习配置 ----
writeFileSync(join(root, 'src/data/phrases.json'), JSON.stringify({
  detName: '正{zhèng}反{fǎn}小{xiǎo}侦{zhēn}探{tàn}',
  hints: D.HINT,
  kindNames: D.KINDNAME,
  praise: D.PRAISE,
  cheer: D.CHEER,
  hintsV5: {
    zi: '看{kàn}字{zì}，选{xuǎn}出{chū}正{zhèng}确{què}的{de}拼{pīn}音{yīn}',
    zword: '看{kàn}词{cí}，选{xuǎn}出{chū}正{zhèng}确{què}的{de}拼{pīn}音{yīn}',
    bdjudge: '小{xiǎo}侦{zhēn}探{tàn}快{kuài}看{kàn}：这{zhè}个{gè}字{zì}母{mǔ}写{xiě}对{duì}了{le}吗{ma}？',
    blisten: '听{tīng}一{yì}听{tīng}，哪{nǎ}个{gè}是{shì}听{tīng}到{dào}的{de}拼{pīn}音{yīn}？',
    blook: '看{kàn}大{dà}字{zì}，选{xuǎn}出{chū}一{yí}样{yàng}的{de}拼{pīn}音{yīn}',
  },
  circ: ['①', '②', '③', '④'],
  practice: [
    { kind: 'sm', name: '练{liàn}习{xí} · 声{shēng}母{mǔ}', btn: '🔤 声{shēng}母{mǔ}练{liàn}习{xí}', desc: '23个{gè}声{shēng}母{mǔ} · 含{hán}全{quán}部{bù}易{yì}混{hùn}声{shēng}母{mǔ}', cat: 'sm',
      pairs: ['b|d', 'p|q', 'b|p', 'd|q', 'n|l', 'f|h', 'd|t', 'g|k', 'z|c', 'c|s'] },
    { kind: 'ym', name: '练{liàn}习{xí} · 韵{yùn}母{mǔ}', btn: '🎵 韵{yùn}母{mǔ}练{liàn}习{xí}', desc: '单{dān}韵{yùn}母{mǔ} 复{fù}韵{yùn}母{mǔ} 鼻{bí}韵{yùn}母{mǔ}', cat: 'ym',
      pairs: ['an|ang', 'en|eng', 'in|ing', 'un|ün', 'ui|iu', 'ie|ei'] },
    { kind: 'zt', name: '练{liàn}习{xí} · 整{zhěng}体{tǐ}认{rèn}读{dú}', btn: '⭐ 整{zhěng}体{tǐ}认{rèn}读{dú}', desc: 'zhi chi shi ri zi ci si', cat: 'zt',
      pairs: ['zhi|chi', 'chi|shi', 'zi|ci', 'ci|si', 'shi|ri'] },
    { kind: 'all', name: '练{liàn}习{xí} · 全{quán}部{bù}大{dà}混{hùn}战{zhàn}', btn: '🔥 全{quán}部{bù}大{dà}混{hùn}战{zhàn}', desc: '所{suǒ}有{yǒu}拼{pīn}音{yīn}随{suí}机{jī}出{chū}题{tí}', cat: null, pairs: null },
  ],
}, null, 1))

console.log('抽取完成：letters=%d anchors=%d levels=%d pairs=%d zi=%d words=%d detSet=%d coreDet=%d',
  Object.keys(D.LETTERS).length, Object.keys(D.ANCHORS).length, D.LEVELS.length,
  D.PAIRS.length, D.ZI.length, D.ZWORDS.length, D.DETSET.length, D.COREDET.length)
