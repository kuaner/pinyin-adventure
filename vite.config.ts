import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { version } from './package.json'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  base: process.env.GITHUB_PAGES ? '/pinyin-adventure/' : '/',
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.svelte.ts', '.jsx', '.tsx', '.json'],
  },
  plugins: [
    svelte(),
    VitePWA({
      // 自动更新：部署新版本后 SW skipWaiting，下次打开生效（儿童应用不打断答题）
      registerType: 'autoUpdate',
      workbox: {
        // mp3 不进 precache（305 条逐个预载太慢），改 CacheFirst 边播边缓存；外壳/数据全量离线可用
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/audio\/.*\.mp3$/,
            handler: 'CacheFirst',
            options: { cacheName: 'pinyin-audio', expiration: { maxEntries: 400 } },
          },
        ],
      },
      manifest: {
        name: '拼音闯关大冒险',
        short_name: '拼音闯关',
        description: '儿童拼音闯关：8 关冒险 + 易混对专练 + 正反小侦探 + 闪电刷题 + 常见字快拼 + 闪卡复习',
        start_url: process.env.GITHUB_PAGES ? '/pinyin-adventure/' : '/',
        display: 'standalone',
        background_color: '#FFEFD6',
        theme_color: '#FF9A3D',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
