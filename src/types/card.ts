export type CardType = 'knowledge' | 'code' | 'terminal' | 'math' | 'quote' | 'custom'

export type FontFamily = 'sans' | 'serif' | 'mono' | 'handwrite'
export type FontSize = 'sm' | 'md' | 'lg' | 'custom'
export type SizePreset = 'square' | 'landscape' | 'portrait' | 'custom'
export type WatermarkPosition = 'bottom-right' | 'bottom-center' | 'top-right'

export interface CardFooter {
  author?: string
  source?: string
  date?: string
}

export interface CardData {
  type: CardType
  title: string
  subtitle?: string
  content: string
  language?: string
  highlightTheme?: string
  showLineNumbers?: boolean
  filename?: string
  tags: string[]
  footer?: CardFooter
  /** 名言出处 */
  quoteFrom?: string
}

export interface CardSize {
  preset: SizePreset
  width: number
  height: number
}

export interface CardWatermark {
  enabled: boolean
  text?: string
  image?: string
  position: WatermarkPosition
}

export interface CardStyle {
  templateId: string
  primaryColor: string
  fontFamily: FontFamily
  fontSize: FontSize
  customFontSize?: number
  borderRadius: 0 | 8 | 16 | 24
  size: CardSize
  backgroundOpacity: number
  watermark?: CardWatermark
}

export const SIZE_PRESETS: Record<Exclude<SizePreset, 'custom'>, CardSize> = {
  square: { preset: 'square', width: 1080, height: 1080 },
  landscape: { preset: 'landscape', width: 1200, height: 630 },
  portrait: { preset: 'portrait', width: 1080, height: 1920 },
}

export const FONT_SIZE_MAP: Record<Exclude<FontSize, 'custom'>, number> = {
  sm: 30,
  md: 36,
  lg: 46,
}

export const FONT_STACK: Record<FontFamily, string> = {
  sans: '"Source Han Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  serif: '"Source Han Serif SC", "Songti SC", Georgia, serif',
  mono: '"JetBrains Mono", "SF Mono", Menlo, "PingFang SC", monospace',
  handwrite: '"LXGW WenKai", "Kaiti SC", cursive',
}

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  knowledge: '知识卡片',
  code: '代码片段',
  terminal: '命令行',
  math: '数学公式',
  quote: '名言金句',
  custom: '自定义',
}

export const DEFAULT_CARD: CardData = {
  type: 'knowledge',
  title: 'Vue 3 响应式原理',
  subtitle: '三分钟读懂 Proxy',
  content: [
    '## 核心机制',
    '',
    'Vue 3 用 `Proxy` 替代了 `Object.defineProperty`，可以拦截属性的**读取**、**赋值**和**删除**。',
    '',
    '- 依赖收集：读取时把副作用函数塞进 `dep`',
    '- 触发更新：赋值时把 `dep` 里的副作用跑一遍',
    '',
    '> 好处是能监听新增属性和数组下标，不再需要 `Vue.set`。',
  ].join('\n'),
  language: 'typescript',
  highlightTheme: 'one-dark',
  showLineNumbers: true,
  filename: 'reactivity.ts',
  tags: ['Vue', '前端', '响应式'],
  footer: { author: '', source: '', date: '' },
  quoteFrom: '',
}

export const DEFAULT_STYLE: CardStyle = {
  templateId: 'gradient-purple',
  primaryColor: '#8B5CF6',
  fontFamily: 'sans',
  fontSize: 'md',
  borderRadius: 16,
  size: { ...SIZE_PRESETS.square },
  backgroundOpacity: 100,
  watermark: { enabled: false, position: 'bottom-right', text: '' },
}
