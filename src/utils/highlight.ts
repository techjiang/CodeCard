/**
 * 轻量代码高亮：手写分词器 + 主题调色板，按行输出 token，
 * 便于外部渲染行号并在 DOM 截图中保持稳定（不依赖第三方高亮库）。
 */

export type TokenType =
  | 'plain'
  | 'comment'
  | 'keyword'
  | 'string'
  | 'number'
  | 'function'
  | 'type'
  | 'operator'
  | 'punct'
  | 'variable'
  | 'tag'
  | 'attr'
  | 'regex'

export interface Token {
  type: TokenType
  value: string
}

export interface HighlightTheme {
  id: string
  name: string
  /** 主题底色，同时用于窗口装饰 */
  background: string
  foreground: string
  colors: Record<TokenType, string>
  /** 亮色主题用于切换描边、阴影 */
  mode: 'dark' | 'light'
}

export const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript' },
  { id: 'typescript', name: 'TypeScript' },
  { id: 'php', name: 'PHP' },
  { id: 'python', name: 'Python' },
  { id: 'java', name: 'Java' },
  { id: 'go', name: 'Go' },
  { id: 'rust', name: 'Rust' },
  { id: 'sql', name: 'SQL' },
  { id: 'html', name: 'HTML' },
  { id: 'css', name: 'CSS' },
  { id: 'bash', name: 'Bash' },
  { id: 'json', name: 'JSON' },
  { id: 'yaml', name: 'YAML' },
  { id: 'markdown', name: 'Markdown' },
  { id: 'text', name: '纯文本' },
] as const

export type LanguageId = (typeof LANGUAGES)[number]['id']

const KEYWORDS: Record<string, string[]> = {
  common: ['if', 'else', 'for', 'while', 'return', 'break', 'continue', 'new', 'delete', 'in', 'of', 'typeof', 'instanceof', 'try', 'catch', 'finally', 'throw', 'switch', 'case', 'default', 'do', 'void', 'yield', 'await', 'async'],
  javascript: ['const', 'let', 'var', 'function', 'class', 'extends', 'import', 'from', 'export', 'default', 'super', 'this', 'null', 'undefined', 'true', 'false'],
  typescript: ['interface', 'type', 'enum', 'implements', 'declare', 'namespace', 'readonly', 'public', 'private', 'protected', 'as', 'satisfies', 'keyof', 'infer', 'asserts', 'const', 'let', 'var', 'function', 'class', 'extends', 'import', 'from', 'export', 'super', 'this', 'null', 'undefined', 'true', 'false'],
  php: ['echo', 'function', 'class', 'extends', 'implements', 'namespace', 'use', 'public', 'private', 'protected', 'static', 'abstract', 'final', 'foreach', 'as', 'elseif', 'endif', 'require', 'require_once', 'include', 'include_once', 'array', 'null', 'true', 'false'],
  python: ['def', 'class', 'import', 'from', 'as', 'with', 'lambda', 'pass', 'raise', 'except', 'elif', 'global', 'nonlocal', 'assert', 'None', 'True', 'False', 'and', 'or', 'not', 'is'],
  java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'package', 'import', 'static', 'final', 'void', 'abstract', 'synchronized', 'throws', 'null', 'true', 'false'],
  go: ['func', 'package', 'import', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'defer', 'select', 'range', 'nil', 'true', 'false', 'var'],
  rust: ['fn', 'let', 'mut', 'impl', 'struct', 'enum', 'trait', 'pub', 'use', 'mod', 'match', 'where', 'Some', 'None', 'Ok', 'Err', 'self', 'crate'],
  sql: ['select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'table', 'index', 'join', 'left', 'right', 'inner', 'outer', 'on', 'group', 'by', 'order', 'having', 'limit', 'offset', 'as', 'and', 'or', 'not', 'null', 'distinct', 'primary', 'key', 'foreign', 'references', 'default'],
  bash: ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'export', 'local', 'return', 'echo', 'cd', 'exit', 'source', 'sudo'],
  yaml: ['true', 'false', 'null', 'yes', 'no'],
}

function keywordsFor(lang: string): Set<string> {
  return new Set([...(KEYWORDS.common ?? []), ...(KEYWORDS[lang] ?? [])])
}

