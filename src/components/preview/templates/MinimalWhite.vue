<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CardData, CardStyle } from '@/types/card'
import CardShell from '../parts/CardShell.vue'
import CardRenderer from '../CardRenderer.vue'
import { useAutoFit } from '@/composables/useAutoFit'
import Watermark from '../parts/Watermark.vue'

const props = defineProps<{ card: CardData; style: CardStyle; primaryColor?: string }>()

const contentEl = ref<HTMLElement | null>(null)
const { scale, balance, refit, waitForSettle } = useAutoFit(contentEl, () => [props.card, props.style])
defineExpose({ refit, waitForSettle })
/**
 * 内容装得下时把版心竖着居中，别把半张卡空在下边。
 * 装不下（balance 被标成 1 = 溢出）时交还给 flex 自己排，溢出方向由模板决定。
 * 居中要写在 .cc-content 上：它自己是 height:100% 的 flex 列，排在版心里不会动。
 */
const fitStyle = computed(() => ({ justifyContent: balance.value <= 0.5 ? 'center' : 'flex-start' }))
const pad = () => Math.round(props.style.size.width * 0.062)
const accent = () => props.style.primaryColor
</script>

<template>
  <CardShell :style="style" :padding="pad()" background="#FFFFFF" text-color="#16181F" :shadow="0.1">
    <template #decor>
      <svg class="decor" width="100%" height="100%" aria-hidden="true">
        <rect x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" fill="none" :stroke="accent()" stroke-opacity="0.22" stroke-width="2" rx="2" />
        <rect x="0" y="0" width="72" height="6" :fill="accent()" />
      </svg>
    </template>

    <div ref="contentEl" class="cc-fit">
      <CardRenderer :card="card" :style="style" tone="light" :fit-scale="scale" :content-style="fitStyle" />
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
