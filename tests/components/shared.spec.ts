import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ExportButton from '@/components/shared/ExportButton.vue'
import HistoryDrawer from '@/components/shared/HistoryDrawer.vue'
import ThemeToggle from '@/components/shared/ThemeToggle.vue'
import Watermark from '@/components/preview/parts/Watermark.vue'
import type { ExportStore } from '@/composables/useExport'
import type { HistoryEntry } from '@/composables/useHistory'
import { DEFAULT_CARD, DEFAULT_STYLE } from '@/types/card'

function fakeStore(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    exporting: ref(false),
    lastError: ref<string | null>(null),
    exportPng: vi.fn(async (scale: number) => ({ blob: new Blob(), width: 1080 * scale, height: 1080 * scale, filename: 'x.png' })),
    copyToClipboard: vi.fn(async () => true),
    ...overrides,
  } as unknown as ExportStore
}

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'a',
    card: { ...DEFAULT_CARD, title: '卡片一' },
    style: { ...DEFAULT_STYLE },
    updatedAt: new Date('2024-03-05T08:09:00').getTime(),
    ...overrides,
  }
}

describe('导出按钮', () => {
  test('点开菜单展示三档倍率与剪贴板', async () => {
    const wrapper = mount(ExportButton, { props: { store: fakeStore() } })
    expect(wrapper.find('.menu').exists()).toBe(false)
    await wrapper.find('.export__btn').trigger('click')
    expect(wrapper.findAll('.menu__item')).toHaveLength(4)
    expect(wrapper.text()).toContain('1x')
    expect(wrapper.text()).toContain('复制到剪贴板')
  })

  test('导出中按钮禁用并提示', () => {
    const wrapper = mount(ExportButton, { props: { store: fakeStore({ exporting: ref(true) }) } })
    const btn = wrapper.find('.export__btn')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.text()).toContain('导出中')
  })

  test('选 2x 调用导出并提示尺寸', async () => {
    const store = fakeStore()
    const wrapper = mount(ExportButton, { props: { store } })
    await wrapper.find('.export__btn').trigger('click')
    await wrapper.findAll('.menu__item')[1].trigger('click')
    expect(store.exportPng).toHaveBeenCalledWith(2)
    await vi.waitFor(() => expect(wrapper.find('.toast').text()).toContain('已导出 2160×2160'))
    expect(wrapper.find('.menu').exists()).toBe(false)
  })

  test('导出失败提示错误信息', async () => {
    const store = fakeStore({
      exportPng: vi.fn(async () => null),
      lastError: ref('卡片尚未挂载'),
    })
    const wrapper = mount(ExportButton, { props: { store } })
    await wrapper.find('.export__btn').trigger('click')
    await wrapper.findAll('.menu__item')[0].trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.toast').text()).toBe('卡片尚未挂载'))
  })

  test('复制成功与失败都有提示', async () => {
    const ok = fakeStore()
    const a = mount(ExportButton, { props: { store: ok } })
    await a.find('.export__btn').trigger('click')
    await a.findAll('.menu__item')[3].trigger('click')
    expect(ok.copyToClipboard).toHaveBeenCalledWith(2)
    await vi.waitFor(() => expect(a.find('.toast').text()).toContain('已复制'))

    const fail = fakeStore({ copyToClipboard: vi.fn(async () => false), lastError: ref('当前浏览器不支持复制图片，请改用下载') })
    const b = mount(ExportButton, { props: { store: fail } })
    await b.find('.export__btn').trigger('click')
    await b.findAll('.menu__item')[3].trigger('click')
    await vi.waitFor(() => expect(b.find('.toast').text()).toContain('不支持复制'))
  })
})

