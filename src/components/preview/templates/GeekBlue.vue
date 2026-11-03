<script setup lang="ts">
import { ref } from 'vue'
import type { CardData, CardStyle } from '@/types/card'
import CardShell from '../parts/CardShell.vue'
import CardRenderer from '../CardRenderer.vue'
import { useAutoFit } from '@/composables/useAutoFit'
import Watermark from '../parts/Watermark.vue'

const props = defineProps<{ card: CardData; style: CardStyle }>()

const contentEl = ref<HTMLElement | null>(null)
const { scale } = useAutoFit(contentEl, () => [props.card, props.style])
const pad = () => Math.round(props.style.size.width * 0.065)
</script>

<template>
  <CardShell
    :style="style"
    :padding="pad()"
    background="linear-gradient(150deg, #0A1B3D 0%, #122B63 52%, #0B1226 100%)"
    text-color="#EAF1FF"
    :shadow="0.34"
  >
    <template #decor>
      <svg class="decor" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient id="gb-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#4D8DFF" stop-opacity="0.85" />
            <stop offset="100%" stop-color="#22D3EE" stop-opacity="0" />
          </linearGradient>
          <radialGradient id="gb-glow" cx="85%" cy="10%" r="60%">
            <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.3" />
            <stop offset="100%" stop-color="#38BDF8" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#gb-glow)" />
        <circle cx="92%" cy="6%" r="180" fill="none" stroke="url(#gb-line)" stroke-width="1.4" />
        <circle cx="92%" cy="6%" r="260" fill="none" stroke="url(#gb-line)" stroke-width="1" opacity="0.5" />
        <path d="M0 92% Q 25% 78%, 50% 92% T 100% 88%" fill="none" stroke="url(#gb-line)" stroke-width="1.6" opacity="0.6" />
      </svg>
    </template>

    <div ref="contentEl" class="cc-fit">
      <CardRenderer :card="card" :style="style" tone="dark" show-chrome :fit-scale="scale" />
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
  min-height: 0;
}
</style>
