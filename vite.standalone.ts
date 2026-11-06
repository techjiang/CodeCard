/**
 * 单文件产物：把 JS / CSS / favicon 全部内联进 index.html，双击就能用。
 *
 * 默认构建产出的是 ESM + 外链 chunk，`file://` 打开会被 CORS 挡死（spec 里 module
 * 脚本一律按 CORS 请求处理），页面白屏。所以打 Release 用这份配置：IIFE + 全内联。
 */
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

/** 把 index.html 里引用的资源换成内联内容 */
function inlineEverything(): Plugin {
  return {
    name: 'codecard:inline-everything',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html']
      if (!html || html.type !== 'asset') return
      let source = String(html.source)

      // 内联脚本是经典脚本，不 defer，放在 head 里会在 #app 出现之前执行。
      // 先收集，最后插到 </body> 前面。
      const scripts: string[] = []
      source = source.replace(/<script[^>]*src="\/?([^"]+\.js)"[^>]*><\/script>/g, (_m, file: string) => {
        const chunk = bundle[file]
        if (!chunk || chunk.type !== 'chunk') return _m
        delete bundle[file]
        // 脚本内容里出现 </script 会提前闭合标签，切开写
        scripts.push(chunk.code.replace(/<\/script/gi, '<\\/script'))
        return ''
      })
      if (scripts.length) {
        source = source.replace('</body>', () => scripts.map((code) => `<script>${code}</script>`).join('\n') + '\n  </body>')
      }

      source = source.replace(/<link[^>]*href="\/?([^"]+\.css)"[^>]*>/g, (_m, file: string) => {
        const asset = bundle[file]
        if (!asset || asset.type !== 'asset') return _m
        delete bundle[file]
        return `<style>${String(asset.source)}</style>`
      })

      // favicon 走 data URI，省掉一个文件（public/ 下的不进 bundle，直接读源文件）
      const favicon = readFileSync(fileURLToPath(new URL('./public/favicon.svg', import.meta.url)))
      source = source.replace(/<link[^>]*href="\/?favicon\.svg"[^>]*>/g, () =>
        `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${favicon.toString('base64')}" />`,
      )

      html.source = source
    },
  }
}

export default defineConfig({
  plugins: [vue(), inlineEverything()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2020',
    outDir: 'dist-standalone',
    cssCodeSplit: false,
    // 单文件不需要独立资源，全部内联
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: {
      output: {
        // file:// 下不能用 ESM（模块脚本按 CORS 取，origin 是 null）
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
})
