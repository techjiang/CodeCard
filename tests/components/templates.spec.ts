import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Component } from 'vue'
import { TEMPLATES } from '@/utils/templates'
import CardRenderer from '@/components/preview/CardRenderer.vue'
import { DEFAULT_CARD, DEFAULT_STYLE } from '@/types/card'

describe('卡片模板', () => {
  test('至少 12 套且分类齐全', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(12)
    const categories = new Set(TEMPLATES.map((t) => t.category))
    for (const c of ['code', 'knowledge', 'quote', 'general']) expect(categories.has(c as never)).toBe(true)
  })

  test('每套模板都能渲染出卡片根节点', async () => {
    for (const tpl of TEMPLATES) {
      const mod = await tpl.loader()
      const wrapper = mount(mod.default as Component, {
        props: { card: { ...DEFAULT_CARD }, style: { ...DEFAULT_STYLE, templateId: tpl.id, ...tpl.defaultStyle } },
      })
      expect(wrapper.find('[data-card-root]').exists()).toBe(true)
      wrapper.unmount()
    }
  })

  test('代码卡片走代码高亮渲染', () => {
    const wrapper = mount(CardRenderer, {
      props: {
        card: { ...DEFAULT_CARD, type: 'code', content: 'const a = 1 // 注释', language: 'typescript' },
        style: DEFAULT_STYLE,
        tone: 'dark',
      },
    })
    expect(wrapper.find('.cc-code').exists()).toBe(true)
    expect(wrapper.text()).toContain('const')
    expect(wrapper.text()).toContain('// 注释')
  })

  test('终端卡片显示命令行与输出', () => {
    const wrapper = mount(CardRenderer, {
      props: { card: { ...DEFAULT_CARD, type: 'terminal', content: '$ npm i\nadded 1 package' }, style: DEFAULT_STYLE, tone: 'dark' },
    })
    expect(wrapper.find('.term').exists()).toBe(true)
    expect(wrapper.text()).toContain('added 1 package')
  })

  test('数学公式替换常见符号', () => {
    const wrapper = mount(CardRenderer, {
      props: { card: { ...DEFAULT_CARD, type: 'math', content: 'a \\times b \\leq c' }, style: DEFAULT_STYLE, tone: 'light' },
    })
    expect(wrapper.text()).toContain('×')
    expect(wrapper.text()).toContain('≤')
  })

  test('名言里混入 Markdown 也不会露出原始符号', () => {
    const wrapper = mount(CardRenderer, {
      props: {
        card: { ...DEFAULT_CARD, type: 'quote', content: '## 小标题\n\n用 `Proxy` 做**拦截**\n\n- 依赖收集\n- 触发更新' },
        style: DEFAULT_STYLE,
        tone: 'light',
      },
    })
    const text = wrapper.text()
    expect(text).not.toContain('##')
    expect(text).not.toContain('**')
    expect(text).toContain('小标题')
    expect(wrapper.find('.quote__h').exists()).toBe(true)
    expect(wrapper.findAll('.quote__list li')).toHaveLength(2)
  })

  test('短金句按原样分行显示，保留强调', () => {
    const wrapper = mount(CardRenderer, {
      props: { card: { ...DEFAULT_CARD, type: 'quote', content: '简单是**可靠**的前提。\n第二行。' }, style: DEFAULT_STYLE, tone: 'light' },
    })
    expect(wrapper.findAll('.quote__line')).toHaveLength(2)
    expect(wrapper.find('.quote__strong, strong').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('**')
  })

  test('公式里混入 Markdown 不露原始符号', () => {
    const wrapper = mount(CardRenderer, {
      props: { card: { ...DEFAULT_CARD, type: 'math', content: '## 公式\n$a \\times b \\leq c$' }, style: DEFAULT_STYLE, tone: 'light' },
    })
    expect(wrapper.text()).not.toContain('##')
    expect(wrapper.text()).toContain('公式')
  })

  test('名言卡片展示出处', () => {
    const wrapper = mount(CardRenderer, {
      props: { card: { ...DEFAULT_CARD, type: 'quote', content: '简单是可靠的前提。', quoteFrom: 'Dijkstra' }, style: DEFAULT_STYLE, tone: 'light' },
    })
    expect(wrapper.text()).toContain('Dijkstra')
  })

  test('标签最多渲染 5 个', () => {
    const wrapper = mount(CardRenderer, {
      props: { card: { ...DEFAULT_CARD, tags: ['a', 'b', 'c', 'd', 'e', 'f'] }, style: DEFAULT_STYLE, tone: 'light' },
    })
    expect(wrapper.findAll('.cc-tag')).toHaveLength(5)
  })
})
