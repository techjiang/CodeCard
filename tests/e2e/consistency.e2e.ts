/**
 * 导出的图不能跟着「预览缩放」变。
 *
 * 用户看到的卡片可能被预览区缩到 30%，也可能因为窗口够大而停在 100%。
 * 同一条内容、同一套模板，两种情况下导出的 PNG 应该逐像素一致 ——
 * 不一致就说明渲染器把「屏幕上的视觉尺寸」和「设计稿尺寸」混在一起用了。
 *
 * 历史教训：`collectWidth()` 读的是 `clientWidth`（布局像素），调用处又除了一次
 * 预览缩放，于是缩到 40% 时可用宽度被放大 2.5 倍，导出图每行比预览长得多。
 * 这条用例就是拿真实浏览器把当时的 bug 钉死。
 */
import { afterAll, describe, expect, test } from 'vitest'
import type { Page } from 'playwright'
import { closeBrowser, openApp, pickSize, pickTemplate, renderPng, seedCard, settle } from './harness'
import { TEMPLATES } from './fixtures'

afterAll(closeBrowser)

/** 走真实的「导出」链路，拿 Blob 转成 dataURL —— 顺手验一遍 useExport 那条路 */
function exportViaApp(page: Page, scale: 1 | 2 | 3) {
  return page.evaluate(async (s) => {
    const out = await (window as unknown as { __ccExport: (s: number) => Promise<{ blob: Blob; width: number; height: number }> }).__ccExport(s)
    const buf = await out.blob.arrayBuffer()
    let bytes = ''
    for (const b of new Uint8Array(buf)) bytes += String.fromCharCode(b)
    return { width: out.width, height: out.height, dataUrl: `data:image/png;base64,${btoa(bytes)}` }
  }, scale)
}

/** 两张图有多少像素肉眼可见地不一样 */
function diffRatio(page: Page, a: string, b: string) {
  return page.evaluate(
    async ([urlA, urlB]) => {
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
      const [da, db] = await Promise.all([load(urlA), load(urlB)])
      if (da.length !== db.length) return 1
      let diff = 0
      for (let i = 0; i < da.length; i += 4) {
        if (Math.abs(da[i] - db[i]) > 40 || Math.abs(da[i + 1] - db[i + 1]) > 40 || Math.abs(da[i + 2] - db[i + 2]) > 40) diff++
      }
      return diff / (da.length / 4)
    },
    [a, b],
  )
}

/**
 * 把预览缩放顶到 1，同时保证卡片整块可见。
 * 视口要够大：卡片 1080 宽，预览区还得放下两侧面板的边距。
 */
async function pinPreviewToOne(page: Page) {
  await page.addStyleTag({
    content: `
      .pane--left, .pane--right, .topbar { display: none !important; }
      .workspace { grid-template-columns: minmax(0, 1fr) !important; }
      .preview-host { overflow: visible !important; padding: 0 !important; align-items: flex-start !important; }
      .preview-stage { width: 2240px !important; height: 2240px !important; }
      .preview-card { transform: none !important; }
    `,
  })
  await settle(page)
}

