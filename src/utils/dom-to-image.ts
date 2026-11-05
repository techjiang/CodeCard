/**
 * DOM -> Canvas：把卡片 DOM 树按计算样式逐节点绘制。
 * 不依赖 html2canvas / foreignObject，体积小且结果可预测。
 */

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META'])
const INLINE_TAGS = new Set(['SPAN', 'A', 'STRONG', 'EM', 'B', 'I', 'CODE', 'SMALL', 'MARK', 'TIME'])

export interface RenderOptions {
  /** 输出像素与 CSS 像素的倍数 */
  scale: number
  /** 卡片设计尺寸（CSS px），不含预览缩放 */
  width: number
  height: number
  /** 兜底底色 */
  background?: string
}

function px(value: string | null | undefined): number {
  const n = parseFloat(value ?? '0')
  return Number.isFinite(n) ? n : 0
}

/** 预览区可能对卡片做了 CSS 缩放，这里把视觉尺寸折算回设计尺寸 */
let cssScale = 1
/**
 * 每个元素自己叠加的缩放倍率（自适应放大时内容整体乘一个倍率撑满卡片）。
 *
 * 这类缩放同时改位置、尺寸和字号，而且不是叠在 cssScale 上的一层，
 * 所以各级元素各记一个倍率，折算回设计尺寸时除掉它。
 */
const zoomOf = new WeakMap<Element, number>()

function zoomFactor(el: Element | null | undefined): number {
  let k = 1
  let node: Element | null = el ?? null
  while (node) {
    k *= zoomOf.get(node) ?? 1
    node = node.parentElement
  }
  return k
}

/**
 * 元素自身的缩放倍率。
 *
 * 以自定义属性 --cc-fit 为准：zoom 读不到（Chrome 会把计算值折回 1、
 * Safari 干脆不认这个属性），而 --cc-fit 是我们自己写上去的内容倍率，
 * 两种浏览器都读得到。
 */
function zoomValue(el: HTMLElement, cs: CSSStyleDeclaration): number {
  const candidates = [cs.getPropertyValue('--cc-fit'), el.style?.zoom, cs.zoom]
  for (const raw of candidates) {
    const n = parseFloat((raw ?? '').trim())
    if (Number.isFinite(n) && n > 0 && n !== 1) return n
  }
  return 1
}

/** 元素自身（含祖先）的 CSS transform 缩放 */
function transformFactor(el: Element | null | undefined): number {
  let k = 1
  let node: Element | null = el ?? null
  while (node) {
    const t = (node as HTMLElement).style?.transform || ''
    const m = /matrix\(([^)]+)\)/.exec(t)
    if (m) {
      const n = m[1].split(',').map(Number)
      if (n.length >= 2 && n[0] > 0) k *= n[0]
    }
    node = node.parentElement
  }
  return k
}

/** 元素相对设计稿的累计倍率：预览缩放 × 各级 transform × 各级 zoom */
function totalScale(el: Element | null | undefined): number {
  return cssScale * transformFactor(el) * zoomFactor(el)
}
let lastCtx: CanvasRenderingContext2D | null = null

function norm(rect: DOMRect, rootRect: DOMRect, el?: Element | null) {
  const k = el ? totalScale(el) : cssScale
  return {
    left: (rect.left - rootRect.left) / k,
    top: (rect.top - rootRect.top) / k,
    width: rect.width / k,
    height: rect.height / k,
  }
}

// ---------- 渐变 ----------

/** CSS 渐变角度换算：0deg 朝上，顺时针；渐变线过中心 */
function gradientCoords(angleDeg: number, w: number, h: number): [number, number, number, number] {
  const rad = (angleDeg * Math.PI) / 180
  const sin = Math.sin(rad)
  const cos = Math.cos(rad)
  const len = Math.abs(w * sin) + Math.abs(h * cos)
  const cx = w / 2
  const cy = h / 2
  const dx = (sin * len) / 2
  const dy = (-cos * len) / 2
  return [cx - dx, cy - dy, cx + dx, cy + dy]
}

function splitTopLevel(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of value) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts
}

/** 取首个颜色作为边缘兜底，避免渐变缝隙露黑 */
function firstColor(value: string): string | null {
  const match = /rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/.exec(value)
  return match ? match[0] : null
}

function parseGradient(ctx: CanvasRenderingContext2D, value: string, w: number, h: number, ox: number, oy: number): CanvasGradient | null {
  const linear = /linear-gradient\((.*)\)/.exec(value)
  if (linear) {
    const parts = splitTopLevel(linear[1])
    let angle = 180
    const stops: Array<[number, string]> = []
    for (const raw of parts) {
      const piece = raw.trim()
      const angleMatch = /^(-?[\d.]+)deg$/.exec(piece)
      if (angleMatch) {
        angle = parseFloat(angleMatch[1])
        continue
      }
      const toMatch = /^to\s+(top|bottom|left|right)/.exec(piece)
      if (toMatch) {
        angle = ({ top: 0, right: 90, bottom: 180, left: 270 } as Record<string, number>)[toMatch[1]] ?? 180
        continue
      }
      const colorStop = /^(\S+?)(?:\s+([\d.]+)%)?$/.exec(piece)
      if (colorStop) stops.push([colorStop[2] ? parseFloat(colorStop[2]) / 100 : NaN, colorStop[1]])
    }
    if (stops.length < 2) return null
    const [x1, y1, x2, y2] = gradientCoords(angle, w, h)
    const gradient = ctx.createLinearGradient(x1 + ox, y1 + oy, x2 + ox, y2 + oy)
    stops.forEach(([pos, color], idx) => {
      const offset = Number.isNaN(pos) ? idx / (stops.length - 1) : pos
      try {
        gradient.addColorStop(Math.min(1, Math.max(0, offset)), color)
      } catch {
        gradient.addColorStop(Math.min(1, Math.max(0, offset)), 'transparent')
      }
    })
    return gradient
  }

  const radial = /radial-gradient\((.*)\)/.exec(value)
  if (radial) {
    const parts = splitTopLevel(radial[1]).filter((p) => !/^(circle|ellipse|at)\b/.test(p.trim()))
    const cx = w / 2 + ox
    const cy = h / 2 + oy
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) / 1.4)
    parts.forEach((color, idx) => {
      try {
        gradient.addColorStop(idx / Math.max(1, parts.length - 1), color.trim())
      } catch {
        /* 忽略无法解析的颜色 */
      }
    })
    return gradient
  }
  return null
}

