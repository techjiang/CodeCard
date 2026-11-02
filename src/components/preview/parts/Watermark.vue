<script setup lang="ts">
import { computed } from 'vue'
import type { CardWatermark } from '@/types/card'

const props = defineProps<{ watermark?: CardWatermark; fontSize?: number }>()

const positionClass = computed(() => {
  switch (props.watermark?.position) {
    case 'bottom-center':
      return 'wm--bottom-center'
    case 'top-right':
      return 'wm--top-right'
    default:
      return 'wm--bottom-right'
  }
})
</script>

<template>
  <div v-if="watermark?.enabled && (watermark.text || watermark.image)" class="wm" :class="positionClass" :style="{ fontSize: `${fontSize ?? 14}px` }">
    <img v-if="watermark.image" :src="watermark.image" class="wm__img" alt="watermark" />
    <span v-else class="wm__text">{{ watermark.text }}</span>
  </div>
</template>

<style scoped>
.wm {
  position: absolute;
  z-index: 5;
  opacity: 0.45;
  pointer-events: none;
}
.wm--bottom-right {
  right: 26px;
  bottom: 20px;
}
.wm--bottom-center {
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
}
.wm--top-right {
  right: 26px;
  top: 20px;
}
.wm__text {
  letter-spacing: 0.08em;
  color: currentColor;
}
.wm__img {
  height: 1.9em;
  display: block;
}
</style>
