/**
 * 中文排版：中英文之间加空格、全角标点规整。
 *
 * 规则只有一处定义：`needsGap`（两个紧贴的字符之间该不该隔开）。
 * 正文、行内代码、加粗/斜体/链接的拼接边界全走这一套 —— 之前各写一套正则，
 * A 补的空格被 B 收回、B 收回的又被 C 补回来，叠三轮之后没人说得清最终形状。
 */

/**
 * 汉字正文区。
 *
 * 两处都踩过，都是「把标点当汉字」：
 * - `\uff00-\uffef` 是全角区，装着全角标点，算成汉字就会排出「读取 。」
 * - `\u2e80-\u9fff` 含 U+3000–U+303F，那一整块也是中文标点（、。「」【】），
 *   更隐蔽：`汉)。` 会变成 `汉) 。`
 */
const HAN = '\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff'
/** 中文成对标点的开：与拉丁文本相邻时该隔开 */
const PAIR_OPEN = '\u201c\u2018\u300c\u300e\u300a\u3008\u3010'
/** 中文成对标点的闭 */
const PAIR_CLOSE = '\u201d\u2019\u300d\u300f\u300b\u3009\u3011'
/** 全角括号：自带字面空隙，内外都不补 */
const WIDE_PAIR = '\uff08\uff09'
/** 行内标点：两侧都不补空格，也不参与「中英之间」判定 */
const MARK = '\u3001\u3002\uff0c\uff1b\uff1a\uff1f\uff01\u2026\u2014'
/** 半角收尾符：`foo()` 后面紧跟中文，中间该有一个空格 */
const ASCII_CLOSE = ')\]}'

const HAN_RE = new RegExp(`[${HAN}]`)

/**
 * 「拉丁词」的两个边界方向要分开看，因为有些符号只能收尾、不能开头。
 *
 * - `%` `+` 收尾：`100%`、`C++` 是一个词，后面接汉字时该隔开，原有空格也不能收
 * - `$` `#` `@` 开头：`$10`、`#1`、`@user` 是一个词，前面接汉字时该隔开
 *
 * 混成一个字符集会排出 `# 标签`（把话题标签拆成井号 + 空格 + 词），所以得分开。
 */
