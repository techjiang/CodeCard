import { describe, expect, test, vi, beforeEach } from 'vitest'
import { copyBlobToClipboard, copyText } from '@/utils/clipboard'

describe('剪贴板', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('复制到剪贴板成功', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    ;(globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = class {
      constructor(public items: Record<string, Blob>) {}
      static supports() {
        return true
      }
    }
    Object.assign(navigator, { clipboard: { write, writeText: vi.fn() } })
    const ok = await copyBlobToClipboard(new Blob(['x'], { type: 'image/png' }))
    expect(ok).toBe(true)
    expect(write).toHaveBeenCalled()
  })

  test('环境不支持时返回 false', async () => {
    Object.assign(navigator, { clipboard: { write: vi.fn().mockRejectedValue(new Error('no')) } })
    const ok = await copyBlobToClipboard(new Blob(['x'], { type: 'image/png' }))
    expect(ok).toBe(false)
  })

  test('没有 ClipboardItem 时返回 false', async () => {
    ;(globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = undefined
    Object.assign(navigator, { clipboard: { write: vi.fn() } })
    expect(await copyBlobToClipboard(new Blob(['x'], { type: 'image/png' }))).toBe(false)
  })

  test('声明不支持 PNG 时不尝试写入', async () => {
    const write = vi.fn()
    ;(globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = class {
      static supports() {
        return false
      }
    }
    Object.assign(navigator, { clipboard: { write } })
    expect(await copyBlobToClipboard(new Blob(['x'], { type: 'image/png' }))).toBe(false)
    expect(write).not.toHaveBeenCalled()
  })

  test('没有 supports() 的旧实现照旧尝试写入', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    ;(globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = class {
      constructor(public items: Record<string, Blob>) {}
    }
    Object.assign(navigator, { clipboard: { write } })
    expect(await copyBlobToClipboard(new Blob(['x'], { type: 'image/png' }))).toBe(true)
    expect(write).toHaveBeenCalled()
  })

  test('没有 navigator.clipboard 时返回 false', async () => {
    Object.assign(navigator, { clipboard: undefined })
    expect(await copyBlobToClipboard(new Blob(['x'], { type: 'image/png' }))).toBe(false)
    expect(await copyText('你好')).toBe(false)
  })

  test('writeText 抛错时返回 false', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } })
    expect(await copyText('你好')).toBe(false)
  })

  test('复制文本', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    expect(await copyText('你好')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('你好')
  })
})
