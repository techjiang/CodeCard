<script setup lang="ts">
import type { CardData, CardStyle } from '@/types/card'
import CardShell from '../parts/CardShell.vue'
import CardRenderer from '../CardRenderer.vue'
import Watermark from '../parts/Watermark.vue'

const props = defineProps<{ card: CardData; style: CardStyle }>()
const pad = () => Math.round(props.style.size.width * 0.058)
</script>

<template>
  <CardShell
    :style="style"
    :padding="pad()"
    background="linear-gradient(155deg, #0F3D2E 0%, #14532D 48%, #0A2A20 100%)"
    text-color="#ECFDF5"
    :shadow="0.3"
  >
    <template #decor>
      <svg class="decor" width="100%" height="100%" aria-hidden="true">
        <defs>
          <radialGradient id="fg-b" cx="10%" cy="0%" r="70%">
            <stop offset="0%" stop-color="#34D399" stop-opacity="0.26" />
            <stop offset="100%" stop-color="#34D399" stop-opacity="0" />
          </radialGradient>
          <pattern id="fg-leaf" width="72" height="72" patternUnits="userSpaceOnUse">
            <path d="M10 62 Q 36 20 62 10" fill="none" stroke="rgba(167,243,208,0.1)" stroke-width="1.2" />
            <circle cx="62" cy="10" r="2.4" fill="rgba(167,243,208,0.16)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fg-leaf)" />
        <rect width="100%" height="100%" fill="url(#fg-b)" />
        <path d="M0 100% Q 40% 74% 100% 96%" fill="#000" fill-opacity="0.12" />
      </svg>
    </template>

    <CardRenderer :card="card" :style="style" tone="dark" />

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
</style>
