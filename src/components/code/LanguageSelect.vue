<script setup lang="ts">
import { LANGUAGES } from '@/utils/highlight'

const model = defineModel<string | undefined>()
</script>

<template>
  <select :value="model ?? 'text'" class="field-input" @change="model = ($event.target as HTMLSelectElement).value">
    <option v-for="lang in LANGUAGES" :key="lang.id" :value="lang.id">{{ lang.name }}</option>
  </select>
</template>
