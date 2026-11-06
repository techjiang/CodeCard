/**
 * 轻量 LaTeX 渲染：把公式排成结构化 HTML，而不是把 `\frac{a}{b}` 原样摊在卡片上。
 *
 * 为什么不引 KaTeX / MathJax：这两个都带字体文件和一大坨布局代码，而卡片是
 * 纯本地、单文件可离线打开的产物，包体与字体子集化的代价都不划算。这里只支持
 * 技术卡片上真会出现的写法：分式、上下标、根式、求和积分、希腊字母与常用符号。
 *
 * 输出是 HTML 字符串（内容全部转义），由组件 v-html 挂进 DOM。导出渲染器逐节点读
 * 计算样式，所以预览里排成什么样，导出图就是什么样。
 */

/** 希腊字母与常用符号 */
const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ',
  eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
  pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ',
  psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
  Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·', ast: '∗', star: '⋆', circ: '∘',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡',
  sim: '∼', simeq: '≃', propto: '∝', ll: '≪', gg: '≫',
  infty: '∞', partial: '∂', nabla: '∇', emptyset: '∅', varnothing: '∅',
  to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔', Rightarrow: '⇒',
  Leftarrow: '⇐', Leftrightarrow: '⇔', mapsto: '↦', implies: '⟹', iff: '⟺',
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇',
  cup: '∪', cap: '∩', setminus: '∖', forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨',
  ldots: '…', cdots: '⋯', dots: '…', vdots: '⋮', ddots: '⋱',
  angle: '∠', perp: '⊥', parallel: '∥', triangle: '△', square: '□',
  because: '∵', therefore: '∴', prime: '′', degree: '°',
  langle: '⟨', rangle: '⟩', lbrace: '{', rbrace: '}', lbrack: '[', rbrack: ']',
  // 函数名当直立文本
  sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec', csc: 'csc',
  arcsin: 'arcsin', arccos: 'arccos', arctan: 'arctan',
  log: 'log', ln: 'ln', lg: 'lg', exp: 'exp', lim: 'lim', max: 'max', min: 'min',
  sup: 'sup', inf: 'inf', det: 'det', dim: 'dim', ker: 'ker', deg: 'deg', gcd: 'gcd',
  mod: 'bmod', bmod: 'bmod',
}
/** 函数名要直立排版 */
const UPRIGHT = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'log', 'ln', 'lg', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'dim', 'ker', 'deg', 'gcd'])
/** 大型运算符：上下限排在上下方而不是右侧 */
const LIMIT_OPS: Record<string, string> = {
  sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬', iiint: '∭', oint: '∮', bigcup: '⋃', bigcap: '⋂',
}
/** 间距命令 */
const SPACES: Record<string, string> = {
  ',': '\u2009', ':': '\u2005', ';': '\u2004', '!': '', quad: '\u2003', qquad: '\u2003\u2003', ' ': ' ',
}
/** 只影响字形、内容照排的命令 */
const IGNORED = new Set(['left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'displaystyle', 'textstyle', 'limits', 'nolimits', 'mathrm', 'operatorname', 'mathbin', 'mathrel'])

type Node =
  | { k: 'text'; v: string; upright?: boolean }
  | { k: 'frac'; num: Node[]; den: Node[] }
  | { k: 'sqrt'; body: Node[] }
  | { k: 'op'; v: string; sup: Node[] | null; sub: Node[] | null }
  | { k: 'script'; base: Node[]; sup: Node[] | null; sub: Node[] | null }

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * 递归下降解析。
 *
 * 只维护一个下标前进，不做 token 流：公式语法太浅，`{` / `}` 就是全部作用域，
 * 一个 index 反而比状态机好读。
 */
class Parser {
  private i = 0
  /** 只有 cases / matrix 里 `&` 才是列分隔，别处的 `&` 就是个字符 */
  private envDepth = 0
  constructor(private readonly src: string) {}

  parseUntil(stop: boolean): Node[] {
    const nodes: Node[] = []
    while (this.i < this.src.length) {
      const ch = this.src[this.i]
      if (stop && ch === '}') {
        this.i++
        return nodes
      }
      if (ch === '{') {
        this.i++
        nodes.push(...this.parseUntil(true))
        continue
      }
      if (ch === '}') {
        // 落单的右括号：当普通字符处理，别把后面的公式全吞掉
        this.i++
        nodes.push({ k: 'text', v: '}' })
        continue
      }
      if (ch === '^' || ch === '_') {
        // 上下标挂在「前一个原子」上，前面什么都没有时它自己当底
        const base = nodes.length ? [nodes.pop()!] : []
        const script = this.readScripts()
        nodes.push({ k: 'script', base, sup: script.sup, sub: script.sub })
        continue
      }
      if (ch === '\\') {
        const node = this.readCommand()
        if (!node) continue
        if (node.k === 'op') {
          const script = this.readScripts()
          nodes.push({ ...node, sup: script.sup, sub: script.sub })
        } else nodes.push(node)
        continue
      }
      if (ch === ' ') {
        this.i++
        continue
      }
      if (ch === '&') {
        this.i++
        // 环境里的 `&` 是列分隔符，单列排版时留个空白即可；
        // 环境外的 `&` 是内容本身，丢了就等于吃字。
        nodes.push({ k: 'text', v: this.envDepth > 0 ? '\u2003' : '&' })
        continue
      }
      if (ch === '~') {
        this.i++
        nodes.push({ k: 'text', v: '\u00a0' })
        continue
      }
      // 连续普通字符并成一段，减少节点数（导出时每个文本节点都要量一遍）
      let text = ''
      while (this.i < this.src.length && !'\\^_{}~&'.includes(this.src[this.i])) text += this.src[this.i++]
      nodes.push({ k: 'text', v: text })
    }
    return nodes
  }

  /** 读 `^x` / `_x`，两种顺序都认 */
  private readScripts(): { sup: Node[] | null; sub: Node[] | null } {
    let sup: Node[] | null = null
    let sub: Node[] | null = null
    for (let guard = 0; guard < 2; guard++) {
      while (this.src[this.i] === ' ') this.i++
      const ch = this.src[this.i]
      if (ch !== '^' && ch !== '_') break
      this.i++
      while (this.src[this.i] === ' ') this.i++
      const arg = this.readAtom()
      if (ch === '^') sup = arg
      else sub = arg
    }
    return { sup, sub }
  }

  /** 一个原子：{...} 整组，或单个字符/命令 */
  private readAtom(): Node[] {
    while (this.src[this.i] === ' ') this.i++
    const ch = this.src[this.i]
    if (ch === undefined) return []
    if (ch === '{') {
      this.i++
      return this.parseUntil(true)
    }
    if (ch === '\\') {
      const node = this.readCommand()
      return node ? [node] : []
    }
    this.i++
    return [{ k: 'text', v: ch }]
  }

  private readCommand(): Node | null {
    this.i++ // 跳过反斜杠
    if (this.i >= this.src.length) return { k: 'text', v: '\\' }
    // 反斜杠 + 符号：间距命令、转义字符、换行
    const punctuation = this.src[this.i]
    if (!/[A-Za-z]/.test(punctuation)) {
      this.i++
      if (punctuation === '\\') return { k: 'text', v: '\n' }
      if (punctuation in SPACES) return { k: 'text', v: SPACES[punctuation] }
      return { k: 'text', v: punctuation }
    }
    let name = ''
    while (this.i < this.src.length && /[A-Za-z]/.test(this.src[this.i])) name += this.src[this.i++]
    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
      return { k: 'frac', num: this.readAtom(), den: this.readAtom() }
    }
    if (name === 'sqrt') {
      // \sqrt[3]{x} 的根指数先不细分，统一按根号处理
      while (this.src[this.i] === ' ') this.i++
      if (this.src[this.i] === '[') {
        const close = this.src.indexOf(']', this.i)
        if (close > 0) this.i = close + 1
      }
      return { k: 'sqrt', body: this.readAtom() }
    }
    if (name === 'begin' || name === 'end') {
      // 环境：cases/matrix 这类按行排，这里统一成「按行显示」，比露出 \begin 好
      while (this.src[this.i] === ' ') this.i++
      this.readRawGroup()
      if (name === 'begin') this.envDepth++
      else this.envDepth = Math.max(0, this.envDepth - 1)
      return null
    }
    if (name === 'text' || name === 'mathrm' || name === 'operatorname' || name === 'textrm' || name === 'mathbf') {
      while (this.src[this.i] === ' ') this.i++
      const raw = this.readRawGroup()
      return { k: 'text', v: raw, upright: true }
    }
    if (name in LIMIT_OPS) return { k: 'op', v: LIMIT_OPS[name], sup: null, sub: null }
    if (name in SPACES) return { k: 'text', v: SPACES[name] }
    if (name in SYMBOLS) {
      const v = SYMBOLS[name]
      return { k: 'text', v, upright: UPRIGHT.has(name) }
    }
    if (IGNORED.has(name)) return null
    // 不认识的命令：印名字（`\foo` → foo），总比露出反斜杠好
    return { k: 'text', v: name, upright: true }
  }

  /** `\text{原始内容}`：里面的花括号要配平 */
  private readRawGroup(): string {
    if (this.src[this.i] !== '{') return ''
    this.i++
    let depth = 1
    let out = ''
    while (this.i < this.src.length) {
      const ch = this.src[this.i++]
      if (ch === '{') depth++
      if (ch === '}') {
        depth--
        if (!depth) break
      }
      out += ch
    }
    return out
  }
}

/** 单行公式的 HTML */
function renderRow(nodes: Node[]): string {
  return nodes.map(renderNode).join('')
}

function renderNode(node: Node): string {
  switch (node.k) {
    case 'text':
      return node.upright ? `<span class="lt-upright">${esc(node.v)}</span>` : esc(node.v)
    case 'frac':
      return (
        `<span class="lt-frac">` +
        `<span class="lt-frac__num">${renderRow(node.num)}</span>` +
        `<span class="lt-frac__bar"></span>` +
        `<span class="lt-frac__den">${renderRow(node.den)}</span>` +
        `</span>`
      )
    case 'sqrt':
      return `<span class="lt-sqrt"><span class="lt-sqrt__sign">√</span><span class="lt-sqrt__body">${renderRow(node.body)}</span></span>`
    case 'op': {
      const sup = node.sup ? `<span class="lt-lim__sup">${renderRow(node.sup)}</span>` : ''
      const sub = node.sub ? `<span class="lt-lim__sub">${renderRow(node.sub)}</span>` : ''
      if (!sup && !sub) return `<span class="lt-op">${esc(node.v)}</span>`
      return `<span class="lt-lim">${sup}<span class="lt-op">${esc(node.v)}</span>${sub}</span>`
    }
    case 'script': {
      const base = renderRow(node.base)
      const sup = node.sup ? `<sup class="lt-sup">${renderRow(node.sup)}</sup>` : ''
      const sub = node.sub ? `<sub class="lt-sub">${renderRow(node.sub)}</sub>` : ''
      return `<span class="lt-script">${base}${sup}${sub}</span>`
    }
  }
}

/** 公式源码 → 每行一段 HTML */
export function renderLatex(src: string): string[] {
  const cleaned = (src ?? '')
    .replace(/^\s*\$+|\$+\s*$/g, '')
    .replace(/^\s*\\\[|\\\]\s*$/g, '')
    .replace(/^\s*\\\(|\\\)\s*$/g, '')
    .trim()
  if (!cleaned) return []
  // 顶层换行：`\\` 是公式内的换行，`\n` 是用户敲的换行，都当成新的一行
  const rows = cleaned.split(/\\\\|\n/)
  return rows
    .map((row) => new Parser(row).parseUntil(false))
    .map((nodes) => renderRow(nodes).trim())
    .filter(Boolean)
}
