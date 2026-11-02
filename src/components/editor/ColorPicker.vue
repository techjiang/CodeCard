<script setup lang="ts">
const model = defineModel<string>()

const PRESETS = ['#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#F59E0B', '#10B981', '#0EA5E9', '#111827']
</script>

<template>
  <div class="colors">
    <div class="colors__presets">
      <button
        v-for="c in PRESETS"
        :key="c"
        type="button"
        class="swatch"
        :style="{ background: c }"
        :data-active="model?.toLowerCase() === c.toLowerCase()"
        @click="model = c"
      />
    </div>
    <label class="colors__custom">
      <input type="color" :value="model" @input="model = ($event.target as HTMLInputElement).value" />
      <span>{{ model }}</span>
    </label>
  </div>
</template>

<style scoped>
.colors {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.colors__presets {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.12s;
}
.swatch:hover {
  transform: scale(1.08);
}
.swatch[data-active='true'] {
  box-shadow: 0 0 0 2px var(--ui-panel), 0 0 0 4px currentColor;
}
.colors__custom {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--ui-muted);
  cursor: pointer;
}
.colors__custom input {
  width: 30px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--ui-border);
  border-radius: 6px;
  background: transparent;
}
</style>
