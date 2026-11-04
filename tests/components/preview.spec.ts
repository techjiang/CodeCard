import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CardPreview from '@/components/preview/CardPreview.vue'
import { DEFAULT_CARD, DEFAULT_STYLE, SIZE_PRESETS } from '@/types/card'

/** jsdom 没有 ResizeObserver，用一个可手动触发的替身 */
function stubResizeObserver() {
  const instances: Array<{ cb: () => void; observed: Element[] }> = []
  class RO {
    cb: () => void
    observed: Element[] = []
    constructor(cb: () => void) {
      this.cb = cb
      instances.push({ cb, observed: this.observed })
    }
    observe(el: Element) {
      this.observed.push(el)
    }
    disconnect() {
      this.observed = []
    }
  }
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO
  return instances
}

describe('预览容器', () => {
  test('渲染模板并把设计尺寸写进样式', async () => {
    stubResizeObserver()
    const wrapper = mount(CardPreview, {
      props: { card: { ...DEFAULT_CARD }, style: { ...DEFAULT_STYLE, size: { ...SIZE_PRESETS.landscape } } },
    })
    await vi.waitFor(() => expect(wrapper.find('[data-card-root]').exists()).toBe(true))
    const card = wrapper.find('[data-card-export]')
    expect(card.attributes('style')).toContain('1200px')
    expect(card.attributes('style')).toContain('630px')
    expect(wrapper.text()).toContain('1200 × 630')
  })

  test('模板挂载后发出 ready 事件', async () => {
    stubResizeObserver()
    const wrapper = mount(CardPreview, { props: { card: { ...DEFAULT_CARD }, style: { ...DEFAULT_STYLE } } })
    await vi.waitFor(() => expect(wrapper.emitted('ready')).toBeTruthy())
    const emitted = wrapper.emitted('ready')!
    const el = emitted[emitted.length - 1][0]
    expect(el).toBeInstanceOf(HTMLElement)
  })

  test('容器有尺寸时按比例缩放并展示百分比', async () => {
    const instances = stubResizeObserver()
    const wrapper = mount(CardPreview, { props: { card: { ...DEFAULT_CARD }, style: { ...DEFAULT_STYLE } } })
    const host = wrapper.element as HTMLElement
    Object.defineProperty(host, 'clientWidth', { value: 604, configurable: true })
    Object.defineProperty(host, 'clientHeight', { value: 1140, configurable: true })
    instances[0].cb()
    // jsdom 的 ref 回调是异步的，等测量结果落到 DOM
    await vi.waitFor(() => expect(wrapper.text()).toContain('50%'))
    // (604 - 64) / 1080 = 0.5
    expect(wrapper.find('.preview-card').attributes('style')).toContain('scale(0.5)')
  })

  test('显式传入 scale 时优先使用', async () => {
    stubResizeObserver()
    const wrapper = mount(CardPreview, { props: { card: { ...DEFAULT_CARD }, style: { ...DEFAULT_STYLE }, scale: 0.3 } })
    expect(wrapper.find('.preview-card').attributes('style')).toContain('scale(0.3)')
    expect(wrapper.text()).toContain('30%')
  })

  test('切换模板会重新解析组件', async () => {
    stubResizeObserver()
    const wrapper = mount(CardPreview, { props: { card: { ...DEFAULT_CARD }, style: { ...DEFAULT_STYLE } } })
    await vi.waitFor(() => expect(wrapper.find('[data-card-root]').exists()).toBe(true))
    await wrapper.setProps({ style: { ...DEFAULT_STYLE, templateId: 'terminal-black' } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Vue 3 响应式原理'))
  })

  test('模板异步加载完仍会重新发出 ready（导出目标不能一直是空）', async () => {
    stubResizeObserver()
    const wrapper = mount(CardPreview, { props: { card: { ...DEFAULT_CARD }, style: { ...DEFAULT_STYLE } } })
    await vi.waitFor(() => expect(wrapper.find('[data-card-root]').exists()).toBe(true))
    // 模板晚一拍才挂上来时也要再通知一次，否则外层注册的导出目标会一直是 null。
    // 这里只保证「通知的那份 DOM 里确实有卡片根节点」——它是用来导出的那棵树
    const emitted = wrapper.emitted('ready')!
    const last = emitted[emitted.length - 1][0] as HTMLElement | null
    expect(last).toBeInstanceOf(HTMLElement)
    expect(last!.querySelector('[data-card-root]')).not.toBeNull()
  })

  test('切换尺寸后重新测量', async () => {
    const instances = stubResizeObserver()
    const wrapper = mount(CardPreview, { props: { card: { ...DEFAULT_CARD }, style: { ...DEFAULT_STYLE } } })
    const host = wrapper.element as HTMLElement
    Object.defineProperty(host, 'clientWidth', { value: 364, configurable: true })
    Object.defineProperty(host, 'clientHeight', { value: 700, configurable: true })
    instances[0].cb()
    await wrapper.setProps({ style: { ...DEFAULT_STYLE, size: { ...SIZE_PRESETS.landscape } } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('1200 × 630'))
    expect(wrapper.find('.preview-card').attributes('style')).toContain('1200px')
  })
})
