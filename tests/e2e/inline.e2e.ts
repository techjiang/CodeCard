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

  test('正文里的断点是零宽空格，不是成片的 <wbr> 与空文本节点', async () => {
    const page = await openApp()
    await seedCard(page, { type: 'knowledge', title: '断点', content: RICH_MD })
    await pickTemplate(page, '终端黑')

    const dom = await page.evaluate(() => {
      const p = document.querySelector<HTMLElement>('[data-card-export] .md-p')!
      const textNodes = Array.from(p.childNodes).filter((n): n is Text => n.nodeType === Node.TEXT_NODE)
      return {
        wbr: p.querySelectorAll('wbr').length,
        // 空的文本节点导出时要逐个去量行盒，是白掉帧的碎片
        emptyText: textNodes.filter((n) => !(n.textContent ?? '').trim()).length,
        textNodes: textNodes.length,
        hasZwsp: (p.textContent ?? '').includes('\u200B'),
      }
    })
    expect(dom.wbr).toBe(0)
    expect(dom.hasZwsp).toBe(true)
    // 空节点只要不是主体就行；纯文本体量远超它们，说明模板没被缩进空白淹掉
    expect(dom.emptyText).toBeLessThan(dom.textNodes)
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
    // 导出不再垫白底；圆角只切掉边上几十个像素，左边不该留整条空白
    expect(pixels.transparent.left).toBeLessThan(0.05)
    expect(pixels.inkRatio).toBeGreaterThan(0.05)
  }, 60_000)
})

/**
 * 段里夹着行内元素时，样式必须落到导出图上。
 *
 * 翻车现场：导出器曾按「整块一个样式」绘制段落，`**读取**` 的加粗、
 * `Proxy` 的等宽字体、行内代码的灰底在导出图里全没了 —— 预览是对的，导出是灰的。
 * 单测里拿到的只是同一段纯文本，压根看不出差别，所以这条只能在这里验。
 */
describe('导出：行内元素的样式', () => {
  test('加粗词更亮、行内代码有底色，不是整段一个样子', async () => {
    const page = await openApp()
    await seedCard(page, { type: 'knowledge', title: '样式', content: '可以拦截**读取**和 `Proxy` 两处' })
    await pickTemplate(page, '渐变紫')
    const boxes = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>('[data-card-export]')!
      const c = card.getBoundingClientRect()
      const k = card.offsetWidth / c.width
      const rel = (sel: string) => {
        const r = document.querySelector<HTMLElement>(sel)!.getBoundingClientRect()
        return { x: Math.round((r.left - c.left) * k), y: Math.round((r.top - c.top) * k), w: Math.round(r.width * k), h: Math.round(r.height * k) }
      }
      return { strong: rel('.md strong'), code: rel('.md-code'), plain: rel('.md p') }
    })
    const png = await renderPng(page, 1)
    const stats = await page.evaluate(
      async ({ url, boxes }) => {
        const img = new Image()
        img.src = url
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        /** 一块区域的平均亮度 */
        const lum = (b: { x: number; y: number; w: number; h: number }) => {
          const d = ctx.getImageData(b.x, b.y, Math.max(1, b.w), Math.max(1, b.h)).data
          let sum = 0
          for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
          return sum / (d.length / 4)
        }
        return { strong: lum(boxes.strong), code: lum(boxes.code), plain: lum(boxes.plain) }
      },
      { url: png.dataUrl, boxes },
    )
    // 行内代码那块压了层灰底，平均亮度必须跟正文拉开
    expect(Math.abs(stats.code - stats.plain), `code=${stats.code} plain=${stats.plain}`).toBeGreaterThan(2)
  }, 60_000)

  /**
   * 行内代码跨行时，两行字都得画出来，且不能把词劈开。
   *
   * 翻车现场：`Object.defineProperty` 被断成两行，收集阶段只得到一整段文字
   * 却有两条行盒，第二行拿不到自己的字，导出图上直接空着。
   */
  test('跨行的行内代码两行都画得出来，且不从词中间劈开', async () => {
    const page = await openApp()
    // 长到必然换行，且中间是可断的零宽断点
    await seedCard(page, {
      type: 'knowledge',
      title: '跨行',
      content:
        '这一段是刻意写长的：前面先铺垫一串足够多的中文，把这个行内代码 `Object.defineProperty` 挤到行末再折到下一行，' +
        '这样才能验到跨行时第二行有没有画出来。后半段继续凑字数，确保它真的会换行，而不是被自适应放大到一行里塞下。',
    })
    await pickTemplate(page, '极简白')
    const rows = await page.evaluate(() => {
      const code = document.querySelector<HTMLElement>('.md-code')!
      const range = document.createRange()
      range.selectNodeContents(code)
      return Array.from(range.getClientRects()).filter((r) => r.width > 0).length
    })
    expect(rows).toBeGreaterThanOrEqual(2)

    const png = await renderPng(page, 2)
    const painted = await page.evaluate(
      async ({ url, rows }) => {
        const code = document.querySelector<HTMLElement>('.md-code')!
        const card = document.querySelector<HTMLElement>('[data-card-export]')!
        const c = card.getBoundingClientRect()
        const k = (card.offsetWidth / c.width) * 2
        const range = document.createRange()
        range.selectNodeContents(code)
        const boxes = Array.from(range.getClientRects())
          .filter((r) => r.width > 0 && r.height > 0)
          .map((r) => ({
            x: Math.round((r.left - c.left) * k),
            y: Math.round((r.top - c.top) * k),
            w: Math.round(r.width * k),
            h: Math.round(r.height * k),
          }))
        const img = new Image()
        img.src = url
        await img.decode()
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        // 每一行行盒里都得有笔画：全白说明这一行什么都没画
        return boxes.map((b) => {
          const d = ctx.getImageData(b.x, b.y, b.w, b.h).data
          let dark = 0
          for (let i = 0; i < d.length; i += 4) if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 140) dark++
          return dark / (b.w * b.h)
        })
      },
      { url: png.dataUrl, rows },
    )
    expect(painted.length).toBe(rows)
    for (const [i, ink] of painted.entries()) {
      expect(ink, `第 ${i + 1} 行是空的`).toBeGreaterThan(0.01)
    }
  }, 60_000)
})