const LATIN_TAIL_RE = /[A-Za-z0-9%+]/
const LATIN_HEAD_RE = /[A-Za-z0-9$#@]/
/**
 * 紧贴文字的半角括号与引号：`函数 )`、`( 参数` 里的空白该收回。
 *
 * 只认括号和引号，不认 `%` `+` `#` 这类运算符 —— 那些是词的一部分，
 * 收掉空格就把 `100% 以上` 粘成 `100%以上`，还补不回来。
 */
const ASCII_OPEN = '([{'
const ASCII_CLOSE_TIGHT = ')]}\'"`'

function has(set: string, ch: string): boolean {
  return !!ch && set.includes(ch)
}

/** 两个紧贴的字符之间该不该有一个空格（原本没有任何空格时） */
export function needsGap(left: string, right: string): boolean {
  if (!left || !right) return false
  // 中文行内标点紧跟上文，两侧都不补
  if (has(MARK, left) || has(MARK, right)) return false
  // 全角括号自带空隙
  if (has(WIDE_PAIR, left) || has(WIDE_PAIR, right)) return false
  // 成对标点内侧：`「 Proxy 」` 是错的
  if (has(PAIR_OPEN, left) || has(PAIR_CLOSE, right)) return false
  const leftLatin = LATIN_TAIL_RE.test(left)
  const rightLatin = LATIN_HEAD_RE.test(right)
  const leftHan = HAN_RE.test(left)
  const rightHan = HAN_RE.test(right)
  // 汉字 ↔ 拉丁
  if ((leftLatin && rightHan) || (leftHan && rightLatin)) return true
  // 半角收尾符后接词：`foo()返回` → `foo() 返回`
  if (has(ASCII_CLOSE, left) && (rightHan || rightLatin)) return true
  // 拉丁文本与中文开引号、闭引号与拉丁文本之间，同样算「中英之间」
  if (leftLatin && has(PAIR_OPEN, right)) return true
  if (has(PAIR_CLOSE, left) && rightLatin) return true
  return false
}

/**
 * 一处已经存在的空格要不要留下。
 *
 * 原则是「用户敲的空格默认是对的」，只有规则能说清哪里错才收。
 *
 * 旧实现反过来：只要有一侧是汉字，而 `needsGap` 又没判定要补，就一律收掉。
 * 于是 `100% 以上`、`C++ 和`、`Hello, 世界`、`第 3 章 #1` 里的空格全被吃掉 ——
 * 那些空格不是多余，是词与词的边界。
 */
function keepSpace(left: string, right: string): boolean {
  if (!left || !right) return false
  if (needsGap(left, right)) return true
  // 标点、全角括号、成对标点内侧：一律收回
  if (has(MARK, left) || has(MARK, right)) return false
  if (has(WIDE_PAIR, left) || has(WIDE_PAIR, right)) return false
  // 成对标点：内侧（`「 ref`、`ref 」`）和外侧贴汉字（`用 「ref」`）都不留空白，
  // 只有外侧挨着拉丁文本时才该隔开 —— 那种情况上一行的 needsGap 已经放行了
  if (has(PAIR_OPEN, left) || has(PAIR_OPEN, right) || has(PAIR_CLOSE, left) || has(PAIR_CLOSE, right)) return false
  // 半角括号紧贴汉字：`函数 )`、`( 参数` 两侧的空白收回
  if (HAN_RE.test(left) && has(ASCII_CLOSE_TIGHT, right)) return false
  if (has(ASCII_OPEN, left) && HAN_RE.test(right)) return false
  return true
}

/** 排版单元：`text` 可以是单个字符，也可以是一整段不可拆的内容（行内代码） */
export interface SpacedUnit {
  text: string
  /**
   * 不可拆的单元（行内代码、链接）。
   *
   * 它自身是「一个词」：内部原样保留，但边界判定不能用反引号去比 ——
   * 得拿内容的首尾字符说话，否则 `用 `Vue3` 做前端` 会因为反引号不算拉丁字母而不补空格。
   */
  opaque?: boolean
  /** 边界判定用的首字符，缺省取 text[0] */
  head?: string
  /** 边界判定用的尾字符，缺省取 text[text.length - 1] */
  tail?: string
  /** 归属于哪个 token，调用方据此把输出聚回节点 */
  tok?: number
}

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\u00a0' || ch === '\t'
}

/**
 * 按单位走一遍：该隔开的补一个空格，不该留的收掉，连续空白压成一个。
 *
 * `tok` 会被带到输出的空格上（记 -1），调用方据此把它们还原成文本节点。
 */
export function spaceUnits(input: SpacedUnit[]): SpacedUnit[] {
  const out: SpacedUnit[] = []
  let last = ''
  let pending: SpacedUnit | null = null

  for (const unit of input) {
    const ch = unit.text
    if (!unit.opaque && ch.length === 1 && isSpace(ch)) {
      pending ??= unit
      continue
    }
    if (!ch) continue
    const first = unit.head ?? ch[0]
    if (last) {
      const sep = pending ? keepSpace(last, first) : needsGap(last, first)
      const tail = out[out.length - 1]
      if (sep && tail && !(tail.text.length === 1 && isSpace(tail.text))) out.push({ text: ' ', tok: -1 })
    }
    pending = null
    out.push(unit)
    last = unit.tail ?? ch[ch.length - 1]
  }
  return out
}

/** 字符级入口：纯文本排版 */
export function spaceCJK(text: string): string {
  if (!text) return ''
  const units: SpacedUnit[] = Array.from(text, (ch) => ({ text: ch }))
  return spaceUnits(units).map((u) => u.text).join('')
}

// 中文语境下的半角标点转全角
const PUNCT_MAP: Array<[RegExp, string]> = [
  [new RegExp(`([${HAN}])\\s*,\\s*`, 'g'), '$1，'],
  [new RegExp(`([${HAN}])\\s*;\\s*`, 'g'), '$1；'],
  [new RegExp(`([${HAN}])\\s*:\\s*`, 'g'), '$1：'],
  [new RegExp(`([${HAN}])\\s*\\?\\s*`, 'g'), '$1？'],
  [new RegExp(`([${HAN}])\\s*!\\s*`, 'g'), '$1！'],
  [new RegExp(`([${HAN}])\\s*\\.(?=\\s|$)`, 'g'), '$1。'],
]
// 成对括号/引号内的中文内容转全角
const BRACKET_PAIR = new RegExp(`\\(([${HAN}][^()]*)\\)`, 'g')
const QUOTE_PAIR = new RegExp(`"([^"]*[${HAN}][^"]*)"`, 'g')

