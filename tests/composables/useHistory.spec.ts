import { beforeEach, describe, expect, test } from 'vitest'
import { useHistory } from '@/composables/useHistory'
import { useCardEditor } from '@/composables/useCardEditor'

describe('历史记录', () => {
  beforeEach(() => {
    localStorage.clear()
    useHistory().clear()
  })

  test('保存后可按时间倒序读出', () => {
    const { save, list } = useHistory()
    const store = useCardEditor()
    save({ ...store.card, title: 'A' }, store.style)
    save({ ...store.card, title: 'B' }, store.style)
    expect(list.value[0].card.title).toBe('B')
  })

  test('最多保留 20 条', () => {
    const { save, list, LIMIT } = useHistory()
    const store = useCardEditor()
    for (let i = 0; i < 25; i++) save({ ...store.card, title: `T${i}`, content: `${i}` }, store.style)
    expect(list.value).toHaveLength(LIMIT)
  })

  test('删除与清空', () => {
    const { save, remove, clear, list } = useHistory()
    const store = useCardEditor()
    const entry = save(store.card, store.style)
    remove(entry.id)
    expect(list.value.find((e) => e.id === entry.id)).toBeUndefined()
    save(store.card, store.style)
    clear()
    expect(list.value).toHaveLength(0)
  })

  test('写入 localStorage 并且能恢复', () => {
    const { save } = useHistory()
    const store = useCardEditor()
    save(store.card, store.style)
    const raw = localStorage.getItem('codecard:history')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)[0].card.title).toBe(store.card.title)
  })
})
