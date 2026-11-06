import { describe, expect, test } from 'vitest'
import { ZWSP, breakParts, breakPoints, normalizePunctuation, pangu, panguSegments, spaceCJK, spaceUnits, textParts } from '@/utils/typography'

describe('Chinese Typography', () => {
  test('中英文之间自动加空格', () => {
    expect(spaceCJK('使用Vue3开发')).toBe('使用 Vue3 开发')
    expect(spaceCJK('苹果Apple香蕉')).toBe('苹果 Apple 香蕉')
  })

  test('已存在的空格不重复添加', () => {
    expect(spaceCJK('使用 Vue 开发')).toBe('使用 Vue 开发')
    expect(spaceCJK('使用  Vue')).toBe('使用 Vue')
  })

  test('全角标点统一', () => {
    expect(normalizePunctuation('他说,这样很好;真的!')).toBe('他说，这样很好；真的！')
    expect(normalizePunctuation('(中文括号)')).toBe('（中文括号）')
    expect(normalizePunctuation('"中文引号"')).toBe('“中文引号”')
  })

  test('纯英文内容不被误伤', () => {
    expect(pangu('const a = 1')).toBe('const a = 1')
    expect(pangu('foo.bar()')).toBe('foo.bar()')
  })

  test('pangu 组合处理后不留下重复空格', () => {
    const out = pangu('依赖收集：读取时把副作用函数塞进dep')
    expect(out).toBe('依赖收集：读取时把副作用函数塞进 dep')
    expect(out).not.toMatch(/ {2,}/)
  })

  test('空输入安全返回', () => {
    expect(pangu('')).toBe('')
    expect(spaceCJK('')).toBe('')
  })

  test('标点规整不会把英文句点当成中文句号', () => {
    expect(normalizePunctuation('vuejs.org')).toBe('vuejs.org')
    expect(normalizePunctuation('版本 3.5')).toBe('版本 3.5')
  })

  test('括号与引号只处理含中文的内容', () => {
    expect(normalizePunctuation('(english)')).toBe('(english)')
    expect(normalizePunctuation('"english"')).toBe('"english"')
  })

  test('中文标点不跟拉丁字符之间补空格', () => {
    // 行内标点紧跟上文，不是「中英之间」
    expect(pangu('读取 。')).toBe('读取。')
    expect(pangu('中文 ，英文')).toBe('中文，英文')
    expect(pangu('在2024年，Vue用Proxy。')).toBe('在 2024 年，Vue 用 Proxy。')
    expect(pangu('函数foo()返回void。')).toBe('函数 foo() 返回 void。')
  })

  test('成对标点内侧不留空格', () => {
    expect(pangu('「Proxy」是拦截器')).toBe('「Proxy」是拦截器')
    expect(pangu('用 「 ref 」 包一层')).toBe('用「ref」包一层')
    expect(pangu('「中文名字」很好')).toBe('「中文名字」很好')
  })

  test('全角括号外侧不留半角空格', () => {
    expect(pangu('这是一段English (混合) 文本')).toBe('这是一段 English（混合）文本')
    expect(pangu('把ref拆开看（它是class）会发现')).toBe('把 ref 拆开看（它是 class）会发现')
    expect(pangu('中文（English）中文')).toBe('中文（English）中文')
  })

  test('行内代码不参与中英文加空格', () => {
    expect(panguSegments('用 `Vue3` 做前端')).toBe('用 `Vue3` 做前端')
    expect(panguSegments('使用Vue开发')).toBe('使用 Vue 开发')
  })

  test('代码块整体跳过排版', () => {
    const src = '```\n使用Vue开发\n```\n\n正文使用Vue开发'
    expect(panguSegments(src)).toContain('```\n使用Vue开发\n```')
    expect(panguSegments(src)).toContain('正文使用 Vue 开发')
  })

  test('断行点不破坏短标识符', () => {
    expect(textParts(breakPoints('a.b'))).toEqual(['a.', 'b'])
    expect(textParts(breakPoints('普通文本'))).toEqual(['普通文本'])
  })

  /**
   * 数字里的点不是分隔符。
   * 旧实现按「点后断开」一律处理，`99.9999` 在窄卡片上折成 `99.` + `9999`，
   * 读起来就是另一个值 —— 导出图上真的这么排过。
   */
  test('小数、版本号、IP 不从小数点断开', () => {
    for (const value of ['99.9999', 'v1.2.0', '3.14159', '192.168.0.1', '2026.11.06', '1,000.50', '99.9%']) {
      expect(breakParts(breakPoints(value)), value).toEqual([value])
    }
  })

  test('标识符仍按语义边界断', () => {
    expect(breakParts(breakPoints('Object.defineProperty'))).toEqual(['Object.', 'define', 'Property'])
    expect(breakParts(breakPoints('README.md'))).toEqual(['README.', 'md'])
    expect(breakParts(breakPoints('path/to/file.ts'))).toEqual(['path/', 'to/', 'file.', 'ts'])
  })

  test('断点用零宽空格，片段比整行宽时浏览器也会先在这里断', () => {
    expect(breakParts(breakPoints('Object.defineProperty'))).toEqual(['Object.', 'define', 'Property'])
    // 零宽空格是不可见字符，但必须是真实字符（<wbr> 兜不住超宽片段）
    expect(ZWSP).toBe('\u200B')
    expect(ZWSP).toHaveLength(1)
  })
})

/**
 * 排版最容易错的地方不是「该加的没加」，而是「不该加的加了」：
 * 中文标点被当成汉字，于是 `汉)。` 变成 `汉) 。`。
 * 这里把字符类两两组合穷举，把不变量钉死。
 */
