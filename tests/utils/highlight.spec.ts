import { describe, expect, test } from 'vitest'
import { getHighlightTheme, HIGHLIGHT_THEMES, highlight, LANGUAGES, tokenizeLine, tokenStyle } from '@/utils/highlight'

const flatten = (lines: ReturnType<typeof highlight>) => lines.map((l) => l.map((t) => t.value).join(''))

describe('CodeHighlight', () => {
  test('PHP 代码高亮正常', () => {
    const code = ['<?php', '$name = "CodeCard";', 'echo $name; // 输出名称'].join('\n')
    const lines = highlight(code, 'php')
    expect(flatten(lines)).toEqual(code.split('\n'))
    const keyword = lines[2].find((t) => t.type === 'keyword')
    expect(keyword?.value).toBe('echo')
    const str = lines[1].find((t) => t.type === 'string')
    expect(str?.value).toBe('"CodeCard"')
  })

  test('中文注释正确渲染', () => {
    const lines = highlight('const a = 1 // 中文注释不丢字', 'javascript')
    const comment = lines[0].find((t) => t.type === 'comment')
    expect(comment?.value).toBe('// 中文注释不丢字')
    expect(flatten(lines)[0]).toBe('const a = 1 // 中文注释不丢字')
  })

  test('块注释可跨行', () => {
    const lines = highlight(['/* 第一行', '第二行 */ const a = 1'].join('\n'), 'typescript')
    // 第一行没有闭合，整行进入注释状态
    expect(lines[0].every((t) => t.type === 'comment')).toBe(true)
    // 第二行先吃注释，再继续解析剩余代码
    expect(lines[1][0].type).toBe('comment')
    expect(lines[1].find((t) => t.type === 'keyword')?.value).toBe('const')
  })

  test('字符串里的注释符号不算注释', () => {
    const lines = highlight('const url = "https://a.b"', 'javascript')
    expect(lines[0].some((t) => t.type === 'comment')).toBe(false)
    expect(lines[0].find((t) => t.type === 'string')?.value).toBe('"https://a.b"')
  })

  test('行号与代码对齐（行数一致）', () => {
    const code = 'a\nb\nc'
    const lines = highlight(code, 'python')
    expect(lines).toHaveLength(code.split('\n').length)
  })

  test('六套以上高亮主题且都有必需字段', () => {
    expect(HIGHLIGHT_THEMES.length).toBeGreaterThanOrEqual(6)
    for (const theme of HIGHLIGHT_THEMES) {
      expect(theme.background).toMatch(/^#/)
      expect(theme.colors.keyword).toMatch(/^#/)
    }
    expect(getHighlightTheme('不存在').id).toBe(HIGHLIGHT_THEMES[0].id)
  })

  test('支持的语言清单覆盖需求', () => {
    const ids = LANGUAGES.map((l) => l.id)
    for (const lang of ['javascript', 'typescript', 'php', 'python', 'java', 'go', 'rust', 'sql', 'html', 'css', 'bash', 'json', 'yaml', 'markdown']) {
      expect(ids).toContain(lang)
    }
  })

  test('SQL 关键字大小写不敏感', () => {
    const tokens = tokenizeLine('SELECT * FROM users', 'sql')
    expect(tokens.filter((t) => t.type === 'keyword').map((t) => t.value)).toEqual(['SELECT', 'FROM'])
  })

  test('HTML 标签、属性、字符串各自成 token', () => {
    const [line] = highlight('<a href="/x">链接</a>', 'html')
    expect(line.filter((t) => t.type === 'keyword').map((t) => t.value)).toEqual(['a', 'a'])
    expect(line.find((t) => t.type === 'attr')?.value).toBe('href')
    expect(line.find((t) => t.type === 'string')?.value).toBe('"/x"')
    expect(line.map((t) => t.value).join('')).toBe('<a href="/x">链接</a>')
  })

  test('CSS 选择器、属性、颜色、数值', () => {
    const [line] = highlight('.card { color: #fff; width: 12px; }', 'css')
    const byType = (type: string) => line.filter((t) => t.type === type).map((t) => t.value)
    expect(byType('tag')).toContain('.card')
    expect(byType('attr')).toContain('color')
    expect(byType('number')).toEqual(expect.arrayContaining(['#fff', '12px']))
    expect(line.map((t) => t.value).join('')).toBe('.card { color: #fff; width: 12px; }')
  })

  test('Markdown 标题、列表、引用、行内样式', () => {
    expect(highlight('## 标题', 'markdown')[0]).toEqual([{ type: 'keyword', value: '## 标题' }])
    expect(highlight('- 列表', 'markdown')[0][0].type).toBe('operator')
    expect(highlight('> 引用', 'markdown')[0][0].type).toBe('comment')
    const inline = highlight('用 `code` 和 **重点** 和 [链接](u)', 'markdown')[0]
    expect(inline.some((t) => t.type === 'string' && t.value === '`code`')).toBe(true)
    expect(inline.some((t) => t.type === 'type' && t.value === '**重点**')).toBe(true)
  })

  test('纯文本语言原样按行返回', () => {
    const lines = highlight('原样\n保留', 'text')
    expect(lines).toEqual([[{ type: 'plain', value: '原样' }], [{ type: 'plain', value: '保留' }]])
  })

  test('函数名与大写类型分别着色', () => {
    const [line] = highlight('const el = document.querySelector(".a")\nnew Proxy(target)', 'javascript')
    expect(line.some((t) => t.type === 'function' && t.value === 'querySelector')).toBe(true)
    const second = highlight('new Proxy(target)', 'javascript')[0]
    expect(second.some((t) => t.type === 'type' && t.value === 'Proxy')).toBe(true)
  })

  test('数字支持十六进制与小数', () => {
    const [line] = highlight('const a = 0xFF; const b = 3.14', 'javascript')
    expect(line.filter((t) => t.type === 'number').map((t) => t.value)).toEqual(['0xFF', '3.14'])
  })

  test('字符串支持转义引号', () => {
    const [line] = highlight('const s = "a\\"b"', 'javascript')
    expect(line.find((t) => t.type === 'string')?.value).toBe('"a\\"b"')
  })

  test('python 与 bash 用 # 注释，yaml 只在空白后算注释', () => {
    expect(highlight('# 注释', 'python')[0][0].type).toBe('comment')
    expect(highlight('# 注释', 'bash')[0][0].type).toBe('comment')
    expect(highlight('key: 1 # 注释', 'yaml')[0].some((t) => t.type === 'comment')).toBe(true)
    expect(highlight('key: 1', 'yaml')[0].some((t) => t.type === 'comment')).toBe(false)
  })

  test('sql 的 -- 注释', () => {
    const [line] = highlight('select 1 -- 注释', 'sql')
    expect(line.find((t) => t.type === 'comment')?.value).toBe('-- 注释')
  })

  test('CRLF 与空输入安全', () => {
    expect(highlight('a\r\nb', 'javascript').map((l) => l.map((t) => t.value).join(''))).toEqual(['a', 'b'])
    expect(highlight('', 'javascript')).toHaveLength(1)
  })

  test('注释 token 用斜体，未知 token 回退前景色', () => {
    const theme = getHighlightTheme('dracula')
    expect(tokenStyle(theme, 'comment').fontStyle).toBe('italic')
    expect(tokenStyle(theme, 'regex').color).toBe(theme.colors.regex)
    const bare = { ...theme, colors: {} as never }
    expect(tokenStyle(bare, 'keyword').color).toBe(theme.foreground)
  })
})
