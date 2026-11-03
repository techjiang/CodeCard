<script setup lang="ts">
import { ref } from 'vue'
import type { CardData, CardStyle } from '@/types/card'
import CardShell from '../parts/CardShell.vue'
import CardRenderer from '../CardRenderer.vue'
import { useAutoFit } from '@/composables/useAutoFit'
import Watermark from '../parts/Watermark.vue'

const props = defineProps<{ card: CardData; style: CardStyle; primaryColor?: string }>()

const contentEl = ref<HTMLElement | null>(null)
const { scale } = useAutoFit(contentEl, () => [props.card, props.style])
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
.cc-fit {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
</style>
