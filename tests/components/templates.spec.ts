import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Component } from 'vue'
import { findTemplate, TEMPLATES, templatesForType } from '@/utils/templates'
import CardRenderer from '@/components/preview/CardRenderer.vue'
import { DEFAULT_CARD, DEFAULT_STYLE, SIZE_PRESETS } from '@/types/card'
import { CATEGORY_LABELS } from '@/types/template'

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

  test('12 套模板 × 6 种卡片类型都能渲染，不崩不白屏', async () => {
    const types = ['knowledge', 'code', 'terminal', 'math', 'quote', 'custom'] as const
    const samples: Record<(typeof types)[number], string> = {
      knowledge: '## 小标题\n\n正文有 `inline` 和 **强调**。\n\n- 一\n- 二',
      code: 'const a = 1 // 注释\nexport default a',
      terminal: '$ npm i\nadded 1 package',
      math: 'E = mc^2 \\leq \\infty',
      quote: '简单是可靠的前提。',
      custom: '随手记一段文字',
    }
    for (const tpl of TEMPLATES) {
      const mod = await tpl.loader()
      for (const type of types) {
        const wrapper = mount(mod.default as Component, {
          props: {
            card: { ...DEFAULT_CARD, type, content: samples[type], tags: ['Vue', '前端'] },
            style: { ...DEFAULT_STYLE, templateId: tpl.id, ...tpl.defaultStyle },
          },
        })
        expect(wrapper.find('[data-card-root]').exists()).toBe(true)
        expect(wrapper.text().trim().length).toBeGreaterThan(0)
        wrapper.unmount()
      }
    }
  })

  test('三种尺寸预设都能渲染出根节点', async () => {
    const mod = await TEMPLATES[0].loader()
    for (const preset of ['square', 'landscape', 'portrait'] as const) {
      const wrapper = mount(mod.default as Component, {
        props: { card: { ...DEFAULT_CARD, type: 'code' }, style: { ...DEFAULT_STYLE, size: { ...SIZE_PRESETS[preset] } } },
      })
      const root = wrapper.find('[data-card-root]')
      expect(root.exists()).toBe(true)
      expect(root.attributes('style')).toContain(`${SIZE_PRESETS[preset].width}px`)
      wrapper.unmount()
    }
  })

  test('templatesForType 把匹配的模板排在前面', () => {
    const code = templatesForType('code')
    expect(code).toHaveLength(TEMPLATES.length)
    expect(code[0].suits).toContain('code')
    const tail = code.slice(code.findIndex((t) => !t.suits?.includes('code')))
    expect(tail.every((t) => !t.suits?.includes('code'))).toBe(true)
  })

  test('findTemplate 未知 id 回退到默认模板', () => {
    expect(findTemplate('not-exist').id).toBe(TEMPLATES[4].id)
    expect(findTemplate('terminal-black').name).toBe('终端黑')
  })

  test('每个分类都有标签，且模板 id 唯一', () => {
    const ids = TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of TEMPLATES) expect(CATEGORY_LABELS[t.category]).toBeTruthy()
  })
})
