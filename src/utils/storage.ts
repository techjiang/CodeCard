/**
 * localStorage 安全封装：隐私模式、配额不足、SSR 时不抛错。
 */
export function safeGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function safeSet(key: string, value: string): boolean {
  try {
    globalThis.localStorage?.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function safeRemove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key)
  } catch {
    /* 忽略 */
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = safeGet(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
