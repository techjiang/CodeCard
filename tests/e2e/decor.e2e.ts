/**
 * 装饰层：模板里的 SVG 装饰必须真的画出来。
 *
 * 前几轮盯的都是文字、自适应、圆角、边框 —— 装饰线不在任何一份清单上。
 * 而 SVG 属性里写百分比（`M0 62% L 100% 42%`）浏览器直接判语法错、整条路径长度 0，
 * 控制台只留一句 `<path> attribute d: Expected number`，卡片照样能导出、测试照样全绿。
 */
import { afterAll, describe, expect, test } from 'vitest'
import { closeBrowser, openApp, pickTemplate, renderPng, settle } from './harness'
import { TEMPLATES } from './fixtures'

afterAll(closeBrowser)

/** 浏览器解析后的真实几何：长度 0 就是没画出来 */
function decorPathLengths(page: Awaited<ReturnType<typeof openApp>>) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-card-root] svg.decor path')).map((p) => {
      let length = 0
      try {
        length = p.getTotalLength()
      } catch {
        length = 0
      }
      return { d: p.getAttribute('d') ?? '', length: Math.round(length) }
    }),
  )
}

describe('装饰层：SVG 路径', () => {
  test('12 套模板的装饰路径全部有几何长度，没有语法错', async () => {
    const page = await openApp()
    const syntaxErrors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error' && /attribute .* Expected/.test(m.text())) syntaxErrors.push(m.text())
    })

    const broken: string[] = []
    for (const tpl of TEMPLATES) {
      await pickTemplate(page, tpl.name)
      const paths = await decorPathLengths(page)
      for (const p of paths) {
        if (p.length <= 0) broken.push(`${tpl.name}: d="${p.d}"`)
      }
    }

    expect(syntaxErrors, `浏览器报了 SVG 语法错：\n${syntaxErrors.join('\n')}`).toEqual([])
    expect(broken, `这些装饰路径长度 0，等于没画：\n${broken.join('\n')}`).toEqual([])
  })

  test('装饰真的进了导出图：摘掉装饰后像素必须变', async () => {
    const page = await openApp()
    // 极客蓝的装饰是右上一组同心圆 + 一条渐变曲线，面积大，摘掉最容易被像素抓到
    await pickTemplate(page, '极客蓝')
    const withDecor = await renderPng(page, 1)
    await page.evaluate(() => {
      document.querySelectorAll('[data-card-root] svg.decor').forEach((el) => el.remove())
    })
    await settle(page, 300)
    const withoutDecor = await renderPng(page, 1)

    const diff = await page.evaluate(
      async ([a, b]) => {
        const load = async (url: string) => {
          const img = new Image()
          img.src = url
          await img.decode()
          const c = document.createElement('canvas')
          c.width = img.naturalWidth
          c.height = img.naturalHeight
          c.getContext('2d')!.drawImage(img, 0, 0)
          return c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
        }
        const [da, db] = await Promise.all([load(a), load(b)])
        let changed = 0
        for (let i = 0; i < da.length; i += 4) {
          if (Math.abs(da[i] - db[i]) > 6 || Math.abs(da[i + 1] - db[i + 1]) > 6 || Math.abs(da[i + 2] - db[i + 2]) > 6) changed++
        }
        return changed / (da.length / 4)
      },
      [withDecor.dataUrl, withoutDecor.dataUrl] as [string, string],
    )

    expect(diff, '导出图里装饰层没有任何痕迹 —— 它根本没被画进去').toBeGreaterThan(0.01)
  })
})
