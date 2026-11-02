import { describe, expect, test } from 'vitest'
import { normalizePunctuation, pangu, spaceCJK } from '@/utils/typography'

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
})