// ---------- 基础绘制 ----------

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function isEllipsis(el: HTMLElement, cs: CSSStyleDeclaration): boolean {
  return cs.textOverflow === 'ellipsis' && cs.whiteSpace === 'nowrap' && cs.overflow === 'hidden'
}

function clipText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, ellipsis: boolean): string {
  if (!ellipsis || ctx.measureText(text).width <= maxWidth) return text
  let out = text
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1)
  return `${out}…`
}

/**
 * 逐字贪心断行。只在拿不到浏览器真实断行时兜底。
 *
 * 预览是浏览器按词断的，逐字算出来的断点经常和预览差一两个字。
 * 所以正常路径走 layoutRuns：直接读浏览器排好版的行盒位置。
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, ellipsis: boolean): string[] {
  if (!text) return []
  if (maxWidth <= 0) return [text]
  return greedyLines(ctx, clipText(ctx, text, maxWidth, ellipsis), maxWidth)
}

// ---------- 行盒 ----------

/**
 * 复用绘制用的上下文量字。
 *
 * 自己另建一个离屏 canvas 看着更干净，但在某些环境里拿到的是另一套上下文，
 * 字体设不进去、量出来的宽度全是 0，断行结果就和真实排版对不上。
 *
 * @param font 调用方要用的字体串，量完字顺手设上
 */
