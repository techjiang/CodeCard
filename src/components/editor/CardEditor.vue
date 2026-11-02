<script setup lang="ts">
import type { CardData } from '@/types/card'
import type { CardEditorStore } from '@/composables/useCardEditor'
import { CARD_TYPE_LABELS } from '@/types/card'
import ContentInput from './ContentInput.vue'

const props = defineProps<{ store: CardEditorStore }>()

const { card, addTag, removeTag, reset } = props.store
</script>

<template>
  <div class="editor">
    <header class="editor__head">
      <div>
        <h2>内容</h2>
        <p class="hint">{{ CARD_TYPE_LABELS[card.type as keyof typeof CARD_TYPE_LABELS] }} · 改动即时预览</p>
      </div>
      <button type="button" class="ghost" @click="reset">重置</button>
    </header>
    <div class="editor__body thin-scroll">
      <ContentInput :card="card as CardData" @add-tag="addTag" @remove-tag="removeTag" />
    </div>
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
.editor__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--ui-border);
}
.editor__head h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.hint {
  margin: 3px 0 0;
  font-size: 11px;
  color: var(--ui-muted);
}
.ghost {
  font-size: 11px;
  color: var(--ui-muted);
  background: transparent;
  border: 1px solid var(--ui-border);
  border-radius: 6px;
  padding: 3px 8px;
  cursor: pointer;
}
.ghost:hover {
  color: #6366F1;
}
.editor__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px 32px;
}
</style>
