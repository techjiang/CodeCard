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

  test('标题与内容都相同才去重', () => {
    const { save, list } = useHistory()
    const store = useCardEditor()
    save({ ...store.card, title: 'A', content: '1' }, store.style)
    save({ ...store.card, title: 'A', content: '1' }, store.style)
    expect(list.value).toHaveLength(1)
    save({ ...store.card, title: 'A', content: '2' }, store.style)
    expect(list.value).toHaveLength(2)
  })

  test('保存的是快照，外部改动不影响历史', () => {
    const { save, list, get } = useHistory()
    const store = useCardEditor()
    const entry = save(store.card, store.style)
    store.card.title = '改过了'
    store.card.tags.push('新标签')
    expect(get(entry.id)?.card.title).not.toBe('改过了')
    expect(get(entry.id)?.card.tags).not.toContain('新标签')
    expect(list.value[0].card.tags).not.toContain('新标签')
  })

  test('配额不足时丢弃旧记录再试', () => {
    const { save, list } = useHistory()
    const store = useCardEditor()
    for (let i = 0; i < 8; i++) save({ ...store.card, title: `Q${i}`, content: `${i}` }, store.style)
    const realSet = localStorage.setItem.bind(localStorage)
    let first = true
    localStorage.setItem = (k: string, v: string) => {
      if (first) {
        first = false
        throw new Error('QuotaExceededError')
      }
      realSet(k, v)
    }
    try {
      save({ ...store.card, title: '溢出', content: 'x' }, store.style)
    } finally {
      localStorage.setItem = realSet
    }
    expect(list.value.length).toBeLessThanOrEqual(6)
    expect(JSON.parse(localStorage.getItem('codecard:history')!)).toHaveLength(list.value.length)
  })
})
