<script setup lang="ts">
import { ref } from 'vue'
import type { CardData, CardStyle } from '@/types/card'
import CardShell from '../parts/CardShell.vue'
import CardRenderer from '../CardRenderer.vue'
import Watermark from '../parts/Watermark.vue'
import { useAutoFit } from '@/composables/useAutoFit'

const props = defineProps<{ card: CardData; style: CardStyle }>()

const contentEl = ref<HTMLElement | null>(null)
const { scale } = useAutoFit(contentEl, () => [props.card, props.style])
const pad = () => Math.round(props.style.size.width * 0.068)
const HAND_FONT = '"LXGW WenKai", "Kaiti SC", cursive'
</script>

<template>
  <CardShell :style="style" :padding="pad()" background="#FBF7EE" text-color="#2B2620" :shadow="0.14">
    <template #decor>
      <svg class="decor" width="100%" height="100%" aria-hidden="true">
        <defs>
          <pattern id="hw-lines" width="100%" height="44" patternUnits="userSpaceOnUse">
            <line x1="0" y1="44" x2="100%" y2="44" stroke="#C9BFA6" stroke-opacity="0.35" stroke-width="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hw-lines)" />
        <line x1="56" y1="0" x2="56" y2="100%" stroke="#E2A8A8" stroke-opacity="0.5" stroke-width="1.6" />
        <rect x="0" y="0" width="100%" height="100%" fill="#F3E7CE" fill-opacity="0.18" />
      </svg>
    </template>

    <div ref="contentEl" class="hw" :style="{ fontFamily: HAND_FONT }">
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
.hw {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-left: 30px;
}
.hw > :deep(*) {
  width: 100%;
  flex: none;
}
</style>
