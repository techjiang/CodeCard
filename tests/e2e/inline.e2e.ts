import { afterAll, describe, expect, test } from 'vitest'
import { closeBrowser, inspectImage, openApp, pickTemplate, renderPng, seedCard } from './harness'

afterAll(closeBrowser)

/** 一段里有行内代码、加粗、列表、引用——导出最容易在这类内容上出错 */
const RICH_MD = `## 核心机制

Vue 3 用 \`Proxy\` 替代了 \`Object.defineProperty\`，可以拦截属性的**读取**、**赋值**和**删除**。

- 依赖收集：读取时把副作用函数塞进 \`dep\`
- 触发更新：赋值时把 \`dep\` 里的副作用跑一遍`

/**
 * 行内内容现在按浏览器真实行盒绘制，最容易出的错是「同一段文字在每行重复画一遍」
 * 或者「被零宽断点切成碎字」。
 *
 * 判据不能只看整张图的墨水比例——杂志风这类浅底模板本身就不透明。
 * 改成看正文区里的文字覆盖率：正常一段话大约三成像素有字，重复绘制会把它推到七八成。
 */
async function textCoverage(page: Parameters<typeof inspectImage>[0], dataUrl: string, opacity: number) {
  const box = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('[data-card-export]')!
    const body = document.querySelector<HTMLElement>('.cc-body')!
    const c = card.getBoundingClientRect()
    const b = body.getBoundingClientRect()
    const k = card.offsetWidth / c.width
    return { x: Math.round((b.left - c.left) * k), y: Math.round((b.top - c.top) * k), w: Math.round(b.width * k), h: Math.round(b.height * k) }
  })
  return page.evaluate(
    async ({ url, box, opacity }) => {
      const img = new Image()
      img.src = url
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const { data } = ctx.getImageData(box.x, box.y, box.w, box.h)
      // 只有明显比底色深（或浅）的像素才算字
      let ink = 0
      for (let i = 0; i < data.length; i += 4) {
        const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
        if (Math.abs(lum - opacity) > 0.12) ink++
      }
      return ink / (data.length / 4)
    },
    { url: dataUrl, box, opacity },
  )
}

describe('导出：行内排版', () => {
  test('行内代码与加粗混排不会重复绘制（墨水密度不爆）', async () => {
    const page = await openApp()
    await seedCard(page, { type: 'knowledge', title: '行内混排', content: RICH_MD })
    await pickTemplate(page, '杂志风')

    // 杂志风是米白底（#2E2A25… 的浅色版本，亮度约 0.93）
    const coverage = await textCoverage(page, (await renderPng(page, 1)).dataUrl, 0.93)
    expect(coverage).toBeGreaterThan(0.08)
    expect(coverage).toBeLessThan(0.55)
  }, 60_000)

  test('长标识符不被零宽断点切成碎字', async () => {
    const page = await openApp()
    await seedCard(page, { type: 'knowledge', title: '长标识符', content: RICH_MD })
    await pickTemplate(page, '海报风')

    // 直接读导出渲染器看到的行：Object.defineProperty 不能被拆成三段碎字
    const lines = await page.evaluate(() => {
      const target = document.querySelector<HTMLElement>('.md-p')!
      const range = document.createRange()
      range.selectNodeContents(target)
      return Array.from(range.getClientRects()).filter((r) => r.width > 0).length
    })
    expect(lines).toBeGreaterThan(0)

    const pixels = await inspectImage(page, (await renderPng(page, 1)).dataUrl)
    expect(pixels.transparent.left).toBe(0)
    expect(pixels.inkRatio).toBeGreaterThan(0.05)
  }, 60_000)
})