export function normalizePunctuation(text: string): string {
  if (!text) return ''
  let out = text
  for (const [re, rep] of PUNCT_MAP) out = out.replace(re, rep)
  out = out.replace(BRACKET_PAIR, '（$1）').replace(QUOTE_PAIR, '“$1”')
  return out
}

/** 完整排版管线：先规整标点，再补空格 */
export function pangu(text: string): string {
  if (!text) return ''
  return spaceCJK(normalizePunctuation(text))
}

/**
 * 代码片段切分：整块代码与行内代码都原样保留，不参与标点规整与补空格。
 * 只认行内代码不认跨行，免得把正文里落单的反引号当成代码开头。
 */
const CODE_SPAN = /(```[\s\S]*?```|`[^`\n]*`)/g

/** 把带行内代码的文本拆成排版单元：代码是一整块不可拆的，其余逐字符 */
export function textUnits(text: string, tok = 0): SpacedUnit[] {
  const units: SpacedUnit[] = []
  let last = 0
  const re = new RegExp(CODE_SPAN.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    for (const ch of text.slice(last, m.index)) units.push({ text: ch, tok })
    // 行内代码的边界按内容首尾算：反引号不是拉丁字母，拿去比就永远补不出空格
    const inner = m[0]
      .replace(/^```[^\n]*\n?|```$/g, '')
      .replace(/^`|`$/g, '')
      .trim()
    units.push({ text: m[0], opaque: true, head: inner[0], tail: inner[inner.length - 1], tok })
    last = re.lastIndex
  }
  for (const ch of text.slice(last)) units.push({ text: ch, tok })
  return units
}

/** 只给一段纯文本做排版，跳过代码与行内代码片段 */
export function panguSegments(text: string): string {
  if (!text) return ''
  return spaceUnits(textUnits(normalizePunctuationPreservingCode(text))).map((u) => u.text).join('')
}

/** 标点规整只作用在代码之外 */
function normalizePunctuationPreservingCode(text: string): string {
  return text
    .split(CODE_SPAN)
    .map((seg, i) => (i % 2 === 1 ? seg : normalizePunctuation(seg)))
    .join('')
}

/**
 * 长标识符断行点：优先在 . _ / 之后断，别把单词从中间劈开。
 * 输出纯文本，渲染时需按 \n 转成断点。
 *
 * **数字里的点不是分隔符。** `99.9999`、`v1.2.0`、`192.168.0.1` 按「点后断开」
 * 处理会变成两个数：导出图上 `99.9999` 折行成 `99.` + `9999`，读起来就是另一个值。
 * 早期版本就是这么排的，而且只在窄卡片上才现形。
 */
export function breakPoints(text: string): string {
  /** 两侧都是数字：中间那个点是小数点，不是分隔符 */
  const decimal = (left: string, right: string) => /\d/.test(left) && /\d/.test(right)
  return (
    text
      // 分隔符之后：Object.defineProperty → Object. | defineProperty
      .replace(/([A-Za-z0-9])([._/])(?=[A-Za-z0-9])/g, (match, left: string, sep: string, offset: number, whole: string) => {
        const right = whole[offset + 2] ?? ''
        return decimal(left, right) ? match : `${left}${sep}\n`
      })
      // 驼峰：defineProperty → define | Property
      .replace(/([a-z0-9])(?=[A-Z][a-z])/g, '$1\n')
  )
}

/**
 * 文本切成「断点」片段：渲染时片段之间插入零宽空格。
 */
export function textParts(value: string): string[] {
  return value.split('\n')
}

/**
 * 断点片段之间要插入的字符。
 *
 * 用零宽空格而不是 `<wbr>`：`<wbr>` 只给浏览器一个断点，片段本身比整行还宽时
 * 浏览器仍会从中间硬拆；零宽空格是真实字符，浏览器会先在这里断。
 */
export const ZWSP = '\u200B'

/** 断点片段：渲染时片段之间插零宽空格 */
export function breakParts(text: string): string[] {
  return text.split('\n')
}