describe('导出与预览缩放无关', () => {
  test('同一张卡片，预览缩小与 100% 导出的像素一致', async () => {
    const page = await openApp()
    await seedCard(page, {
      type: 'knowledge',
      title: '缩放无关',
      content: '用 `Proxy` 拦截对象的读写，比 Object.defineProperty 更彻底。\n\n- 可以监听新增属性\n- 可以监听数组下标',
    })
    await pickTemplate(page, '森林绿')

    const scaled = await renderPng(page, 1)
    await pinPreviewToOne(page)
    const unscaled = await renderPng(page, 1)

    expect([scaled.width, scaled.height]).toEqual([unscaled.width, unscaled.height])
    const ratio = await diffRatio(page, scaled.dataUrl, unscaled.dataUrl)
    // 字体渲染有亚像素差异，允许极少量像素不同；排版错了会是大片不同（历史上是 5%）
    expect(ratio, '预览缩放影响了导出排版').toBeLessThan(0.005)
  }, 120_000)

  test('12 套模板 × 3 种尺寸：导出都不受预览缩放影响', async () => {
    const page = await openApp()
    const seed = {
      type: 'knowledge' as const,
      title: '全模板',
      content: '用 `Proxy` 拦截对象的读写，比 Object.defineProperty 更彻底。\n\n- 可以监听新增属性\n\n> 代价是需要额外的 get/set 陷阱。',
      tags: ['Vue', '响应式'],
    }

    const failures: string[] = []
    /** 每一轮都从「有缩放」的现场重新开始：上一次为了对图把预览顶到了 1 */
    const reset = async (size: 'square' | 'landscape' | 'portrait', tpl: string) => {
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForSelector('[data-card-export] [data-card-root]')
      await pickSize(page, size)
      await pickTemplate(page, tpl)
      await seedCard(page, seed)
    }

    for (const tpl of TEMPLATES) {
      await reset('square', tpl.name)
      const scaled = await renderPng(page, 1)
      await pinPreviewToOne(page)
      const unscaled = await renderPng(page, 1)
      const ratio = await diffRatio(page, scaled.dataUrl, unscaled.dataUrl)
      if (ratio >= 0.01) failures.push(`${tpl.name}/square: ${(ratio * 100).toFixed(1)}%`)
    }
    for (const size of ['landscape', 'portrait'] as const) {
      await reset(size, '森林绿')
      const scaled = await renderPng(page, 1)
      await pinPreviewToOne(page)
      const unscaled = await renderPng(page, 1)
      const ratio = await diffRatio(page, scaled.dataUrl, unscaled.dataUrl)
      if (ratio >= 0.01) failures.push(`森林绿/${size}: ${(ratio * 100).toFixed(1)}%`)
    }
    expect(failures, `这些组合的导出图随预览缩放变了：\n${failures.join('\n')}`).toEqual([])
  }, 600_000)
})

describe('手机端导出', () => {
  test('停在「内容」Tab 上导出，拿到的不是空白图', async () => {
    const page = await openApp({ width: 390, height: 844 })
    await seedCard(page, { type: 'knowledge', title: '手机导出', content: '在手机上直接点导出，不用先切到预览。' })

    // 默认就停在「内容」Tab，卡片所在面板此时是 display: none
    const hidden = await page.evaluate(
      () => getComputedStyle(document.querySelector('.pane--center')!).display,
    )
    expect(hidden).toBe('none')

    const png = await exportViaApp(page, 1)
    expect([png.width, png.height]).toEqual([1080, 1080])
    const stats = await page.evaluate(async (url) => {
      const img = new Image()
      img.src = url
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const { data } = ctx.getImageData(0, 0, c.width, c.height)
      let opaque = 0
      for (let i = 3; i < data.length; i += 4) if (data[i] > 250) opaque++
      return opaque / (data.length / 4)
    }, png.dataUrl)
    // 空白图是 0：整张画布一个像素都没画上去
    expect(stats, '停在其它 Tab 上导出得到的是空白图').toBeGreaterThan(0.9)
  }, 120_000)

  test('三种 Tab 下导出结果一致', async () => {
    const page = await openApp({ width: 390, height: 844 })
    await seedCard(page, { type: 'knowledge', title: '手机导出', content: '在手机上直接点导出，不用先切到预览。\n\n- 也不用等它显示' })

    const fromContent = await exportViaApp(page, 1)
    await page.click('.mobile-tabs button:has-text("样式")')
    await settle(page)
    const fromStyle = await exportViaApp(page, 1)
    await page.click('.mobile-tabs button:has-text("预览")')
    await settle(page)
    const fromPreview = await exportViaApp(page, 1)

    expect(await diffRatio(page, fromContent.dataUrl, fromPreview.dataUrl)).toBeLessThan(0.005)
    expect(await diffRatio(page, fromStyle.dataUrl, fromPreview.dataUrl)).toBeLessThan(0.005)
  }, 120_000)
})
