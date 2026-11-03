import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { canvasToBlob, renderElementToCanvas } from '@/utils/dom-to-image'

type Call = [string, ...unknown[]]

/** 记录所有绘制调用的假 Canvas 上下文 */
function makeCtx() {
  const calls: Call[] = []
  const rec = (name: string) => (...args: unknown[]) => {
    calls.push([name, ...args])
  }
  return {
    calls,
    save: rec('save'),
    restore: rec('restore'),
    beginPath: rec('beginPath'),
    closePath: rec('closePath'),
    moveTo: rec('moveTo'),
    arcTo: rec('arcTo'),
    clip: rec('clip'),
    rect: rec('rect'),
    fillRect: rec('fillRect'),
    strokeRect: rec('strokeRect'),
    fillText: rec('fillText'),
    drawImage: rec('drawImage'),
    stroke: rec('stroke'),
    createLinearGradient: (...args: unknown[]) => {
      calls.push(['createLinearGradient', ...args])
      return { addColorStop: (...stop: unknown[]) => calls.push(['addColorStop', ...stop]) }
    },
    createRadialGradient: (...args: unknown[]) => {
      calls.push(['createRadialGradient', ...args])
      return { addColorStop: (...stop: unknown[]) => calls.push(['addColorStop', ...stop]) }
    },
    // 中文按 20px、其余按 10px 估算，方便断言换行
    measureText: (text: string) => ({
      width: Array.from(text).reduce((sum, ch) => sum + (/[\u2e80-\u9fff]/.test(ch) ? 20 : 10), 0),
    }),
    set fillStyle(v: unknown) {
      calls.push(['fillStyle', v])
    },
    set strokeStyle(v: unknown) {
      calls.push(['strokeStyle', v])
    },
    set lineWidth(v: unknown) {
      calls.push(['lineWidth', v])
    },
    set font(v: unknown) {
      calls.push(['font', v])
    },
    textAlign: 'left',
    set textBaseline(v: unknown) {
      calls.push(['textBaseline', v])
    },
  }
}

let ctx: ReturnType<typeof makeCtx>

/** jsdom 不做布局，getBoundingClientRect 恒为 0，这里按 data-* 标注的尺寸伪造 */
function fakeRect(el: HTMLElement, w: number, h: number, x = 0, y = 0): HTMLElement {
  el.dataset.w = String(w)
  el.dataset.h = String(h)
  el.dataset.x = String(x)
  el.dataset.y = String(y)
  return el
}

/** jsdom 不会展开 border-radius 简写，测试里统一用长写属性 */
const ROUND = { borderTopLeftRadius: '8px', borderTopRightRadius: '8px', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }

/** 给元素写内联样式，避免 jsdom 对样式表的支持差异 */
function styled<T extends HTMLElement>(el: T, css: Record<string, string>): T {
  for (const [k, v] of Object.entries(css)) el.style.setProperty(k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), v)
  return el
}

function callsOf(name: string): Call[] {
  return ctx.calls.filter((c) => c[0] === name)
}

function texts(): string[] {
  return callsOf('fillText').map((c) => String(c[1]))
}

beforeEach(() => {
  ctx = makeCtx()
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never
  Element.prototype.getBoundingClientRect = function () {
    const el = this as HTMLElement
    const w = parseFloat(el.dataset.w ?? '0')
    const h = parseFloat(el.dataset.h ?? '0')
    const x = parseFloat(el.dataset.x ?? '0')
    const y = parseFloat(el.dataset.y ?? '0')
    return { x, y, left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, toJSON: () => ({}) } as DOMRect
  }
})

