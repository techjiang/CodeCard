/**
 * 装饰线：引用块、名言副引用、海报风左竖条用的都是单侧边框（border-left）。
 * 渲染器原来只认 border-top，这些线在导出图里整条消失 —— 预览看得见，导出没有。
 */
import { afterAll, describe, expect, test } from 'vitest'
import { closeBrowser, openApp, pickTemplate, renderPng, seedCard } from './harness'
import { KNOWLEDGE_MD } from './fixtures'

afterAll(closeBrowser)

describe('导出：单侧边框', () => {
  test('引用块的竖线画进了导出图', async () => {
    // 引用块的竖线是 border-left，渲染器原来只认 border-top，整条线在导出图里消失
    const page = await openApp()
    await seedCard(page, { type: 'knowledge', title: '引用竖线', content: KNOWLEDGE_MD })
    await pickTemplate(page, '极简白')

    // 先确认预览里这根竖线是存在的，再去导出图里找同一位置
    const bar = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('[data-card-export] [data-card-root]')!
      const quote = root.querySelector<HTMLElement>('.md-quote')!
      const cs = getComputedStyle(quote)
      const cardRect = root.getBoundingClientRect()
      const k = cardRect.width / root.offsetWidth
      const r = quote.getBoundingClientRect()
      return {
        borderLeftWidth: parseFloat(cs.borderLeftWidth),
        x: Math.round((r.left - cardRect.left) / k),
        y: Math.round((r.top - cardRect.top) / k),
        h: Math.round(r.height / k),
      }
    })
    expect(bar.borderLeftWidth).toBeGreaterThan(0)

    const png = await renderPng(page, 1)
    const found = await page.evaluate(
      async ({ url, region }) => {
        const img = new Image()
        img.src = url
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        // 竖线在 region.x 左侧几像素内；沿高度取中段，统计有一条深色竖列的行数占比
        const strip = ctx.getImageData(region.x - 2, region.y + Math.round(region.h * 0.2), 8, Math.round(region.h * 0.6)).data
        const width = 8
        const rows = strip.length / 4 / width
        let hit = 0
        for (let row = 0; row < rows; row++) {
          let darkest = 255
          for (let col = 0; col < width; col++) {
            const i = (row * width + col) * 4
            darkest = Math.min(darkest, (strip[i] + strip[i + 1] + strip[i + 2]) / 3)
          }
          if (darkest < 150) hit++
        }
        return hit / rows
      },
      { url: png.dataUrl, region: { x: bar.x, y: bar.y, h: bar.h } },
    )
    // 修之前整列是底色，一条都打不到
    expect(found).toBeGreaterThan(0.7)
  }, 60_000)

})
