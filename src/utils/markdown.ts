/**
 * 极简 Markdown 渲染：段落、标题、列表、引用、代码块、行内样式。
 * 输出结构化块，模板自行决定样式，避免 v-html 带来的截图不确定性。
 */
import { breakPoints, normalizePunctuation, spaceUnits, type SpacedUnit } from './typography'

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

/** 行内标记：代码、加粗、斜体、链接 */
const INLINE_RE = /(`[^`\n]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g

interface Token {
  node: InlineNode
  /** 边界判定用的首尾字符（去掉标记符号之后） */
  head: string
  tail: string
}

/**
 * 行内排版。
 *
 * 旧做法是先把整段跑一遍 pangu 再切标记，切出来的各段各自成节点 —— 标记符号
 * 一去掉，`**Proxy**复写` 里的 `*` 就没了，补空格时看到的是 `y复`，判定成
 * 「拉丁 + 汉字」，可那段文本已经切走了，空格补不出来。所以现在是先切标记，
 * 再把「标记内容的首尾字符」当成一个整体单元参与边界判定。
 */
export function parseInline(raw: string, autoSpace = true): InlineNode[] {
  const text = normalizePunctuation(raw)
  const tokens: Token[] = []
  let last = 0
  let m: RegExpExecArray | null
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) pushText(tokens, text.slice(last, m.index))
    const token = m[0]
    if (token.startsWith('`')) {
      const value = token.slice(1, -1)
      tokens.push({ node: { type: 'code', value }, head: value[0], tail: value[value.length - 1] })
    } else if (token.startsWith('**')) {
      const value = token.slice(2, -2)
      tokens.push({ node: { type: 'strong', value }, head: value[0], tail: value[value.length - 1] })
    } else if (token.startsWith('*')) {
      const value = token.slice(1, -1)
      tokens.push({ node: { type: 'em', value }, head: value[0], tail: value[value.length - 1] })
    } else {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)!
      tokens.push({ node: { type: 'link', value: link[1], href: link[2] }, head: link[1][0], tail: link[1][link[1].length - 1] })
    }
    last = INLINE_RE.lastIndex
  }
  if (last < text.length) pushText(tokens, text.slice(last))

  // 不加空格也要标断点：长标识符不能在中间被劈开，这与排版开关无关
  if (!autoSpace) {
    return tokens
      .map((t) => (t.node.type === 'text' ? { type: 'text' as const, value: breakPoints(t.node.value) } : t.node))
      .filter((n) => n.type !== 'text' || n.value !== '')
  }

  // 每个 token 展开成排版单元：文本逐字符，标记内容整块不拆
  const units: SpacedUnit[] = []
  tokens.forEach((token, i) => {
    if (token.node.type === 'text') {
      for (const ch of token.node.value) units.push({ text: ch, tok: i })
    } else {
      units.push({ text: token.node.value, opaque: true, head: token.head, tail: token.tail, tok: i })
    }
  })

  const placed = spaceUnits(units)
  // 按 token 聚回去。
  //
  // 补出来的空格记在 tok = -1 上：它不属于任何一个原节点，位置却在节点边界之间。
  // 前面是文本就并进那段文本，前面是行内代码/加粗就单独成一个只含空格的文本节点 ——
  // 丢掉它的话 `参见 [文档]` 会变成 `参见文档`，`**Proxy**复写了` 会变成 `Proxy复写了`。
  const out: InlineNode[] = []
  let cur = -1
  let buffer = ''
  const flush = () => {
    if (buffer) out.push({ type: 'text', value: breakPoints(buffer) })
    buffer = ''
  }
  const pushRaw = (value: string) => {
    const tail = out[out.length - 1]
    if (tail && tail.type === 'text') tail.value += value
    else out.push({ type: 'text', value })
  }
  for (const unit of placed) {
    const tok = unit.tok ?? -1
    if (tok < 0) {
      if (buffer) buffer += unit.text
      else pushRaw(unit.text)
      continue
    }
    if (tok !== cur) {
      flush()
      cur = tok
    }
    const node = tokens[tok].node
    if (node.type === 'text') buffer += unit.text
    else {
      flush()
      out.push(node)
    }
  }
  flush()
  // 首尾的空格没有意义，导出时还会多画一段空白
  const trimmed = out.map((n, i, arr) => {
    if (n.type !== 'text') return n
    let v = n.value
    if (i === 0) v = v.replace(/^ +/, '')
    if (i === arr.length - 1) v = v.replace(/ +$/, '')
    return { type: 'text' as const, value: v }
  })
  // 相邻文本节点合起来：渲染时少一层 span，导出时也少几段
  const merged: InlineNode[] = []
  for (const node of trimmed) {
    const tail = merged[merged.length - 1]
    if (node.type === 'text' && tail?.type === 'text') tail.value += node.value
    else merged.push(node)
  }
  return merged.filter((n) => n.type !== 'text' || n.value !== '')
}

function pushText(tokens: Token[], value: string) {
  if (!value) return
  // 一段纯文本也可能夹着需要保留的边界字符，整段当一个 token
  tokens.push({ node: { type: 'text', value }, head: value[0], tail: value[value.length - 1] })
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