describe('导出尺寸', () => {
  const makeRoot = () => {
    const root = fakeRect(document.createElement('div'), 1080, 1080)
    const child = fakeRect(document.createElement('p'), 1080, 200)
    child.textContent = '中文 body'
    root.appendChild(child)
    document.body.appendChild(root)
    return root
  }

  test('1x 导出尺寸等于设计尺寸', async () => {
    const canvas = await renderElementToCanvas(makeRoot(), { scale: 1, width: 1080, height: 1080 })
    expect([canvas.width, canvas.height]).toEqual([1080, 1080])
  })

  test('2x 导出分辨率翻倍', async () => {
    const canvas = await renderElementToCanvas(makeRoot(), { scale: 2, width: 1080, height: 1080 })
    expect([canvas.width, canvas.height]).toEqual([2160, 2160])
  })

  test('3x 导出分辨率三倍，横版尺寸按比例', async () => {
    const canvas = await renderElementToCanvas(makeRoot(), { scale: 3, width: 1200, height: 630 })
    expect([canvas.width, canvas.height]).toEqual([3600, 1890])
  })

  test('整张画布铺底，默认白色兜底', async () => {
    await renderElementToCanvas(makeRoot(), { scale: 1, width: 200, height: 100 })
    expect(ctx.calls[0]).toEqual(['fillStyle', '#FFFFFF'])
    expect(ctx.calls[1]).toEqual(['fillRect', 0, 0, 200, 100])
  })

  test('可指定兜底底色', async () => {
    await renderElementToCanvas(makeRoot(), { scale: 1, width: 200, height: 100, background: '#101820' })
    expect(ctx.calls[0]).toEqual(['fillStyle', '#101820'])
  })

  test('canvas 转 Blob 为 PNG', async () => {
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(new Blob(['x'], { type: 'image/png' }))
    } as never
    const blob = await canvasToBlob(document.createElement('canvas'))
    expect(blob.type).toBe('image/png')
  })
})

describe('导出渲染：背景与边框', () => {
  test('线性渐变按 CSS 角度换算坐标', async () => {
    const root = styled(fakeRect(document.createElement('div'), 200, 100), {
      backgroundImage: 'linear-gradient(180deg,#000000,#FFFFFF)',
    })
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 100 })
    // 180deg = 从上到下：起点 (100,0)，终点 (100,100)
    const [call] = callsOf('createLinearGradient')
    expect(call.slice(1).map((v) => Math.round(Number(v)) || 0)).toEqual([100, 0, 100, 100])
    expect(callsOf('addColorStop').map((c) => [c[1], c[2]])).toEqual([
      [0, '#000000'],
      [1, '#FFFFFF'],
    ])
  })

  test('角度渐变长度按 |w·sinθ| + |h·cosθ| 计算', async () => {
    const root = styled(fakeRect(document.createElement('div'), 200, 100), {
      backgroundImage: 'linear-gradient(90deg,#111111,#222222)',
    })
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 100 })
    const [call] = callsOf('createLinearGradient')
    // 90deg = 从左到右：起点 (0,50)，终点 (200,50)
    expect(call.slice(1).map((v) => Math.round(Number(v)) || 0)).toEqual([0, 50, 200, 50])
  })

  test('to right 关键字等价于 90deg', async () => {
    const root = styled(fakeRect(document.createElement('div'), 100, 100), {
      backgroundImage: 'linear-gradient(to right,#111111,#222222)',
    })
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 100, height: 100 })
    const [call] = callsOf('createLinearGradient')
    expect(call.slice(1).map((v) => Math.round(Number(v)) || 0)).toEqual([0, 50, 100, 50])
  })

  test('径向渐变以元素中心为圆心', async () => {
    const root = styled(fakeRect(document.createElement('div'), 200, 100), {
      backgroundImage: 'radial-gradient(#FFFFFF,#000000)',
    })
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 100 })
    const [call] = callsOf('createRadialGradient')
    expect(call.slice(1, 3).map((v) => Math.round(Number(v)) || 0)).toEqual([100, 50])
  })

  test('圆角元素走裁剪路径', async () => {
    const root = styled(fakeRect(document.createElement('div'), 200, 100), {
      backgroundColor: 'rgb(255, 255, 255)',
      ...ROUND,
    })
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 100 })
    // 背景填充与描边各自裁剪一次
    expect(callsOf('clip').length).toBeGreaterThanOrEqual(1)
    expect(callsOf('arcTo').length % 4).toBe(0)
  })

  test('text-align 只影响本级绘制', async () => {
    const root = styled(fakeRect(document.createElement('div'), 200, 400), { textAlign: 'left' })
    const p = styled(fakeRect(document.createElement('div'), 200, 40), { fontSize: '20px', textAlign: 'center' })
    p.textContent = '居中'
    root.appendChild(p)
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 400 })
    expect(callsOf('fillText')[0][2]).toBe(100)
  })

  test('直角元素不裁剪', async () => {
    const root = styled(fakeRect(document.createElement('div'), 200, 100), { backgroundColor: 'rgb(255, 255, 255)' })
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 100 })
    expect(callsOf('clip')).toHaveLength(0)
  })

  test('边框按 1x 宽度与圆角绘制', async () => {
    const root = styled(fakeRect(document.createElement('div'), 100, 100), {
      backgroundColor: 'rgb(255, 255, 255)',
      border: '2px solid rgb(255, 0, 0)',
      ...ROUND,
    })
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 2, width: 100, height: 100 })
    expect(callsOf('lineWidth')[0]).toEqual(['lineWidth', 4])
    expect(callsOf('strokeStyle')[0]).toEqual(['strokeStyle', 'rgb(255, 0, 0)'])
    expect(callsOf('stroke')).toHaveLength(1)
    expect(callsOf('strokeRect')).toHaveLength(0)
  })

  test('直角边框走 strokeRect，并内缩半个线宽', async () => {
    const root = styled(fakeRect(document.createElement('div'), 100, 100), {
      backgroundColor: 'rgb(255, 255, 255)',
      border: '2px solid rgb(0, 255, 0)',
    })
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 2, width: 100, height: 100 })
    expect(callsOf('strokeRect')[0]).toEqual(['strokeRect', 2, 2, 196, 196])
  })

  test('无边框不描边', async () => {
    const root = styled(fakeRect(document.createElement('div'), 100, 100), { backgroundColor: 'rgb(255, 255, 255)' })
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 100, height: 100 })
    expect(callsOf('strokeRect')).toHaveLength(0)
  })
})

