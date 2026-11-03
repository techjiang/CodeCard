import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useExport } from '@/composables/useExport'
import { DEFAULT_CARD, DEFAULT_STYLE } from '@/types/card'

function stubCanvas() {
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'measureText') return (s: string) => ({ width: s.length * 8 })
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop: () => {} })
        return () => {}
      },
      set: () => true,
    },
  )
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['png'], { type: 'image/png' }))
  } as never
  if (typeof URL.createObjectURL !== 'function') {
    Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true })
  }
}

describe('导出流程', () => {
  beforeEach(() => {
    stubCanvas()
  })

  const setup = () => {
    const store = useExport()
    const el = document.createElement('div')
    document.body.appendChild(el)
    store.register({ element: el, card: { ...DEFAULT_CARD }, style: { ...DEFAULT_STYLE } })
    return store
  }

  test('导出 PNG 产出正确尺寸与文件名', async () => {
    const store = setup()
    const result = await store.exportPng(1)
    expect(result?.width).toBe(1080)
    expect(result?.height).toBe(1080)
    expect(result?.filename).toMatch(/_(\d{8})\.png$/)
    expect(store.exporting.value).toBe(false)
  })

  test('2x 导出分辨率翻倍', async () => {
    const store = setup()
    const result = await store.exportPng(2)
    expect([result?.width, result?.height]).toEqual([2160, 2160])
  })

  test('未挂载时导出给出错误提示', async () => {
    const store = useExport()
    const result = await store.exportPng(1)
    expect(result).toBeNull()
    expect(store.lastError.value).toBeTruthy()
  })

  test('剪贴板不支持时提示改用下载', async () => {
    const store = setup()
    const ok = await store.copyToClipboard(1)
    expect(ok).toBe(false)
    expect(store.lastError.value).toContain('复制')
  })

  test('可导出横版与竖版尺寸', async () => {
    const store = useExport()
    const el = document.createElement('div')
    document.body.appendChild(el)
    store.register({
      element: el,
      card: { ...DEFAULT_CARD },
      style: { ...DEFAULT_STYLE, size: { preset: 'landscape', width: 1200, height: 630 } },
    })
    const result = await store.exportPng(2)
    expect([result?.width, result?.height]).toEqual([2400, 1260])
    expect(store.sizeLabel.value).toBe('1200 × 630')
  })

  test('渲染抛错时记录错误并复位状态', async () => {
    const store = setup()
    const broken = document.createElement('canvas')
    document.createElement('div')
    const originalGet = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never
    try {
      const result = await store.exportPng(1)
      expect(result).toBeNull()
      expect(store.lastError.value).toContain('Canvas')
      expect(store.exporting.value).toBe(false)
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGet
    }
    expect(broken).toBeTruthy()
  })

  test('导出成功后记录结果', async () => {
    const store = setup()
    await store.exportPng(3)
    expect(store.lastResult.value?.width).toBe(3240)
  })
})
