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

  test('复制文本', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    expect(await copyText('你好')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('你好')
  })
})
