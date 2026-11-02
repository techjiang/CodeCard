<script setup lang="ts">
import type { HistoryEntry } from '@/composables/useHistory'

defineProps<{ open: boolean; entries: HistoryEntry[] }>()
const emit = defineEmits<{ close: []; restore: [entry: HistoryEntry]; remove: [id: string]; clear: [] }>()

function formatTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <div v-if="open" class="drawer-mask" @click.self="emit('close')">
    <aside class="drawer">
      <header class="drawer__head">
        <h3>历史记录</h3>
        <div class="drawer__actions">
          <button v-if="entries.length" type="button" @click="emit('clear')">清空</button>
          <button type="button" @click="emit('close')">关闭</button>
        </div>
      </header>
      <p v-if="!entries.length" class="drawer__empty">还没有记录，导出一次或手动保存</p>
      <ul class="drawer__list">
        <li v-for="entry in entries" :key="entry.id" class="item">
          <button type="button" class="item__main" @click="emit('restore', entry)">
            <span class="item__title">{{ entry.card.title || '未命名卡片' }}</span>
            <span class="item__meta">{{ formatTime(entry.updatedAt) }} · {{ entry.card.type }}</span>
          </button>
          <button type="button" class="item__del" @click="emit('remove', entry.id)">删除</button>
        </li>
      </ul>
    </aside>
  </div>
</template>

<style scoped>
.drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(15, 23, 42, 0.32);
  display: flex;
  justify-content: flex-end;
  animation: fade 0.15s ease-out;
}
.drawer {
  width: 320px;
  max-width: 86vw;
  height: 100%;
  background: var(--ui-panel);
  border-left: 1px solid var(--ui-border);
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 12px;
  overflow-y: auto;
}
.drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.drawer__head h3 {
  margin: 0;
  font-size: 13px;
}
.drawer__actions {
  display: flex;
  gap: 8px;
}
.drawer__actions button {
  font-size: 11px;
  border: 1px solid var(--ui-border);
  background: transparent;
  color: var(--ui-muted);
  padding: 3px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.drawer__empty {
  font-size: 12px;
  color: var(--ui-muted);
}
.drawer__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  padding: 8px 10px;
}
.item__main {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}
.item__title {
  font-size: 12px;
  color: var(--ui-text);
}
.item__meta {
  font-size: 10px;
  color: var(--ui-muted);
}
.item__del {
  font-size: 11px;
  color: var(--ui-muted);
  background: none;
  border: none;
  cursor: pointer;
}
.item__del:hover {
  color: #EF4444;
}
@keyframes fade {
  from {
    opacity: 0;
  }
}
</style>
