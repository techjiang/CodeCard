<script setup lang="ts">
import { ref } from 'vue'
import type { CardData, CardStyle } from '@/types/card'
import CardShell from '../parts/CardShell.vue'
import CardRenderer from '../CardRenderer.vue'
import Watermark from '../parts/Watermark.vue'
import { useAutoFit } from '@/composables/useAutoFit'

const props = defineProps<{ card: CardData; style: CardStyle }>()

const contentEl = ref<HTMLElement | null>(null)
const { scale, waitForSettle } = useAutoFit(contentEl, () => [props.card, props.style])
defineExpose({ waitForSettle })
// 杂志风本来就顶上排，底部留白是版式的一部分，不跟着居中
const pad = () => Math.round(props.style.size.width * 0.075)
const serif = '"Songti SC", "Source Han Serif SC", Georgia, serif'
</script>

<template>
  <CardShell :style="style" :padding="pad()" background="#F7F4EE" text-color="#1A1712" :shadow="0.12">
    <template #decor>
      <svg class="decor" width="100%" height="100%" aria-hidden="true">
        <rect x="0" y="0" width="100%" height="14" :fill="style.primaryColor" fill-opacity="0.9" />
        <line x1="0" y1="76" x2="100%" y2="76" stroke="#1A1712" stroke-opacity="0.16" stroke-width="1" />
        <text x="0" y="52" fill="#1A1712" fill-opacity="0.42" font-size="20" letter-spacing="6" font-family="Georgia, serif">CODE CARD · ISSUE</text>
      </svg>
    </template>

    <div ref="contentEl" class="mag" :style="{ fontFamily: serif }">
      <CardRenderer :card="card" :style="style" tone="light" :fit-scale="scale" />
    </div>

    <template #overlay>
      <Watermark :watermark="style.watermark" :font-size="Math.round(style.size.width * 0.014)" />
    </template>
  </CardShell>
</template>

<style scoped>
.decor {
  position: absolute;
  inset: 0;
  z-index: 1;
}
.mag {
  flex: 1 1 auto;
  /* 版心的宽度必须由容器决定：min-width:auto 会让它被内容顶宽，
     父级跟着撑开，量出来的「可用宽度」就成了错的，字号也就缩不下去 */
  width: 100%;
  min-width: 0;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-top: 46px;
}
.mag > :deep(*) {
  width: 100%;
  flex: none;
}
</style>
