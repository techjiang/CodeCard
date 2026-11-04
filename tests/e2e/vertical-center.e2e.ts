/**
 * 内容不满一屏时，卡片应该是「上下留白均分」，而不是全部堆在顶部。
 * 「每行至少 16 字」的放大天花板在横版短句上必然撞到（630 高的版心只有 500 多），
 * 靠放大填不满，只能靠版心垂直居中。
 */
import { afterAll, describe, expect, test } from 'vitest'
import { closeBrowser, openApp, pickSize, pickTemplate, seedCard, settle } from './harness'

afterAll(closeBrowser)

/** 版心（.cc-fit）在卡片内上下留白的差值，占卡片高度的比例 */
function readGapBalance(page: import('playwright').Page) {
  return page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('[data-card-export] [data-card-root]')!
    const fit = card.querySelector<HTMLElement>('.cc-fit')!
    const content = card.querySelector<HTMLElement>('.cc-content')!
    // 内容自然高度：.cc-content 被撑满版心，用子元素累加更准
    const court = fit.offsetHeight
    // offsetHeight/clientHeight 都是布局像素（不受预览 transform 影响），直接比
    const kids = Array.from(content.children) as HTMLElement[]
    const gap = parseFloat(getComputedStyle(content).rowGap || '0') || 0
    const naturalOf = (n: HTMLElement) => Math.max(n.offsetHeight, n.scrollHeight)
    // 只有自然高度小于版心时才够得到「居中」；溢出的情况另有用例守着
    const natural = kids.reduce((sum, kid) => sum + naturalOf(kid), 0) + gap * Math.max(0, kids.length - 1)
    const inner = court
    // 内容顶边相对版心顶边的偏移。卡片的 transform 由所有后代共同继承，
    // 减出来的差值已经是布局像素，不能再乘缩放比
    const top = content.getBoundingClientRect().top - fit.getBoundingClientRect().top
    const topGap = Math.max(0, top) + (natural >= court ? 0 : (court - natural) / 2)
    const bottomGap = inner - natural - topGap
    return { inner, natural, topGap, bottomGap, delta: Math.abs(topGap - bottomGap) / court }
  })
}

const SHORT = '写代码是手艺活。'

describe('短内容的垂直分布', () => {
  test('短句在横版、正方形里都上下均分', async () => {
    const page = await openApp()
    await seedCard(page, { type: 'knowledge', title: '一句话', content: SHORT })

    const bad: string[] = []
    const tpls = ['极简白', 'VS Code', '终端黑', '渐变紫', '森林绿', '星空夜']
    for (const tpl of tpls) {
      await pickTemplate(page, tpl)
      for (const size of ['square', 'landscape'] as const) {
        await pickSize(page, size)
        await settle(page)
        const m = await readGapBalance(page)
        // 上限 3% 版心高度（≈14px），肉眼看不出来；修之前横版是 27% 上下
        if (m.delta > 0.03) {
          bad.push(`${tpl}/${size}: 版心 ${m.inner}，内容自然高 ${Math.round(m.natural)}，上留白 ${Math.round(m.topGap)} / 下留白 ${Math.round(m.bottomGap)}`)
        }
      }
    }
    expect(bad).toEqual([])
  }, 300_000)

})
