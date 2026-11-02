<script setup lang="ts">
import type { CardData, CardStyle } from '@/types/card'
import CardShell from '../parts/CardShell.vue'
import CardRenderer from '../CardRenderer.vue'
import Watermark from '../parts/Watermark.vue'

const props = defineProps<{ card: CardData; style: CardStyle }>()
const pad = () => Math.round(props.style.size.width * 0.05)
const tabName = () => props.card.filename || (props.card.language ? `untitled.${props.card.language}` : 'untitled')
</script>

<template>
  <CardShell :style="style" :padding="pad()" background="#1E1F26" text-color="#D4D4D4" :shadow="0.32">
    <template #decor>
      <svg class="decor" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient id="vsc-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3A3D4A" />
            <stop offset="100%" stop-color="#26272F" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100%" height="46" fill="url(#vsc-top)" />
        <rect x="0" y="46" width="100%" height="1" fill="#15161B" />
      </svg>
    </template>

    <template #before>
      <div class="vsc-tabs">
        <span class="vsc-dots"><i /><i /><i /></span>
        <span class="vsc-tab">
          <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
            <path :fill="style.primaryColor" d="M3 3h18v18H3z" opacity="0.18" />
            <path :fill="style.primaryColor" d="M8.4 6.6 3.8 12l4.6 5.4 1.2-1.5L6.4 12l3.2-3.9zM15.6 6.6l-1.2 1.5 3.2 3.9-3.2 3.9 1.2 1.5L20.2 12z" />
          </svg>
          {{ tabName() }}
          <span class="vsc-tab__close">×</span>
        </span>
      </div>
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
.vsc-tabs {
  display: flex;
  align-items: center;
  gap: 18px;
  height: 46px;
  margin: calc(-1 * v-bind('pad() + "px"')) calc(-1 * v-bind('pad() + "px"')) 0;
  padding: 0 20px;
  position: relative;
  z-index: 3;
}
.vsc-dots {
  display: flex;
  gap: 7px;
}
.vsc-dots i {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #4A4D5A;
}
.vsc-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  padding: 0 16px;
  font-size: 13px;
  color: #E6E8EF;
  background: #1E1F26;
  border-top: 1px solid v-bind('style.primaryColor');
  font-family: 'JetBrains Mono', monospace;
}
.vsc-tab__close {
  opacity: 0.5;
}
</style>