function measureCtx(font?: string): CanvasRenderingContext2D | null {
  const ctx = lastCtx ?? (typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d'))
  if (ctx && font) ctx.font = font
  return ctx
}

function applyFont(ctx: CanvasRenderingContext2D, style: CSSStyleDeclaration) {
  // 字体串拼不完整时 canvas 会静默保留上一个字体，量出来的是别的字宽。
  // jsdom 这类环境设了也读不回来，所以只要求字号，字体缺了用默认的，量出来的相对宽度仍然可用。
  const size = style.fontSize || '16px'
  const family = style.fontFamily || 'sans-serif'
  ctx.font = `${style.fontStyle || 'normal'} ${style.fontWeight || '400'} ${size} ${family}`.trim()
}

/** 行内代码的内边距会把可用宽度再吃掉一截 */
function insidePadding(style: CSSStyleDeclaration): number {
  return px(style.paddingLeft) + px(style.paddingRight)
}

/** 断行点两侧的字符 */
function isBreakSpace(ch: string): boolean {
  return ch === ' ' || ch === '\u200B'
}

/** 汉字与中文标点：它们之间任意位置都能断 */
const CJK = /[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef]/

/** 分隔符之后可以断：`a/b`、`a.b`、`a-b` 看着不断，实际浏览器也接受 */
const BREAK_AFTER = '._/-'

/** 位置 i 是不是一个浏览器认可的断点（落在 chars[i-1] 与 chars[i] 之间） */
function isBreakable(chars: string[], i: number): boolean {
  if (i <= 0 || i >= chars.length) return false
  const before = chars[i - 1]
  const after = chars[i]
  if (isBreakSpace(before) || isBreakSpace(after)) return true
  if (BREAK_AFTER.includes(before)) return true
  return CJK.test(before) || CJK.test(after)
}

/**
 * 在一段要断开的字符里往前找一个体面的断点：
 * 空格、零宽空格、CJK 边界，或者 . _ / - 之后。找不到就按原位置硬断。
 *
 * 不找断点的后果是逐字硬切：`Proxy 与 defineProperty` 会排成
 * `Proxy 与 defineP` / `roperty`，而预览里浏览器在空格处断成 `Proxy 与` / `defineProperty`。
 */
function preferBreak(chars: string[], cut: number): number {
  for (let i = cut; i > 0; i--) if (isBreakable(chars, i)) return i
  return cut
}

/**
 * 中文标点不能出现在行首（避头尾）。浏览器遇到这种情况会把它「悬挂」到上一行的
 * 行盒之外 —— 行盒量出来的宽度不含它，行首看着也没有它。
 */
const NO_LINE_START = '，。、；：？！）》」』】…—,.;:?!)]}'

/**
 * 贪心断行：一行能塞多少塞多少，回退到最近的合法断点。
 * 只按宽度切的话会把词从中间劈开，导出的换行位置就和预览对不上。
 */
function greedyLines(ctx: CanvasRenderingContext2D, text: string, limit: number): string[] {
  const chars = Array.from(text)
  const lines: string[] = []
  let start = 0
  while (start < chars.length) {
    // 量整串前缀而不是逐字累加：字距、连字都会让单字宽度之和偏大
    let fit = start
    while (fit < chars.length && ctx.measureText(chars.slice(start, fit + 1).join('')).width <= limit + 1) fit++
    if (fit >= chars.length) {
      lines.push(chars.slice(start).join('').trim())
      break
    }
    let cut = start + preferBreak(chars.slice(start), Math.max(1, fit - start))
    // 断在标点前就把它一起带上：浏览器会把行末标点悬挂到行盒之外 ——
    // 行盒宽度不含它，行首也看不到它。不模拟这一步，句号就被挤到下一行，
    // 孤零零占一整行。
    while (cut < chars.length && NO_LINE_START.includes(chars[cut])) cut++
    if (cut <= start) cut = start + 1
    lines.push(chars.slice(start, cut).join('').trim())
    start = cut
  }
  return lines
}

/**
 * 一段文字在一个固定宽度里会排成哪几行。
 *
 * 有真实行盒就能验证：按行盒宽切出来的行，前几行应当贴着行盒右边缘，
 * 且每一行都不该比浏览器给的那条行盒更宽。对不上说明切歪了，
 * 这时把宽度收到「浏览器真排出来的最宽一行」再切一次；
 * 还不行就整段画（可能出一行略宽）也不要错行。
 * 量不出字宽的环境（jsdom）直接整段返回。
 */
function splitLines(
  text: string,
  style: CSSStyleDeclaration,
  width: number,
  ctx: CanvasRenderingContext2D | null,
  /** 已知浏览器把这段文字断成了几行时传进来，切出来的行数得对得上 */
  expectLines = 0,
  /** 浏览器每行的行盒宽度（CSS px），用来验切出来的行是不是塞多了 */
  lineBoxes: number[] = [],
): string[] {
  if (!ctx || width <= 0) return [text]
  // 量不了字就别断（jsdom 之类的环境），否则断出来的位置反而是错的
  if (typeof ctx.measureText !== 'function') return [text]
  applyFont(ctx, style)

  // 容差必须容得下「少排一个字」：中文按整字取整，行末还剩不到一个字的宽度时
  // 下一个字就排不进去，这一行自然比可用宽度短一截。按半个字宽算会把正常排版判成歪的。
  const widestChar = Array.from(text).reduce((max, ch) => Math.max(max, ctx.measureText(ch).width), 0)
  const tol = widestChar + 2
  // 行数对不上时，逐行比宽没有意义（下标已经错位）
  const sameCount = !expectLines || lineBoxes.length === expectLines
  // 行盒给的是实际排出来的宽度：塞超过它，说明贪心多啃了一个字
  const overflowsBox = (lines: string[]) =>
    sameCount &&
    lines.length === lineBoxes.length &&
    lineBoxes.some((box, i) => lines[i] !== undefined && ctx.measureText(lines[i]).width > box + 2)
  const cleanEdges = (lines: string[]) =>
    lines.slice(0, -1).every((line) => Math.abs(ctx.measureText(line).width - width) <= tol)

  let limit = width
  let lines = greedyLines(ctx, text, limit)
  // 第一轮就该对上：行数一致、没超出行盒、除末行外都贴边
  if ((!expectLines || lines.length === expectLines) && !overflowsBox(lines) && cleanEdges(lines)) return lines

  // 收窄到浏览器真排出来的最宽一行再切一次。行盒宽度是浏览器算出来的，
  // 一定塞得下，用它当上限不会把行切得更碎，只是别再多啃一个字
  const widest = Math.max(0, ...lineBoxes.slice(0, -1))
  if (widest > 0 && widest < limit) {
    limit = widest
    lines = greedyLines(ctx, text, limit)
    if ((!expectLines || lines.length === expectLines) && !overflowsBox(lines) && cleanEdges(lines)) return lines
  }
  // 切不准就整段画：宁可出一行略宽，也不要断错位置
  return [text]
}

/**
 * 这个节点能用来排字的横向宽度。
 *
 * 行盒矩形不能当可用宽度用：行内代码跨行时换行处被拆成几个矩形，每个都短于真正能排字的宽度。
 * 所以取包含它的块级容器（按版面算），扣掉左右内边距和边框——那才是这一行真正能用的宽度。
 */
function collectWidth(el: HTMLElement): number {
  let box: HTMLElement | null = el
  while (box) {
    const cs = window.getComputedStyle(box)
    if (!cs.display.startsWith('inline')) break
    box = box.parentElement
  }
  const host = box ?? el
  const cs = window.getComputedStyle(host)
  const padX = px(cs.paddingLeft) + px(cs.paddingRight)
  // clientWidth 已经是「含内边距、不含边框」的布局值，所以只扣内边距。
  // 之前连边框一起扣，引用块那条 3px 左边线就被多扣了一次，
  // 切出来的行比浏览器短 3px —— 刚好够把一个句号挤到下一行。
  const inner = host.clientWidth
  const width = inner > 0 ? inner - padX : host.getBoundingClientRect().width - padX - px(cs.borderLeftWidth) - px(cs.borderRightWidth)
  // 自己身上如果也带内边距（行内代码、标签胶囊），再扣一次：它们只影响自己这一段，不影响整行。
  // 但 el 本身就是那个块级宿主时（引用块、段落），上面扣的就是它自己的内边距，
  // 再扣一遍等于白扣掉一整段行首留白，切出来的行会比浏览器短一截。
  const own = window.getComputedStyle(el)
  const ownPadding = host === el ? 0 : px(own.paddingLeft) + px(own.paddingRight)
  const usable = width - ownPadding
  // 布局宽度拿不到（无头环境、隐藏的预览）就退回元素自己的盒子宽度
  return usable > 0 ? usable : Math.max(0, fallbackWidth(host) - ownPadding)
}

/**
 * 拿不到版面宽度时就按元素自己的盒子估：
 * clientWidth 为 0 的容器（无头环境、被隐藏的预览）本来就不排版，量出来是 0。
 */
function fallbackWidth(el: HTMLElement): number {
  const cs = window.getComputedStyle(el)
  return Math.max(0, el.getBoundingClientRect().width - px(cs.paddingLeft) - px(cs.paddingRight))
}

/**
 * 把 Range 给的矩形按视觉行归组。
 *
 * 一条视觉行可能被拆成好几个矩形：中英混排、行内样式的边界都会切一刀。
 * 直接拿矩形个数当行数、拿矩形宽度当行宽，切行就会越切越碎
 * （引用块里那句「…留在下一行。」就是这么被整段吞成一行的）。
 */
function groupByLine(rects: DOMRect[], k: number): Array<{ left: number; right: number; top: number; height: number }> {
  const lines: Array<{ left: number; right: number; top: number; height: number }> = []
  for (const rect of rects) {
    if (rect.width <= 0 || rect.height <= 0) continue
    const top = rect.top / k
    const height = rect.height / k
    const hit = lines.find((l) => Math.abs(l.top - top) < Math.max(2, height * 0.5))
    if (hit) {
      hit.left = Math.min(hit.left, rect.left / k)
      hit.right = Math.max(hit.right, rect.right / k)
      hit.top = Math.min(hit.top, top)
      hit.height = Math.max(hit.height, height)
    } else {
      lines.push({ left: rect.left / k, right: rect.right / k, top, height })
    }
  }
  return lines.sort((a, b) => a.top - b.top)
}

/** Range 给的行盒（部分环境，比如 jsdom，没有这个能力） */
function rangeRects(node: Node): DOMRect[] {
  const range = document.createRange()
  range.selectNodeContents(node)
  if (typeof range.getClientRects !== 'function') return []
  return Array.from(range.getClientRects())
}

/**
 * 块里既有无样式的散字、又有行内代码时，浏览器量散字矩形会给「整个行盒」的宽度，
 * 于是看起来像把行内代码一个字一个字啃掉（见过 `Object.` `d` `efine` 这种）。
 * 这种块里散字的位置只认行盒起点，文字自己按可用宽度切行。
 */
function blockHasInline(el: HTMLElement): boolean {
  return Array.from(el.children).some((c) => isInlineElement(c as HTMLElement, window.getComputedStyle(c)))
}

/**
 * 浏览器排好版的一行：一段行内内容在同一基线、同一行盒里。
 * 同一视觉行可能由多段拼成（「用 」+ `Proxy` + 「 替代了」），按行盒聚合后再逐段画。
 */
interface InlineRun {
  text: string
  /** 跨行元素的每一行文字；单行时与 text 相同 */
  lines: string[]
  /**
   * 每段文字对应的行盒（相对根节点，CSS px）。
   * 行内元素跨行时一行一个，画的时候按它裁切，避免糊到隔壁行
   */
  rows?: Array<{ x: number; top: number; width: number; height: number }>
  /** 这段文字自己的行盒矩形（相对根节点，CSS px）；跨行元素每行一个 */
  boxes?: Array<{ x: number; top: number; width: number; height: number }>
  /** 行盒不可信时，绘制按这个宽度重排（而不是照抄草稿） */
  rewrap?: boolean
  /** 相对行盒起点的横坐标（CSS px，未缩放） */
  x: number
  width: number
  /** 行盒顶部（CSS px，未缩放，相对根节点） */
  top: number
  /** 行盒高度（CSS px，未缩放） */
  height: number
  style: CSSStyleDeclaration
  /** 出处元素：绘制时现场读样式，避免拿到空壳声明 */
  el?: HTMLElement
}

/**
 * 图片这类替换元素：不是文字，但必须原样画出来。
 * 漏掉它们的后果是导出图里图标、头像、水印图整块消失。
 */
function paintReplaced(el: HTMLElement, rect: DOMRect, rootRect: DOMRect, scale: number) {
  if (el.tagName?.toUpperCase() !== 'IMG') return
  const img = el as HTMLImageElement
  const nb = norm(rect, rootRect, el)
  const draw = () => {
    const ctx = lastCtx
    if (!ctx) return
    try {
      const radius = px(window.getComputedStyle(img).borderTopLeftRadius) * scale
      ctx.save()
      if (radius > 0) {
        ctx.beginPath()
        roundRect(ctx, nb.left * scale, nb.top * scale, nb.width * scale, nb.height * scale, radius)
        ctx.clip()
      }
      ctx.drawImage(img, nb.left * scale, nb.top * scale, nb.width * scale, nb.height * scale)
      ctx.restore()
    } catch {
      /* 跨域图片画不上就不画，不影响其余内容 */
    }
  }
  if (img.complete && img.naturalWidth > 0) draw()
  else {
    pendingImages.push({ img, draw })
  }
}

/** 行内元素：自己的文字就画在这里，不再往下递归 */
function isInlineElement(el: HTMLElement, cs: CSSStyleDeclaration): boolean {
  if (INLINE_TAGS.has(el.tagName?.toUpperCase())) return true
  return cs.display === 'inline' || cs.display === 'inline-block'
}

/** 块里夹着行内元素（行内代码、加粗、链接） */
function hasInlineBlock(el: HTMLElement): boolean {
  return Array.from(el.children).some((c) => isInlineElement(c as HTMLElement, window.getComputedStyle(c)))
}

/**
 * 把一棵子树按浏览器真实排版拆成「视觉行」。
 *
 * 为什么不 measureText 逐字累加：Canvas 的量字和浏览器排版不是一回事，
 * 中英文混排、行内代码的内边距、零宽空格断点、行末标点悬挂都会让断点错开，
 * 结果就是导出图里换行位置和预览不一样。直接读 Range 给的行盒，位置就是所见即所得。
 */
function collectRuns(el: HTMLElement, rootRect: DOMRect, out: InlineRun[]): boolean {
  let ok = true
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? '').replace(/\s+/g, ' ')
      if (!text.trim()) continue
      // 文字节点的样式来自它所在的元素：取父级会把 body 的默认样式拿过来
      const style = window.getComputedStyle(el)
      const rects = rangeRects(child)

      // 块里的散字：位置只信行盒起点，文字按可用宽度自己切行。
      // 不能用行盒的宽度——块里夹着行内代码时，浏览器给散字矩形的宽度是整行宽度。
      const anchor = rects[0]
      if (!anchor || anchor.height <= 0) continue
      // collectWidth 读的是 clientWidth —— 已经是布局像素，别再除一次预览缩放。
      // 除了就会在缩放预览下把可用宽度放大 1/scale 倍（缩到 40% 时放大 2.5 倍），
      // 切出来的行比浏览器长得多，整段被吞成一行。
      const width = collectWidth(el)
      // 用这一块实测的行宽当基准；算不出来再退回元素宽度
      const rowWidth = Math.min(width, blockRowWidth || width)
      const kEl = totalScale(el)
      const visualLines = groupByLine(rects, kEl)
      const wrapped = splitLines(
        text,
        style,
        rowWidth,
        measureCtx(),
        visualLines.length,
        visualLines.map((l) => l.right - l.left),
      )
      // 浏览器把这段文字断成了几行，我们按宽度切出来却是另一种断法 —— 行盒不可信
      // （典型是块里夹行内代码，浏览器被零宽断点带着走了）。
      // 这时按可用宽度自己重排，只是不再拿原行盒去裁切。
      const rewrap = hasInlineBlock(el) || (visualLines.length > 1 && wrapped.length !== visualLines.length)
      if (rewrap) ok = false
      out.push({
        text: wrapped.join(''),
        lines: wrapped,
        boxes: rects.map((r) => ({
          x: (r.left - rootRect.left) / kEl,
          top: (r.top - rootRect.top) / kEl,
          width: r.width / kEl,
          height: r.height / kEl,
        })),
        x: (anchor.left - rootRect.left) / kEl,
        top: (anchor.top - rootRect.top) / kEl,
        width: collectWidth(el),
        height: anchor.height / kEl,
        style,
        el,
        rewrap,
      })
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const node = child as HTMLElement
    const tag = node.tagName?.toUpperCase()
    if (SKIP_TAGS.has(tag)) continue
    const cs = window.getComputedStyle(node)
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue
    // 断点标记本身不占位
    if (tag === 'WBR') continue
    if (isInlineElement(node, cs)) {
      // 行内元素（行内代码、加粗、链接）自己带样式、带内边距，不能和散字混成一段画，
      // 否则整段用一个字体一个颜色，导出的图和预览对不上。
      // 元素里有块级子节点时继续往下递归，交还给下面的散字逻辑
      const rects = rangeRects(node)
      const text = (node.textContent ?? '').replace(/\s+/g, ' ')
      if (rects.length && text.trim()) {
        // 跨行���每行一个矩形；文字按行盒宽度切开后逐行裁切绘制
        const kNode = totalScale(node)
        const wrapWidth = Math.min(...rects.map((r) => r.width)) / kNode
        const lines = splitLines(text, cs, wrapWidth, measureCtx(), rects.length)
        const boxes = rects
          .filter((rect) => rect.width > 0 && rect.height > 0)
          .map((rect) => ({
            x: (rect.left - rootRect.left) / kNode,
            top: (rect.top - rootRect.top) / kNode,
            width: rect.width / kNode,
            height: rect.height / kNode,
          }))
        if (boxes.length) {
          out.push({
            text: lines.join(''),
            lines,
            rows: boxes,
            x: boxes[0].x,
            top: boxes[0].top,
            width: boxes[0].width,
            height: boxes[0].height,
            style: cs,
            el: node,
          })
          continue
        }
      }
    }
    if (!collectRuns(node, rootRect, out)) ok = false
  }
  return ok
}

