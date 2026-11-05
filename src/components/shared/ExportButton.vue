<script setup lang="ts">
import { ref } from 'vue'
import type { ExportStore } from '@/composables/useExport'
import type { ExportScale } from '@/types/export'

const props = defineProps<{ store: ExportStore }>()
const open = ref(false)
const toast = ref('')

const SCALES: Array<{ value: ExportScale; label: string; hint: string }> = [
  { value: 1, label: '1x', hint: '1080 宽，朋友圈标准' },
  { value: 2, label: '2x', hint: '高清 Retina' },
  { value: 3, label: '3x', hint: '打印级' },
]

let timer: ReturnType<typeof setTimeout> | null = null
function flash(message: string) {
  toast.value = message
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => (toast.value = ''), 2600)
}

async function download(scale: ExportScale) {
  open.value = false
  const result = await props.store.exportPng(scale)
  flash(result ? `已导出 ${result.width}×${result.height}` : props.store.lastError.value ?? '导出失败')
}

/** SVG 走同一个渲染器，只是把画好的位图裹进矢量容器：预览什么样，导出就是什么样 */
async function downloadSvg() {
  open.value = false
  const result = await props.store.exportPng(2, 'svg')
  flash(result ? `已导出 SVG ${result.width}×${result.height}` : props.store.lastError.value ?? '导出失败')
}

async function copy() {
  open.value = false
  const ok = await props.store.copyToClipboard(2)
  flash(ok ? '已复制到剪贴板' : props.store.lastError.value ?? '复制失败')
}
</script>

<template>
  <div class="export">
    <button type="button" class="export__btn" :disabled="store.exporting.value" @click="open = !open">
      {{ store.exporting.value ? '导出中…' : '导出 PNG' }}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <div v-if="open" class="menu">
      <button v-for="s in SCALES" :key="s.value" type="button" class="menu__item" @click="download(s.value)">
        <strong>{{ s.label }}</strong>
        <span>{{ s.hint }}</span>
      </button>
      <div class="menu__sep" />
      <button type="button" class="menu__item" @click="downloadSvg">
        <strong>SVG</strong>
        <span>矢量容器，缩到多大都不糊</span>
      </button>
      <button type="button" class="menu__item" @click="copy">
        <strong>复制到剪贴板</strong>
        <span>2x 分辨率，直接粘贴</span>
      </button>
    </div>

    <transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.export {
  position: relative;
}
.export__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  box-shadow: 0 6px 16px -8px rgba(99, 102, 241, 0.9);
  cursor: pointer;
}
.export__btn:disabled {
  opacity: 0.7;
  cursor: default;
}
.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 40;
  width: 214px;
  padding: 6px;
  border-radius: 10px;
  background: var(--ui-panel);
  border: 1px solid var(--ui-border);
  box-shadow: 0 18px 40px -18px rgba(15, 23, 42, 0.4);
}
.menu__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}
.menu__item:hover {
  background: rgba(99, 102, 241, 0.1);
}
.menu__item strong {
  font-size: 12px;
  color: var(--ui-text);
  font-weight: 500;
}
.menu__item span {
  font-size: 10px;
  color: var(--ui-muted);
}
.menu__sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--ui-border);
}
.toast {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  white-space: nowrap;
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 8px;
  color: #fff;
  background: rgba(17, 24, 39, 0.92);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
