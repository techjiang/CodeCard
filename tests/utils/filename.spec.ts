import { describe, expect, test } from 'vitest'
import { buildFileName, slugTitle } from '@/utils/filename'

describe('导出文件名', () => {
  test('自动生成 {标题}_{日期}.png', () => {
    expect(buildFileName('Vue 3 响应式原理', new Date(2026, 0, 5))).toBe('Vue-3-响应式原理_20260105.png')
  })

  test('过滤非法字符并兜底', () => {
    expect(slugTitle('a/b:c*d?')).toBe('a-b-c-d')
    expect(slugTitle('   ')).toBe('codecard')
  })
})
