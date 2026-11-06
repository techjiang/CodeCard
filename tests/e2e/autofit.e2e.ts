/**
 * 自适应缩放：只能在真浏览器里验。
 * jsdom 的 measureText 恒返回 0 宽，useAutoFit 在那里测出来全是假的。
 */
import { afterAll, describe, expect, test } from 'vitest'
import { closeBrowser, openApp, pickSize, pickTemplate, readMetrics, seedCard, settle } from './harness'
import { TEMPLATES, SIZES, longProse } from './fixtures'

/** 一行就能放下，放大主要由卡片高度决定 */
const QUOTE_SHORT = '写代码是手艺活。'

afterAll(closeBrowser)

const SIZE_KEYS = ['square', 'landscape', 'portrait'] as const

describe('自适应缩放', () => {
  test('长文在 12 套模板 × 3 种尺寸下都不被裁', async () => {
    const page = await openApp()
    await seedCard(page, { type: 'knowledge', title: '自适应缩放', content: longProse(8) })

    const failures: string[] = []
    for (const size of SIZE_KEYS) {
      await pickSize(page, size)
      for (const tpl of TEMPLATES) {
        await pickTemplate(page, tpl.name)
        const m = await readMetrics(page)
        const label = `${tpl.name}/${size}`
        if (m.width !== SIZES[size].width || m.height !== SIZES[size].height) {
          failures.push(`${label}: 卡片尺寸 ${m.width}×${m.height}`)
        }
        if (m.overflowLines > 0) failures.push(`${label}: ${m.overflowLines} 行文本溢出右边框`)
        // 容器裁掉的高度最多容忍一行（行末悬挂标点会被浏览器算到行盒外）
        if (m.contentScrollHeight > m.contentClientHeight + m.bodyFontSize * 2) {
          failures.push(`${label}: 内容 ${m.contentScrollHeight} > 容器 ${m.contentClientHeight}，被裁了`)
        }
      }
    }
    expect(failures).toEqual([])
  }, 300_000)

  test('横版空间紧张时字号真的缩下去了', async () => {
    const page = await openApp()
    await seedCard(page, { type: 'knowledge', title: '自适应缩放', content: longProse(3) })
    await pickSize(page, 'square')
    const square = await readMetrics(page)
    await pickSize(page, 'landscape')
    const landscape = await readMetrics(page)
    // 630 高塞下 1080 高塞得下的内容，字号必须变小，否则就是没缩
    expect(landscape.bodyFontSize).toBeLessThan(square.bodyFontSize)
  }, 60_000)

  test('内容太少时字号放大，但不超过每行最少字数', async () => {
    const page = await openApp()
    await seedCard(page, { type: 'knowledge', title: '短内容', content: QUOTE_SHORT })
    await pickSize(page, 'square')
    const square = await readMetrics(page)
    await pickSize(page, 'portrait')
    const portrait = await readMetrics(page)

    // 小字打底的模板（默认 md = 36px）在正方形下就该被放大了
    expect(square.bodyFontSize).toBeGreaterThan(36)
    // 放大上限受「每行至少 16 字」约束，短句在正方形里就已经顶到天花板
    expect(portrait.bodyFontSize).toBeGreaterThanOrEqual(square.bodyFontSize)
    expect(portrait.bodyFontSize).toBeLessThanOrEqual(square.bodyFontSize * 1.05)
  }, 60_000)

  test('长标识符不在中间被劈开', async () => {
    const page = await openApp()
    await seedCard(page, {
      type: 'knowledge',
      title: '长标识符',
      content: 'Vue 3 用 Object.defineProperty 的替代方案是 Proxy，长一点再来一个 __VUE_REACTIVE_EFFECT_FLAGS__ 和 requestAnimationFrameCallback。',
    })
    await pickSize(page, 'portrait')

    const broken = await page.evaluate(() => {
      const md = document.querySelector<HTMLElement>('.md')!
      const walker = document.createTreeWalker(md, NodeFilter.SHOW_TEXT)
      const bad: string[] = []
      let node: Node | null
      while ((node = walker.nextNode())) {
        const text = node.textContent ?? ''
        for (const token of ['Object.defineProperty', '__VUE_REACTIVE_EFFECT_FLAGS__', 'requestAnimationFrameCallback']) {
          if (text.includes(token)) continue
          // 出现前缀但前缀在行尾、后缀在下一行 -> 被劈开了
          const head = token.slice(0, Math.ceil(token.length / 2))
          const tail = token.slice(Math.ceil(token.length / 2))
          if (text.endsWith(head) && text !== token) bad.push(token)
          if (text.startsWith(tail) && text !== token) bad.push(token)
        }
      }
      return bad
    })
    expect(broken).toEqual([])
  }, 60_000)

  /**
   * 填不满就是字太小。
   *
   * 旧实现在「缩到能放下」的第一档就收手，横版六段只用到 59% 的版心高度，
   * 字号 11px —— 卡片看着像被缩印过。二分补回来之后应当稳定在 85% 以上。
   *
   * 段落长短要错开：等长段落会在某个字号上「全体同时换行」，字号是整数，
   * 跨不过去的那一档只能留白，那是量化瓶颈不是算法问题。
   *
   * 一段话不进这条 —— 它会被「每行至少 16 字」挡住，宁可留白也不排成一列字。
   */
  test('内容放下之后还会往上补，版心利用率不低于 85%', async () => {
    const page = await openApp()
    const vars = (n: number) =>
      Array.from({ length: n }, (_, i) => `第 ${i + 1} 段：${longProse(1).slice(0, 20 + i * 13)}`).join('\n\n')
    for (const n of [2, 4, 6, 10]) {
      await seedCard(page, { type: 'knowledge', title: '填充率', content: vars(n) })
      await pickSize(page, 'landscape')
      await settle(page)
      const used = await page.evaluate(() => {
        const content = document.querySelector<HTMLElement>('.cc-content')!
        const box = content.getBoundingClientRect()
        const range = document.createRange()
        range.selectNodeContents(content)
        const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0)
        if (!rects.length) return 0
        const top = rects.reduce((m, r) => Math.min(m, r.top), Number.POSITIVE_INFINITY)
        const bottom = rects.reduce((m, r) => Math.max(m, r.bottom), 0)
        // 版心高度里真正被字占了多少
        return (box.height - Math.max(0, top - box.top) - Math.max(0, box.bottom - bottom)) / box.height
      })
      expect(used, `${n} 段只用了 ${(used * 100).toFixed(0)}%`).toBeGreaterThan(0.85)
    }
  }, 120_000)

  test('等长段落遇到字号量化瓶颈时也不溢出', async () => {
    // 六段等长：13px 各行一行、14px 全体换两行，中间没有可用档位，只能留白 ——
    // 但绝不允许为了填满而撑出卡片。
    const page = await openApp()
    await seedCard(page, { type: 'knowledge', title: '量化', content: longProse(6) })
    await pickSize(page, 'landscape')
    await settle(page)
    const m = await readMetrics(page)
    expect(m.contentScrollHeight).toBeLessThanOrEqual(m.contentClientHeight + 2)
    expect(m.overflowLines).toBe(0)
  }, 60_000)

  test('改内容后自适应会重新收敛，不会停在上一档', async () => {
    const page = await openApp()
    await seedCard(page, { type: 'knowledge', title: '收敛', content: '短句。' })
    await pickSize(page, 'landscape')
    const short = await readMetrics(page)

    await page.fill('#cc-content', longProse(6))
    await settle(page)
    const long = await readMetrics(page)

    expect(long.bodyFontSize).toBeLessThan(short.bodyFontSize)
    expect(long.contentScrollHeight).toBeLessThanOrEqual(long.contentClientHeight + long.bodyFontSize * 2)
  }, 60_000)
})
