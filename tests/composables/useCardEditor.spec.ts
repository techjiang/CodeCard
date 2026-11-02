import { describe, expect, test } from 'vitest'
import { useCardEditor } from '@/composables/useCardEditor'
import { SIZE_PRESETS } from '@/types/card'

describe('CardEditor', () => {
  test('输入标题实时更新预览', () => {
    const store = useCardEditor()
    store.card.title = '新的标题'
    expect(store.card.title).toBe('新的标题')
  })

  test('切换模板保留内容', () => {
    const store = useCardEditor()
    const before = store.card.content
    store.applyTemplate('terminal-black')
    expect(store.style.templateId).toBe('terminal-black')
    expect(store.card.content).toBe(before)
    expect(store.style.primaryColor).toBe('#4C8DFF')
  })

  test('切换卡片类型正确显示对应编辑器', () => {
    const store = useCardEditor()
    store.setCardType('code')
    expect(store.card.type).toBe('code')
    expect(store.card.language).toBeTruthy()
    store.card.language = ''
    store.setCardType('code')
    expect(store.card.language).toBe('typescript')
    store.setCardType('quote')
    expect(store.style.fontSize).toBe('lg')
  })

  test('尺寸预设同步宽高', () => {
    const store = useCardEditor()
    store.setSizePreset('landscape')
    expect(store.style.size).toEqual(SIZE_PRESETS.landscape)
    store.setCustomSize(500, 900)
    expect(store.style.size.preset).toBe('custom')
    expect([store.style.size.width, store.style.size.height]).toEqual([500, 900])
  })

  test('自定义尺寸做上下限收敛', () => {
    const store = useCardEditor()
    store.setCustomSize(10, 99999)
    expect(store.style.size.width).toBe(320)
    expect(store.style.size.height).toBe(4000)
  })

  test('标签最多 5 个且去重', () => {
    const store = useCardEditor()
    store.card.tags = []
    const results = ['Vue', 'Vue', '#前端', 'TS', 'CSS', 'Node', '多余'].map((t) => store.addTag(t))
    expect(store.card.tags).toEqual(['Vue', '前端', 'TS', 'CSS', 'Node'])
    expect(results.slice(-1)[0]).toBe(false)
    store.removeTag('Vue')
    expect(store.card.tags).not.toContain('Vue')
  })

  test('快照与还原互不影响', () => {
    const store = useCardEditor()
    const snap = store.snapshot()
    store.card.title = '改过的'
    snap.card.title = '外部改动'
    expect(store.card.title).toBe('改过的')
    store.restore({ card: { ...snap.card, title: '还原后的' }, style: snap.style })
    expect(store.card.title).toBe('还原后的')
  })

  test('重置回到默认值', () => {
    const store = useCardEditor()
    store.card.title = 'x'
    store.reset()
    expect(store.card.title).not.toBe('x')
  })
})
