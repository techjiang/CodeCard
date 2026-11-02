import { describe, expect, test } from 'vitest'
import { nextTick } from 'vue'
import { useTheme } from '@/composables/useTheme'

describe('编辑器主题', () => {
  test('切换写入 html.dark 与本地存储', async () => {
    const { theme, toggle } = useTheme()
    const initial = theme.value
    toggle()
    await nextTick()
    expect(theme.value).not.toBe(initial)
    expect(document.documentElement.classList.contains('dark')).toBe(theme.value === 'dark')
    expect(localStorage.getItem('codecard:ui-theme')).toBe(theme.value)
    toggle()
  })
})
