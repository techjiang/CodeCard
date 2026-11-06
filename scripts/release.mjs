/**
 * 打 Release 包：产出可直接分发的压缩包 + 校验和。
 *
 * 两种产物，对应用户的两种用法：
 * - `codecard-<ver>.html` 双击就开，不发一个请求、不用起服务
 * - `codecard-<ver>-dist.zip` 静态站点，挂到任何 web 服务器 / Pages 上
 *
 * 打包前先验一遍单文件产物真能跑（见 check-standalone.mjs），
 * 免得又出现「README 说能双击打开、打开是白屏」。
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { join } from 'node:path'
import { zip } from './zip.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version
const outDir = join(root, 'release')
const name = `codecard-${version}`

const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' })
const step = (message) => console.log(`\n▸ ${message}`)

const SKIP = (abs) => abs.endsWith('.map') || abs.includes('/node_modules/') || abs.includes('/.artifacts/')

step('构建：默认产物 + 单文件产物')
run('npm', ['run', 'build'])
run('npm', ['run', 'build:standalone'])

step('验收单文件产物')
run('node', ['scripts/check-standalone.mjs'])

step('打包')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

copyFileSync(join(root, 'dist-standalone/index.html'), join(outDir, `${name}.html`))
zip(join(outDir, `${name}-dist.zip`), ['dist'], { skip: SKIP })
zip(join(outDir, `${name}-source.zip`), [
  'src', 'public', 'tests', 'scripts', 'docs', 'index.html',
  'package.json', 'package-lock.json', 'README.md', 'CHANGELOG.md', 'LICENSE',
  'vite.config.ts', 'vite.standalone.ts', 'vitest.e2e.config.ts', 'tailwind.config.ts',
  'postcss.config.js', 'tsconfig.json', '.cnb.yml',
], { skip: SKIP })

// 校验和：分发包靠这个确认没被改动
const files = readdirSync(outDir).filter((f) => f !== 'SHA256SUMS.txt').sort()
const sums = files.map((f) => `${createHash('sha256').update(readFileSync(join(outDir, f))).digest('hex')}  ${f}`)
writeFileSync(join(outDir, 'SHA256SUMS.txt'), sums.join('\n') + '\n')

step('产物')
for (const f of [...files, 'SHA256SUMS.txt']) {
  const kb = (statSync(join(outDir, f)).size / 1024).toFixed(0)
  console.log(`  ${f.padEnd(32)} ${kb.padStart(7)} KB`)
}