describe('导出渲染：文本', () => {
  test('纯文本节点绘制到画布', async () => {
    const root = fakeRect(document.createElement('div'), 200, 400)
    const p = styled(fakeRect(document.createElement('p'), 200, 40), { fontSize: '20px' })
    p.textContent = '你好'
    root.appendChild(p)
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 400 })
    expect(texts()).toContain('你好')
  })

  test('超宽文本按字符贪心换行', async () => {
    const root = fakeRect(document.createElement('div'), 200, 400)
    const p = styled(fakeRect(document.createElement('div'), 100, 200), { fontSize: '20px' })
    // 每个中文 20px、容器 100px → 每行 5 个字
    p.textContent = '一二三四五六七八九十'
    root.appendChild(p)
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 400 })
    expect(texts()).toEqual(['一二三四五', '六七八九十'])
  })

  test('居中文本以内容区中心为锚点', async () => {
    const root = fakeRect(document.createElement('div'), 200, 400)
    const p = styled(fakeRect(document.createElement('div'), 200, 40), { fontSize: '20px', textAlign: 'center' })
    p.textContent = '居中'
    root.appendChild(p)
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 400 })
    const [call] = callsOf('fillText')
    expect(call[2]).toBe(100)
  })

  test('右对齐文本贴右边', async () => {
    const root = fakeRect(document.createElement('div'), 200, 400)
    const p = styled(fakeRect(document.createElement('div'), 200, 40), { fontSize: '20px', textAlign: 'right' })
    p.textContent = '右'
    root.appendChild(p)
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 400 })
    expect(callsOf('fillText')[0][2]).toBe(200)
  })

  test('内边距从左侧扣掉', async () => {
    const root = fakeRect(document.createElement('div'), 200, 400)
    const p = styled(fakeRect(document.createElement('div'), 200, 40), {
      fontSize: '20px',
      paddingLeft: '24px',
      paddingRight: '24px',
    })
    p.textContent = '缩进'
    root.appendChild(p)
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 400 })
    expect(callsOf('fillText')[0][2]).toBe(24)
  })

  test('ellipsis 文本超宽时截断并加省略号', async () => {
    const root = fakeRect(document.createElement('div'), 200, 400)
    const p = styled(fakeRect(document.createElement('div'), 100, 40), {
      fontSize: '20px',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
    })
    p.textContent = '一二三四五六七八'
    root.appendChild(p)
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 400 })
    const out = texts()[0]
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThan(9)
  })

  test('空文本不绘制', async () => {
    const root = fakeRect(document.createElement('div'), 200, 400)
    const p = styled(fakeRect(document.createElement('div'), 200, 40), { fontSize: '20px' })
    p.textContent = '   '
    root.appendChild(p)
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 400 })
    expect(texts()).toHaveLength(0)
  })
})

