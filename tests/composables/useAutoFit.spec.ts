/**
 * 自适应缩放的单测。
 *
 * 这里能验的是「测量的口径」和「时序」：量的那个数，是不是我以为的那个数。
 * 字号最终落在哪一档由浏览器排版决定，jsdom 不排版、measureText 恒返回 0，
 * 那部分交给 tests/e2e/autofit.e2e.ts。
 */
import { afterEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useAutoFit } from '@/composables/useAutoFit'

const mounted: Array<{ unmount: () => void }> = []

afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
})

function num(el: object, values: Record<string, number>) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(el, key, { value, configurable: true, writable: true })
  }
}

interface Skeleton {
  root: Ref<HTMLElement | null>
  /** root 元素（模板外壳，比如 .cc-fit） */
  host: HTMLElement
  /** 卡片根节点，尺寸写死，与内容撑多大无关 */
  card: HTMLElement
  /** 版心 .cc-content */
  content: HTMLElement
  /** 往版心里塞一块内容，返回那个元素 */
  addBlock(cls?: string): HTMLElement
}

/**
 * 挂一个最小的卡片骨架：卡片 → 外壳（root） → 版心 .cc-content → 内容块。
 * 所有尺寸都靠 defineProperty 写死，jsdom 不排版，只能这么给。
 */
function mountCard(
  options: { cardHeight?: number; cardWidth?: number; courtHeight?: number; rootIsContent?: boolean } = {},
): Skeleton {
  const root = ref<HTMLElement | null>(null)
  const card = document.createElement('div')
  num(card, {
    clientHeight: options.cardHeight ?? 1080,
    offsetHeight: options.cardHeight ?? 1080,
    clientWidth: options.cardWidth ?? 1080,
    offsetWidth: options.cardWidth ?? 1080,
  })
  document.body.appendChild(card)

  const Comp = defineComponent({
    setup: () => () => h('div', { ref: (el) => (root.value = el as HTMLElement) }),
  })
  const wrapper = mount(Comp)
  mounted.push(wrapper)

  const host = root.value!
  card.appendChild(host)

  const content = host
  content.className = 'cc-content'
  num(content, {
    clientHeight: options.courtHeight ?? 800,
    offsetHeight: options.courtHeight ?? 800,
    scrollHeight: options.courtHeight ?? 800,
    clientWidth: options.cardWidth ?? 1080,
    offsetWidth: options.cardWidth ?? 1080,
    scrollWidth: options.cardWidth ?? 1080,
  })
  // root 就是 .cc-content 的形态（模板把 ref 直接挂在版心上时）
  if (!options.rootIsContent) {
    // 默认形态：root 是外壳，版心在它里面
    const inner = document.createElement('div')
    inner.className = 'cc-content'
    num(inner, {
      clientHeight: options.courtHeight ?? 800,
      offsetHeight: options.courtHeight ?? 800,
      scrollHeight: options.courtHeight ?? 800,
      clientWidth: options.cardWidth ?? 1080,
      offsetWidth: options.cardWidth ?? 1080,
      scrollWidth: options.cardWidth ?? 1080,
    })
    content.className = 'cc-fit'
    num(content, { clientHeight: options.courtHeight ?? 800, offsetHeight: options.courtHeight ?? 800 })
    content.appendChild(inner)
    return {
      root,
      host: content,
      card,
      content: inner,
      addBlock(cls = 'md-p') {
        const block = document.createElement('p')
        block.className = cls
        inner.appendChild(block)
        return block
      },
    }
  }

  return {
    root,
    host,
    card,
    content,
    addBlock(cls = 'md-p') {
      const block = document.createElement('p')
      block.className = cls
      content.appendChild(block)
      return block
    },
  }
}

function setBlockHeight(block: HTMLElement, height: number) {
  num(block, { offsetHeight: height, scrollHeight: height })
  vi.spyOn(block, 'getBoundingClientRect').mockReturnValue({ height } as DOMRect)
}

