<script setup lang="ts">
import { computed } from 'vue'
import MarkdownContent from './MarkdownContent.vue'

const props = defineProps<{ content: string; fontSize: number; tone: 'dark' | 'light' | 'accent' }>()

/** 误把 Markdown 粘进公式时，退回 Markdown 渲染，避免露出原始符号 */
const looksLikeMarkdown = computed(() => /(^|\n)\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>)|\*\*|`[^`]+`/.test(props.content ?? ''))

/** 轻量 LaTeX 处理：保留结构，替换常见符号为可读 Unicode */
const SYMBOLS: Array<[RegExp, string]> = [
  [/\\times/g, '×'],
  [/\\div/g, '÷'],
  [/\\pm/g, '±'],
  [/\\cdot/g, '·'],
  [/\\leq|\\le/g, '≤'],
  [/\\geq|\\ge/g, '≥'],
  [/\\neq|\\ne/g, '≠'],
  [/\\approx/g, '≈'],
  [/\\infty/g, '∞'],
  [/\\sum/g, '∑'],
  [/\\prod/g, '∏'],
  [/\\int/g, '∫'],
  [/\\partial/g, '∂'],
  [/\\sqrt/g, '√'],
  [/\\alpha/g, 'α'],
  [/\\beta/g, 'β'],
  [/\\gamma/g, 'γ'],
  [/\\delta/g, 'δ'],
  [/\\epsilon/g, 'ε'],
  [/\\theta/g, 'θ'],
  [/\\lambda/g, 'λ'],
  [/\\mu/g, 'μ'],
  [/\\pi/g, 'π'],
  [/\\sigma/g, 'σ'],
  [/\\phi/g, 'φ'],
  [/\\omega/g, 'ω'],
  [/\\to|\\rightarrow/g, '→'],
  [/\\Rightarrow/g, '⇒'],
  [/\\in/g, '∈'],
  [/\\forall/g, '∀'],
  [/\\exists/g, '∃'],
]

const cleaned = computed(() => {
  let out = (props.content ?? '').trim()
  out = out.replace(/^\$\$|\$\$$/g, '').replace(/^\\\[|\\\]$/g, '')
  for (const [re, rep] of SYMBOLS) out = out.replace(re, rep)
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
})
</script>

<template>
  <MarkdownContent v-if="looksLikeMarkdown" :content="content" :tone="tone" :font-size="fontSize" />
  <div v-else class="math" :style="{ fontSize: `${Math.round(fontSize * 1.12)}px` }">
    <div v-for="(line, i) in cleaned" :key="i" class="math__line" :class="{ 'math__line--dim': i > 0 }">
      {{ line }}
    </div>
    <p v-if="!cleaned.length" class="math__empty">在编辑区输入 LaTeX 公式</p>
  </div>
</template>

<style scoped>
.math {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  font-family: 'Cambria Math', 'Latin Modern Math', Georgia, serif;
  line-height: 1.7;
}
.math__line {
  letter-spacing: 0.01em;
}
.math__line--dim {
  opacity: 0.82;
}
.math__empty {
  margin: 0;
  opacity: 0.5;
}
</style>
