<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ tags: string[]; max?: number }>()
const emit = defineEmits<{ add: [value: string]; remove: [value: string] }>()

const draft = ref('')
const max = props.max ?? 5

function commit() {
  const value = draft.value.trim()
  if (!value) return
  emit('add', value)
  draft.value = ''
}

function onBackspace() {
  if (!draft.value && props.tags.length) emit('remove', props.tags[props.tags.length - 1])
}
</script>

<template>
  <div class="tag-input">
    <span v-for="tag in tags" :key="tag" class="tag">
      #{{ tag }}
      <button type="button" class="tag__x" @click="emit('remove', tag)">×</button>
    </span>
    <input
      v-model="draft"
      :disabled="tags.length >= max"
      class="tag-input__field"
      type="text"
      :placeholder="tags.length >= max ? `最多 ${max} 个标签` : '输入后回车'"
      @keydown.enter.prevent="commit"
      @keydown.backspace="onBackspace"
      @blur="commit"
    />
  </div>
</template>

<style scoped>
.tag-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-bg);
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(99, 102, 241, 0.12);
  color: #6366F1;
}
.tag__x {
  border: none;
  background: none;
  padding: 0;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
  line-height: 1;
}
.tag__x:hover {
  opacity: 1;
}
.tag-input__field {
  flex: 1 1 80px;
  min-width: 80px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
  padding: 2px 4px;
  color: var(--ui-text);
}
</style>
