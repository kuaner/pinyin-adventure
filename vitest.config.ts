/* T1 测试基建：vitest 单测配置（jsdom + svelte 插件编译 .svelte/.svelte.ts runes）。
   与 vite.config.ts 保持同款 resolve.extensions 与 __APP_VERSION__ define；
   PWA 插件不进测试（无 SW 语义）。CI 跑 `vitest run`（--run 模式，无 watch）。 */
import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { version } from './package.json'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.svelte.ts', '.jsx', '.tsx', '.json'],
  },
  plugins: [svelte()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/unit/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**'],
      exclude: ['src/main.ts', 'src/vite-env.d.ts'],
      reportsDirectory: 'coverage',
    },
  },
})
