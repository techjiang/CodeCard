import { beforeEach, describe, expect, test, vi } from 'vitest'

const calls: Array<{ scale: number; type?: string; quality?: number }> = []

vi.mock('@/utils/dom-to-image', () => ({
  renderElementToCanvas: vi.fn(async (_el: unknown, opts: { scale: number }) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1080
    return canvas
  }),
  canvasToBlob: vi.fn(async (_c: HTMLCanvasElement, type?: string, quality?: number) => {
    calls.push({ scale: 1, type, quality })
    return new Blob(['fake'], { type: type ?? 'image/png' })
  }),
}))

class FakeReader {
  result = 'data:image/jpeg;base64,AAAA'
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  readAsDataURL() {
    queueMicrotask(() => this.onload?.())
  }
}

describe('导出 SVG', () => {
  beforeEach(() => {
    calls.length = 0
    vi.stubGlobal('FileReader', FakeReader)
  })

  test('内嵌 JPEG 而不是 PNG：渐变大图 PNG 要 990KB，JPEG 只要 160KB', async () => {
    const { renderElementToSvg } = await import('@/utils/svg-export')
    await renderElementToSvg({ element: document.createElement('div'), width: 1080, height: 1080, scale: 2 })
    expect(calls[0].type).toBe('image/jpeg')
    expect(calls[0].quality).toBe(0.94)
  })

  test('根节点尺寸是设计尺寸，不乘倍率', async () => {
    const { renderElementToSvg } = await import('@/utils/svg-export')
    const svg = await renderElementToSvg({ element: document.createElement('div'), width: 1200, height: 630, scale: 3 })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('width="1200" height="630"')
    expect(svg).toContain('viewBox="0 0 1200 630"')
    // 位图按倍率画，但落回设计尺寸
    expect(svg).toContain('width="1200" height="630" preserveAspectRatio="none"')
  })

  test('透明区被压到白底上：JPEG 没有 alpha，不合成会变黑', async () => {
    const { renderElementToSvg } = await import('@/utils/svg-export')
    const fillRect = vi.fn()
    const drawImage = vi.fn()
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string) {
      if (id !== '2d') return null
      return { fillStyle: '', fillRect, drawImage } as unknown as CanvasRenderingContext2D
    } as typeof HTMLCanvasElement.prototype.getContext
    try {
      await renderElementToSvg({ element: document.createElement('div'), width: 1080, height: 1080, scale: 1 })
    } finally {
      HTMLCanvasElement.prototype.getContext = original
    }
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1080, 1080)
    expect(drawImage).toHaveBeenCalled()
  })

  test('href 与 xlink:href 同时写，老渲染器也认', async () => {
    const { renderElementToSvg } = await import('@/utils/svg-export')
    const svg = await renderElementToSvg({ element: document.createElement('div'), width: 1080, height: 1080, scale: 1 })
    expect(svg).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"')
    expect(svg).toContain('xlink:href="data:image/jpeg;base64,')
    expect(svg).toContain(' href="data:image/jpeg;base64,')
  })
})