const NUMBER_RE = /^-?(?:0[xX][\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/
const IDENT_RE = /^[A-Za-z_$\u4e00-\u9fff][\w$\u4e00-\u9fff]*/

/** 判断字符是否为标识符组成 */
const isIdentChar = (c: string) => /[\w$\u4e00-\u9fff]/.test(c)

export interface TokenizerState {
  inBlockComment: boolean
}

export function tokenizeLine(line: string, language: string, state: TokenizerState = { inBlockComment: false }): Token[] {
  const lang = language === 'text' ? 'plain' : language
  const keywords = keywordsFor(lang)
  const tokens: Token[] = []
  let buffer = ''
  let i = 0

  const flush = () => {
    if (buffer) {
      tokens.push({ type: 'plain', value: buffer })
      buffer = ''
    }
  }
  const push = (type: TokenType, value: string) => {
    flush()
    tokens.push({ type, value })
  }

  // 跨行块注释续行：先吃掉注释，再继续解析本行剩余代码
  if (state.inBlockComment) {
    const end = line.indexOf('*/')
    if (end === -1) return [{ type: 'comment', value: line }]
    tokens.push({ type: 'comment', value: line.slice(0, end + 2) })
    state.inBlockComment = false
    i = end + 2
  }

  while (i < line.length) {
    const rest = line.slice(i)
    const ch = line[i]

    // 行注释
    if (lang === 'python' && ch === '#') {
      push('comment', rest)
      break
    }
    if ((lang === 'bash' || lang === 'yaml') && ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      push('comment', rest)
      break
    }
    if (rest.startsWith('//')) {
      push('comment', rest)
      break
    }
    // 块注释
    if (rest.startsWith('/*')) {
      const end = rest.indexOf('*/', 2)
      if (end === -1) {
        push('comment', rest)
        state.inBlockComment = true
        break
      }
      push('comment', rest.slice(0, end + 2))
      i += end + 2
      continue
    }
    if (lang === 'sql' && rest.startsWith('--')) {
      push('comment', rest)
      break
    }

    // 字符串
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < line.length) {
        if (line[j] === '\\') j += 2
        else if (line[j] === ch) {
          j++
          break
        } else j++
      }
      push('string', line.slice(i, j))
      i = j
      continue
    }

    // 数字
    const numMatch = NUMBER_RE.exec(rest)
    if (numMatch && /\d/.test(ch)) {
      push('number', numMatch[0])
      i += numMatch[0].length
      continue
    }

    // 标识符 / 关键字 / 函数调用
    const idMatch = IDENT_RE.exec(rest)
    if (idMatch) {
      const word = idMatch[0]
      const next = line[i + word.length]
      const lower = word.toLowerCase()
      if (keywords.has(word) || (lang === 'sql' && keywords.has(lower))) {
        push('keyword', word)
      } else if (next === '(') {
        push(keywords.has('function') && /^[A-Z]/.test(word) ? 'type' : 'function', word)
      } else if (/^[A-Z]/.test(word) && word.length > 1) {
        push('type', word)
      } else {
        push('plain', word)
      }
      i += word.length
      continue
    }

    if (/[+\-*/%=<>!&|^~?:]/.test(ch)) {
      // 连续运算符合并
      let j = i
      while (j < line.length && /[+\-*/%=<>!&|^~?:]/.test(line[j])) j++
      push('operator', line.slice(i, j))
      i = j
      continue
    }

    if (/[{}()[\],;.]/.test(ch)) {
      push('punct', ch)
      i++
      continue
    }

    if (!isIdentChar(ch)) {
      buffer += ch
      i++
      continue
    }
    buffer += ch
    i++
  }

  flush()
  return tokens
}

/** 特殊语言的分词入口：HTML/CSS/Markdown 用简化规则 */
function tokenizeMarkup(line: string, lang: string): Token[] {
  if (lang === 'html') {
    const tokens: Token[] = []
    const re = /(<\/?)([\w-]+)|(-->)|("[^"]*"|'[^']*')|(\/?>)|([\w-]+)(?==)|(=)/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) {
      if (m.index > last) tokens.push({ type: 'plain', value: line.slice(last, m.index) })
      if (m[1] && m[2]) {
        tokens.push({ type: 'punct', value: m[1] })
        tokens.push({ type: 'keyword', value: m[2] })
      } else if (m[4]) tokens.push({ type: 'string', value: m[4] })
      else if (m[5]) tokens.push({ type: 'punct', value: m[5] })
      else if (m[6]) tokens.push({ type: 'attr', value: m[6] })
      else if (m[7]) tokens.push({ type: 'operator', value: m[7] })
      last = re.lastIndex
    }
    if (last < line.length) tokens.push({ type: 'plain', value: line.slice(last) })
    return tokens
  }
  if (lang === 'css') {
    const tokens: Token[] = []
    const re = /(\/\*.*?\*\/)|(#[\da-fA-F]{3,8})|("[^"]*"|'[^']*')|([.#][\w-]+)|([\w-]+)(?=\s*:)|(:)|(-?\d+(?:\.\d+)?(?:px|rem|em|%|s|deg)?)/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) {
      if (m.index > last) tokens.push({ type: 'plain', value: line.slice(last, m.index) })
      if (m[1]) tokens.push({ type: 'comment', value: m[1] })
      else if (m[2]) tokens.push({ type: 'number', value: m[2] })
      else if (m[3]) tokens.push({ type: 'string', value: m[3] })
      else if (m[4]) tokens.push({ type: 'tag', value: m[4] })
      else if (m[5]) tokens.push({ type: 'attr', value: m[5] })
      else if (m[6]) tokens.push({ type: 'punct', value: m[6] })
      else if (m[7]) tokens.push({ type: 'number', value: m[7] })
      last = re.lastIndex
    }
    if (last < line.length) tokens.push({ type: 'plain', value: line.slice(last) })
    return tokens
  }
  if (lang === 'markdown') {
    const tokens: Token[] = []
    if (/^#{1,6}\s/.test(line)) return [{ type: 'keyword', value: line }]
    if (/^\s*[-*+]\s/.test(line)) {
      const m = /^(\s*[-*+]\s)(.*)$/.exec(line)!
      return [{ type: 'operator', value: m[1] }, { type: 'plain', value: m[2] }]
    }
    if (/^>/.test(line)) return [{ type: 'comment', value: line }]
    const re = /(`[^`]*`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]*\]\([^)]*\))/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) {
      if (m.index > last) tokens.push({ type: 'plain', value: line.slice(last, m.index) })
      tokens.push({ type: /`/.test(m[1]) ? 'string' : 'type', value: m[1] })
      last = re.lastIndex
    }
    if (last < line.length) tokens.push({ type: 'plain', value: line.slice(last) })
    return tokens
  }
  return tokenizeLine(line, lang)
}

