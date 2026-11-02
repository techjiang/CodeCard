import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

const MIN_SCALE = 0.5
const MAX_STEPS = 14

/**
 * 内容放不下时自动缩小字号。
 *
 * 字号是响应式数据，改动后要等 Vue 更新到 DOM 才能测量，
 * 所以这里用异步循环（每次 await nextTick）逐档试缩，
 * 同步读 getComputedStyle 只会拿到旧值。
 */
export function useAutoFit(root: Ref<HTMLElement | null>, deps: () => unknown) {
  const scale = ref(1)
  let running = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let observer: ResizeObserver | null = null

  /** 内容自然高度是否超出容器 */
  function fits(el: HTMLElement): boolean {
    const content = el.querySelector<HTMLElement>('.cc-content') ?? (el.firstElementChild as HTMLElement | null)
    if (!content) return true
    const cs = getComputedStyle(content)
    const gap = parseFloat(cs.rowGap || cs.gap || '0') || 0
    const children = Array.from(content.children) as HTMLElement[]
    let natural = gap * Math.max(0, children.length - 1)

    for (const child of children) {
      const body = child.querySelector<HTMLElement>('.cc-body')
      if (body) {
        const innerGap = parseFloat(getComputedStyle(body).rowGap || '0') || 0
        const inner = Array.from(body.children) as HTMLElement[]
        natural += inner.reduce((sum, n) => sum + Math.max(n.scrollHeight, n.offsetHeight), 0)
        natural += innerGap * Math.max(0, inner.length - 1)
      } else {
        natural += Math.max(child.scrollHeight, child.offsetHeight)
      }
    }
    return natural <= el.clientHeight + 1
  }

  async function measure() {
    const el = root.value
    if (!el || el.clientHeight === 0) return

    scale.value = 1
    await nextTick()
    if (fits(el)) return

    for (let i = 1; i <= MAX_STEPS; i++) {
      const next = Math.max(MIN_SCALE, Math.round((1 - i * 0.04) * 100) / 100)
      scale.value = next
      await nextTick()
      if (fits(el)) return
      if (next <= MIN_SCALE) return
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
      if (running) return
      running = true
      try {
        await measure()
      } finally {
        running = false
      }
    }, 60)
  }

  onMounted(async () => {
    schedule()
    await nextTick()
    if (document.fonts?.ready) void document.fonts.ready.then(schedule)
    setTimeout(schedule, 400)
    setTimeout(schedule, 1000)
    const el = root.value
    if (el && 'ResizeObserver' in window) {
      observer = new ResizeObserver(() => schedule())
      observer.observe(el)
    }
  })

  watch(deps, schedule, { deep: true })
  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
    observer?.disconnect()
  })

  return { scale, measure }
}