describe('排版不变量：不该有空格的地方不能有', () => {
  /** 覆盖汉字、拉丁、数字、全角标点、半角标点、括号、引号、行内代码片段 */
  const SAMPLES = [
    '汉',
    'A',
    '3',
    '。',
    '，',
    '、',
    '：',
    '；',
    '？',
    '！',
    '（',
    '）',
    '“',
    '”',
    '《',
    '》',
    '·',
    '.',
    ',',
    ')',
    '(',
    '"',
    "'",
    '-',
    '+',
    '=',
    '/',
    '%',
    '#',
    '@',
    '$',
  ]

  /** 断点标记 \n 与零宽空格不算可见空格 */
  const visible = (s: string) => s.replace(/[\n\u200b\u00a0]/g, '')

  test('标点前不留空格，标点后不乱加空格', () => {
    const bad: string[] = []
    for (const a of SAMPLES) {
      for (const b of SAMPLES) {
        const out = visible(pangu(a + b))
        // 全角标点左边不该有空格
        if ('。，、：；？！）》”'.includes(b) && out !== a + b) bad.push(`[${a}${b}] → [${out}]`)
        // 前括号 / 前引号右边不该有空格
        if ('（《“'.includes(a) && out !== a + b) bad.push(`[${a}${b}] → [${out}]`)
      }
    }
    expect(bad).toEqual([])
  })

  test('不会出现连续两个空格', () => {
    const bad: string[] = []
    for (const a of SAMPLES) {
      for (const b of SAMPLES) {
        for (const c of SAMPLES) {
          const out = pangu(a + b + c)
          if (/ {2,}/.test(out)) bad.push(`[${a}${b}${c}]`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  test('右括号紧跟中文标点，中间不插空格', () => {
    // 旧 bug 现场：`汉)` 被当成「汉字 + 汉字」，于是补出 `汉) 。`
    for (const [input, forbidden] of [
      ['（汉字)。', '汉) 。'],
      ['汉字)。', '汉) 。'],
      ['汉字)，然后', '汉) ，'],
      ['汉字》。', '汉》 。'],
      ['用 Proxy)。', 'y) 。'],
    ] as const) {
      expect(pangu(input)).not.toContain(forbidden)
    }
    // 成对半角括号夹中文仍会规整成全角
    expect(pangu('(汉字)。')).toBe('（汉字）。')
  })

  /**
   * 旧实现只要「有一侧是汉字、needsGap 又没判定要补」就收空格，
   * 于是 `100% 以上` 被粘成 `100%以上`。这些空格不是多余，是词与词的边界。
   */
  test('拉丁词与汉字之间的空格不会被收走', () => {
    for (const [input, expected] of [
      ['完成度 100% 以上', '完成度 100% 以上'],
      ['可用率 99.9% 的服务', '可用率 99.9% 的服务'],
      ['C++ 和 C# 都是语言', 'C++ 和 C# 都是语言'],
      ['价格 $10 一件', '价格 $10 一件'],
      ['第 3 章 #1 小节', '第 3 章 #1 小节'],
      ['Hello, 世界!', 'Hello, 世界！'],
      ['这是 Vue, 也是 React', '这是 Vue, 也是 React'],
      ['耗时 200ms，占比 40% 左右', '耗时 200ms，占比 40% 左右'],
      ['a = 1 的情况', 'a = 1 的情况'],
    ] as const) {
      expect(panguSegments(input), input).toBe(expected)
    }
  })

  test('同一句话里同一个词只有一种排法', () => {
    // 旧实现：有空格的地方收走、没空格的地方补上，一句话里排出两种样子
    expect(panguSegments('100% 以上')).toBe(panguSegments('100%以上'))
    expect(panguSegments('C++ 和')).toBe(panguSegments('C++和'))
  })

  test('半角括号贴汉字时该收回空白', () => {
    expect(panguSegments('函数 ) 的参数')).toBe('函数) 的参数')
    // 括号内侧的空白收回，外侧与汉字之间的空格留着（那是词边界）
    expect(panguSegments('调用 ( 参数 ) 时')).toBe('调用 (参数) 时')
    // 半角括号里的拉丁文本仍按正常间距排
    expect(panguSegments('读取 (x) 的值')).toBe('读取 (x) 的值')
  })

  test('首尾不留空格', () => {
    for (const a of SAMPLES) {
      expect(pangu(`  ${a}  `).trim()).toBe(pangu(a).trim())
    }
  })

  test('汉字与拉丁字母之间补空格，标点不算汉字', () => {
    expect(pangu('用Proxy替代')).toBe('用 Proxy 替代')
    expect(pangu('用Proxy，')).toBe('用 Proxy，')
    expect(pangu('（Proxy）')).toBe('（Proxy）')
  })
})

describe('spaceUnits：单元流是唯一真源', () => {
  test('不透明单元按内容首尾判定边界', () => {
    const out = spaceUnits([
      { text: '用', tok: 0 },
      { text: 'Proxy', opaque: true, head: 'P', tail: 'y', tok: 1 },
      { text: '替代', tok: 2 },
    ])
    expect(out.map((u) => u.text).join('')).toBe('用 Proxy 替代')
  })

  test('标点收尾的不透明单元后面不补空格', () => {
    const out = spaceUnits([
      { text: '见', tok: 0 },
      { text: '文档，', opaque: true, head: '文', tail: '，', tok: 1 },
      { text: '然后', tok: 2 },
    ])
    expect(out.map((u) => u.text).join('')).toBe('见文档，然后')
  })
})
