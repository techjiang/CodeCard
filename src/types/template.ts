import type { CardStyle } from './card'

export type TemplateCategory = 'code' | 'knowledge' | 'quote' | 'general'

export interface CardTemplate {
  id: string
  name: string
  category: TemplateCategory
  /** 该模板适用的卡片类型，空表示通用 */
  suits?: string[]
  defaultStyle: Partial<CardStyle>
  loader: () => Promise<{ default: unknown }>
}

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  code: '代码类',
  knowledge: '知识类',
  quote: '金句类',
  general: '通用',
}
