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
const pad = () => Math.round(props.style.size.width * 0.055)
</script>

<template>
  <CardShell
    :style="style"
    :padding="pad()"
    background="linear-gradient(160deg, #FFF1F5 0%, #FDE2EC 46%, #F8D4E4 100%)"
    text-color="#5B2338"
    :shadow="0.14"
  >
    <template #decor>
      <svg class="decor" width="100%" height="100%" aria-hidden="true">
        <defs>
          <radialGradient id="ps-b" cx="100%" cy="0%" r="70%">
            <stop offset="0%" stop-color="#FFB6D5" stop-opacity="0.6" />
            <stop offset="100%" stop-color="#FFB6D5" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#ps-b)" />
        <g fill="#FF8FBE" fill-opacity="0.5">
          <circle cx="86%" cy="18%" r="9" />
          <circle cx="92%" cy="26%" r="5" />
          <circle cx="10%" cy="82%" r="7" />
          <circle cx="16%" cy="90%" r="4" />
        </g>
        <path d="M86% 14% q 26 -22 40 4" fill="none" stroke="#FF9EC4" stroke-opacity="0.55" stroke-width="3" stroke-linecap="round" />
      </svg>
    </template>

    <div class="pink-card">
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
.pink-card {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  padding: 36px 34px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 40px -22px rgba(190, 74, 120, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.9) inset;
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
