import { describe, expect, test } from 'vitest'
import { markdownToPlain, parseInline, parseMarkdown } from '@/utils/markdown'

describe('Markdown', () => {
  test('解析标题/段落/列表/引用/代码块', () => {
    const blocks = parseMarkdown(['## 标题', '', '正文段落。', '', '- 项目一', '- 项目二', '', '> 引用', '', '```ts', 'const a = 1', '```'].join('\n'))
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'quote', 'code'])
  })

  test('行内代码、加粗、链接', () => {
    const nodes = parseInline('用 `Proxy` 做 **拦截** 见 [文档](https://vuejs.org)', false)
    expect(nodes.some((n) => n.type === 'code' && n.value === 'Proxy')).toBe(true)
    expect(nodes.some((n) => n.type === 'strong' && n.value === '拦截')).toBe(true)
    expect(nodes.some((n) => n.type === 'link' && n.href === 'https://vuejs.org')).toBe(true)
  })

  test('有序列表与无序列表区分', () => {
    const ordered = parseMarkdown('1. 第一\n2. 第二')[0]
    expect(ordered.type).toBe('list')
    expect(ordered.type === 'list' && ordered.ordered).toBe(true)
  })

  test('转纯文本用于文件名', () => {
    expect(markdownToPlain('## 标题\n\n正文**加粗**')).toContain('标题')
  })
})

describe('中文断行', () => {
  test('长标识符标出断行点，不劈单词', () => {
    const nodes = parseInline('用 `Proxy` 替代了 Object.defineProperty，可拦截。', false)
    const text = nodes.filter((n) => n.type === 'text').map((n) => (n.type === 'text' ? n.value : '')).join('')
    expect(text).toContain('Object.\ndefine\nProperty')
  })

  test('链接地址不被打断行标记污染', () => {
    const nodes = parseInline('见 [文档](https://vuejs.org/guide/intro.html)', false)
    const link = nodes.find((n) => n.type === 'link')
    expect(link && link.type === 'link' && link.href).toBe('https://vuejs.org/guide/intro.html')
  })

  test('行内代码内容保持原样', () => {
    const nodes = parseInline('`Object.defineProperty`', false)
    expect(nodes[0]).toEqual({ type: 'code', value: 'Object.defineProperty' })
  })
})
