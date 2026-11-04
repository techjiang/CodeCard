<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CardData, CardStyle } from '@/types/card'
import CardShell from '../parts/CardShell.vue'
import CardRenderer from '../CardRenderer.vue'
import { useAutoFit } from '@/composables/useAutoFit'
import Watermark from '../parts/Watermark.vue'

const props = defineProps<{ card: CardData; style: CardStyle }>()

const contentEl = ref<HTMLElement | null>(null)
const { scale, balance, waitForSettle } = useAutoFit(contentEl, () => [props.card, props.style])
defineExpose({ waitForSettle })
// 内容装得下时把 .cc-content 竖着居中；溢出时（balance = 1）交还给 flex 自己排
// 居中要写在 .cc-content 上：它自己是 height:100% 的 flex 列，排在版心里不会动
const fitStyle = computed(() => ({ justifyContent: balance.value <= 0.5 ? 'center' : 'flex-start' }))
const pad = () => Math.round(props.style.size.width * 0.055)
</script>

<template>
  <CardShell
    :style="style"
    :padding="pad()"
    background="linear-gradient(140deg, #6D28D9 0%, #8B5CF6 44%, #C084FC 100%)"
    text-color="#FAF8FF"
    :shadow="0.3"
  >
    <template #decor>
      <svg class="decor" width="100%" height="100%" aria-hidden="true">
        <defs>
          <radialGradient id="gp-b1" cx="0%" cy="0%" r="70%">
            <stop offset="0%" stop-color="#F0ABFC" stop-opacity="0.55" />
            <stop offset="100%" stop-color="#F0ABFC" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="gp-b2" cx="100%" cy="100%" r="65%">
            <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.4" />
            <stop offset="100%" stop-color="#38BDF8" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#gp-b1)" />
        <rect width="100%" height="100%" fill="url(#gp-b2)" />
        <circle cx="88%" cy="14%" r="150" fill="#FFFFFF" fill-opacity="0.07" />
        <circle cx="8%" cy="88%" r="200" fill="#FFFFFF" fill-opacity="0.05" />
      </svg>
    </template>

    <div class="glass">
      <div ref="contentEl" class="cc-fit">
      <CardRenderer :card="card" :style="style" tone="dark" :fit-scale="scale" :content-style="fitStyle" />
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
.glass {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  padding: 34px 36px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.11);
  border: 1px solid rgba(255, 255, 255, 0.26);
  box-shadow: 0 18px 44px -24px rgba(49, 10, 90, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(6px);
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
