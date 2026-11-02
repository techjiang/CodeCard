import { computed, ref } from 'vue'
import type { CardData, CardStyle } from '@/types/card'
import { readJSON, safeSet } from '@/utils/storage'

export interface HistoryEntry {
  id: string
  card: CardData
  style: CardStyle
  updatedAt: number
}

const STORAGE_KEY = 'codecard:history'
const LIMIT = 20

const entries = ref<HistoryEntry[]>([])
let loaded = false

function load() {
  if (loaded) return
  entries.value = readJSON<HistoryEntry[]>(STORAGE_KEY, []).filter(
    (e) => !!e && typeof e.id === 'string' && !!e.card && !!e.style,
  )
  loaded = true
}

function persist() {
  if (safeSet(STORAGE_KEY, JSON.stringify(entries.value))) return
  // 超出配额时丢弃较旧记录再试一次
  entries.value = entries.value.slice(0, 5)
  safeSet(STORAGE_KEY, JSON.stringify(entries.value))
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function useHistory() {
  load()

  const list = computed(() => [...entries.value].sort((a, b) => b.updatedAt - a.updatedAt))

  function save(card: CardData, style: CardStyle): HistoryEntry {
    load()
    const entry: HistoryEntry = {
      id: makeId(),
      card: JSON.parse(JSON.stringify(card)),
      style: JSON.parse(JSON.stringify(style)),
      updatedAt: Date.now(),
    }
    entries.value = [entry, ...entries.value.filter((e) => e.card.title !== card.title || e.card.content !== card.content)].slice(0, LIMIT)
    persist()
    return entry
  }

  function remove(id: string) {
    entries.value = entries.value.filter((e) => e.id !== id)
    persist()
  }

  function clear() {
    entries.value = []
    persist()
  }

  function get(id: string): HistoryEntry | undefined {
    return entries.value.find((e) => e.id === id)
  }

  return { list, save, remove, clear, get, LIMIT }
}
