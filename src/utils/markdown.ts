/**
 * 极简 Markdown 渲染：段落、标题、列表、引用、代码块、行内样式。
 * 输出结构化块，模板自行决定样式，避免 v-html 带来的截图不确定性。
 */
import { breakPoints, panguSegments } from './typography'

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string }
  | { type: 'link'; value: string; href: string }

export type BlockNode =
  | { type: 'heading'; level: number; inlines: InlineNode[] }
  | { type: 'paragraph'; inlines: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
  | { type: 'quote'; inlines: InlineNode[] }
  | { type: 'code'; language: string; value: string }
  | { type: 'divider' }

export function parseInline(raw: string, autoSpace = true): InlineNode[] {
  // 先做中英文加空格，再标出长标识符的断行点（避免 Object.defineProperty 被劈开）
  const spaced = autoSpace ? panguSegments(raw).trim() : raw
  const text = spaced
  const nodes: InlineNode[] = []
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push({ type: 'text', value: breakPoints(text.slice(last, m.index)) })
    const token = m[0]
    if (token.startsWith('`')) nodes.push({ type: 'code', value: token.slice(1, -1) })
    else if (token.startsWith('**')) nodes.push({ type: 'strong', value: token.slice(2, -2) })
    else if (token.startsWith('*')) nodes.push({ type: 'em', value: token.slice(1, -1) })
    else {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)!
      nodes.push({ type: 'link', value: link[1], href: link[2] })
    }
    last = re.lastIndex
  }
  if (last < text.length) nodes.push({ type: 'text', value: breakPoints(text.slice(last)) })
  return nodes.filter((n) => n.type !== 'text' || n.value.trim() !== '' || n.value.includes(' '))
}

export function parseMarkdown(src: string, autoSpace = true): BlockNode[] {
  const lines = (src ?? '').replace(/\r\n?/g, '\n').split('\n')
  const blocks: BlockNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (/^\s*$/.test(line)) {
      i++
      continue
    }

    // 代码块
    if (/^\s*```/.test(line)) {
      const language = line.trim().replace(/^```/, '').trim()
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++])
      i++ // 跳过收尾 ```
      blocks.push({ type: 'code', language, value: body.join('\n') })
      continue
    }

    // 分隔线
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push({ type: 'divider' })
      i++
      continue
    }

    // 标题
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, inlines: parseInline(heading[2], autoSpace) })
      i++
      continue
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      const collected: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        collected.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      blocks.push({ type: 'quote', inlines: parseInline(collected.join(' '), autoSpace) })
      continue
    }

    // 列表
    const listMatch = /^\s*([-*+]|\d+[.)])\s+/.exec(line)
    if (listMatch) {
      const ordered = /\d/.test(listMatch[1])
      const items: InlineNode[][] = []
      while (i < lines.length) {
        const m = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i])
        if (!m || /\d/.test(m[1]) !== ordered) break
        items.push(parseInline(m[2], autoSpace))
        i++
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    // 段落：连续非空行合并
    const para: string[] = []
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*(#{1,6}\s|>|```|([-*+]|\d+[.)])\s)/.test(lines[i])) {
      para.push(lines[i].trim())
      i++
    }
    if (para.length) blocks.push({ type: 'paragraph', inlines: parseInline(para.join(' '), autoSpace) })
    else i++
  }

  return blocks
}

/** 转成纯文本，用于导出文件名等场景 */
export function markdownToPlain(src: string): string {
  return parseMarkdown(src, false)
    .map((b) => {
      switch (b.type) {
        case 'heading':
        case 'paragraph':
        case 'quote':
          return b.inlines.map((n) => n.value).join('')
        case 'list':
          return b.items.map((it) => it.map((n) => n.value).join('')).join(' ')
        case 'code':
          return b.value
        default:
          return ''
      }
    })
    .filter(Boolean)
    .join('\n')
}
