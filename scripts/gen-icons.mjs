/* 一次性：生成 PWA 图标 public/icon-192.png / icon-512.png（保留供日后改版重跑） */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFC53D"/><stop offset="1" stop-color="#FF9A3D"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <text x="256" y="238" font-family="PingFang SC, HarmonyOS Sans SC, Microsoft YaHei, sans-serif"
        font-size="252" font-weight="900" fill="#FFF8EE" text-anchor="middle">拼</text>
  <text x="256" y="392" font-family="PingFang SC, sans-serif" font-size="86" font-weight="800"
        fill="#7A4B1E" text-anchor="middle">pīn yīn</text>
</svg>`

const browser = await chromium.launch()
const page = await browser.newPage()
for (const size of [192, 512]) {
  await page.setContent(`<body style="margin:0">${svg(size)}</body>`)
  await page.locator('svg').screenshot({ path: join(root, 'public', `icon-${size}.png`) })
  console.log(`icon-${size}.png 生成`)
}
await browser.close()