/** 按视觉行归组：顶边相近即同一行 */
function groupRuns(runs: InlineRun[]): InlineRun[][] {
  const rows: InlineRun[][] = []
  for (const run of [...runs].sort((a, b) => a.top - b.top || a.x - b.x)) {
    const row = rows.find((r) => Math.abs(r[0].top - run.top) < Math.max(2, r[0].height * 0.4))
    if (row) row.push(run)
    else rows.push([run])
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x)
  return rows.sort((a, b) => a[0].top - b[0].top)
}

/**
 * 基线偏移：行盒顶边到这一行基线的高度（CSS px）。
 *
 * 画布默认按 middle 对齐，而 middle 是字体 em 框的中线，不是汉字视觉上的重心 ——
 * 行盒上下留白并不均分，于是同一行里中文、英文、行内代码的基线各走各的，
 * 导出图看起来高低不齐。浏览器给的是基线，照抄它才和预览一致。
 */
function baselineOffset(el: HTMLElement): number | null {
  if (typeof document === 'undefined' || !document.createRange) return null
  const range = document.createRange()
  range.selectNodeContents(el)
  // jsdom 等环境没有 Range 的盒子 API，量不到就退回 middle 对齐
  if (typeof range.getBoundingClientRect !== 'function' || typeof range.getClientRects !== 'function') return null
  const box = range.getBoundingClientRect()
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0)
  if (!rects.length || box.height <= 0) return null
  const probe = document.createElement('span')
  probe.textContent = '中'
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;display:inline-block'
  el.appendChild(probe)
  const probeRect = probe.getBoundingClientRect()
  el.removeChild(probe)
  const offset = probeRect.top - box.top
  // 量不到（元素被移出文档）就退回 middle，别让整段跳位
  return Number.isFinite(offset) && offset > 0 && offset < box.height ? offset / totalScale(el) : null
}

