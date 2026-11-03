import { describe, expect, test, vi } from 'vitest'
import { readJSON, safeGet, safeRemove, safeSet } from '@/utils/storage'

describe('本地存储封装', () => {
  test('正常读写', () => {
    expect(safeSet('k', 'v')).toBe(true)
    expect(safeGet('k')).toBe('v')
    safeRemove('k')
    expect(safeGet('k')).toBeNull()
  })

  test('JSON 读写与解析失败回退', () => {
    safeSet('json', JSON.stringify({ a: 1 }))
    expect(readJSON('json', { a: 0 })).toEqual({ a: 1 })
    safeSet('bad', '{oops')
    expect(readJSON('bad', [])).toEqual([])
    expect(readJSON('missing', { fallback: true })).toEqual({ fallback: true })
  })

  /** tests/setup.ts 把 localStorage 换成了普通对象，这里临时塞一个会抛错的替身 */
  function withBrokenStorage(run: () => void) {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => {
          throw new Error('denied')
        },
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
        removeItem: () => {
          throw new Error('denied')
        },
      },
      configurable: true,
    })
    try {
      run()
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
    }
  }

  test('存储抛错时读写都安全降级', () => {
    withBrokenStorage(() => {
      // 有 localStorage 但写入失败 → false；没有 localStorage 时也不会抛错
      expect(typeof safeSet('k', 'v')).toBe('boolean')
      expect(safeGet('k')).toBeNull()
      expect(() => safeRemove('k')).not.toThrow()
      expect(readJSON('k', { fallback: true })).toEqual({ fallback: true })
    })
  })

  test('没有 localStorage 的极端环境也不崩', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true })
    try {
      expect(safeGet('k')).toBeNull()
      // 有 localStorage 但写入失败 → false；没有 localStorage 时也不会抛错
      expect(typeof safeSet('k', 'v')).toBe('boolean')
      expect(() => safeRemove('k')).not.toThrow()
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
    }
  })
})
