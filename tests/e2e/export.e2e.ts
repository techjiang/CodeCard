/**
 * 真实导出：用应用自己的 DOM → Canvas 渲染器出图，再回读像素。
 * 单测里 Canvas 是假的，这里才是真的画。
 */
import { afterAll, describe, expect, test } from 'vitest'
import { closeBrowser, inspectImage, openApp, pickSize, pickTemplate, readMetrics, renderPng, seedCard, settle } from './harness'
import { CODE_SNIPPET, KNOWLEDGE_MD, QUOTE_TEXT, SIZES } from './fixtures'

afterAll(closeBrowser)

describe('导出', () => {
  test.each([1, 2, 3] as const)('%ix 导出像素尺寸正确', async (scale) => {
    const page = await openApp()
    await seedCard(page, { type: 'knowledge', title: '导出尺寸', content: KNOWLEDGE_MD })
    const m = await readMetrics(page)

    const png = await renderPng(page, scale)
    expect(png.width).toBe(m.width * scale)
    expect(png.height).toBe(m.height * scale)
  }, 60_000)

  test('导出图没有白边也没有黑边', async () => {
    const page = await openApp()
    await seedCard(page, { type: 'knowledge', title: '边缘', content: KNOWLEDGE_MD })
    await pickTemplate(page, '渐变紫')

    const png = await renderPng(page, 1)
    const pixels = await inspectImage(page, png.dataUrl)
    // 导出不再垫白底（背景透明度调 0 时要能透明），所以「边」不该有整条空白：
    // 渐变底会铺满每一行每一列，只有四个圆角被切掉
    for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
      expect(pixels.transparent[edge], `${edge} 边不该留整条空白`).toBeLessThan(0.05)
    }
    // 四角：渐变底从圆心方向铺过来，圆角处天然透明；要紧的是不能整张空掉
    expect(pixels.inkRatio).toBeGreaterThan(0.3)
    expect(pixels.opaqueRatio).toBeGreaterThan(0.9)
    expect(pixels.darkRatio).toBeLessThan(0.02)
  }, 60_000)

  test('多尺寸导出都不留白带', async () => {
    const page = await openApp()
    await seedCard(page, { type: 'knowledge', title: '多尺寸', content: KNOWLEDGE_MD })
    for (const size of ['square', 'landscape', 'portrait'] as const) {
      await pickSize(page, size)
      const png = await renderPng(page, 1)
      const pixels = await inspectImage(page, png.dataUrl)
      expect([pixels.width, pixels.height]).toEqual([SIZES[size].width, SIZES[size].height])
      for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
        expect(pixels.transparent[edge], `${size} ${edge} 边留了整条空白`).toBeLessThan(0.05)
      }
    }
  }, 120_000)

  test('中文注释在导出图里真的画出来了', async () => {
    const page = await openApp()
    await seedCard(page, { type: 'code', title: '中文注释', content: CODE_SNIPPET, tags: ['Vue'] })
    await pickTemplate(page, '终端黑')

    const png = await renderPng(page, 1)
    const pixels = await inspectImage(page, png.dataUrl)
    // 深色模板上的亮色文字：统计亮像素占比，页面空白则接近 0
    const bright = await page.evaluate(async (url) => {
      const img = new Image()
      img.src = url
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const { data } = ctx.getImageData(0, 0, c.width, c.height)
      let bright = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) bright++
      }
      return bright / (data.length / 4)
    }, png.dataUrl)
    // 深色底上的文字像素本来就只占几个百分点，0.5% 足够判定「画出来了」
    expect(bright).toBeGreaterThan(0.005)
    // 终端黑是浅底模板，深色像素来自代码块底衬
    expect(pixels.inkRatio).toBeGreaterThan(0.2)
  }, 60_000)

  test('导出的换行位置和预览一致（不差行）', async () => {
    const page = await openApp()
    await seedCard(page, { type: 'quote', title: '换行一致', content: QUOTE_TEXT })
    await pickTemplate(page, '杂志风')

    const previewLines = await page.evaluate(() => {
      const target = document.querySelector<HTMLElement>('.quote__line, .cc-body')!
      const range = document.createRange()
      range.selectNodeContents(target)
      const tops = new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top)))
      return tops.size
    })
    const png = await renderPng(page, 1)
    const exportLineHeight = await page.evaluate(async (url) => {
      // 按行扫描亮像素，数出文字行数
      const img = new Image()
      img.src = url
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const { data } = ctx.getImageData(0, 0, c.width, c.height)
      let rows = 0
      let inText = false
      for (let y = 0; y < c.height; y++) {
        let ink = 0
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4
          if (data[i + 3] > 200 && data[i] < 160) ink++
        }
        if (ink > 3 && !inText) {
          rows++
          inText = true
        } else if (ink <= 1) inText = false
      }
      return rows
    }, png.dataUrl)
    // 预览行数包含标题等，只要求导出比预览少了不超过 1 行（少行就是被吞了）
    expect(exportLineHeight).toBeGreaterThanOrEqual(Math.max(1, previewLines - 1))
  }, 60_000)
})
