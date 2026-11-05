/**
 * 导出 SVG。
 *
 * 不另写一套绘制逻辑：仍然走 `renderElementToCanvas` 画一遍，
 * 把画好的位图整张裹进 `<image>`。好处是「所见即所导」自动成立 ——
 * 两套渲染器迟早会漂移，而 SVG 只是同一个产物的另一种封装。
 *
 * 内嵌用 JPEG 不用 PNG：卡片是照片式的大面积渐变，PNG 无损编码要 990KB，
 * JPEG(0.94) 只要 160KB，肉眼看不出差别，而 base64 还要再涨三分之一。
 *
 * 代价有两个，都写在这：
 * - 图里没有可选中的矢量字形。要真正的矢量字体得逐字转 path，是另一个量级的工程
 * - JPEG 不支持透明，背景透明度 < 100% 时透明区会被合成成白底
 */
import { canvasToBlob, renderElementToCanvas } from './dom-to-image'
import type { ExportScale } from '@/types/export'

export interface SvgRenderInput {
  element: HTMLElement
  width: number
  height: number
  scale: ExportScale
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('读取位图失败'))
    reader.readAsDataURL(blob)
  })
}

/** 把透明区压到白底上：JPEG 没有 alpha 通道，不合成的话透明处会是黑的 */
function flatten(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = source.width
  out.height = source.height
  const ctx = out.getContext('2d')
  if (!ctx) return source
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(source, 0, 0)
  return out
}

/** 画布按 `width × scale` 出图，SVG 里再缩回设计尺寸，打开时尺寸才对得上 */
export async function renderElementToSvg({ element, width, height, scale }: SvgRenderInput): Promise<string> {
  const canvas = flatten(
    await renderElementToCanvas(element, { scale, width, height, background: 'transparent' }),
  )
  const dataUrl = await blobToDataUrl(await canvasToBlob(canvas, 'image/jpeg', 0.94))
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
    ` width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<image x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none"`,
    ` xlink:href="${dataUrl}" href="${dataUrl}"/>`,
    `</svg>`,
  ].join('')
}
