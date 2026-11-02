import { ref, watch } from 'vue'
import { safeGet, safeSet } from '@/utils/storage'

const STORAGE_KEY = 'codecard:ui-theme'
export type UiTheme = 'light' | 'dark'

function readInitial(): UiTheme {
  const saved = safeGet(STORAGE_KEY)
  return saved === 'dark' ? 'dark' : 'light'
}

const theme = ref<UiTheme>(readInitial())

watch(
  theme,
  (value) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', value === 'dark')
    }
    safeSet(STORAGE_KEY, value)
  },
  { immediate: true },
)

export function useTheme() {
  const toggle = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }
  return { theme, toggle, setTheme: (v: UiTheme) => (theme.value = v) }
}
