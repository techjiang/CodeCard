/**
 * 中文排版：中英文之间加空格、全角标点规整。
 * 只处理正文文本，不做 HTML 解析，避免破坏标签结构。
 */

const CJK = '\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef'
// 汉字紧邻拉丁字母/数字时补空格
const CJK_LATIN = new RegExp(`([${CJK}])([A-Za-z0-9@#$%&])`, 'g')
const LATIN_CJK = new RegExp(`([A-Za-z0-9!?%&)])[\\s]*([${CJK}])`, 'g')
// 中文语境下的半角标点转全角
const PUNCT_MAP: Array<[RegExp, string]> = [
  [new RegExp(`([${CJK}])\\s*,\\s*`, 'g'), '$1，'],
  [new RegExp(`([${CJK}])\\s*;\\s*`, 'g'), '$1；'],
  [new RegExp(`([${CJK}])\\s*:\\s*`, 'g'), '$1：'],
  [new RegExp(`([${CJK}])\\s*\\?\\s*`, 'g'), '$1？'],
  [new RegExp(`([${CJK}])\\s*!\\s*`, 'g'), '$1！'],
  [new RegExp(`([${CJK}])\\s*\\.(?=\\s|$)`, 'g'), '$1。'],
]
// 成对括号/引号内的中文内容转全角
const BRACKET_PAIR = new RegExp(`\\(([${CJK}][^()]*)\\)`, 'g')
const QUOTE_PAIR = new RegExp(`"([^"]*[${CJK}][^"]*)"`, 'g')

export function spaceCJK(text: string): string {
  if (!text) return ''
  let out = text
  // 反复处理，避免 "中A中B" 这类连续情况被前一次替换吃掉尾部
  for (let i = 0; i < 3; i++) {
    const next = out.replace(CJK_LATIN, '$1 $2').replace(LATIN_CJK, '$1 $2')
    if (next === out) break
    out = next
  }
  return out.replace(/[ \t]{2,}/g, ' ')
}

export function normalizePunctuation(text: string): string {
  if (!text) return ''
  let out = text
  for (const [re, rep] of PUNCT_MAP) out = out.replace(re, rep)
  out = out.replace(BRACKET_PAIR, '（$1）').replace(QUOTE_PAIR, '“$1”')
  return out
}

/** 完整排版管线：先规整标点，再补空格，最后去掉挤压出的重复空格 */
export function pangu(text: string): string {
  if (!text) return ''
  return spaceCJK(normalizePunctuation(text)).replace(/[ \t]{2,}/g, ' ')
}

/** 只给一段纯文本做排版，跳过代码与行内代码片段 */
export function panguSegments(text: string): string {
  return text
    .split(/(`[^`]*`|```[\s\S]*?```)/g)
    .map((seg, i) => (i % 2 === 1 ? seg : pangu(seg)))
    .join('')
}

/**
 * 长标识符断行点：优先在 . _ / 之后断，别把单词从中间劈开。
 * 输出纯文本，渲染时需按 \n 转成 <wbr>。
 */
export function breakPoints(text: string): string {
  return (
    text
      // 分隔符之后：Object.defineProperty → Object. | defineProperty
      .replace(/([A-Za-z0-9])([._/])(?=[A-Za-z0-9])/g, '$1$2\n')
      // 驼峰：defineProperty → define | Property
      .replace(/([a-z0-9])(?=[A-Z][a-z])/g, '$1\n')
  )
}

/**
 * 文本切成「断点」片段：渲染时片段之间插入 <wbr>。
 * 用零宽空格而不是 <wbr>：<wbr> 只提供一个断点，片段本身超宽时
 * 浏览器仍会从中间硬拆；零宽空格在行内元素里表现更稳。
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