describe('历史抽屉', () => {
  test('关闭时不渲染', () => {
    const wrapper = mount(HistoryDrawer, { props: { open: false, entries: [] } })
    expect(wrapper.find('.drawer').exists()).toBe(false)
  })

  test('空列表给出引导文案', () => {
    const wrapper = mount(HistoryDrawer, { props: { open: true, entries: [] } })
    expect(wrapper.find('.drawer__empty').exists()).toBe(true)
    expect(wrapper.find('.drawer__actions').text()).not.toContain('清空')
  })

  test('渲染标题、时间与类型', () => {
    const wrapper = mount(HistoryDrawer, { props: { open: true, entries: [entry()] } })
    expect(wrapper.find('.item__title').text()).toBe('卡片一')
    expect(wrapper.find('.item__meta').text()).toContain('03-05 08:09')
    expect(wrapper.find('.item__meta').text()).toContain('knowledge')
  })

  test('无标题时显示未命名卡片', () => {
    const wrapper = mount(HistoryDrawer, { props: { open: true, entries: [entry({ card: { ...DEFAULT_CARD, title: '' } })] } })
    expect(wrapper.find('.item__title').text()).toBe('未命名卡片')
  })

  test('恢复、删除、清空、关闭分别派发事件', async () => {
    const list = [entry({ id: 'x' }), entry({ id: 'y', card: { ...DEFAULT_CARD, title: '卡片二' } })]
    const wrapper = mount(HistoryDrawer, { props: { open: true, entries: list } })
    await wrapper.findAll('.item__main')[0].trigger('click')
    expect(wrapper.emitted('restore')?.[0]).toEqual([list[0]])
    await wrapper.findAll('.item__del')[1].trigger('click')
    expect(wrapper.emitted('remove')?.[0]).toEqual(['y'])
    await wrapper.find('.drawer__actions button').trigger('click')
    expect(wrapper.emitted('clear')).toBeTruthy()
    await wrapper.findAll('.drawer__actions button')[1].trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  test('点遮罩关闭，点抽屉本身不关闭', async () => {
    const wrapper = mount(HistoryDrawer, { props: { open: true, entries: [entry()] } })
    await wrapper.find('.drawer').trigger('click')
    expect(wrapper.emitted('close')).toBeFalsy()
    await wrapper.find('.drawer-mask').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})

describe('主题开关', () => {
  test('点击在明暗之间切换并写入 html', async () => {
    const wrapper = mount(ThemeToggle)
    const { theme } = (await import('@/composables/useTheme')).useTheme()
    theme.value = 'light'
    await wrapper.vm.$nextTick()
    await wrapper.find('.toggle').trigger('click')
    expect(theme.value).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    await wrapper.find('.toggle').trigger('click')
    expect(theme.value).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  test('title 跟随当前主题', async () => {
    const wrapper = mount(ThemeToggle)
    const { theme } = (await import('@/composables/useTheme')).useTheme()
    theme.value = 'light'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.toggle').attributes('title')).toBe('切换到深色')
    theme.value = 'dark'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.toggle').attributes('title')).toBe('切换到浅色')
  })
})

describe('水印', () => {
  test('未开启时不渲染', () => {
    const wrapper = mount(Watermark, { props: { watermark: { enabled: false, position: 'bottom-right', text: 'hi' } } })
    expect(wrapper.find('.wm').exists()).toBe(false)
  })

  test('开启但没有内容时不渲染', () => {
    const wrapper = mount(Watermark, { props: { watermark: { enabled: true, position: 'bottom-right' } } })
    expect(wrapper.find('.wm').exists()).toBe(false)
  })

  test('文字水印带位置类与字号', () => {
    const wrapper = mount(Watermark, { props: { watermark: { enabled: true, position: 'top-right', text: '@cosc' }, fontSize: 18 } })
    const wm = wrapper.find('.wm')
    expect(wm.classes()).toContain('wm--top-right')
    expect(wm.attributes('style')).toContain('18px')
    expect(wm.text()).toBe('@cosc')
  })

  test('居水印用 bottom-center，默认回退到右下', () => {
    const center = mount(Watermark, { props: { watermark: { enabled: true, position: 'bottom-center', text: 'a' } } })
    expect(center.find('.wm').classes()).toContain('wm--bottom-center')
    const fallback = mount(Watermark, { props: { watermark: { enabled: true, position: 'weird' as never, text: 'a' } } })
    expect(fallback.find('.wm').classes()).toContain('wm--bottom-right')
  })

  test('图片水印优先于文字', () => {
    const wrapper = mount(Watermark, {
      props: { watermark: { enabled: true, position: 'bottom-right', text: '文字', image: 'data:image/png;base64,AAA' } },
    })
    expect(wrapper.find('.wm__img').exists()).toBe(true)
    expect(wrapper.find('.wm__text').exists()).toBe(false)
  })
})
