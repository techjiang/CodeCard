/**
 * 行末标点的处理：中文标点会被浏览器「悬挂」到行盒之外。
 *
 * 悬挂本身是对的（预览里也这样），错的是导出时按行盒宽度去切行 ——
 * 行盒不含悬挂出去的那个标点，贪心就多啃一个字，整段提前一行断，
 * 于是句号孤零零落在下一行，看起来像排错了。
 */
import { afterAll, describe, expect, test } from 'vitest'
import { closeBrowser, openApp, pickSize, pickTemplate, renderPng, seedCard } from './harness'

afterAll(closeBrowser)

/** 找出「整行只有一个标点」的行数：这是最扎眼的一种排错 */
function lonelyPunctuationLines(page: Awaited<ReturnType<typeof openApp>>, dataUrl: string, size: { w: number; h: number }) {
  return page.evaluate(
    async ({ url, w, h }) => {
      const img = new Image()
      img.src = url
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const { data } = ctx.getImageData(0, 0, c.width, c.height)
      const inkInRow = (y: number) => {
        let ink = 0
        for (let x = 0; x < w; x++) {
          const i = (y * c.width + x) * 4
          if (data[i + 3] > 200 && data[i] < 200) ink++
        }
        return ink
      }
      // 逐行扫，把连续有墨迹的行聚成一条文字行，再看它的水平跨度
      const lines: Array<{ top: number; bottom: number; minX: number; maxX: number }> = []
      let cur: { top: number; bottom: number; minX: number; maxX: number } | null = null
      for (let y = 0; y < h; y++) {
        let minX = -1
        let maxX = -1
        for (let x = 0; x < w; x++) {
          const i = (y * c.width + x) * 4
          if (data[i + 3] > 200 && data[i] < 200) {
            if (minX < 0) minX = x
            maxX = x
          }
        }
        if (minX >= 0) {
          cur ??= { top: y, bottom: y, minX, maxX }
          cur.bottom = y
          cur.minX = Math.min(cur.minX, minX)
          cur.maxX = Math.max(cur.maxX, maxX)
        } else if (cur) {
          if (cur.bottom - cur.top > 6) lines.push(cur)
          cur = null
        }
        void inkInRow
      }
      if (cur && cur.bottom - cur.top > 6) lines.push(cur)
      // 比一个汉字还窄、又不是纯横线的行 —— 只放得下一个标点
      return lines.filter((l) => l.maxX - l.minX < 40).length
    },
    { url: dataUrl, w: size.w, h: size.h },
  )
}

describe('行末标点不被挤到下一行', () => {
  test('引用的句号跟正文同一行', async () => {
    const page = await openApp()
    await pickSize(page, 'portrait')
    await pickTemplate(page, '森林绿')
    await seedCard(page, {
      type: 'knowledge',
      title: '拦截器',
      content: '用 Proxy 拦截对象的读写，比 Object.defineProperty 更彻底。\n\n- 可以监听新增属性\n\n> 代价是需要额外的 get/set 陷阱。',
    })

    const png = await renderPng(page, 1)
    const lonely = await lonelyPunctuationLines(page, png.dataUrl, { w: 1080, h: 1920 })
    expect(lonely, '有标点被单独挤到了一行').toBe(0)
  }, 120_000)

  test('正方形尺寸下也没有孤立标点行', async () => {
    const page = await openApp()
    await pickTemplate(page, '极简白')
    await seedCard(page, {
      type: 'knowledge',
      title: '排版',
      content: '浏览器的行末标点会悬挂到行盒之外，导出时按行盒宽度切行就会多吃一个字。\n\n> 结果就是句号孤零零地留在下一行。',
    })

    const png = await renderPng(page, 1)
    expect(await lonelyPunctuationLines(page, png.dataUrl, { w: 1080, h: 1080 })).toBe(0)
  }, 120_000)
})
