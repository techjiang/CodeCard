import { describe, expect, test, vi, beforeEach } from 'vitest'
import { canvasToBlob, renderElementToCanvas } from '@/utils/dom-to-image'

function mockCanvas() {
  const ctx = {
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    clip: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn((t: string) => ({ width: t.length * 10 })),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    set fillStyle(_v: string) {},
    set strokeStyle(_v: string) {},
    set lineWidth(_v: number) {},
    set font(_v: string) {},
    set textAlign(_v: string) {},
    set textBaseline(_v: string) {},
  }
  return ctx
}

describe('Export', () => {
  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCanvas()) as never
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(new Blob(['x'], { type: 'image/png' }))
    } as never
  })

  const makeRoot = () => {
    const root = document.createElement('div')
    root.style.width = '200px'
    root.style.height = '100px'
    const child = document.createElement('p')
    child.textContent = '中文 body'
    root.appendChild(child)
    document.body.appendChild(root)
    return root
  }

  test('导出 PNG 尺寸正确', async () => {
    const canvas = await renderElementToCanvas(makeRoot(), { scale: 1, width: 1080, height: 1080 })
    expect(canvas.width).toBe(1080)
    expect(canvas.height).toBe(1080)
  })

  test('2x 导出分辨率翻倍', async () => {
    const canvas = await renderElementToCanvas(makeRoot(), { scale: 2, width: 1080, height: 1080 })
    expect(canvas.width).toBe(2160)
    expect(canvas.height).toBe(2160)
  })

  test('3x 导出分辨率三倍', async () => {
    const canvas = await renderElementToCanvas(makeRoot(), { scale: 3, width: 600, height: 400 })
    expect([canvas.width, canvas.height]).toEqual([1800, 1200])
  })

  test('canvas 转 Blob', async () => {
    const canvas = document.createElement('canvas')
    const blob = await canvasToBlob(canvas)
    expect(blob.type).toBe('image/png')
  })
})
