/**
 * 让一棵被 `display: none` 藏起来的子树重新参与布局。
 *
 * 手机端窄屏把「内容 / 预览 / 样式」拆成三个 Tab，没选中的面板直接 `display: none`。
 * 用户正停在「内容」Tab 上点导出时，卡片虽然在 DOM 里，但整棵子树没有布局 ——
 * `getBoundingClientRect()` 全是 0，渲染器一层都进不去，导出来是一张空白图。
 *
 * 做法：把挡路的祖先临时支起来，整块挪到视口外，量完再原样还原。
 */

export interface MeasuredBox {
  width: number
  height: number
}

const OFFSCREEN_LEFT = '-20000px'

/** 等一帧，让刚改过的样式真正走到布局 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

/**
 * 跑 `run` 期间保证 `el` 有真实布局。
 *
 * 只有「自己被藏起来」时才动样式：祖先都正常显示时原样直接跑，一点开销都不加。
 */
export async function withMeasurableLayout<T>(
  el: HTMLElement,
  box: MeasuredBox,
  run: () => Promise<T>,
): Promise<T> {
  const patched: Array<{ node: HTMLElement; cssText: string }> = []
  let node: HTMLElement | null = el
  while (node && node !== document.body) {
    if (window.getComputedStyle(node).display === 'none') {
      patched.push({ node, cssText: node.style.cssText })
      // 固定定位挪出视口：用户看不到任何跳动，也不会触发滚动
      node.style.setProperty('display', 'block', 'important')
      node.style.setProperty('position', 'fixed', 'important')
      node.style.setProperty('left', OFFSCREEN_LEFT, 'important')
      node.style.setProperty('top', '0', 'important')
      // 里面的预览容器按 100% 取尺寸，得给个明确的盒子，否则量出来是 0
      node.style.setProperty('width', `${box.width}px`, 'important')
      node.style.setProperty('height', `${box.height}px`, 'important')
    }
    node = node.parentElement
  }

  if (!patched.length) return run()

  try {
    await nextFrame()
    await nextFrame()
    return await run()
  } finally {
    for (const { node: target, cssText } of patched.reverse()) target.style.cssText = cssText
  }
}
