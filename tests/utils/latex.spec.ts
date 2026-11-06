/**
 * LaTeX 渲染：卡片上不能出现 `\frac{a}{b}` 这种源码。
 *
 * 这里只验「排出来的结构对不对」，位置和像素交给 E2E（jsdom 不排版）。
 */
import { describe, expect, test } from 'vitest'
import { renderLatex } from '@/utils/latex'

describe('LaTeX：结构真的排出来', () => {
  test('分式排成上下两层，不是原样的 \\frac', () => {
    const [row] = renderLatex(String.raw`\frac{n(n+1)}{2}`)
    expect(row).toContain('lt-frac')
    expect(row).toContain('lt-frac__num')
    expect(row).toContain('lt-frac__den')
    expect(row).not.toContain('\\frac')
  })

  test('上下标变成 sup / sub，基底跟着留着', () => {
    const [row] = renderLatex('E = mc^2')
    expect(row).toContain('<sup')
    expect(row).toContain('mc')
  })

  test('求和符号的上下限排在符号上下方，不是右侧', () => {
    const [row] = renderLatex(String.raw`\sum_{i=1}^{n} x_i`)
    expect(row).toContain('lt-lim__sup')
    expect(row).toContain('lt-lim__sub')
    expect(row).toContain('∑')
  })

  test('根号带横线，里面内容单独一层', () => {
    const [row] = renderLatex(String.raw`\sqrt{a^2+b^2}`)
    expect(row).toContain('lt-sqrt__sign')
    expect(row).toContain('lt-sqrt__body')
  })

  test('希腊字母与关系符号换成 Unicode', () => {
    const [row] = renderLatex(String.raw`\alpha \leq \beta \neq \gamma`)
    expect(row).toBe('α≤β≠γ')
  })

  test('\\text{} 里的中文照原样，不当数学斜体', () => {
    const [row] = renderLatex(String.raw`\text{面积} = \pi r^2`)
    expect(row).toContain('面积')
    expect(row).toContain('lt-upright')
    expect(row).toContain('π')
  })

  test('多行公式按行拆开', () => {
    const rows = renderLatex("E = mc^2\n\nF = ma")
    expect(rows).toHaveLength(2)
  })

  test('$$ 与 \\[ \\] 包裹会被剥掉', () => {
    expect(renderLatex('$$x^2$$')).toHaveLength(1)
    expect(renderLatex('$$x^2$$')[0]).not.toContain('$')
    expect(renderLatex(String.raw`\[x^2\]`)[0]).not.toContain('\\[')
  })

  test('落单的右括号不会把后面的公式吞掉', () => {
    const [row] = renderLatex('a} = b')
    expect(row).toContain('a')
    expect(row).toContain('b')
  })

  test('不认识的命令印名字，不露出反斜杠', () => {
    const [row] = renderLatex(String.raw`\unknowncmd x`)
    expect(row).not.toContain('\\')
    expect(row).toContain('unknowncmd')
    expect(row).toContain('x')
  })

  test('尖括号被转义，不会把公式变成标签', () => {
    const [row] = renderLatex('a < b > c')
    expect(row).toContain('&lt;')
    expect(row).toContain('&gt;')
    expect(row).not.toContain('<b')
  })

  test('环境外落单的 & 是内容，不能被当对齐符吃掉', () => {
    expect(renderLatex('a & b')[0]).toContain('&')
    // cases 里的 & 才是列分隔，排成空白
    expect(renderLatex(String.raw`\begin{cases} a & b \end{cases}`)[0]).toContain('a')
  })

  test('空输入不产出空行', () => {
    expect(renderLatex('')).toEqual([])
    expect(renderLatex('   ')).toEqual([])
    expect(renderLatex('$$')).toEqual([])
  })
})
