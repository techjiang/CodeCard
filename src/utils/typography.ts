/**
 * 中文排版：中英文之间加空格、全角标点规整。
 * 只处理正文文本，不做 HTML 解析，避免破坏标签结构。
 */

/**
 * 汉字正文区。
 *
 * 不能把 \uff00-\uffef（全角区）整个算进来：那里装着全角标点，
 * 允许它跟拉丁字符之间补空格，就会排出「读取 。」「读取 ， dep」这种
 * 中文正文里不该出现的样子。标点各按开合与行内分开定义，见下。
 */
const CJK = '\u2e80-\u9fff\uf900-\ufaff'
/** 中文成对标点：和拉丁字符相邻时该隔开的，是它们 */
const PAIR_OPEN = '\u201c\u2018\u300c\u300e\uff08\u300a\u3008'
const PAIR_CLOSE = '\u201d\u2019\u300d\u300f\uff09\u300b\u3009'
/** 左侧只有汉字时才补空格：括号里包着中文就别加 */
const CJK_PAIR_OPEN = `[${CJK}${PAIR_OPEN}]`
/** 右侧只有汉字时才补空格 */
const CJK_PAIR_CLOSE = `[${CJK}${PAIR_CLOSE}]`
/** 自带字面空隙的成对标点：无论如何都不跟外侧补空格 */
const WIDE_PAIR_OPEN = '\uff08'
const WIDE_PAIR_CLOSE = '\uff09'
/** 行内标点：不跟拉丁字符隔开，也别把一段连续的拉丁文本切出缝来 */
const CJK_MARK = '\u3001\u3002\uff0c\uff1b\uff1a\uff1f\uff01\u2026\u2014'
/**
 * 半角收尾符后接汉字：`foo()返回` → `foo() 返回`。
 *
 * 半角 `)` `]` `}` 不属于汉字，LATIN_OPEN 只管「字母数字 + 汉字」，
 * 漏掉了它们；可中英混排里 `foo()` 后面紧跟中文太常见。
 */
const ASCII_CLOSE_CJK = new RegExp(`([A-Za-z0-9)\\]}])(?=[${CJK}])`, 'g')
/** 拉丁文本 + 汉字或中文开括号：补空格 */
const LATIN_OPEN = new RegExp(`([A-Za-z0-9])(${CJK_PAIR_OPEN})`, 'g')
/** 汉字或中文闭括号 + 拉丁文本：补空格 */
const CLOSE_LATIN = new RegExp(`(${CJK_PAIR_CLOSE})([A-Za-z0-9])`, 'g')
/** 行内标点 + 拉丁文本：不补空格（上一轮可能已经补了，这里收回来） */
const MARK_LATIN = new RegExp(`([${CJK_MARK}]) ([A-Za-z0-9])`, 'g')
/**
 * 拉丁文本 + 行内标点：看起来像「中英之间」，其实什么都不该加 ——
 * 那个空格是硬塞在 Proxy 和「。」中间的，中文正文里不该出现。
 */
const LATIN_MARK = new RegExp(`([A-Za-z0-9]) ([${CJK_MARK}])`, 'g')
/** 汉字与行内标点之间的空格：`中文 ，` → `中文，` */
const MARK_GAP = new RegExp(`([${CJK}]) +(?=[${CJK_MARK}])`, 'g')
/**
 * 全角括号/引号外侧的空格：`English （混合）` → `English（混合）`。
 * 全角标点自带字面空隙，再补一个半角空格就豁开一道，中文正文里不该有。
 */
const WIDE_PAIR_GAP = new RegExp(`\\s*([${WIDE_PAIR_OPEN}])|([${WIDE_PAIR_CLOSE}])\\s*`, 'g')
/** 成对标点内侧的空格：`「 Proxy 」` → `「Proxy」` */
const PAIR_INNER_GAP = new RegExp(`([${PAIR_OPEN}])( *)([^\\n]*?)( *)([${PAIR_CLOSE}])`, 'g')
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
    const next = out
      .replace(LATIN_OPEN, '$1 $2')
      .replace(ASCII_CLOSE_CJK, '$1 ')
      .replace(CLOSE_LATIN, '$1 $2')
      .replace(MARK_LATIN, '$1$2')
      .replace(LATIN_MARK, '$1$2')
      // 引号/括号内侧不该有空格：`「 Proxy 」` → `「Proxy」`
      .replace(PAIR_INNER_GAP, '$1$3$5')
    if (next === out) break
    out = next
  }
  // 汉字之间的空格删掉：那多半是上一次补空格时挤出来的，中文正文里不该有。
  // 汉字与全角标点之间同理，标点紧跟上文。
  return out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(new RegExp(`([${CJK}]) +([${CJK}])`, 'g'), '$1$2')
    .replace(MARK_GAP, '$1')
    .replace(WIDE_PAIR_GAP, '$1$2')
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
