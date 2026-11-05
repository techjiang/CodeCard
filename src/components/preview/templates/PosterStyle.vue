<script setup lang="ts">
import { ref } from 'vue'
import type { CardData, CardStyle } from '@/types/card'
import CardShell from '../parts/CardShell.vue'
import CardRenderer from '../CardRenderer.vue'
import Watermark from '../parts/Watermark.vue'
import { useAutoFit } from '@/composables/useAutoFit'

const props = defineProps<{ card: CardData; style: CardStyle }>()
const pad = () => Math.round(props.style.size.width * 0.066)

const contentEl = ref<HTMLElement | null>(null)
const { scale, refit, waitForSettle } = useAutoFit(contentEl, () => [props.card, props.style])
defineExpose({ refit, waitForSettle })
// 海报风是贴底大字版式，不入居中那一套
</script>

<template>
  <CardShell
    :style="style"
    :padding="pad()"
    :background="`linear-gradient(135deg, ${style.primaryColor} 0%, #11131A 62%, #11131A 100%)`"
    text-color="#FFFFFF"
    :shadow="0.34"
  >
    <template #decor>
      <svg class="decor" width="100%" height="100%" aria-hidden="true">
        <circle cx="100%" cy="100%" r="240" fill="#FFFFFF" fill-opacity="0.06" />
        <circle cx="100%" cy="100%" r="150" fill="#FFFFFF" fill-opacity="0.05" />
        <rect x="0" y="0" width="100%" height="10" fill="#FFFFFF" fill-opacity="0.9" />
        <path d="M0 670 L 1200 454" stroke="#FFFFFF" stroke-opacity="0.1" stroke-width="2" />
      </svg>
    </template>

    <div ref="contentEl" class="poster">
      <div class="poster__inner">
        <CardRenderer :card="card" :style="style" tone="dark" :fit-scale="scale" />
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
.poster {
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
  padding: 0 0 0 22px;
  border-left: 6px solid rgba(255, 255, 255, 0.85);
  /* 内容长时整体等比收纳，避免撑破卡片 */
  overflow: hidden;
}
.poster__inner {
  flex: none;
  width: 100%;
}
</style>
