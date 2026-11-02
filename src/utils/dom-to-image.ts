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
let lastCtx: CanvasRenderingContext2D | null = null

function norm(rect: DOMRect, rootRect: DOMRect) {
  return {
    left: (rect.left - rootRect.left) / cssScale,
    top: (rect.top - rootRect.top) / cssScale,
    width: rect.width / cssScale,
    height: rect.height / cssScale,
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

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, ellipsis: boolean): string[] {
  if (!text) return []
  if (maxWidth <= 0) return [text]
  const chars = Array.from(clipText(ctx, text, maxWidth, ellipsis))
  const lines: string[] = []
  let current = ''
  for (const ch of chars) {
    const test = current + ch
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = ch
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

function shouldPaintBackground(el: HTMLElement, cs: CSSStyleDeclaration): boolean {
  if (SKIP_TAGS.has(el.tagName?.toUpperCase())) return false
  return (cs.backgroundImage && cs.backgroundImage !== 'none') || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent')
}

function paintBackground(ctx: CanvasRenderingContext2D, el: HTMLElement, cs: CSSStyleDeclaration, rect: DOMRect, rootRect: DOMRect, scale: number) {
  const nb = norm(rect, rootRect)
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

function paintBorder(ctx: CanvasRenderingContext2D, cs: CSSStyleDeclaration, rect: DOMRect, rootRect: DOMRect, scale: number) {
  const width = px(cs.borderTopWidth)
  if (!width || cs.borderTopStyle === 'none' || cs.borderTopColor === 'rgba(0, 0, 0, 0)') return
  const nb = norm(rect, rootRect)
  const x = nb.left * scale
  const y = nb.top * scale
  const w = nb.width * scale
  const h = nb.height * scale
  ctx.strokeStyle = cs.borderTopColor
  ctx.lineWidth = width * scale
  const radius = px(cs.borderTopLeftRadius) * scale
  if (radius > 0) {
    ctx.save()
    ctx.beginPath()
    roundRect(ctx, x + (width * scale) / 2, y + (width * scale) / 2, w - width * scale, h - width * scale, radius)
    ctx.stroke()
    ctx.restore()
  } else {
    ctx.strokeRect(x + (width * scale) / 2, y + (width * scale) / 2, w - width * scale, h - width * scale)
  }
}

function paintText(ctx: CanvasRenderingContext2D, el: HTMLElement, cs: CSSStyleDeclaration, rect: DOMRect, rootRect: DOMRect, scale: number, rootCs: CSSStyleDeclaration) {
  const text = el.textContent ?? ''
  if (!text.trim()) return
  const fontSize = px(cs.fontSize) * scale
  if (fontSize < 1) return

  const nb = norm(rect, rootRect)
  const paddingLeft = px(cs.paddingLeft)
  const paddingRight = px(cs.paddingRight)
  const contentW = Math.max(0, nb.width - paddingLeft - paddingRight)
  if (contentW <= 0) return

  ctx.save()
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${fontSize}px ${cs.fontFamily || rootCs.fontFamily}`
  ctx.fillStyle = cs.color
  ctx.textAlign = (cs.textAlign as CanvasTextAlign) || 'left'
  ctx.textBaseline = 'middle'

  const lineHeight = px(cs.lineHeight) || px(cs.fontSize) * 1.5
  const lines = wrapText(ctx, text.replace(/\s+/g, ' ').trim(), contentW * scale, isEllipsis(el, cs))
  const totalH = lines.length * lineHeight * scale
  const offsetY = (nb.height * scale - totalH) / 2 + (lineHeight * scale) / 2
  const left = nb.left * scale + paddingLeft * scale
  const alignX = ctx.textAlign === 'center' ? left + (contentW * scale) / 2 : ctx.textAlign === 'right' ? left + contentW * scale : left

  lines.forEach((line, idx) => {
    ctx.fillText(line, alignX, nb.top * scale + offsetY + idx * lineHeight * scale)
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
}

const pendingSvgs: PendingSvg[] = []

function paintSvg(el: SVGSVGElement, rect: DOMRect, rootRect: DOMRect, scale: number) {
  const clone = el.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const nb = norm(rect, rootRect)
  // 显式宽高，避免部分环境按 0x0 光栅化
  clone.setAttribute('width', String(Math.max(1, Math.round(nb.width))))
  clone.setAttribute('height', String(Math.max(1, Math.round(nb.height))))

  const data = new XMLSerializer().serializeToString(clone)
  const img = new Image()
  img.decoding = 'sync'
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`
  pendingSvgs.push({ img, x: nb.left * scale, y: nb.top * scale, w: nb.width * scale, h: nb.height * scale })
}

// ---------- 节点递归 ----------

function paintNode(ctx: CanvasRenderingContext2D, el: Element, rootRect: DOMRect, rootCs: CSSStyleDeclaration, scale: number) {
  const html = el as HTMLElement
  const tag = html.tagName?.toUpperCase()
  if (SKIP_TAGS.has(tag)) return

  const cs = window.getComputedStyle(html)
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return

  const rect = html.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return

  if (tag === 'SVG') {
    paintSvg(html as unknown as SVGSVGElement, rect, rootRect, scale)
    return
  }

  // flex/grid 容器的子项不论标签类型都按块级处理
  const isLayout = cs.display === 'flex' || cs.display === 'inline-flex' || cs.display === 'grid' || cs.display === 'inline-grid'
  const hasBlockChildren =
    isLayout || Array.from(html.children).some((child) => !INLINE_TAGS.has(child.tagName?.toUpperCase()))

  ctx.save()
  const nb = norm(rect, rootRect)
  const radius = px(cs.borderTopLeftRadius) * scale
  if (radius > 0) {
    ctx.beginPath()
    roundRect(ctx, nb.left * scale, nb.top * scale, nb.width * scale, nb.height * scale, radius)
    ctx.clip()
  }
  if (shouldPaintBackground(html, cs)) paintBackground(ctx, html, cs, rect, rootRect, scale)
  paintBorder(ctx, cs, rect, rootRect, scale)
  if (!hasBlockChildren) paintText(ctx, html, cs, rect, rootRect, scale, rootCs)
  ctx.restore()

  if (hasBlockChildren) {
    for (const child of Array.from(html.children)) paintNode(ctx, child, rootRect, rootCs, scale)
  }
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

  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('导出失败，请重试'))
    }, 'image/png')
  })
}
