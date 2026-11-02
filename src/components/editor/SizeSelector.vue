<script setup lang="ts">
import { computed } from 'vue'
import type { CardSize } from '@/types/card'
import { SIZE_PRESETS } from '@/types/card'

const props = defineProps<{ size: CardSize }>()
const emit = defineEmits<{ preset: [v: 'square' | 'landscape' | 'portrait']; custom: [w: number, h: number] }>()

const presets = computed(() =>
  (Object.keys(SIZE_PRESETS) as Array<keyof typeof SIZE_PRESETS>).map((key) => ({
    key,
    ...SIZE_PRESETS[key],
    label: { square: '正方形', landscape: '横版', portrait: '竖版' }[key],
    hint: { square: '朋友圈 / 小红书', landscape: '掘金 / 知乎头图', portrait: '壁纸 / 故事' }[key],
  })),
)
</script>

<template>
  <div class="sizes">
    <button
      v-for="p in presets"
      :key="p.key"
      type="button"
      class="size-btn"
      :data-active="size.preset === p.key"
      @click="emit('preset', p.key)"
    >
      <span class="size-btn__shape" :data-shape="p.key" />
      <span class="size-btn__text">
        <strong>{{ p.label }}</strong>
        <small>{{ p.width }}×{{ p.height }}</small>
      </span>
    </button>
    <div class="size-custom" :data-active="size.preset === 'custom'">
      <span class="field-label">自定义</span>
      <div class="size-custom__inputs">
        <input
          type="number"
          class="field-input"
          :value="size.width"
          min="320"
          max="4000"
          @change="emit('custom', Number(($event.target as HTMLInputElement).value), props.size.height)"
        />
        <span>×</span>
        <input
          type="number"
          class="field-input"
          :value="size.height"
          min="320"
          max="4000"
          @change="emit('custom', props.size.width, Number(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sizes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.size-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--ui-border);
  background: var(--ui-bg);
  cursor: pointer;
  transition: all 0.15s;
}
.size-btn[data-active='true'] {
  border-color: #6366F1;
  background: rgba(99, 102, 241, 0.08);
}
.size-btn__shape {
  display: block;
  border: 1.5px solid currentColor;
  border-radius: 3px;
  opacity: 0.6;
  color: var(--ui-muted);
}
.size-btn__shape[data-shape='square'] {
  width: 18px;
  height: 18px;
}
.size-btn__shape[data-shape='landscape'] {
  width: 22px;
  height: 14px;
}
.size-btn__shape[data-shape='portrait'] {
  width: 12px;
  height: 20px;
}
.size-btn__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.4;
}
.size-btn__text strong {
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-text);
}
.size-btn__text small {
  font-size: 10px;
  color: var(--ui-muted);
}
.size-custom {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px dashed var(--ui-border);
}
.size-custom[data-active='true'] {
  border-color: #6366F1;
}
.size-custom__inputs {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ui-muted);
}
.size-custom__inputs input {
  padding: 4px 8px;
}
</style>