/** 整段代码 -> 二维 token 行 */
export function highlight(code: string, language = 'text'): Token[][] {
  const lines = (code ?? '').replace(/\r\n?/g, '\n').split('\n')
  const state: TokenizerState = { inBlockComment: false }
  return lines.map((line) => {
    if (['html', 'css', 'markdown'].includes(language)) return tokenizeMarkup(line, language)
    if (language === 'text') return [{ type: 'plain' as TokenType, value: line }]
    return tokenizeLine(line, language, state)
  })
}

export const HIGHLIGHT_THEMES: HighlightTheme[] = [
  {
    id: 'one-dark',
    name: 'One Dark',
    mode: 'dark',
    background: '#282C34',
    foreground: '#ABB2BF',
    colors: { plain: '#ABB2BF', comment: '#7F848E', keyword: '#C678DD', string: '#98C379', number: '#D19A66', function: '#61AFEF', type: '#E5C07B', operator: '#56B6C2', punct: '#ABB2BF', variable: '#E06C75', tag: '#E06C75', attr: '#D19A66', regex: '#98C379' },
  },
  {
    id: 'monokai',
    name: 'Monokai',
    mode: 'dark',
    background: '#272822',
    foreground: '#F8F8F2',
    colors: { plain: '#F8F8F2', comment: '#75715E', keyword: '#F92672', string: '#E6DB74', number: '#AE81FF', function: '#A6E22E', type: '#66D9EF', operator: '#F92672', punct: '#F8F8F2', variable: '#FD971F', tag: '#F92672', attr: '#A6E22E', regex: '#E6DB74' },
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    mode: 'light',
    background: '#FFFFFF',
    foreground: '#24292F',
    colors: { plain: '#24292F', comment: '#6E7781', keyword: '#CF222E', string: '#0A3069', number: '#0550AE', function: '#8250DF', type: '#953800', operator: '#0550AE', punct: '#24292F', variable: '#953800', tag: '#116329', attr: '#0550AE', regex: '#0A3069' },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    mode: 'dark',
    background: '#282A36',
    foreground: '#F8F8F2',
    colors: { plain: '#F8F8F2', comment: '#6272A4', keyword: '#FF79C6', string: '#F1FA8C', number: '#BD93F9', function: '#50FA7B', type: '#8BE9FD', operator: '#FF79C6', punct: '#F8F8F2', variable: '#FFB86C', tag: '#FF79C6', attr: '#50FA7B', regex: '#F1FA8C' },
  },
  {
    id: 'solarized',
    name: 'Solarized',
    mode: 'dark',
    background: '#002B36',
    foreground: '#93A1A1',
    colors: { plain: '#93A1A1', comment: '#586E75', keyword: '#859900', string: '#2AA198', number: '#D33682', function: '#268BD2', type: '#B58900', operator: '#859900', punct: '#93A1A1', variable: '#CB4B16', tag: '#268BD2', attr: '#B58900', regex: '#2AA198' },
  },
  {
    id: 'nord',
    name: 'Nord',
    mode: 'dark',
    background: '#2E3440',
    foreground: '#D8DEE9',
    colors: { plain: '#D8DEE9', comment: '#616E88', keyword: '#81A1C1', string: '#A3BE8C', number: '#B48EAD', function: '#88C0D0', type: '#8FBCBB', operator: '#81A1C1', punct: '#ECEFF4', variable: '#D08770', tag: '#81A1C1', attr: '#8FBCBB', regex: '#EBCB8B' },
  },
]

export function getHighlightTheme(id?: string): HighlightTheme {
  return HIGHLIGHT_THEMES.find((t) => t.id === id) ?? HIGHLIGHT_THEMES[0]
}

export function tokenStyle(theme: HighlightTheme, type: TokenType): Record<string, string> {
  const color = theme.colors[type] ?? theme.foreground
  const style: Record<string, string> = { color }
  if (type === 'comment') style.fontStyle = 'italic'
  return style
}
