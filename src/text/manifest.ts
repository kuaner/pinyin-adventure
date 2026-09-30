/* v2.6 配音清单加载器：audio-manifest.json（scripts/gen-audio.ts 产出）的运行时入口。
   keys：文案层 key → 音频文件（相对 public/audio/）；zh：数据层文案（题型提示/夸奖语/口诀等）
   按渲染文本反查音频（Speak text= 模式点播依据）。 */
import raw from './audio-manifest.json'
import { strings } from './strings'

interface ManifestFile {
  keys: Record<string, string>
  zh: Record<string, string>
}

const m = raw as ManifestFile

export const manifest: Record<string, string> = m.keys || {}

/* zh 反查表：数据段 + 文案层静态 key（含 {x} 占位的模板不可播，不进表） */
export const zhAudio: Record<string, string> = { ...(m.zh || {}) }
Object.keys(strings).forEach((k: string) => {
  const f = manifest[k]
  const zh = (strings as any)[k]?.zh
  if (f && zh && !zh.includes('{')) zhAudio[zh] = f
})
