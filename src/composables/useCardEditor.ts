import { computed, reactive, ref, watch } from 'vue'
import type { CardData, CardStyle, CardType, SizePreset } from '@/types/card'
import { DEFAULT_CARD, DEFAULT_STYLE, SIZE_PRESETS } from '@/types/card'
import { findTemplate } from '@/utils/templates'

function cloneCard(card: CardData): CardData {
  return { ...card, tags: [...card.tags], footer: { ...card.footer } }
}

function cloneStyle(style: CardStyle): CardStyle {
  return { ...style, size: { ...style.size }, watermark: style.watermark ? { ...style.watermark } : undefined }
}

export interface EditorOptions {
  initialCard?: CardData
  initialStyle?: CardStyle
}

export function useCardEditor(options: EditorOptions = {}) {
  const card = reactive<CardData>(cloneCard(options.initialCard ?? DEFAULT_CARD))
  const style = reactive<CardStyle>(cloneStyle(options.initialStyle ?? DEFAULT_STYLE))
  const activePanel = ref<'content' | 'style'>('content')

  /** 切换模板只替换样式，不动内容 */
  function applyTemplate(templateId: string) {
    const template = findTemplate(templateId)
    style.templateId = template.id
    Object.assign(style, { ...style, ...template.defaultStyle, templateId: template.id })
  }

  function setCardType(type: CardType) {
    card.type = type
    if (type === 'code' && !card.language) card.language = 'typescript'
    if (type === 'quote') style.fontSize = 'lg'
  }

  function setSizePreset(preset: SizePreset) {
    style.size.preset = preset
    if (preset !== 'custom') {
      const size = SIZE_PRESETS[preset]
      style.size.width = size.width
      style.size.height = size.height
    }
  }

  function setCustomSize(width: number, height: number) {
    style.size.preset = 'custom'
    style.size.width = Math.max(320, Math.min(4000, Math.round(width) || 1080))
    style.size.height = Math.max(320, Math.min(4000, Math.round(height) || 1080))
  }

  function addTag(tag: string): boolean {
    const value = tag.trim().replace(/^#/, '')
    if (!value || card.tags.length >= 5 || card.tags.includes(value)) return false
    card.tags.push(value)
    return true
  }

  function removeTag(tag: string) {
    card.tags = card.tags.filter((t) => t !== tag)
  }

  function reset() {
    Object.assign(card, cloneCard(DEFAULT_CARD))
    Object.assign(style, cloneStyle(DEFAULT_STYLE))
  }

  function restore(snapshot: { card: CardData; style: CardStyle }) {
    Object.assign(card, cloneCard(snapshot.card))
    Object.assign(style, cloneStyle(snapshot.style))
  }

  function snapshot(): { card: CardData; style: CardStyle } {
    return { card: cloneCard(card), style: cloneStyle(style) }
  }

  const pixelRatio = computed(() => style.size.width / 1080)

  /** 内容/样式变化都触发，供历史记录去抖保存 */
  const revision = ref(0)
  watch([() => card, () => style], () => { revision.value++ }, { deep: true })

  return {
    card,
    style,
    activePanel,
    pixelRatio,
    revision,
    applyTemplate,
    setCardType,
    setSizePreset,
    setCustomSize,
    addTag,
    removeTag,
    reset,
    restore,
    snapshot,
  }
}

export type CardEditorStore = ReturnType<typeof useCardEditor>