/** 行盒里的字体信息现场读，别隔着闭包传声明对象（部分环境拿不到值） */
function styleOf(el: HTMLElement | null | undefined): CSSStyleDeclaration | null {
  return el ? window.getComputedStyle(el) : null
}

/**
 * 绘制时用的样式。
 *
 * 现场读元素的样式最准，但有些环境给的是空壳声明（字号读出来是空、是 0），
 * 那样整段文字会因为字号为 0 被跳过 —— 收集阶段留下的那份更可信。
 */
function resolveStyle(el: HTMLElement | undefined, fallback: CSSStyleDeclaration): CSSStyleDeclaration {
  const live = styleOf(el)
  if (live && px(live.fontSize) > 0) return live
  return px(fallback.fontSize) > 0 ? fallback : (live ?? fallback)
}

function paintRuns(ctx: CanvasRenderingContext2D, rows: InlineRun[][], scale: number) {
  for (const row of rows) {
    const top = Math.min(...row.map((r) => r.top))
    const height = Math.max(...row.map((r) => r.height + (r.top - top)))
    for (const run of row) {
      // 样式以元素现场读到的为准，但字号取不到（被移除、或环境给的是空壳声明）时
      // 退回收集阶段记下的那一份，否则整段文字会因为字号为 0 被跳过
      const style = resolveStyle(run.el, run.style)
      const fontSize = px(style.fontSize) * scale
      if (fontSize < 1) continue
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`
      ctx.fillStyle = style.color
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      // 画布不吃 CSS 排版，text-transform 得自己折算：否则代码块右上角的语言标签
      // 预览是大写、导出是原文
      const upper = style.textTransform === 'uppercase'
      const baseOffset = run.el ? baselineOffset(run.el) : null

      // 一段里排了多行：按它自己实测的行矩形逐行裁切绘制。
      // 断点稍有出入也不会糊到隔壁行，行距也对得上浏览器
      if (run.rows?.length) {
        run.rows.forEach((row, idx) => {
          const line = run.lines[idx] ?? ''
          if (!line) return
          ctx.save()
          ctx.beginPath()
          // 多留 2px：行末的直角字形不会因为取整被切掉一竖
          ctx.rect(row.x * scale, row.top * scale, (row.width + 2) * scale, row.height * scale)
          ctx.clip()
          ctx.fillText(upper ? line.toUpperCase() : line, row.x * scale, (row.top + row.height / 2) * scale)
          ctx.restore()
        })
        continue
      }

      // 一段里有几行就按行盒顺序逐行画；连行盒都没有时按行高平铺开
      // 行盒既可能是这段文字自己的，也可能是它所在的那条行（同一视觉行的几段共用一条）
      const fallbackBoxes = run.lines.length > 1 ? run.rows : undefined
      const lineStep = height / Math.max(1, run.lines.length)
      run.lines.forEach((line, idx) => {
        if (!line) return
        const box = run.boxes?.[idx] ?? fallbackBoxes?.[idx]
        if (box) {
          // 内层已经按行盒裁切过了，这里别再来一次
          const baseline = baseOffset != null ? box.top + baseOffset : box.top + box.height / 2
          ctx.fillText(upper ? line.toUpperCase() : line, box.x * scale, baseline * scale)
          return
        }
        const lineTop = top + height / 2 + (idx - (run.lines.length - 1) / 2) * lineStep - lineStep / 2
        const baseline = baseOffset != null ? lineTop + baseOffset : top + height / 2 + (idx - (run.lines.length - 1) / 2) * lineStep
        ctx.fillText(upper ? line.toUpperCase() : line, run.x * scale, baseline * scale)
      })
    }
  }
}

function shouldPaintBackground(el: HTMLElement, cs: CSSStyleDeclaration): boolean {
  if (SKIP_TAGS.has(el.tagName?.toUpperCase())) return false
  return (cs.backgroundImage && cs.backgroundImage !== 'none') || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent')
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  el: HTMLElement,
  cs: CSSStyleDeclaration,
  rect: DOMRect,
  rootRect: DOMRect,
  scale: number,
) {
  const nb = norm(rect, rootRect, el)
  const x = nb.left * scale
  const y = nb.top * scale
  const w = nb.width * scale
  const h = nb.height * scale
  const radius = px(cs.borderTopLeftRadius) * scale

  ctx.save()
  if (radius > 0) {
    ctx.beginPath()
    roundRect(ctx, x, y, w, h, radius)
    ctx.clip()
  }

  const fallback = firstColor(cs.backgroundImage || '') ?? (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : null)
  if (fallback) {
    ctx.fillStyle = fallback
    ctx.fillRect(x, y, w, h)
  }

  if (cs.backgroundImage && cs.backgroundImage !== 'none') {
    const grad = parseGradient(ctx, cs.backgroundImage, w, h, x, y)
    if (grad) {
      ctx.fillStyle = grad
      ctx.fillRect(x, y, w, h)
    }
  } else if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
    ctx.fillStyle = cs.backgroundColor
    ctx.fillRect(x, y, w, h)
  }
  ctx.restore()
}

const SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const
type Side = (typeof SIDES)[number]

interface SideBorder {
  side: Side
  width: number
  color: string
}

/**
 * 四条边各自判定。
 *
 * 只认 `border-top` 是错的：引用块的竖线用的是 `border-left`，
 * `currentColor` 在计算样式里已经算成了具体颜色。
 */
function sideBorders(cs: CSSStyleDeclaration): SideBorder[] {
  const out: SideBorder[] = []
  for (const side of SIDES) {
    const width = px(cs[`border${side}Width` as 'borderTopWidth'])
    if (!width) continue
    const style = cs[`border${side}Style` as 'borderTopStyle']
    const color = cs[`border${side}Color` as 'borderTopColor']
    if (style === 'none' || style === 'hidden' || color === 'rgba(0, 0, 0, 0)' || color === 'transparent') continue
    out.push({ side, width, color })
  }
  return out
}

function hasVisibleBorder(cs: CSSStyleDeclaration): boolean {
  return sideBorders(cs).length > 0
}

/**
 * 画边框。
 *
 * 四条边一起 `strokeRect` 只对「四边同宽同色」成立，所以按边分开画；
 * 有圆角时整圈仍用 `roundRect` 描一遍（好看且不会在圆角处留豁口），
 * 但描边宽度取这条边自己的值，颜色按边设。
 */
function paintBorder(
  ctx: CanvasRenderingContext2D,
  el: HTMLElement,
  cs: CSSStyleDeclaration,
  rect: DOMRect,
  rootRect: DOMRect,
  scale: number,
) {
  const borders = sideBorders(cs)
  if (!borders.length) return
  const nb = norm(rect, rootRect, el)
  const x = nb.left * scale
  const y = nb.top * scale
  const w = nb.width * scale
  const h = nb.height * scale
  const radius = px(cs.borderTopLeftRadius) * scale

  if (radius > 0) {
    for (const b of borders) {
      const lw = b.width * scale
      ctx.save()
      ctx.beginPath()
      // 描边中心线内缩半个线宽：圆角处不能靠裁剪切，直接按内缩的圆角走线
      roundRect(ctx, x + lw / 2, y + lw / 2, w - lw, h - lw, Math.max(0, radius - lw / 2))
      ctx.strokeStyle = b.color
      ctx.lineWidth = lw
      ctx.stroke()
      ctx.restore()
    }
    return
  }

  // 直角：一条边一根实心矩形，比描边准（描边会被取整啃掉半像素）
  for (const b of borders) {
    const lw = b.width * scale
    ctx.save()
    ctx.fillStyle = b.color
    if (b.side === 'Top') ctx.fillRect(x, y, w, lw)
    else if (b.side === 'Bottom') ctx.fillRect(x, y + h - lw, w, lw)
    else if (b.side === 'Left') ctx.fillRect(x, y, lw, h)
    else ctx.fillRect(x + w - lw, y, lw, h)
    ctx.restore()
  }
}

/** 正在绘制的那一块能排字的宽度（CSS px） */
let blockRowWidth = 0

/** 一块内容里最宽的行盒宽度，跟着递归收集，取到就缓存 */
function maxRowWidth(el: HTMLElement): number {
  let best = el.getBoundingClientRect().width || el.clientWidth || 0
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue
    const node = child as HTMLElement
    if (!node.tagName || SKIP_TAGS.has(node.tagName.toUpperCase())) continue
    for (const rect of rangeRects(node)) best = Math.max(best, rect.width)
    best = Math.max(best, maxRowWidth(node))
  }
  return best
}

function paintText(ctx: CanvasRenderingContext2D, el: HTMLElement, cs: CSSStyleDeclaration, rect: DOMRect, rootRect: DOMRect, scale: number, rootCs: CSSStyleDeclaration) {
  const text = el.textContent ?? ''
  if (!text.trim()) return

  // 有真实行盒就照眼睛看到的样子画，量不到才退回逐字断行。
  // trustLayout 是底线：一旦发现行盒不可信（块里散字被行内代码的零宽断点挤成碎片），
  // 整块退回「自己按宽度断行」，宁可换行位置差一点，也不要排出乱码样的碎字
  // 先把这块的行宽量出来：散字自己算不出可用宽度（行内代码的零宽断点会把它们拆碎），
  // 只能拿这一块里最宽的那条行盒当基准。
  // 最宽的那条都填不满元素宽度时，说明这块是被断点拆碎的，只能按元素宽度重排
  // 元素能排字的宽度；量不到才用"这一块最宽的行盒 − 自己的内边距"来估
  const boxWidth = collectWidth(el)
  const measured = maxRowWidth(el) / totalScale(el) - px(cs.paddingLeft) - px(cs.paddingRight)
  blockRowWidth = boxWidth > 0 ? boxWidth : measured
  const runs: InlineRun[] = []
  const trustLayout = collectRuns(el, rootRect, runs)
  const rowCount = runs.reduce((n, r) => n + Math.max(1, r.lines.length), 0)
  // 行盒既不可信、又没给出比「整段一行」更细的信息时，交给下面的逐字断行
  if (runs.length && (trustLayout || rowCount > runs.length)) {
    paintRuns(ctx, groupRuns(runs), scale)
    return
  }

  const fontSize = px(cs.fontSize) * scale
  if (fontSize < 1) return

  const nb = norm(rect, rootRect, el)
  const paddingLeft = px(cs.paddingLeft)
  const paddingRight = px(cs.paddingRight)
  const contentW = Math.max(0, nb.width - paddingLeft - paddingRight)
  if (contentW <= 0) return

  ctx.save()
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${fontSize}px ${cs.fontFamily || rootCs.fontFamily}`
  ctx.fillStyle = cs.color
  ctx.textAlign = (cs.textAlign as CanvasTextAlign) || 'left'
  ctx.textBaseline = 'middle'
  // 画布不吃 CSS 排版，text-transform 得自己折算
  const upper = cs.textTransform === 'uppercase'

  const lineHeight = px(cs.lineHeight) || px(cs.fontSize) * 1.5
  const lines = wrapText(ctx, text.replace(/\s+/g, ' ').trim(), contentW * scale, isEllipsis(el, cs))
  const totalH = lines.length * lineHeight * scale
  const offsetY = (nb.height * scale - totalH) / 2 + (lineHeight * scale) / 2
  const left = nb.left * scale + paddingLeft * scale
  const alignX = ctx.textAlign === 'center' ? left + (contentW * scale) / 2 : ctx.textAlign === 'right' ? left + contentW * scale : left

  lines.forEach((line, idx) => {
    ctx.fillText(upper ? line.toUpperCase() : line, alignX, nb.top * scale + offsetY + idx * lineHeight * scale)
  })
  ctx.restore()
}

// ---------- SVG ----------

interface PendingSvg {
  img: HTMLImageElement
  x: number
  y: number
  w: number
  h: number
  /**
   * 装饰自己的圆角半径（CSS px）。
   * SVG 光栅化出来是「一整个矩形图层」，边缘那一两个像素的抗锯齿噪点会把外面的圆角啃掉，
   * 所以落笔时要按装饰自己的圆角再裁一次。
   */
  radius: number
}

const pendingSvgs: PendingSvg[] = []
const pendingImages: Array<{ img: HTMLImageElement; draw: () => void }> = []

function paintSvg(el: SVGSVGElement, rect: DOMRect, rootRect: DOMRect, scale: number) {
  const clone = el.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const nb = norm(rect, rootRect, el)
  // 显式宽高，避免部分环境按 0x0 光栅化
  clone.setAttribute('width', String(Math.max(1, Math.round(nb.width))))
  clone.setAttribute('height', String(Math.max(1, Math.round(nb.height))))

  const data = new XMLSerializer().serializeToString(clone)
  const img = new Image()
  img.decoding = 'sync'
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`
  // 光栅化时半径是整数近似，圆角边缘会残留一圈半透明的直角像素。
  // 多裁 1px 盖住它：24px 圆角少 1px 看不出来，边上那一圈噪点却很扎眼
  const radius = clipRadiusOf(el, rect) + 1
  pendingSvgs.push({ img, x: nb.left * scale, y: nb.top * scale, w: nb.width * scale, h: nb.height * scale, radius })
}

/**
 * 装饰实际被哪个圆角裁着。
 *
 * SVG 装饰自己是直角，圆角在外壳上；但它光栅化出来是「一整个矩形图层」，
 * 边缘一两个像素的抗锯齿噪点会把外壳的圆角啃成方角。
 * 所以落笔时按包含它的那层祖先的圆角再裁一次 —— 只认跟它几乎同框、带圆角、且溢出被隐藏的祖先。
 */
function clipRadiusOf(el: Element, rect: DOMRect): number {
  let node = el.parentElement
  while (node) {
    const cs = window.getComputedStyle(node)
    const own = px(cs.borderTopLeftRadius)
    const box = node.getBoundingClientRect()
    // 只认跟装饰几乎同框的那层：装饰自己铺满谁的盒子，就跟着谁的圆角走
    const sameBox =
      Math.abs(box.left - rect.left) < 0.5 &&
      Math.abs(box.top - rect.top) < 0.5 &&
      Math.abs(box.width - rect.width) < 0.5 &&
      Math.abs(box.height - rect.height) < 0.5
    if (own > 0 && sameBox) return own
    node = node.parentElement
  }
  return 0
}

// ---------- 节点递归 ----------

function paintNode(ctx: CanvasRenderingContext2D, el: Element, rootRect: DOMRect, rootCs: CSSStyleDeclaration, scale: number): void {
  const html = el as HTMLElement
  const tag = html.tagName?.toUpperCase()
  if (SKIP_TAGS.has(tag)) return

  const cs = window.getComputedStyle(html)
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return

  // 元素自身的缩放影响它自己和后代的位置与尺寸，先记下来再往下画
  const zoom = zoomValue(html, cs)
  if (Number.isFinite(zoom) && zoom > 0 && zoom !== 1) zoomOf.set(html, zoom)

  const rect = html.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return

  if (tag === 'SVG') {
    paintSvg(html as unknown as SVGSVGElement, rect, rootRect, scale)
    return
  }
  if (tag === 'IMG') {
    paintReplaced(html, rect, rootRect, scale)
    return
  }

  // flex/grid 容器的子项不论标签类型都按块级处理
  const isLayout = cs.display === 'flex' || cs.display === 'inline-flex' || cs.display === 'grid' || cs.display === 'inline-grid'
  const hasBlockChildren =
    isLayout || Array.from(html.children).some((child) => !INLINE_TAGS.has(child.tagName?.toUpperCase()))

  ctx.save()
  // 只认自己的 opacity。祖先那份要是也乘下来，正文会跟着背景一起淡掉，
  // 而预览里正文始终是实的（「背景透明度」调的本来就只是底）
  const selfOpacity = cs.opacity === '' ? 1 : Number(cs.opacity)
  ctx.globalAlpha = Math.max(0, Math.min(1, selfOpacity))
  const bg = shouldPaintBackground(html, cs)
  const border = hasVisibleBorder(cs)
  if (hasBlockChildren) {
    // 有块级子节点：圆角只约束这一层自己的背景和描边（paintBackground 里各自裁剪）。
    // 正文得按未裁剪的区域排 —— 浏览器不会因为 overflow:hidden 就换行。
    // 装饰的溢出交给它自己的圆角处理，见 paintSvg 里的 radius。
    if (bg) paintBackground(ctx, html, cs, rect, rootRect, scale)
    if (border) paintBorder(ctx, html, cs, rect, rootRect, scale)
    for (const child of Array.from(html.children)) paintNode(ctx, child, rootRect, rootCs, scale)
    ctx.restore()
    return
  }

  if (bg) paintBackground(ctx, html, cs, rect, rootRect, scale)
  if (border) paintBorder(ctx, html, cs, rect, rootRect, scale)
  paintText(ctx, html, cs, rect, rootRect, scale, rootCs)
  ctx.restore()
}

// ---------- 入口 ----------

export async function renderElementToCanvas(root: HTMLElement, options: RenderOptions): Promise<HTMLCanvasElement> {
  const { scale, width, height, background } = options
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建 Canvas 上下文')

  lastCtx = ctx
  pendingSvgs.length = 0
  pendingImages.length = 0

  const rootRect = root.getBoundingClientRect()
  const rootCs = window.getComputedStyle(root)
  cssScale = rootRect.width > 0 ? rootRect.width / width : 1

  // 整张画布铺底，避免任何缝隙露黑
  ctx.fillStyle = background ?? '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  paintNode(ctx, root, rootRect, rootCs, scale)

  await Promise.all(
    pendingSvgs.map(
      (item) =>
        new Promise<void>((resolve) => {
          const done = () => {
            try {
              ctx.save()
              ctx.globalCompositeOperation = 'source-over'
              if (item.radius > 0) {
                ctx.beginPath()
                roundRect(ctx, item.x, item.y, item.w, item.h, item.radius * scale)
                ctx.clip()
              }
              ctx.drawImage(item.img, item.x, item.y, item.w, item.h)
              ctx.restore()
            } catch {
              /* 跳过绘制失败的装饰 */
            }
            resolve()
          }
          if (item.img.complete && item.img.naturalWidth > 0) done()
          else {
            item.img.onload = done
            item.img.onerror = () => resolve()
          }
        }),
    ),
  )

  await Promise.all(
    pendingImages.map(
      (item) =>
        new Promise<void>((resolve) => {
          const done = () => {
            item.draw()
            resolve()
          }
          if (item.img.complete) done()
          else {
            item.img.addEventListener('load', done, { once: true })
            item.img.addEventListener('error', () => resolve(), { once: true })
          }
        }),
    ),
  )

  return canvas
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('导出失败，请重试'))
      },
      type,
      quality,
    )
  })
}
