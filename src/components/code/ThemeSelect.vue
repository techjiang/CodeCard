<script setup lang="ts">
import { HIGHLIGHT_THEMES } from '@/utils/highlight'

const model = defineModel<string | undefined>()
</script>

<template>
  <select :value="model ?? HIGHLIGHT_THEMES[0].id" class="field-input" @change="model = ($event.target as HTMLSelectElement).value">
    <option v-for="theme in HIGHLIGHT_THEMES" :key="theme.id" :value="theme.id">{{ theme.name }}</option>
  </select>
</template>
