/**
 * E2E 入口：起 vite dev server，跑 vitest（配套 Chromium），收工关掉。
 * 浏览器不在 npm install 时下载，CI 里单独装，见 .cnb.yml。
 */
import { spawn } from 'node:child_process'
import { createServer } from 'vite'

const PORT = Number(process.env.E2E_PORT ?? 4180)
const server = await createServer({ server: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' })
await server.listen()

const child = spawn('npx', ['vitest', 'run', '--config', 'vitest.e2e.config.ts'], {
  stdio: 'inherit',
  env: { ...process.env, E2E_BASE_URL: `http://127.0.0.1:${PORT}` },
})
const code = await new Promise((resolve) => child.on('exit', resolve))
await server.close()
process.exit(code ?? 1)