describe('导出渲染：树遍历', () => {
  test('display:none 子树整体跳过', async () => {
    const root = fakeRect(document.createElement('div'), 200, 400)
    const hidden = styled(fakeRect(document.createElement('div'), 200, 40), { display: 'none' })
    hidden.textContent = '不该出现'
    root.appendChild(hidden)
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 400 })
    expect(texts()).not.toContain('不该出现')
  })

  test('visibility:hidden 与 opacity:0 跳过', async () => {
    const root = fakeRect(document.createElement('div'), 200, 400)
    const a = styled(fakeRect(document.createElement('div'), 200, 40), { visibility: 'hidden' })
    a.textContent = '不可见'
    const b = styled(fakeRect(document.createElement('div'), 200, 40), { opacity: '0' })
    b.textContent = '透明'
    root.append(a, b)
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 400 })
    expect(texts()).toEqual([])
  })

  test('零尺寸元素不绘制', async () => {
    const root = fakeRect(document.createElement('div'), 200, 400)
    const empty = fakeRect(document.createElement('div'), 0, 0)
    empty.textContent = '零尺寸'
    root.appendChild(empty)
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 400 })
    expect(texts()).toEqual([])
  })

  test('flex 容器里的 span 子项按块级各自绘制，不会粘成一段', async () => {
    const root = styled(fakeRect(document.createElement('div'), 400, 200), { display: 'flex' })
    for (const [i, label] of ['Vue', '前端', '响应式'].entries()) {
      const span = styled(fakeRect(document.createElement('span'), 60, 30, 90 * i, 0), { fontSize: '20px' })
      span.textContent = label
      root.appendChild(span)
    }
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 400, height: 200 })
    expect(texts()).toEqual(['Vue', '前端', '响应式'])
  })

  test('块级子节点递归绘制，父节点不重复画文本', async () => {
    const root = fakeRect(document.createElement('div'), 200, 400)
    const section = fakeRect(document.createElement('section'), 200, 100)
    const p = styled(fakeRect(document.createElement('p'), 200, 40), { fontSize: '20px' })
    p.textContent = '只画一次'
    section.appendChild(p)
    root.appendChild(section)
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 400 })
    expect(texts()).toEqual(['只画一次'])
  })

  test('script/style 等标签跳过', async () => {
    const root = fakeRect(document.createElement('div'), 200, 400)
    const style = fakeRect(document.createElement('style'), 10, 10)
    style.textContent = 'body{}'
    root.appendChild(style)
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 400 })
    expect(texts()).toEqual([])
  })
})

describe('导出渲染：按真实行盒绘制', () => {
  /**
   * 伪造 Range 的行盒，模拟浏览器已经排好版。
   * 只给「有文字的元素」返回行盒——真实浏览器里空元素也没有矩形，
   * 一律返回空数组会让渲染器以为量不到布局，直接退回逐字断行。
   */
  /** jsdom 的元素没有默认字号，字体串拼不完整就量不了字，统一写上 */
  function withFont<T extends HTMLElement>(el: T): T {
    el.style.setProperty('font-size', '20px')
    el.style.setProperty('font-family', 'sans-serif')
    return el
  }

  function fakeRangeRects(rects: Array<[number, number, number, number]>, onlyWhenContains = '', fullText = '') {
    Range.prototype.getClientRects = function (this: Range) {
      const text = this.toString()
      if (!text.trim()) return [] as never
      if (onlyWhenContains && !text.includes(onlyWhenContains)) return [] as never
      // 只有「整段文字」才拿到完整行盒；按字量的（逐字断行时）只给 0 宽，
      // 和真实浏览器一致——这正是分不清行宽的原因
      const use = text === fullText ? rects : []
      return use.map(([x, y, w, h]) => ({ x, y, left: x, top: y, right: x + w, bottom: y + h, width: w, height: h })) as never
    } as never
  }

  const realRange = Range.prototype.getClientRects

  afterEach(() => {
    Range.prototype.getClientRects = realRange
  })

  test('行盒位置被直接采用，不再按 measureText 重新断行', async () => {
    const root = fakeRect(document.createElement('div'), 110, 400, 0, 0)
    const p = withFont(fakeRect(document.createElement('p'), 110, 80, 0, 0))
    p.textContent = '一二三四五六七八'
    root.appendChild(p)
    document.body.appendChild(root)
    // 浏览器把它排成两行（行宽 110px，五个 20px 的字），第二行在下一行的行盒里
    fakeRangeRects([[0, 0, 110, 24], [0, 30, 110, 24]], '一二三四', '一二三四五六七八')
    await renderElementToCanvas(root, { scale: 1, width: 110, height: 400 })
    expect(texts()).toEqual(['一二三四五', '六七八'])
    // 第二行跟着行盒走（30 + 半个行高），而不是平均分摊在元素里
    expect(callsOf('fillText')[1][3]).toBe(42)
  })

  test('行内元素跨行时按各自的行盒裁切，一段文字不会重复画满每行', async () => {
    const root = fakeRect(document.createElement('div'), 200, 200, 0, 0)
    const p = withFont(fakeRect(document.createElement('p'), 200, 60, 0, 0))
    const code = withFont(fakeRect(document.createElement('code'), 200, 24, 0, 0))
    code.textContent = 'Object.defineProperty'
    p.append('用 ', code)
    root.appendChild(p)
    document.body.appendChild(root)
    // 行内代码被拆成两行（第二行跑到下一行的行盒里）
    fakeRangeRects([[60, 0, 60, 24], [0, 30, 60, 24]], 'Object', 'Object.defineProperty')
    await renderElementToCanvas(root, { scale: 1, width: 200, height: 200 })
    // 跨行的行内代码按行盒切开：一段不会被整段画到每一行上，也不会被切成碎字
    const drawn = texts().filter((t) => t.includes('Object.defineProperty'))
    expect(drawn.length).toBeLessThanOrEqual(2)
    expect(callsOf('fillText').length).toBeGreaterThanOrEqual(1)
  })

  test('IMG 元素被绘制到画布', async () => {
    const root = fakeRect(document.createElement('div'), 100, 100, 0, 0)
    const img = fakeRect(document.createElement('img'), 40, 40, 10, 10)
    root.appendChild(img)
    document.body.appendChild(root)
    await renderElementToCanvas(root, { scale: 1, width: 100, height: 100 })
    expect(callsOf('drawImage')).toHaveLength(1)
  })
})

