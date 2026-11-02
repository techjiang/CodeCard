import type { CardTemplate } from '@/types/template'

/** 模板清单：组件按需加载，保证首屏体积 */
export const TEMPLATES: CardTemplate[] = [
  {
    id: 'terminal-black',
    name: '终端黑',
    category: 'code',
    suits: ['code', 'terminal'],
    defaultStyle: { primaryColor: '#4C8DFF', fontFamily: 'mono', fontSize: 'md' },
    loader: () => import('@/components/preview/templates/TerminalBlack.vue'),
  },
  {
    id: 'geek-blue',
    name: '极客蓝',
    category: 'code',
    suits: ['code', 'terminal'],
    defaultStyle: { primaryColor: '#38BDF8', fontFamily: 'mono', fontSize: 'md' },
    loader: () => import('@/components/preview/templates/GeekBlue.vue'),
  },
  {
    id: 'minimal-white',
    name: '极简白',
    category: 'code',
    suits: ['code', 'knowledge'],
    defaultStyle: { primaryColor: '#6366F1', fontFamily: 'sans', fontSize: 'md' },
    loader: () => import('@/components/preview/templates/MinimalWhite.vue'),
  },
  {
    id: 'vs-code',
    name: 'VS Code',
    category: 'code',
    suits: ['code', 'terminal'],
    defaultStyle: { primaryColor: '#3B9EF7', fontFamily: 'mono', fontSize: 'md' },
    loader: () => import('@/components/preview/templates/VsCode.vue'),
  },
  {
    id: 'gradient-purple',
    name: '渐变紫',
    category: 'knowledge',
    suits: ['knowledge', 'custom'],
    defaultStyle: { primaryColor: '#8B5CF6', fontFamily: 'sans', fontSize: 'md' },
    loader: () => import('@/components/preview/templates/GradientPurple.vue'),
  },
  {
    id: 'pink-sweet',
    name: '粉色甜心',
    category: 'knowledge',
    suits: ['knowledge', 'quote'],
    defaultStyle: { primaryColor: '#F472B6', fontFamily: 'sans', fontSize: 'md' },
    loader: () => import('@/components/preview/templates/PinkSweet.vue'),
  },
  {
    id: 'forest-green',
    name: '森林绿',
    category: 'knowledge',
    suits: ['knowledge', 'math'],
    defaultStyle: { primaryColor: '#34D399', fontFamily: 'sans', fontSize: 'md' },
    loader: () => import('@/components/preview/templates/ForestGreen.vue'),
  },
  {
    id: 'starry-night',
    name: '星空夜',
    category: 'knowledge',
    suits: ['knowledge', 'math', 'custom'],
    defaultStyle: { primaryColor: '#7C6BF5', fontFamily: 'sans', fontSize: 'md' },
    loader: () => import('@/components/preview/templates/StarryNight.vue'),
  },
  {
    id: 'magazine',
    name: '杂志风',
    category: 'quote',
    suits: ['quote', 'knowledge'],
    defaultStyle: { primaryColor: '#B45309', fontFamily: 'serif', fontSize: 'lg' },
    loader: () => import('@/components/preview/templates/MagazineStyle.vue'),
  },
  {
    id: 'poster',
    name: '海报风',
    category: 'quote',
    suits: ['quote', 'custom'],
    defaultStyle: { primaryColor: '#EF4444', fontFamily: 'sans', fontSize: 'lg' },
    loader: () => import('@/components/preview/templates/PosterStyle.vue'),
  },
  {
    id: 'handwrite',
    name: '手写风',
    category: 'quote',
    suits: ['quote', 'knowledge'],
    defaultStyle: { primaryColor: '#D97706', fontFamily: 'handwrite', fontSize: 'lg' },
    loader: () => import('@/components/preview/templates/HandwriteStyle.vue'),
  },
  {
    id: 'modern-simple',
    name: '现代简约',
    category: 'general',
    defaultStyle: { primaryColor: '#6366F1', fontFamily: 'sans', fontSize: 'md' },
    loader: () => import('@/components/preview/templates/ModernSimple.vue'),
  },
]

export function findTemplate(id: string): CardTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[4]
}

export function templatesByCategory(): Record<string, CardTemplate[]> {
  return TEMPLATES.reduce<Record<string, CardTemplate[]>>((acc, t) => {
    ;(acc[t.category] ??= []).push(t)
    return acc
  }, {})
}

/** 适合当前卡片类型的模板，用于模板面板排序 */
export function templatesForType(type: string): CardTemplate[] {
  const matched = TEMPLATES.filter((t) => t.suits?.includes(type))
  return [...matched, ...TEMPLATES.filter((t) => !matched.includes(t))]
}
