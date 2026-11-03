import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

/** 缩小下限：字缩到看不清就没意义了，宁可让导出渲染器在词边界断开 */
const MIN_SCALE = 0.28
const MAX_GROW = 1.6
/** 放大后正文每行至少要有这么多字，否则宁可留白也别排成一列字 */
const MIN_CHARS_PER_LINE = 16
/** 行首不能出现的标点（中文避头尾规则） */
const NO_LINE_START = '，。、；：？！）》」』】…—,.;:?!)]}'
const MAX_STEPS = 14

/** 元素按内容撑开时的高度 */
function naturalHeight(el: HTMLElement): number {
  return Math.max(el.scrollHeight, el.offsetHeight, el.getBoundingClientRect().height)
}

/** .cc-content 的总自然高度（含 gap，正文按内容撑开算） */
function naturalTotal(el: HTMLElement): number {
  const content = el.querySelector<HTMLElement>('.cc-content') ?? (el.firstElementChild as HTMLElement | null)
  if (!content) return 0
  const cs = getComputedStyle(content)
  const gap = parseFloat(cs.rowGap || cs.gap || '0') || 0
  const children = Array.from(content.children) as HTMLElement[]
  let natural = gap * Math.max(0, children.length - 1)

  // 正文区会被 flex 压小：scrollHeight 量的是被压缩后的盒子，内容仍可能溢出，
  // 所以正文按「自然高度」累加，不能只看盒子高度。
  for (const child of children) {
    const body = child.querySelector<HTMLElement>('.cc-body')
    if (!body) {
      natural += Math.max(child.scrollHeight, child.offsetHeight)
      continue
    }
    const innerGap = parseFloat(getComputedStyle(body).rowGap || '0') || 0
    const inner = Array.from(body.children) as HTMLElement[]
    natural += inner.reduce((sum, n) => sum + naturalHeight(n), 0)
    natural += innerGap * Math.max(0, inner.length - 1)
  }
  return natural
}

let sharedCtx: CanvasRenderingContext2D | null | undefined
/** 复用一个离屏 canvas 量文字宽度 */
function measureCtx(): CanvasRenderingContext2D | null {
  if (sharedCtx !== undefined) return sharedCtx
  sharedCtx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  return sharedCtx
}

function clamp(v: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_GROW, Number(v.toFixed(2))))
}

/**
 * 内容放不下时自动缩字号，内容太短时自动放大填满。
 *
 * 字号是响应式数据，改动后要等 Vue 更新到 DOM 才能测量，
 * 所以这里全部用异步循环（每次 await nextTick），
 * 同步读 getComputedStyle 只会拿到上一帧的旧值。
 */
