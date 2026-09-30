/* v293 截图联版：截图拼 3×2 全分辨率联版图，供批量目验裁切。
   每版新开 page（大 base64 连续 setContent 会把渲染器图片缓存打挂——05~07 全黑教训） */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) }
catch { ({ chromium } = await import('/Users/kuaner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')) }

const DIR = '.acceptance/v293'
const OUT = '.acceptance/v293-sheets'
fs.mkdirSync(OUT, { recursive: true })
fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).forEach((f) => fs.unlinkSync(path.join(OUT, f)))
const shots = fs.readdirSync(DIR).filter((f) => f.endsWith('.png')).sort()
console.log(`${shots.length} shots → sheets of 6`)

const browser = await chromium.launch()
for (let s = 0; s * 6 < shots.length; s++) {
  const batch = shots.slice(s * 6, s * 6 + 6)
  const page = await browser.newPage({ viewport: { width: 1188, height: 1712 } })
  const cells = batch.map((f) => {
    const b64 = fs.readFileSync(path.resolve(DIR, f)).toString('base64')
    return `<div class="cell"><img src="data:image/png;base64,${b64}"><span>${f}</span></div>`
  }).join('')
  const html = `<!doctype html><style>body{margin:0;background:#222;display:grid;grid-template-columns:repeat(3,392px);grid-auto-rows:848px;gap:2px}
  .cell{position:relative}img{width:390px;height:844px;display:block}span{position:absolute;top:2px;left:2px;background:#000;color:#0f0;font:700 13px monospace;padding:1px 5px;z-index:2}</style>${cells}`
  await page.setContent(html)
  await page.waitForTimeout(400)
  const name = `sheet-${String(s + 1).padStart(2, '0')}.png`
  await page.screenshot({ path: `${OUT}/${name}` })
  console.log(name + ' ← ' + batch.join(', '))
  await page.close()
}
await browser.close()
