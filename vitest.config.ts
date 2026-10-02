/* T1 测试基建：vitest 单测配置（jsdom + svelte 插件编译 .svelte/.svelte.ts runes）。
   与 vite.config.ts 保持同款 resolve.extensions 与 __APP_VERSION__ define；
   PWA 插件不进测试（无 SW 语义）。CI 跑 `vitest run`（--run 模式，无 watch）。
   T2（2026-10-02）：components/ 组件测并入；覆盖率门槛落配置——
   src/{lib,stores,data,text} 聚合行覆盖 <95% = 退出码非零 = CI 红（只升不降棘轮起点）。 */
import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { version } from './package.json'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.svelte.ts', '.jsx', '.tsx', '.json'],
    /* vitest node 环境下 svelte 5 默认解析到 server 构建（mount 报 lifecycle_function_unavailable）
       ——测试也走浏览器构建（jsdom 是浏览器语义） */
    conditions: ['browser'],
  },
  plugins: [svelte()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/components/**/*.test.ts'],
    setupFiles: ['tests/unit/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**'],
      exclude: ['src/main.ts', 'src/vite-env.d.ts'],
      reportsDirectory: 'coverage',
      /* 棘轮：逻辑层（lib/stores/data/text）聚合行覆盖 ≥95%——.svelte 组件不入阈值组
         （组件面由 components/ 测试与 e2e 回归包守护），但保留在报告里可见 */
      thresholds: {
        'src/{lib,stores,data,text}/**': { lines: 95 },
      },
    },
  },
})
