/**
 * 样式自定义（圆角 / 透明度 / 水印）在导出图里到底生效没有。
 *
 * 之前所有导出用例都跑在默认样式下，配置面板改完之后导出成什么样没人验过 ——
 * 结果就是「圆角、透明度、水印」整组开关点了完全没反应，测试全绿。
 */
import { afterAll, describe, expect, test } from 'vitest'
import {
  cardComputedStyle,
  closeBrowser,
  clickRadius,
  enableWatermark,
  inspectImage,
  layerCoverage,
  openApp,
  pickTemplate,
  renderPng,
  seedCard,
  setBackgroundOpacity,
  settle,
} from './harness'
import { KNOWLEDGE_MD } from './fixtures'

afterAll(closeBrowser)

/**
 * 用例之间必须清 localStorage。
 * 应用每次打开都会读本地设置，同一个浏览器上下文里上一条用例改过的样式会漏到下一条
 * （曾经就因此让「0% 透明」的断言拿到 100% 的样式）。
 */
async function freshApp() {
  const page = await openApp()
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('[data-card-export] [data-card-root]')
  await settle(page)
  return page
}

/** 右下角那块区域的墨迹占比：水印就画在这儿 */
function cornerInk(page: Awaited<ReturnType<typeof openApp>>, dataUrl: string) {
  return page.evaluate(async (url) => {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(canvas.width - 150, canvas.height - 90, 140, 70)
    let ink = 0
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 20 && data[i] < 200) ink++
    return ink / (data.length / 4)
  }, dataUrl)
}

describe('导出：样式自定义', () => {
  test('圆角 0px 时四角铺满，24px 时四角让出去', async () => {
    const page = await freshApp()
    await seedCard(page, { type: 'knowledge', title: '圆角', content: KNOWLEDGE_MD })
    await pickTemplate(page, '极简白')

    await clickRadius(page, 0)
    // 先确认配置真的落到了卡片上：面板静默失败时这里就是第一道警报
    expect((await cardComputedStyle(page)).borderRadius).toBe('0px')
    // 改模板和改圆角是两次渲染，导出前多等一拍，别截到还没落地的中间态
    await settle(page)
    const square = await inspectImage(page, (await renderPng(page, 1)).dataUrl)
    expect(square.corners.every((c) => c[3] > 250), '0px 圆角时四角应该不透明').toBe(true)

    await settle(page)
    await clickRadius(page, 24)
    expect((await cardComputedStyle(page)).borderRadius).toBe('24px')
    // 24px 圆角在 1080 的画布上只切掉一小块，1x 回读只有几个像素，量不准；
    // 3x 下一次裁掉 72px，回读才稳
    const round = await inspectImage(page, (await renderPng(page, 3)).dataUrl)
    expect(round.corners.every((c) => c[3] < 10), '24px 圆角时四角应该被切掉').toBe(true)
  }, 120_000)

  test('背景透明度 0% 时底色真的透明，100% 时铺满', async () => {
    const page = await freshApp()
    await seedCard(page, { type: 'knowledge', title: '透明度', content: KNOWLEDGE_MD })
    await pickTemplate(page, '极简白')

    await setBackgroundOpacity(page, 100)
    expect((await cardComputedStyle(page)).backgroundColor).toBe('rgb(255, 255, 255)')
    await settle(page)
    const opaque = await layerCoverage(page, (await renderPng(page, 1)).dataUrl)
    expect(opaque.bright, '100% 时整张卡都是白底').toBeGreaterThan(0.9)

    await setBackgroundOpacity(page, 0)
    expect((await cardComputedStyle(page)).backgroundColor).toBe('rgba(255, 255, 255, 0)')
    await settle(page)
    const clear = await layerCoverage(page, (await renderPng(page, 1)).dataUrl)
    // 白底没了，只剩字：亮像素应该掉下去，暗像素还在（说明不是整张空掉）
    expect(clear.bright, '0% 时白底应该消失').toBeLessThan(0.3)
    expect(clear.dark, '0% 时正文还在').toBeGreaterThan(0.005)
  }, 120_000)

  test('水印文字真的画进导出图右下角', async () => {
    const page = await freshApp()
    await seedCard(page, { type: 'knowledge', title: '水印', content: KNOWLEDGE_MD })
    await pickTemplate(page, '极简白')
    await settle(page)

    const before = await cornerInk(page, (await renderPng(page, 1)).dataUrl)
    await enableWatermark(page, '@cosc')
    await settle(page)
    const after = await cornerInk(page, (await renderPng(page, 1)).dataUrl)

    expect(after, '水印区域导出后应该有字').toBeGreaterThan(before + 0.01)
  }, 120_000)
})