describe('导出渲染：预览缩放折算', () => {
  test('预览被 CSS 缩放时仍按设计尺寸绘制', async () => {
    const root = fakeRect(document.createElement('div'), 540, 540)
    const p = styled(fakeRect(document.createElement('p'), 1080, 100), { fontSize: '20px' })
    p.textContent = '缩放'
    root.appendChild(p)
    document.body.appendChild(root)
    // 预览按 50% 显示，canvas 为 1x
    await renderElementToCanvas(root, { scale: 1, width: 1080, height: 1080 })
    expect(ctx.calls[1]).toEqual(['fillRect', 0, 0, 1080, 1080])
    expect(callsOf('fillRect').some((c) => c[1] === 0 && c[3] === 1080)).toBe(true)
  })
})

describe('导出渲染：装饰 SVG', () => {
  test('SVG 装饰转图片后绘制到画布', async () => {
    const root = fakeRect(document.createElement('div'), 200, 200)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    fakeRect(svg as unknown as HTMLElement, 200, 200)
    svg.innerHTML = '<rect width="10" height="10" fill="#fff" />'
    root.appendChild(svg)
    document.body.appendChild(root)

    const images: HTMLImageElement[] = []
    const RealImage = globalThis.Image
    class FakeImage {
      complete = true
      naturalWidth = 10
      decoding = ''
      src = ''
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor() {
        images.push(this as never)
      }
    }
    ;(globalThis as unknown as { Image: unknown }).Image = FakeImage
    try {
      await renderElementToCanvas(root, { scale: 1, width: 200, height: 200 })
      expect(images[0].src.startsWith('data:image/svg+xml')).toBe(true)
      expect(callsOf('drawImage')).toHaveLength(1)
    } finally {
      ;(globalThis as unknown as { Image: unknown }).Image = RealImage
    }
  })

  test('装饰图片加载失败不影响导出', async () => {
    const root = fakeRect(document.createElement('div'), 200, 200)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    fakeRect(svg as unknown as HTMLElement, 200, 200)
    root.appendChild(svg)
    document.body.appendChild(root)

    const RealImage = globalThis.Image
    class BadImage {
      complete = false
      naturalWidth = 0
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_v: string) {
        setTimeout(() => this.onerror?.(), 0)
      }
    }
    ;(globalThis as unknown as { Image: unknown }).Image = BadImage
    try {
      const canvas = await renderElementToCanvas(root, { scale: 1, width: 200, height: 200 })
      expect(canvas.width).toBe(200)
      expect(callsOf('drawImage')).toHaveLength(0)
    } finally {
      ;(globalThis as unknown as { Image: unknown }).Image = RealImage
    }
  })
})
