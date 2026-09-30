/* 全局类型：数据结构与题目对象（行为与 v1 单文件版一致） */

export type Cat = 'sm' | 'ym' | 'zt'

export interface Letter {
  cat: Cat
  tts: string   // 呼读音/直读（闪卡背面大字）
  han: string   // 拼音直注汉字（音频缺失兜底提示用）
  kj: string    // 正确口诀（带注音 DSL）
  kjf: string   // 干扰口诀（带注音 DSL）
  word: string  // 例字词（带注音 DSL）
  wp: string    // 例词纯注音
  em: string    // 例词 emoji
}

export interface Pair { a: string; b: string; grp: string; tip: string }

export interface LevelDef {
  n: number
  icon: string   // naive-icons 名（v2.3：关卡 emoji → 图标）
  name: string   // 带 DSL
  sub: string    // 带 DSL
  pool: string[] | null
  pairs: string[] | null
  hot?: string[]
  boss?: boolean
}

export interface Anchor { h: string; p: string; em: string }

export interface ZiItem { h: string; p: string; f: string }
export interface ZWord { w: string; p: string; f: string }

/* 关卡/练习的出题域（buildQuestions 入参） */
export interface QuizScope {
  name: string
  pool: string[] | null
  pairs: string[] | null
  hot?: string[]
  boss?: boolean
}

export type QType =
  | 'listen' | 'look' | 'kj'               // 闯关三题型（v2.3 铁律：ll 听看一致/rule 错句判断删除）
  | 'djudge' | 'dfix'                        // 正反小侦探
  | 'zi' | 'zword'                           // 常见字快拼
  | 'blisten' | 'bkj'                        // ⚡闪电刷题（听写 70% + 口诀正向回忆 30%）

interface QBase { key: string; hint: string }

export interface ListenQ extends QBase { type: 'listen'; A: string; B: string; opts: string[]; ans: number }
export interface LookQ extends QBase { type: 'look'; A: string; B: string; opts: string[]; ans: number }
export interface KjQ extends QBase { type: 'kj'; A: string; B: string; stmt: string; opts: string[]; ans: number }
export interface DjudgeQ extends QBase { type: 'djudge'; X: string; flipped: boolean; ans: number }
export interface DfixQ extends QBase { type: 'dfix'; X: string; opts: string[]; ans: number }
export interface ZiQ extends QBase { type: 'zi'; z: ZiItem; opts: string[]; ans: number }
export interface ZwordQ extends QBase { type: 'zword'; z: ZWord; opts: string[]; ans: number }
export interface BListenQ extends QBase { type: 'blisten'; A: string; sound: string; opts: string[]; ans: number }
export interface BKjQ extends QBase { type: 'bkj'; A: string; B: string; stmt: string; opts: string[]; ans: number }

export type Question =
  | ListenQ | LookQ | KjQ | DjudgeQ | DfixQ | ZiQ | ZwordQ
  | BListenQ | BKjQ

export type BoltQ = BListenQ | BKjQ

export interface SessionCfg {
  name: string
  level?: QuizScope
  levelNo?: number
  pkind?: string
  det?: boolean
  zi?: boolean
  qs: Question[]
}
