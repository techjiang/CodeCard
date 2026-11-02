<script setup lang="ts">
import type { CardStyle } from '@/types/card'
import { FONT_SIZE_MAP } from '@/types/card'
import TemplatePicker from './TemplatePicker.vue'
import ColorPicker from './ColorPicker.vue'
import FontSelector from './FontSelector.vue'
import SizeSelector from './SizeSelector.vue'

const props = defineProps<{ style: CardStyle; cardType: string; favorites: string[] }>()
const emit = defineEmits<{
  'update:template': [v: string]
  'update:size-preset': [v: 'square' | 'landscape' | 'portrait']
  'update:custom-size': [w: number, h: number]
  'toggle-favorite': [v: string]
  'randomize': []
}>()

const SIZES = Object.keys(FONT_SIZE_MAP) as Array<keyof typeof FONT_SIZE_MAP>
const RADII = [0, 8, 16, 24] as const
</script>

<template>
  <div class="style-panel">
    <section class="group">
      <header class="group__head">
        <h3>模板</h3>
        <button type="button" class="ghost-btn" @click="emit('randomize')">🎲 随机</button>
      </header>
      <TemplatePicker
        :model-value="style.templateId"
        :card-type="cardType as never"
        :favorites="favorites"
        @update:model-value="emit('update:template', $event)"
        @toggle-favorite="emit('toggle-favorite', $event)"
      />
    </section>

    <section class="group">
      <header class="group__head"><h3>主色调</h3></header>
      <ColorPicker v-model="style.primaryColor" />
    </section>

    <section class="group">
      <header class="group__head"><h3>字体</h3></header>
      <FontSelector v-model="style.fontFamily" />
      <div class="sub">
        <span class="field-label">字号</span>
        <div class="seg">
          <button
            v-for="s in SIZES"
            :key="s"
            type="button"
            :data-active="style.fontSize === s"
            @click="style.fontSize = s"
          >
            {{ { sm: '小', md: '中', lg: '大' }[s] }}
          </button>
          <button type="button" :data-active="style.fontSize === 'custom'" @click="style.fontSize = 'custom'">自定义</button>
        </div>
        <input
          v-if="style.fontSize === 'custom'"
          v-model.number="style.customFontSize"
          class="field-input"
          type="number"
          min="16"
          max="72"
          placeholder="32"
        />
      </div>
    </section>

    <section class="group">
      <header class="group__head"><h3>圆角</h3></header>
      <div class="seg seg--wide">
        <button
          v-for="r in RADII"
          :key="r"
          type="button"
          :data-active="style.borderRadius === r"
          @click="style.borderRadius = r"
        >
          {{ r }}px
        </button>
      </div>
    </section>

    <section class="group">
      <header class="group__head"><h3>尺寸</h3></header>
      <SizeSelector
        :size="style.size"
        @preset="emit('update:size-preset', $event)"
        @custom="(w, h) => emit('update:custom-size', w, h)"
      />
    </section>

    <section class="group">
      <header class="group__head"><h3>水印</h3></header>
      <label class="switch-line">
        <input v-model="style.watermark!.enabled" type="checkbox" class="switch" />
        <span class="field-label">显示水印</span>
      </label>
      <template v-if="style.watermark!.enabled">
        <input v-model="style.watermark!.text" class="field-input" placeholder="@你的昵称" />
        <select v-model="style.watermark!.position" class="field-input">
          <option value="bottom-right">右下角</option>
          <option value="bottom-center">底部居中</option>
          <option value="top-right">右上角</option>
        </select>
      </template>
    </section>

    <section class="group">
      <header class="group__head"><h3>背景透明度</h3><span class="value">{{ style.backgroundOpacity }}%</span></header>
      <input v-model.number="style.backgroundOpacity" type="range" min="0" max="100" class="range" />
    </section>
  </div>
</template>

<style scoped>
.style-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 24px;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ui-border);
}
.group:last-child {
  border-bottom: none;
}
.group__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.group__head h3 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--ui-text);
  letter-spacing: 0.02em;
}
.value {
  font-size: 11px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}
.ghost-btn {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--ui-border);
  background: transparent;
  color: var(--ui-muted);
  cursor: pointer;
}
.ghost-btn:hover {
  color: #6366F1;
  border-color: rgba(99, 102, 241, 0.4);
}
.sub {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.seg--wide {
  display: flex;
  width: 100%;
}
.seg--wide > button {
  flex: 1;
}
.switch-line {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.switch {
  width: 16px;
  height: 16px;
  accent-color: #6366F1;
}
.range {
  width: 100%;
  accent-color: #6366F1;
}
</style>
