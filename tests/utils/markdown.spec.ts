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

  test('代码块语言标记与内容保留', () => {
    const [block] = parseMarkdown('```typescript\nconst a = 1\n```', false)
    expect(block).toEqual({ type: 'code', language: 'typescript', value: 'const a = 1' })
  })

  test('分隔线单独成块', () => {
    expect(parseMarkdown('---')[0].type).toBe('divider')
    expect(parseMarkdown('***')[0].type).toBe('divider')
  })

  test('多行引用合并为一段', () => {
    const [quote] = parseMarkdown('> 第一句\n> 第二句', false)
    expect(quote.type === 'quote' && quote.inlines.map((n) => n.value).join('')).toContain('第一句 第二句')
  })

  test('连续非空行合并成段落，不额外切块', () => {
    const blocks = parseMarkdown('第一行\n第二行', false)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('paragraph')
  })

  test('CRLF 与空输入安全', () => {
    expect(parseMarkdown('## 标题\r\n\r\n正文', false).map((b) => b.type)).toEqual(['heading', 'paragraph'])
    expect(parseMarkdown('')).toEqual([])
  })

  test('有序列表遇到无序项即截止', () => {
    const blocks = parseMarkdown('1. 一\n2. 二\n- 三', false)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type === 'list' && blocks[0].ordered).toBe(true)
    expect(blocks[1].type === 'list' && blocks[1].ordered).toBe(false)
  })

  test('列表与代码块也能转纯文本', () => {
    expect(markdownToPlain('- 一\n- 二\n\n```\nconst a = 1\n```')).toBe('一 二\nconst a = 1')
  })
})
