import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

/** E2E 专用：只跑 *.e2e.ts，单测那套配置不受影响 */
export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['tests/e2e/**/*.e2e.ts'],
    // 共用同一个 dev server，串行跑更稳
    fileParallelism: false,
    testTimeout: 300_000,
    hookTimeout: 60_000,
  },
})
