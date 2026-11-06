/**
 * 数字不能被排版管线从中间切开。
 *
 * 断点是在 `Object.defineProperty` 这种长标识符上做的：点后插零宽空格，
 * 让浏览器优先在语义边界折行。但早期实现没区分「小数点」和「分隔符」，
 * `99.9999`、`v1.2.0`、`192.168.0.1` 都被切成两段 —— 窄卡片上折行之后
 * 导出图里就变成 `99.` 加 `9999`，读者看到的是另一个数。
 *
 * jsdom 不排版，切没切开只有真浏览器能看出来，所以这条放在 E2E。
 */
import { afterAll, describe, expect, test } from 'vitest'
import { closeBrowser, openApp, pickSize, pickTemplate, seedCard } from './harness'

afterAll(closeBrowser)

/** 按行盒把正文还原成「每一行有哪些字」，零宽空格标出来 */
function readLines(page: Awaited<ReturnType<typeof openApp>>) {
  return page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('.cc-content')
    if (!body) return []
    const range = document.createRange()
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
    const chars: Array<{ ch: string; top: number }> = []
    let node: Node | null
    while ((node = walker.nextNode())) {
      const text = node.textContent ?? ''
      for (let i = 0; i < text.length; i++) {
        range.setStart(node, i)
        range.setEnd(node, i + 1)
        const rect = range.getBoundingClientRect()
        if (rect.width || rect.height) chars.push({ ch: text[i], top: Math.round(rect.top) })
      }
    }
    const byLine = new Map<number, string[]>()
    for (const { ch, top } of chars) {
      if (!byLine.has(top)) byLine.set(top, [])
      byLine.get(top)!.push(ch === '\u200B' ? '␣' : ch)
    }
    return [...byLine.entries()].sort((a, b) => a[0] - b[0]).map(([, chars]) => chars.join(''))
  })
}

describe('数字与版本号不被切断', () => {
  test('窄卡片里小数、版本号、IP 都完整落在同一行', async () => {
    const page = await openApp()
    await seedCard(page, {
      type: 'knowledge',
      title: '数字',
      content: '服务可用率必须达到 99.9999 才算达标，版本号 v1.2.0 里修了，内存 192.168.0.1 那台机器。',
    })
    await pickTemplate(page, '极简白')
    // 横版最窄，最容易把长数字挤断
    await pickSize(page, 'landscape')

    const lines = await readLines(page)
    const text = lines.join('\n')
    // 零宽断点插在数字中间时，这里会读到 `99.␣9999`
    for (const value of ['99.9999', 'v1.2.0', '192.168.0.1']) {
      expect(text, `${value} 被断点切开了：\n${text}`).toContain(value)
    }
    expect(text).not.toMatch(/\d\.␣\d/)
  }, 90_000)

  test('长标识符仍然按语义边界断，没有退化成整段不断', async () => {
    const page = await openApp()
    await seedCard(page, {
      type: 'knowledge',
      title: '标识符',
      content: 'Vue 3 用 Proxy 替代了 Object.defineProperty，读属性时收集依赖。',
    })
    await pickTemplate(page, '极简白')
    await pickSize(page, 'landscape')

    const text = (await readLines(page)).join('\n')
    // 断点应该还在：否则长标识符会把整段挤成一列字
    expect(text).toContain('Object.␣')
    // 而且不该在字母中间劈开
    expect(text).not.toMatch(/definePropert␣y/)
  }, 90_000)
})
