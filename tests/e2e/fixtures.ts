/** E2E 样例内容：故意带上长标识符、中英文混排和半角中文标点 */
export const KNOWLEDGE_MD = `## 核心机制

Vue 3 用 \`Proxy\` 替代了 Object.defineProperty，可以拦截属性的读取、赋值和删除。

- 依赖收集：读取时把副作用函数塞进 dep
- 触发更新：赋值时把 dep 里的副作用跑一遍

> 好处是能监听新增属性和数组下标,不再需要 Vue.set。`

export const CODE_SNIPPET = `export function createReactive(target: object) {
  const deps = new WeakMap<object, Set<() => void>>()

  return new Proxy(target, {
    get(obj, key) {
      track(deps, obj, key) // 收集依赖
      return Reflect.get(obj, key)
    },
    set(obj, key, value) {
      const ok = Reflect.set(obj, key, value)
      trigger(deps, obj, key) // 触发更新
      return ok
    },
  })
}`

export const TERMINAL_TEXT = `$ npm run build

> codecard@0.1.0 build
> vite build

vite v6.0.5 building for production...
✓ 42 modules transformed.
dist/index.html  0.51 kB │ gzip: 0.33 kB
✓ built in 812ms`

export const MATH_TEXT = String.raw`\sum_{i=1}^{n} i = \frac{n(n+1)}{2}`

export const QUOTE_TEXT = '简单是可靠的前提。复杂只能勉强运行，简单才能一直运行下去。'

/** 一段长文，用来把内容撑到溢出来考验自适应 */
export function longProse(times: number): string {
  const unit =
    '自适应缩放的难点不在缩放本身，而在于缩放之后中文断行是否还干净。标点掉在行首、长标识符被从中间劈开、末行只剩一个标点，这些都得一个一个盯。'
  return Array.from({ length: times }, (_, i) => `第 ${i + 1} 段：${unit}`).join('\n\n')
}

export const TEMPLATES = [
  { id: 'terminal-black', name: '终端黑' },
  { id: 'geek-blue', name: '极客蓝' },
  { id: 'minimal-white', name: '极简白' },
  { id: 'vs-code', name: 'VS Code' },
  { id: 'gradient-purple', name: '渐变紫' },
  { id: 'pink-sweet', name: '粉色甜心' },
  { id: 'forest-green', name: '森林绿' },
  { id: 'starry-night', name: '星空夜' },
  { id: 'magazine', name: '杂志风' },
  { id: 'poster', name: '海报风' },
  { id: 'handwrite', name: '手写风' },
  { id: 'modern-simple', name: '现代简约' },
] as const

export const SIZES = {
  square: { width: 1080, height: 1080 },
  landscape: { width: 1200, height: 630 },
  portrait: { width: 1080, height: 1920 },
} as const
