import { describe, expect, test } from 'vitest'
import { getHighlightTheme, HIGHLIGHT_THEMES, highlight, LANGUAGES, tokenizeLine } from '@/utils/highlight'

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
})
