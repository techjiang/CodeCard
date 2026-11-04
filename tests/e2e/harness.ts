/**
 * E2E 公共工具：用真实 Chromium 驱动真实应用。
 * jsdom 不做布局、Canvas 不量字，导出与自适应缩放这两块只能在这里验。
 */
import { chromium, type Browser, type Page } from 'playwright'

export const APP_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4180'

/** 自适应是逐档试缩 + 去抖 60ms，只能等它自己收敛 */
export const SETTLE_MS = 900

export interface CardSeed {
  type?: 'knowledge' | 'code' | 'terminal' | 'math' | 'quote' | 'custom'
  title?: string
  subtitle?: string
  content?: string
  tags?: string[]
}

const TYPE_LABELS = {
  knowledge: '知识卡片',
  code: '代码片段',
  terminal: '命令行',
  math: '数学公式',
  quote: '名言金句',
  custom: '自定义',
} as const

let browser: Browser | null = null

export async function launch(): Promise<Browser> {
  browser ??= await chromium.launch()
  return browser
}

export async function closeBrowser() {
  await browser?.close()
  browser = null
}

/**
 * 打开应用。
 *
 * 窄屏（<=900px）默认停在「内容」Tab，卡片所在面板是 display:none —— 元素在 DOM 里
 * 但不可见，所以默认只等它挂上（attached）。要真实可见的用例自己开 `visible`。
 */
export async function openApp(
  viewport = { width: 1440, height: 900 },
  options: { visible?: boolean } = {},
): Promise<Page> {
  const b = await launch()
  const page = await b.newPage({ viewport, deviceScaleFactor: 1 })
  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-card-export] [data-card-root]', {
    state: options.visible ? 'visible' : 'attached',
  })
  return page
}

export async function settle(page: Page, ms = SETTLE_MS) {
  await page.waitForTimeout(ms)
}

/** 填好卡片内容，并等自适应缩放收敛 */
export async function seedCard(page: Page, seed: CardSeed) {
  if (seed.type) await page.click(`.type-btn:has-text("${TYPE_LABELS[seed.type]}")`)
  if (seed.title !== undefined) await page.fill('#cc-title', seed.title)
  if (seed.subtitle !== undefined) await page.fill('#cc-subtitle', seed.subtitle)
  if (seed.content !== undefined) await page.fill('#cc-content', seed.content)
  for (const tag of seed.tags ?? []) {
    await page.fill('.tag-input__field', tag)
    await page.keyboard.press('Enter')
  }
  await settle(page)
}

/** 模板按钮的 title 属性就是中文模板名，E2E 只认可见名字，不认内部 id */
export async function pickTemplate(page: Page, name: string) {
  await page.click(`.tpl[title="${name}"]`)
  await settle(page)
}

export async function pickSize(page: Page, preset: 'square' | 'landscape' | 'portrait') {
  const label = { square: '正方形', landscape: '横版', portrait: '竖版' }[preset]
  await page.click(`.size-btn:has-text("${label}")`)
  await settle(page)
}

export interface CardMetrics {
  width: number
  height: number
  /** 内容自然高度 vs 容器高度，用来判断有没有被裁 */
  contentScrollHeight: number
  contentClientHeight: number
  /** 单行元素横向溢出（scrollWidth 查不到行内元素，只能量行盒） */
  overflowLines: number
  /** 正文实际字号：自适应有没有真的动过 */
  bodyFontSize: number
  /** 第一行文本的 y 坐标，用来发现「内容被挤成一条」 */
  firstLineTop: number
}

export function readMetrics(page: Page): Promise<CardMetrics> {
  return page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('[data-card-export] [data-card-root]')!
    const content = document.querySelector<HTMLElement>('.cc-content')!
    const body = document.querySelector<HTMLElement>('.cc-body') ?? content
    const box = content.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(content)
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0)
    const overflowLines = rects.filter((r) => r.right > box.right + 1.5).length
    return {
      width: Math.round(card.offsetWidth),
      height: Math.round(card.offsetHeight),
      contentScrollHeight: content.scrollHeight,
      contentClientHeight: content.clientHeight,
      overflowLines,
      bodyFontSize: parseFloat(getComputedStyle(body).fontSize),
      firstLineTop: Math.round(rects[0]?.top - box.top || 0),
    }
  })
}

/**
 * 直接调应用自己的导出渲染器，拿到和用户点「导出」完全一致的像素。
 *
 * 一起把导出时用到的样式快照带回来：测试要判断「这个配置有没有生效」，
 * 只能看渲染器真正拿到的值，不能靠猜。
 */
export function renderPng(page: Page, scale: 1 | 2 | 3) {
  // 这段代码会被序列化后丢进浏览器执行，不能引用外部变量，路径只能现场拼
  return page.evaluate(async (s) => {
    const card = document.querySelector<HTMLElement>('[data-card-export]')!
    // 用 Function 包一层原生动态 import：vite 若改写这段，会引用只在模块作用域里存在的
    // __vite_ssr_dynamic_import__，在浏览器里直接报未定义。dev server 会照原样吐源码。
    const src = ['', 'src', 'utils', 'dom-to-image.ts'].join('/')
    const load = new Function('p', 'return import(p)') as (p: string) => Promise<typeof import('../../src/utils/dom-to-image')>
    const mod = await load(src)
    const style = JSON.parse(card.dataset.exportStyle ?? '{}')
    // 和应用里 useExport 保持同一套参数（透明兜底），否则测出来的底色和真导出的不一样
    const canvas = await mod.renderElementToCanvas(card, { scale: s, width: style.width, height: style.height, background: 'transparent' })
    const root = document.querySelector<HTMLElement>('[data-card-root]')
    const cs = root ? getComputedStyle(root) : null
    // toDataURL 把像素提到事件循环之外编码：导出后立刻回读 canvas，
    // 后面用例又去动 DOM，可能会读到编码途中的半成品（曾经就因此断言到全白）
    const dataUrl = await new Promise<string>((resolve) => {
      canvas.toBlob((blob) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.readAsDataURL(blob!)
      }, 'image/png')
    })
    return {
      width: canvas.width,
      height: canvas.height,
      dataUrl,
      computed: cs ? { borderRadius: cs.borderTopLeftRadius, backgroundColor: cs.backgroundColor } : null,
    }
  }, scale)
}

