<script setup lang="ts">
import { computed } from 'vue'
import MarkdownContent from './MarkdownContent.vue'
import { renderLatex } from '@/utils/latex'

const props = defineProps<{ content: string; fontSize: number; tone: 'dark' | 'light' | 'accent' }>()

/** 误把 Markdown 粘进公式时，退回 Markdown 渲染，避免露出原始符号 */
const looksLikeMarkdown = computed(() => /(^|\n)\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>)|\*\*|`[^`]+`/.test(props.content ?? ''))

/** 每行公式的 HTML：结构（分式、上下标、根式）真的排出来，不是把源码摊在卡片上 */
const rows = computed(() => renderLatex(props.content ?? ''))
</script>

<template>
  <MarkdownContent v-if="looksLikeMarkdown" :content="content" :tone="tone" :font-size="fontSize" />
  <div v-else class="math" :style="{ fontSize: `${Math.round(fontSize * 1.08)}px` }">
    <!-- eslint-disable-next-line vue/no-v-html -- 内容在 renderLatex 里逐字符转义 -->
    <div v-for="(row, i) in rows" :key="i" class="math__row" :class="{ 'math__row--dim': i > 0 }" v-html="row" />
    <p v-if="!rows.length" class="math__empty">在编辑区输入 LaTeX 公式</p>
  </div>
</template>

<style scoped>
.math {
  display: flex;
  flex-direction: column;
  gap: 0.6em;
  font-family: 'Times New Roman', 'Cambria Math', Georgia, serif;
  line-height: 1.5;
}
.math__row {
  letter-spacing: 0.01em;
}
.math__row--dim {
  opacity: 0.86;
}
.math__empty {
  margin: 0;
  font-family: inherit;
  opacity: 0.5;
}
/* 上下标：浏览器原生的 sup/sub 已经对，只调大小与基线，别自己位移 */
.math :deep(.lt-sup),
.math :deep(.lt-sub) {
  font-size: 0.62em;
  line-height: 0;
}
/* 分式：竖排三层，中间一条横线 */
.math :deep(.lt-frac) {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  vertical-align: -0.42em;
  margin: 0 0.18em;
  line-height: 1.18;
}
.math :deep(.lt-frac__num),
.math :deep(.lt-frac__den) {
  display: block;
  padding: 0 0.16em;
  font-size: 0.92em;
  white-space: nowrap;
}
/* 分数线用边框而不是字符：字符的高度跟着字号变，画出来粗细不一 */
.math :deep(.lt-frac__bar) {
  display: block;
  width: 100%;
  height: 0;
  border-top: 1px solid currentColor;
  margin: 0.06em 0;
}
.math :deep(.lt-sqrt) {
  display: inline-flex;
  align-items: flex-start;
}
.math :deep(.lt-sqrt__sign) {
  transform: scaleY(1.15);
  transform-origin: bottom;
}
/* 根号里的内容顶上那条横线，看着才像根号 */
.math :deep(.lt-sqrt__body) {
  border-top: 1px solid currentColor;
  padding: 0.04em 0.14em 0 0.06em;
  margin-left: -0.06em;
}
/* 求和、积分的上下限：排在符号上下方，而不是右侧 */
.math :deep(.lt-lim) {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  vertical-align: -0.32em;
  margin: 0 0.14em;
  line-height: 1.1;
}
.math :deep(.lt-lim__sup),
.math :deep(.lt-lim__sub) {
  font-size: 0.6em;
  white-space: nowrap;
}
.math :deep(.lt-op) {
  font-size: 1.24em;
  line-height: 1;
}
/* 函数名与 \text{}：直立，别跟着数学斜体 */
.math :deep(.lt-upright) {
  font-style: normal;
  font-family: inherit;
}
</style>
