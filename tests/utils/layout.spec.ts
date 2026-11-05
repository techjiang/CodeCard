import { beforeEach, describe, expect, test, vi } from 'vitest'
import { withMeasurableLayout } from '@/utils/layout'

/** jsdom 不做样式解析，display 由 data-display 决定 */
function el(tag = 'div', display = 'block'): HTMLElement {
  const node = document.createElement(tag)
  Object.defineProperty(node, 'dataset', { value: { display }, configurable: true })
  vi.spyOn(window, 'getComputedStyle').mockImplementation(((target: Element) => {
    const d = (target as HTMLElement).dataset?.display ?? 'block'
    return { display: d, paddingTop: '0px', paddingBottom: '0px' } as CSSStyleDeclaration
  }) as never)
  return node
}

function styleOf(node: HTMLElement): string {
  return node.style.cssText
}

beforeEach(() => {
  document.body.innerHTML = ''
  ;(window as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  }
})

describe('withMeasurableLayout', () => {
  test('祖先都正常显示时原样直接跑，不动任何样式', async () => {
    const pane = el()
    const card = el()
    pane.appendChild(card)
    document.body.appendChild(pane)
    const before = styleOf(pane)

    const result = await withMeasurableLayout(card, { width: 1080, height: 1080 }, async () => 'done')

    expect(result).toBe('done')
    expect(styleOf(pane)).toBe(before)
  })

  test('被 display:none 藏起来时临时支起来，跑完原样还原', async () => {
    const pane = el('section', 'none')
    const card = el()
    pane.appendChild(card)
    document.body.appendChild(pane)
    // 用户之前手动加过的内联样式不能在还原时丢掉
    pane.style.padding = '4px'
    const before = styleOf(pane)

    let seen: { display: string; position: string; width: string } | null = null
    await withMeasurableLayout(card, { width: 1080, height: 720 }, async () => {
      seen = {
        display: pane.style.display,
        position: pane.style.position,
        width: pane.style.width,
      }
      return null
    })

    expect(seen).toEqual({ display: 'block', position: 'fixed', width: '1080px' })
    expect(pane.style.height).toBe('')
    expect(styleOf(pane)).toBe(before)
  })

  test('run 抛错也要还原样式', async () => {
    const pane = el('section', 'none')
    const card = el()
    pane.appendChild(card)
    document.body.appendChild(pane)
    const before = styleOf(pane)

    await expect(
      withMeasurableLayout(card, { width: 100, height: 100 }, async () => {
        throw new Error('导出失败')
      }),
    ).rejects.toThrow('导出失败')

    expect(styleOf(pane)).toBe(before)
  })

  test('多层祖先都被藏起来时逐层支起来', async () => {
    const outer = el('section', 'none')
    const inner = el('div', 'none')
    const card = el()
    inner.appendChild(card)
    outer.appendChild(inner)
    document.body.appendChild(outer)

    let displays: string[] = []
    await withMeasurableLayout(card, { width: 390, height: 844 }, async () => {
      displays = [outer.style.display, inner.style.display]
      return null
    })

    expect(displays).toEqual(['block', 'block'])
    expect(outer.style.cssText).toBe('')
    expect(inner.style.cssText).toBe('')
  })
})
