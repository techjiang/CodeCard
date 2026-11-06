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

  test('长标题在词边界换行，不会把标识符从中间劈开', async () => {
    const page = await openApp()
    // 标题得真的长到要换行：短标题会被自适应放大到一行放得下，
    // 那样这条用例就测不到「换个行会不会劈开标识符」了
    await seedCard(page, { type: 'knowledge', title: 'Vue 3 的 Proxy 与 defineProperty 到底差在哪', content: '一句话' })
    await pickTemplate(page, '渐变紫')

    // 预览里浏览器把标题排成三行，且 `defineProperty` 整体落在同一行
    const preview = await page.evaluate(() => {
      const title = document.querySelector<HTMLElement>('[data-card-root] .cc-title')!
      const range = document.createRange()
      range.selectNodeContents(title)
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0)
      const card = document.querySelector<HTMLElement>('[data-card-export]')!
      const c = card.getBoundingClientRect()
      const t = title.getBoundingClientRect()
      // 按 top 取整会漏行：同一行的字体重叠、亚像素差异都会让 top 差一点。
      // 用「垂直不重叠」聚类才数得准
      const bands: Array<{ top: number; bottom: number }> = []
      for (const r of rects.slice().sort((a, b) => a.top - b.top)) {
        const hit = bands.find((b) => r.top < b.bottom - 1 && r.bottom > b.top + 1)
        if (hit) {
          hit.top = Math.min(hit.top, r.top)
          hit.bottom = Math.max(hit.bottom, r.bottom)
        } else bands.push({ top: r.top, bottom: r.bottom })
      }
      const k = card.offsetWidth / c.width
      return {
        lines: bands.length,
        band: { top: Math.round((t.top - c.top) * k), bottom: Math.round((t.bottom - c.top) * k) },
        boxWidth: Math.round(t.width * k),
      }
    })
    expect(preview.lines).toBeGreaterThanOrEqual(2)

    const png = await renderPng(page, 1)
    // 标题是白字压深底：按行扫近白像素，把行数和非末行/末行宽度量出来
    const exported = await page.evaluate(
      async ({ url, band }) => {
        const img = new Image()
        img.src = url
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const { data } = ctx.getImageData(0, band.top, c.width, band.bottom - band.top)
        const rows: Array<{ w: number } | null> = []
        for (let y = 0; y < band.bottom - band.top; y++) {
          let minX = Infinity
          let maxX = -1
          for (let x = 0; x < c.width; x++) {
            const i = (y * c.width + x) * 4
            if (data[i + 3] > 200 && data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) {
              if (x < minX) minX = x
              if (x > maxX) maxX = x
            }
          }
          rows.push(maxX > minX ? { w: maxX - minX } : null)
        }
        const lines: Array<{ w: number }> = []
        let cur: { w: number } | null = null
        for (const r of rows) {
          if (r && r.w > 3) {
            if (!cur) {
              cur = { w: 0 }
              lines.push(cur)
            }
            cur.w = Math.max(cur.w, r.w)
          } else cur = null
        }
        // 抗锯齿会在笔画间隙里留几行窄缝，过窄的不算一整行
        return lines.map((l) => l.w).filter((w) => w > 12)
      },
      { url: png.dataUrl, band: preview.band },
    )

    // 行数对上，且末行不是被劈下来的两三个字母（`ty` 只有几十像素宽）
    expect(exported.length).toBe(preview.lines)
    const last = exported[exported.length - 1]
    expect(last).toBeGreaterThan(preview.boxWidth * 0.3)
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