describe('自适应缩放：量的对象是对的', () => {
  test('root 本身就是 .cc-content 时也要量到它自己', async () => {
    // 这条守的是 querySelector 不含自己的坑：查不到版心就会退到 firstElementChild，
    // 量到的是一棵不相干的子树，数字读得出来但完全不是这个东西
    const sk = mountCard({ cardHeight: 1080, courtHeight: 400, rootIsContent: true })
    setBlockHeight(sk.addBlock(), 3000)

    const fit = useAutoFit(sk.root, () => [])
    await fit.measure()
    // 内容 3000 远超卡片 1080，必须缩；量不到版心就会当成 0 而停在 1
    expect(fit.scale.value).toBeLessThan(1)
  })

  test('内容放得下时只会往上放大，不会往下缩', async () => {
    const sk = mountCard({ cardHeight: 1080, courtHeight: 800 })
    setBlockHeight(sk.addBlock(), 400)

    const fit = useAutoFit(sk.root, () => [])
    await fit.measure()
    expect(fit.scale.value).toBeGreaterThanOrEqual(1)
    // 放大有天花板（每行至少 16 个字 + 高度余量），不会把一行字放成竖排
    expect(fit.scale.value).toBeLessThanOrEqual(1.6)
  })

  test('内容远超卡片时缩到下限，不会无限缩', async () => {
    const sk = mountCard({ cardHeight: 1080, courtHeight: 800 })
    setBlockHeight(sk.addBlock(), 20000)

    const fit = useAutoFit(sk.root, () => [])
    await fit.measure()
    expect(fit.scale.value).toBeGreaterThanOrEqual(0.28)
    expect(fit.scale.value).toBeLessThan(1)
  })

  test('可用高度按卡片算，不按被压小的版心算', async () => {
    // 版心是 flex 项，被压到 200 不代表卡片只给得出 200
    const sk = mountCard({ cardHeight: 1080, courtHeight: 200 })
    setBlockHeight(sk.addBlock(), 900)

    const fit = useAutoFit(sk.root, () => [])
    await fit.measure()
    // 900 塞进 1080 是放得下的，不该一路缩到下限
    expect(fit.scale.value).toBeGreaterThan(0.9)
  })

  test('内容横向溢出时不放大', async () => {
    const sk = mountCard({ cardHeight: 1080, courtHeight: 800 })
    const block = sk.addBlock()
    setBlockHeight(block, 100)
    num(sk.content, { scrollWidth: 1400, clientWidth: 1080 })

    const fit = useAutoFit(sk.root, () => [])
    await fit.measure()
    expect(fit.scale.value).toBeLessThanOrEqual(1)
  })
})

describe('自适应缩放：时序与边界', () => {
  test('元素没挂上时 measure 直接返回，不抛错', async () => {
    const empty: Ref<HTMLElement | null> = ref(null)
    const fit = useAutoFit(empty, () => [])
    await expect(fit.measure()).resolves.toBeUndefined()
    expect(fit.scale.value).toBe(1)
  })

  test('卡片量为零（藏在 display:none 的 Tab 里）时不改缩放', async () => {
    const sk = mountCard({ cardHeight: 0, courtHeight: 0 })
    const fit = useAutoFit(sk.root, () => [])
    await fit.measure()
    expect(fit.scale.value).toBe(1)
  })

  test('measure 之后 settled 为真，导出不用猜时机', async () => {
    const sk = mountCard()
    const fit = useAutoFit(sk.root, () => [])
    expect(fit.settled.value).toBe(false)
    await fit.refit()
    expect(fit.settled.value).toBe(true)
  })

  test('waitForSettle 在上限内返回，不会把导出卡死', async () => {
    const sk = mountCard()
    const fit = useAutoFit(sk.root, () => [])
    const start = Date.now()
    await fit.waitForSettle(120)
    expect(Date.now() - start).toBeLessThan(800)
  })

  test('依赖变化会重新测量', async () => {
    const sk = mountCard({ cardHeight: 1080, courtHeight: 800 })
    setBlockHeight(sk.addBlock(), 200)
    const deps = ref('短')
    const fit = useAutoFit(sk.root, () => deps.value)

    await nextTick()
    await new Promise((r) => setTimeout(r, 120))
    expect(fit.scale.value).toBe(1)

    setBlockHeight(sk.addBlock('md-p'), 4000)
    deps.value = '很长的一篇'
    await nextTick()
    // 去抖 60ms + 逐档试缩
    await new Promise((r) => setTimeout(r, 400))
    expect(fit.scale.value).toBeLessThan(1)
  })
})