/** 导出渲染器读的是卡片根节点的计算样式，这里把它读出来断言 */
export function cardComputedStyle(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-card-export] [data-card-root]')!
    const cs = getComputedStyle(root)
    return { borderRadius: cs.borderTopLeftRadius, backgroundColor: cs.backgroundColor, opacity: cs.opacity }
  })
}

/** 统计图片四边的像素，判断有没有白边/黑边 */
export async function inspectImage(page: Page, dataUrl: string) {
  return page.evaluate(async (url) => {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)

    const corner = (x: number, y: number) => {
      const d = ctx.getImageData(x, y, 1, 1).data
      return [d[0], d[1], d[2], d[3]] as [number, number, number, number]
    }
    const edgeIsTransparent = (edge: 'top' | 'bottom' | 'left' | 'right') => {
      const w = canvas.width
      const h = canvas.height
      const strip = edge === 'top' || edge === 'bottom' ? { x: 0, y: edge === 'top' ? 0 : h - 1, w, h: 1 } : { x: edge === 'left' ? 0 : w - 1, y: 0, w: 1, h }
      const { data } = ctx.getImageData(strip.x, strip.y, strip.w, strip.h)
      let transparent = 0
      for (let i = 3; i < data.length; i += 4) if (data[i] < 250) transparent++
      return transparent / (data.length / 4)
    }
    const full = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let dark = 0
    let ink = 0
    for (let i = 0; i < full.length; i += 4) {
      const lum = 0.2126 * full[i] + 0.7152 * full[i + 1] + 0.0722 * full[i + 2]
      if (full[i + 3] > 250) {
        ink++
        if (lum < 8) dark++
      }
    }
    let opaqueCount = 0
    for (let i = 3; i < full.length; i += 4) if (full[i] === 255) opaqueCount++
    return {
      width: canvas.width,
      height: canvas.height,
      corners: [corner(0, 0), corner(canvas.width - 1, 0), corner(0, canvas.height - 1), corner(canvas.width - 1, canvas.height - 1)],
      /** 完全不透明的像素占比：底色在不在，看这个而不是看「墨迹」 */
      opaqueRatio: opaqueCount / (full.length / 4),
      transparent: {
        top: edgeIsTransparent('top'),
        bottom: edgeIsTransparent('bottom'),
        left: edgeIsTransparent('left'),
        right: edgeIsTransparent('right'),
      },
      darkRatio: dark / full.length / 0.25,
      inkRatio: ink / (full.length / 4),
    }
  }, dataUrl)
}

/** 点样式面板里的按钮/复选框，走真实 UI 而不是直接改 store */
export async function clickRadius(page: Page, radius: 0 | 8 | 16 | 24) {
  await page.locator('.style-panel .seg--wide button', { hasText: `${radius}px` }).click()
  await settle(page)
}

export async function setBackgroundOpacity(page: Page, value: number) {
  const slider = page.locator('.style-panel input[type="range"]')
  await slider.evaluate((el: HTMLInputElement, v: number) => {
    el.value = String(v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
  await settle(page)
}

export async function enableWatermark(page: Page, text: string) {
  await page.locator('.style-panel .switch').check()
  await page.locator('.style-panel input[placeholder="@你的昵称"]').fill(text)
  await settle(page)
}

/**
 * 统计图片里某一层的覆盖率，用来验证「这块底色到底在不在」。
 *
 * 不能只看墨迹：浅色底（白底配深字）在「有没有底」这件事上是反的。
 * 这里把不透明像素按亮度分三档数出来，调用方按需挑一档断言。
 */
export async function layerCoverage(page: Page, dataUrl: string) {
  return page.evaluate(async (url) => {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const total = data.length / 4
    let opaque = 0
    let bright = 0
    let dark = 0
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]
      if (a === 0) continue
      if (a === 255) opaque++
      // 预乘之外直接按通道算亮度，白底 255、深字 20 左右，分得开
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3
      if (lum > 235) bright++
      else if (lum < 80) dark++
    }
    return { total, opaque: opaque / total, bright: bright / total, dark: dark / total }
  }, dataUrl)
}

/** 取图片某区域的墨迹占比，用来验证内容真的被画到了那个位置 */
export async function inkInRegion(
  page: Page,
  dataUrl: string,
  region: { x: number; y: number; w: number; h: number },
  threshold = 40,
) {
  return page.evaluate(
    async ({ url, r, t }) => {
      const img = new Image()
      img.src = url
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const { data } = ctx.getImageData(r.x, r.y, r.w, r.h)
      let ink = 0
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3]
        if (a === 0) continue
        const bg = 235
        if (Math.abs(data[i] - bg) > t || Math.abs(data[i + 1] - bg) > t || Math.abs(data[i + 2] - bg) > t) ink++
      }
      return ink / (data.length / 4)
    },
    { url: dataUrl, r: region, t: threshold },
  )
}
