<script setup lang="ts">
import type { CardData, CardStyle } from '@/types/card'
import CardShell from '../parts/CardShell.vue'
import CardRenderer from '../CardRenderer.vue'
import Watermark from '../parts/Watermark.vue'

const props = defineProps<{ card: CardData; style: CardStyle }>()
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
      <CardRenderer :card="card" :style="style" tone="light" />
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
</style>
