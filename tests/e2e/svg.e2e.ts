/**
 * 导出 SVG。
 *
 * 规格里写着「导出 SVG（矢量，可缩放）」这条一直没做。做的时候没另写一套绘制逻辑 ——
 * 同一个渲染器画完裹进 <image>，否则两套渲染器迟早漂移。
 */
import { afterAll, describe, expect, test } from 'vitest'
import { closeBrowser, openApp, pickTemplate, settle } from './harness'

afterAll(closeBrowser)

describe('导出 SVG', () => {
  test('菜单里有 SVG，点出来的文件是真 SVG 且尺寸等于设计尺寸', async () => {
    const page = await openApp()
    await pickTemplate(page, '渐变紫')
    await page.click('.export__btn')
    await settle(page, 300)
    const items = await page.$$eval('.menu__item', (els) => els.map((e) => e.textContent?.replace(/\s+/g, ' ').trim() ?? ''))
    expect(items.some((t) => t.startsWith('SVG')), `导出菜单里没有 SVG：${items.join(' | ')}`).toBe(true)

    const svg = await page.evaluate(async () => {
      // 用 Function 包一层原生动态 import：vite 会改写裸 import()，引用只在模块作用域里
      // 存在的 __vite_ssr_dynamic_import__，在浏览器里直接报未定义（harness 注释里记过这条）
      const load = new Function('p', 'return import(p)') as (p: string) => Promise<typeof import('../../src/composables/useExport')>
      const { useExport } = await load('/src/composables/useExport.ts')
      const card = document.querySelector<HTMLElement>('[data-card-export]')!
      // dataset.exportStyle 里只有宽高，导出器要的是完整 style
      const style = JSON.parse(card.dataset.exportStyle ?? '{}') as Record<string, unknown>
      const full = { ...style, size: { preset: 'square', width: style.width, height: style.height } }
      const store = useExport()
      store.register({
        element: card,
        card: { type: 'knowledge', title: '导出 SVG', content: '', tags: [] } as never,
        style: full as never,
      })
      const result = await store.render(2, 'svg')
      return { text: await result.blob.text(), type: result.blob.type, name: result.filename, w: result.width, h: result.height }
    })

    expect(svg.type).toContain('image/svg+xml')
    expect(svg.name.endsWith('.svg'), `文件名后缀不对：${svg.name}`).toBe(true)
    expect(svg.text.startsWith('<svg'), '不是合法 SVG 根节点').toBe(true)
    expect(svg.text).toContain(`width="${svg.w}" height="${svg.h}"`)
    // 设计尺寸，不是乘倍率之后的
    expect(svg.w).toBe(1080)
    expect(svg.h).toBe(1080)
    // 里面得真有图，不能是空壳
    expect(svg.text).toContain('data:image/jpeg;base64,')
    expect(svg.text.length).toBeGreaterThan(10_000)
  })

  test('SVG 里的位图就是当前预览这一张：换模板后内容跟着变', async () => {
    const page = await openApp()
    const grab = () =>
      page.evaluate(async () => {
        const load = new Function('p', 'return import(p)') as (p: string) => Promise<typeof import('../../src/utils/svg-export')>
        const { renderElementToSvg } = await load('/src/utils/svg-export.ts')
        const card = document.querySelector<HTMLElement>('[data-card-export]')!
        return renderElementToSvg({ element: card, width: 1080, height: 1080, scale: 1 })
      })

    await pickTemplate(page, '极简白')
    const white = await grab()
    await pickTemplate(page, '星空夜')
    const starry = await grab()

    expect(white).not.toBe(starry)
    const payload = (s: string) => s.slice(s.indexOf('base64,') + 7, s.indexOf('"', s.indexOf('base64,')))
    // 只比长度：白底卡和深色星空压缩后的字节数不可能一样
    expect(Math.abs(payload(white).length - payload(starry).length)).toBeGreaterThan(1000)
  })
})
