import { computed, ref } from 'vue'
import type { CardData, CardStyle } from '@/types/card'
import type { ExportFormat, ExportResult, ExportScale } from '@/types/export'
import { renderElementToCanvas, canvasToBlob } from '@/utils/dom-to-image'
import { renderElementToSvg } from '@/utils/svg-export'
import { buildFileName, downloadBlob } from '@/utils/filename'
import { copyBlobToClipboard } from '@/utils/clipboard'
import { withMeasurableLayout } from '@/utils/layout'

export interface ExportTarget {
  /** 卡片根节点（固定 1:1 像素尺寸） */
  element: HTMLElement | null
  card: CardData
  style: CardStyle
  /** 导出要等自适应量完，否则可能截到缩放的中间态 */
  waitUntilReady?: () => Promise<void>
}

export function useExport() {
  const exporting = ref(false)
  const lastError = ref<string | null>(null)
  const lastResult = ref<ExportResult | null>(null)

  const scales: ExportScale[] = [1, 2, 3]
  const target = ref<ExportTarget | null>(null)

  function register(t: ExportTarget) {
    target.value = t
  }

  async function render(scale: ExportScale, format: ExportFormat = 'png'): Promise<ExportResult> {
    const t = target.value
    if (!t?.element) throw new Error('卡片尚未挂载')
    const { width, height } = t.style.size
    // 手机端没选中「预览」Tab 时，卡片所在面板是 display:none，量什么都是 0，
    // 直接画会得到一张空白图。先让它有布局，画完还原。
    const payload = await withMeasurableLayout(t.element, { width, height }, async () => {
      // 等自适应量完，否则可能截到逐档试缩的中间态
      await t.waitUntilReady?.()
      if (format === 'svg') {
        // SVG 打开后就是设计尺寸，不再乘倍率
        return new Blob([await renderElementToSvg({ element: t.element!, width, height, scale })], {
          type: 'image/svg+xml',
        })
      }
      // 导出图必须带透明通道：背景透明度调成 0 时要能叠到别的东西上。
      // 渲染器的兜底底色默认刷白，那就是「导出一张白底图」而不是「一张透明底卡」。
      return canvasToBlob(
        await renderElementToCanvas(t.element!, { scale, width, height, background: 'transparent' }),
      )
    })

    return {
      blob: payload,
      width: format === 'svg' ? width : Math.round(width * scale),
      height: format === 'svg' ? height : Math.round(height * scale),
      filename: buildFileName(t.card.title, new Date(), format),
      format,
    }
  }

  async function exportPng(scale: ExportScale = 1, format: ExportFormat = 'png'): Promise<ExportResult | null> {
    exporting.value = true
    lastError.value = null
    try {
      const result = await render(scale, format)
      downloadBlob(result.blob, result.filename)
      lastResult.value = result
      return result
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : '导出失败'
      return null
    } finally {
      exporting.value = false
    }
  }

  async function copyToClipboard(scale: ExportScale = 1): Promise<boolean> {
    exporting.value = true
    lastError.value = null
    try {
      const result = await render(scale)
      const ok = await copyBlobToClipboard(result.blob)
      if (!ok) lastError.value = '当前浏览器不支持复制图片，请改用下载'
      return ok
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : '复制失败'
      return false
    } finally {
      exporting.value = false
    }
  }

  const sizeLabel = computed(() => {
    const s = target.value?.style.size
    return s ? `${s.width} × ${s.height}` : ''
  })

  return { exporting, lastError, lastResult, scales, register, render, exportPng, copyToClipboard, sizeLabel }
}

export type ExportStore = ReturnType<typeof useExport>
