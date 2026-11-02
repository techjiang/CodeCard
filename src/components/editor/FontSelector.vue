<script setup lang="ts">
import type { FontFamily } from '@/types/card'

const model = defineModel<FontFamily>()

const FONTS: Array<{ id: FontFamily; label: string; sample: string }> = [
  { id: 'sans', label: '思源黑体', sample: '黑体' },
  { id: 'serif', label: '思源宋体', sample: '宋体' },
  { id: 'mono', label: 'JetBrains Mono', sample: 'code' },
  { id: 'handwrite', label: '霞鹜文楷', sample: '文楷' },
]
</script>

<template>
  <div class="fonts">
    <button
      v-for="f in FONTS"
      :key="f.id"
      type="button"
      class="font"
      :data-active="model === f.id"
      @click="model = f.id"
    >
      <span class="font__sample" :data-font="f.id">{{ f.sample }}</span>
      <span class="font__label">{{ f.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.fonts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.font {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--ui-border);
  background: var(--ui-bg);
  cursor: pointer;
  transition: all 0.15s;
}
.font[data-active='true'] {
  border-color: #6366F1;
  background: rgba(99, 102, 241, 0.08);
}
.font__sample {
  font-size: 15px;
  color: var(--ui-text);
}
.font__sample[data-font='serif'] {
  font-family: 'Songti SC', Georgia, serif;
}
.font__sample[data-font='mono'] {
  font-family: 'JetBrains Mono', monospace;
}
.font__sample[data-font='handwrite'] {
  font-family: 'LXGW WenKai', 'Kaiti SC', cursive;
}
.font__label {
  font-size: 10px;
  color: var(--ui-muted);
}
</style>
