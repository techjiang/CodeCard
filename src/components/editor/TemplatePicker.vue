<script setup lang="ts">
import { computed } from 'vue'
import type { CardType } from '@/types/card'
import { CATEGORY_LABELS } from '@/types/template'
import { templatesForType } from '@/utils/templates'

const props = defineProps<{ modelValue: string; cardType: CardType; favorites?: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: string]; 'toggle-favorite': [v: string] }>()

const groups = computed(() => {
  const list = templatesForType(props.cardType)
  const ordered = Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>
  return ordered
    .map((key) => ({ key, label: CATEGORY_LABELS[key], items: list.filter((t) => t.category === key) }))
    .filter((g) => g.items.length)
})

/** 用主色 + 分类做一个轻量缩略图，避免运行时截图 */
function thumbStyle(color: string, category: string) {
  const map: Record<string, string> = {
    code: `linear-gradient(140deg, #111827, ${color}40)`,
    knowledge: `linear-gradient(140deg, ${color}, ${color}66)`,
    quote: `linear-gradient(140deg, #F7F4EE, ${color}55)`,
    general: `linear-gradient(140deg, #ffffff, ${color}33)`,
  }
  return { background: map[category] ?? `linear-gradient(140deg, ${color}, #ffffff33)` }
}
</script>

<template>
  <div class="picker">
    <div v-for="group in groups" :key="group.key" class="picker__group">
      <p class="field-label">{{ group.label }}</p>
      <div class="picker__grid">
        <button
          v-for="tpl in group.items"
          :key="tpl.id"
          type="button"
          class="tpl"
          :data-active="modelValue === tpl.id"
          :title="tpl.name"
          @click="emit('update:modelValue', tpl.id)"
        >
          <span class="tpl__thumb" :style="thumbStyle(tpl.defaultStyle.primaryColor ?? '#6366F1', tpl.category)">
            <span class="tpl__bars"><i /><i /><i /></span>
          </span>
          <span class="tpl__name">{{ tpl.name }}</span>
          <span
            v-if="favorites"
            class="tpl__fav"
            :data-on="favorites.includes(tpl.id)"
            @click.stop="emit('toggle-favorite', tpl.id)"
          >★</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.picker__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.picker__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.tpl {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  border-radius: 10px;
  border: 1px solid var(--ui-border);
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.tpl:hover {
  border-color: rgba(99, 102, 241, 0.5);
}
.tpl[data-active='true'] {
  border-color: #6366F1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.18);
}
.tpl__thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 52px;
  border-radius: 6px;
  overflow: hidden;
}
.tpl__bars {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 60%;
}
.tpl__bars i {
  height: 3px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.72);
}
.tpl__bars i:nth-child(2) {
  width: 76%;
  opacity: 0.7;
}
.tpl__bars i:nth-child(3) {
  width: 52%;
  opacity: 0.5;
}
.tpl__name {
  font-size: 11px;
  color: var(--ui-text);
  text-align: center;
}
.tpl__fav {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 12px;
  color: rgba(148, 163, 184, 0.9);
  opacity: 0;
  transition: opacity 0.15s;
}
.tpl:hover .tpl__fav,
.tpl__fav[data-on='true'] {
  opacity: 1;
}
.tpl__fav[data-on='true'] {
  color: #F59E0B;
}
</style>
