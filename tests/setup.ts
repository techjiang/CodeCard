import { beforeEach, vi, afterEach } from 'vitest'

/** jsdom 在不同版本下暴露位置不一致，这里统一挂到全局 */
const store = new Map<string, string>()

const localStorageMock: Storage = {
  get length() {
    return store.size
  },
  clear: () => store.clear(),
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  removeItem: (k: string) => void store.delete(k),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
}

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true })

beforeEach(() => {
  store.clear()
  document.documentElement.className = ''
})

afterEach(() => {
  vi.restoreAllMocks()
})
