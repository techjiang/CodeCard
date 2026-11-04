<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CardData, CardStyle } from '@/types/card'
import CardShell from '../parts/CardShell.vue'
import CardRenderer from '../CardRenderer.vue'
import { useAutoFit } from '@/composables/useAutoFit'
import Watermark from '../parts/Watermark.vue'

const props = defineProps<{ card: CardData; style: CardStyle }>()

const contentEl = ref<HTMLElement | null>(null)
const { scale, balance, refit, waitForSettle } = useAutoFit(contentEl, () => [props.card, props.style])
defineExpose({ refit, waitForSettle })
// 内容装得下时把 .cc-content 竖着居中；溢出时（balance = 1）交还给 flex 自己排
// 居中要写在 .cc-content 上：它自己是 height:100% 的 flex 列，排在版心里不会动
const fitStyle = computed(() => ({ justifyContent: balance.value <= 0.5 ? 'center' : 'flex-start' }))
const pad = () => Math.round(props.style.size.width * 0.06)
</script>

<template>
  <CardShell :style="style" :padding="pad()" background="#FFFFFF" text-color="#171A21" :shadow="0.16">
    <template #decor>
      <svg class="decor" width="100%" height="100%" aria-hidden="true">
        <rect x="0" y="0" width="12" height="100%" :fill="style.primaryColor" />
        <circle cx="100%" cy="0%" r="220" :fill="style.primaryColor" fill-opacity="0.06" />
      </svg>
    </template>

    <div class="modern">
      <div ref="contentEl" class="cc-fit">
      <CardRenderer :card="card" :style="style" tone="light" :fit-scale="scale" :content-style="fitStyle" />
    </div>
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
.modern {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  padding-left: 22px;
}
.cc-fit {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  /* 版心的宽度必须由容器决定：min-width:auto 会让它被内容顶宽，
     父级跟着撑开，量出来的「可用宽度」就成了错的，字号也就缩不下去 */
  width: 100%;
  min-width: 0;
  min-height: 0;
}
</style>