export function useAutoFit(root: Ref<HTMLElement | null>, deps: () => unknown) {
  const scale = ref(1)
  /** 首次测量是否已经完成，导出要等它，否则可能截到缩放的中间态 */
  const settled = ref(false)
  let running = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let observer: ResizeObserver | null = null
  let pending = false

  /** 内容是否落在容器内（高度按自然高度算，宽度看有没有横向溢出） */
  function fits(el: HTMLElement, target: number, slack = 1): boolean {
    const natural = naturalTotal(el)
    if (!natural || natural > target + slack) return false
    const content = el.querySelector<HTMLElement>('.cc-content') ?? el.firstElementChild
    if (!content) return true
    if (content.scrollWidth > content.clientWidth + 2) return false
    // 行内元素（代码片段、行内代码）不参与 scrollWidth，得量真实行盒
    const range = document.createRange()
    range.selectNodeContents(content)
    const boxRight = content.getBoundingClientRect().right
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.right > boxRight + 2) return false
    }
    return true
  }

  /**
   * 第一遍按比例缩到刚好放下（缩太慢时逐档试缩兜底）；
   * 第二遍内容太短就等比放大，别让竖版空着半张卡。
   */
  async function measure() {
    const el = root.value
    if (!el || el.clientHeight === 0) return

    scale.value = 1
    await nextTick()

    const cs = getComputedStyle(el)
    const target = el.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0)
    const base = naturalTotal(el)
    if (base > target + 1) {
      // 高度随字号单调增长，按比例缩通常一两次就到位。
      // 留 6% 余量：断行按整字取整、行末标点还挂在行盒外，估出来的高度总是偏乐观。
      let g = clamp((target / base) * 0.94)
      // 兜底逐档往下试：断行不是严格线性的，有的档位缩 2% 不降行，再缩 2% 就整整少一行。
      for (let i = 0; i <= MAX_STEPS * 4; i++) {
        scale.value = g
        await nextTick()
        if (fits(el, target)) return
        if (g <= MIN_SCALE) return
        // 差得多就直接按真实高度比跳过去，别一档一档挪
        const cur = naturalTotal(el)
        const ratio = cur > target * 1.15 ? Math.max(0.7, Math.min(0.97, target / cur)) : 1
        g = Math.max(MIN_SCALE, Math.round((g * ratio - 0.02) * 100) / 100)
      }
      return
    }

    // 内容不满一屏：先按高度和行宽估一个放大上限，再从这一档往下试，
    // 找到第一个「放得下且断行干净」的档位 —— 中文断行是浏览器贪心算的，
    // 标点会不会掉行首只跟具体字号有关，只能逐档实测。
    const max = clamp(Math.round(Math.min(target / base, charLimit(el)) * 0.97 * 100) / 100)
    let safe = 1
    for (let g = max; g > 1.001; g = Math.round((g - 0.02) * 100) / 100) {
      scale.value = g
      await nextTick()
      if (!fits(el, target)) continue
      if (!hasBadBreak(el)) return
      // 记录一个可用但略有瑕疵的档位，实在挑不到时用它，别一直停在原尺寸
      if (safe === 1) safe = g
    }
    scale.value = safe
    await nextTick()
  }

  /** 放大倍数上限：保证放大后每行仍有足够字数，别把句子排成竖排 */
  function charLimit(el: HTMLElement): number {
    const content = el.querySelector<HTMLElement>('.cc-content')
    if (!content) return MAX_GROW
    const fontSize = parseFloat(getComputedStyle(content).fontSize) || 0
    if (fontSize <= 0) return MAX_GROW
    // 此刻 scale 还是 1，量到的是基础字号；放大后字号会等比变大
    const width = content.clientWidth
    return width / (fontSize * MIN_CHARS_PER_LINE)
  }

  /**
   * 断行缺陷检测：标点掉在行首、或整段只剩一个标点落到下一行。
   *
   * Range 量不出来——浏览器会把行末标点悬挂出去，位置仍归属上一行。
   * 所以这里用 measureText 逐字累加宽度，自己模拟一遍贪心断行。
   */
  function hasBadBreak(el: HTMLElement): boolean {
    // 只看正文：页脚是右对齐的，贴边并不代表断行有问题
    const target =
      el.querySelector<HTMLElement>('.quote__line') ??
      el.querySelector<HTMLElement>('.cc-body') ??
      el.querySelector<HTMLElement>('.cc-content')
    if (!target) return false

    const text = (target.textContent ?? '').replace(/\s+/g, '')
    if (!text) return false

    const cs = getComputedStyle(target)
    const canvas = measureCtx()
    if (!canvas) return false
    canvas.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    // 内容宽度要扣掉左右内边距；再留一点余量，字宽的亚像素误差会让浏览器多排一行
    const padding = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
    const width = target.clientWidth - padding - parseFloat(cs.fontSize) * 0.05
    if (width <= 0) return false

    const lines: string[] = []
    let current = ''
    let used = 0
    for (const ch of text) {
      const w = canvas.measureText(ch).width
      if (used + w > width && current) {
        lines.push(current)
        current = ''
        used = 0
      }
      current += ch
      used += w
    }
    if (current) lines.push(current)

    if (lines.some((l) => NO_LINE_START.includes(l[0]))) return true
    // 末行只剩一个标点也很难看
    const last = lines[lines.length - 1] ?? ''
    return last.length > 0 && Array.from(last).every((c) => NO_LINE_START.includes(c))
  }

  function schedule() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
      if (running) {
        // 正在量的时候又来了变化，量完再补一次，别把最新状态丢掉
        pending = true
        return
      }
      running = true
      try {
        await measure()
        settled.value = true
      } finally {
        running = false
        if (pending) {
          pending = false
          schedule()
        }
      }
    }, 60)
  }

  onMounted(async () => {
    // 首帧字体可能还没生效，量出来的自然高度是错的，等字体就绪再量一次
    if (document.fonts?.ready) void document.fonts.ready.then(schedule)
    schedule()
    await nextTick()
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

  return { scale, settled, measure }
}
