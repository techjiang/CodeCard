<script setup lang="ts">
import type { CardData, CardStyle } from '@/types/card'
import CardShell from '../parts/CardShell.vue'
import CardRenderer from '../CardRenderer.vue'
import Watermark from '../parts/Watermark.vue'

const props = defineProps<{ card: CardData; style: CardStyle }>()
const pad = () => Math.round(props.style.size.width * 0.06)

// 固定种子，保证导出与预览一致
const stars = Array.from({ length: 46 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n) * 43758.5453) % 1 + 1) % 1
  return { x: r(1) * 100, y: r(2) * 100, size: 0.8 + r(3) * 2.2, opacity: 0.25 + r(4) * 0.6 }
})
</script>

<template>
  <CardShell
    :style="style"
    :padding="pad()"
    background="linear-gradient(180deg, #05070F 0%, #0B1026 55%, #131A3A 100%)"
    text-color="#EDF1FF"
    :shadow="0.4"
  >
    <template #decor>
      <svg class="decor" width="100%" height="100%" aria-hidden="true">
        <defs>
          <radialGradient id="sn-neb" cx="78%" cy="18%" r="60%">
            <stop offset="0%" stop-color="#7C6BF5" stop-opacity="0.48" />
            <stop offset="55%" stop-color="#3B5BDB" stop-opacity="0.16" />
            <stop offset="100%" stop-color="#000000" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="sn-neb2" cx="12%" cy="82%" r="55%">
            <stop offset="0%" stop-color="#22D3EE" stop-opacity="0.24" />
            <stop offset="100%" stop-color="#22D3EE" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#sn-neb)" />
        <rect width="100%" height="100%" fill="url(#sn-neb2)" />
        <g fill="#FFFFFF">
          <circle
            v-for="(s, i) in stars"
            :key="i"
            :cx="`${s.x}%`"
            :cy="`${s.y}%`"
            :r="s.size"
            :fill-opacity="s.opacity"
          />
        </g>
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
