/**
 * 单文件产物验收：`dist-standalone/index.html` 必须自包含、且真能跑起来。
 *
 * 这条检查是为一个真事故写的：README 一直写着「单文件产物，打开即用」，
 * 但默认构建产出的是 ESM + 外链 chunk。`file://` 下模块脚本按 CORS 取，
 * origin 是 null，浏览器直接拒绝加载 —— 双击打开是白屏。
 *
 * 只检查「文件里有几行字符串」不够。这里真的用 Chromium 打开它，
 * 确认 Vue 挂上了、12 套模板都在、导出能出图。
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const file = `${root}dist-standalone/index.html`

const fail = (message) => {
  console.error(`✗ ${message}`)
  process.exit(1)
}

if (!existsSync(file)) fail('缺少 dist-standalone/index.html')

const html = readFileSync(file, 'utf8')
// 自包含：不能有任何外链脚本、样式或模块 preload
const external = [...html.matchAll(/<(script|link)[^>]*(?:src|href)="(?!data:)([^"]+)"/g)].map((m) => m[2])
if (external.length) fail(`产物不是自包含的，还在引外部资源：${external.join(', ')}`)
if (/<script[^>]*type="module"/.test(html)) fail('内联的仍是 module 脚本，file:// 下会被 CORS 挡掉')
if (!/<style>/.test(html)) fail('样式没有内联进来')
if (!/<script>/.test(html)) fail('脚本没有内联进来')

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto(`file://${file}`)
  await page.waitForSelector('[data-card-root]', { state: 'attached', timeout: 15_000 })

  const stats = await page.evaluate(() => ({
    templates: document.querySelectorAll('.tpl').length,
    card: !!document.querySelector('[data-card-root]'),
  }))
  if (!stats.card) fail('file:// 打开后卡片没渲染出来')
  if (stats.templates !== 12) fail(`模板应该 12 套，实际 ${stats.templates} 套`)

  // 真导出一张，确认 Canvas 在 file:// 下也能编码
  const exported = await page.evaluate(async () => {
    const result = await window.__ccExport(1)
    return { size: result.blob.size, width: result.width, height: result.height }
  })
  if (!exported.size) fail('file:// 下导出得到空文件')
  if (exported.width !== 1080 || exported.height !== 1080) fail(`导出尺寸不对：${exported.width}×${exported.height}`)

  if (errors.length) fail(`控制台有报错：\n${errors.join('\n')}`)

  console.log(`✓ 单文件产物可用：${(html.length / 1024).toFixed(0)} KB，12 套模板，导出 ${exported.width}×${exported.height}`)
} finally {
  await browser.close()
}
