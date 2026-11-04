<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useCardEditor } from '@/composables/useCardEditor'
import { useExport } from '@/composables/useExport'
import { useHistory, type HistoryEntry } from '@/composables/useHistory'
import { useTheme } from '@/composables/useTheme'
import { TEMPLATES } from '@/utils/templates'
import { readJSON, safeSet } from '@/utils/storage'
import CardEditor from '@/components/editor/CardEditor.vue'
import StylePanel from '@/components/editor/StylePanel.vue'
import CardPreview from '@/components/preview/CardPreview.vue'
import ExportButton from '@/components/shared/ExportButton.vue'
import HistoryDrawer from '@/components/shared/HistoryDrawer.vue'
import ThemeToggle from '@/components/shared/ThemeToggle.vue'

const store = useCardEditor()
const exporter = useExport()
const history = useHistory()
const { theme } = useTheme()

const previewRef = ref<InstanceType<typeof CardPreview> | null>(null)
const drawerOpen = ref(false)
const mobileTab = ref<'content' | 'preview' | 'style'>('content')

const FAV_KEY = 'codecard:favorites'
const favorites = ref<string[]>(readFavorites())

function readFavorites(): string[] {
  const data = readJSON<unknown>(FAV_KEY, [])
  return Array.isArray(data) ? data.filter((v): v is string => typeof v === 'string') : []
}

function toggleFavorite(id: string) {
  favorites.value = favorites.value.includes(id)
    ? favorites.value.filter((v) => v !== id)
    : [...favorites.value, id]
  safeSet(FAV_KEY, JSON.stringify(favorites.value))
}

function randomizeTemplate() {
  const pool = TEMPLATES.filter((t) => t.id !== store.style.templateId)
  const picked = pool[Math.floor(Math.random() * pool.length)]
  store.applyTemplate(picked.id)
}

function onPreviewReady(el: HTMLElement | null) {
  if (el) {
    exporter.register({
      element: el,
      card: store.card,
      style: store.style,
      waitUntilReady: () => previewRef.value?.waitUntilSettled() ?? Promise.resolve(),
    })
  }
}

function restoreEntry(entry: HistoryEntry) {
  store.restore({ card: entry.card, style: entry.style })
  drawerOpen.value = false
}

/** 内容稳定 1.2s 后落一次历史，避免打字时刷记录 */
let saveTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => store.revision.value,
  () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const { card, style } = store.snapshot()
      if (!card.title && !card.content) return
      history.save(card, style)
    }, 1200)
  },
)

const sizeText = computed(() => {
  const { width, height } = store.style.size
  return `${width} × ${height}`
})

const fileLabel = computed(() => store.card.filename || (store.card.title ? store.card.title.slice(0, 18) : '未命名卡片'))

/** E2E 钩子：只挂到 window，不参与任何界面逻辑 */
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__ccExport = (scale: 1 | 2 | 3) => exporter.render(scale)
}

onMounted(async () => {
  await nextTick()
  // 组件异步加载后重新注册导出目标
  onPreviewReady(previewRef.value?.cardEl ?? null)
})
</script>

<template>
  <div class="app" :data-theme="theme">
    <header class="topbar">
      <div class="brand">
        <svg class="brand__logo" width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
          <defs>
            <linearGradient id="brand-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#6366F1" />
              <stop offset="100%" stop-color="#8B5CF6" />
            </linearGradient>
          </defs>
          <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="url(#brand-g)" />
          <path d="M13 11 9 16l4 5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="m19 11 4 5-4 5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <div class="brand__text">
          <strong>CodeCard</strong>
          <span>{{ fileLabel }}</span>
        </div>
      </div>

      <div class="topbar__actions">
        <span class="size-chip">{{ sizeText }}</span>
        <button type="button" class="ghost-btn" @click="drawerOpen = true">历史</button>
        <ThemeToggle />
        <ExportButton :store="exporter" />
      </div>
    </header>

    <nav class="mobile-tabs">
      <button type="button" :data-active="mobileTab === 'content'" @click="mobileTab = 'content'">内容</button>
      <button type="button" :data-active="mobileTab === 'preview'" @click="mobileTab = 'preview'">预览</button>
      <button type="button" :data-active="mobileTab === 'style'" @click="mobileTab = 'style'">样式</button>
    </nav>

    <main class="workspace">
      <aside class="pane pane--left" :data-mobile-hidden="mobileTab !== 'content'">
        <CardEditor :store="store" />
      </aside>

      <section class="pane pane--center checkerboard" :data-mobile-hidden="mobileTab !== 'preview'">
        <CardPreview ref="previewRef" :card="store.card" :style="store.style" @ready="onPreviewReady" />
      </section>

      <aside class="pane pane--right" :data-mobile-hidden="mobileTab !== 'style'">
        <div class="pane__head">
          <h2>样式</h2>
        </div>
        <div class="pane__scroll thin-scroll">
          <StylePanel
            :style="store.style"
            :card-type="store.card.type"
            :favorites="favorites"
            @update:template="store.applyTemplate"
            @update:size-preset="store.setSizePreset"
            @update:custom-size="(w, h) => store.setCustomSize(w, h)"
            @toggle-favorite="toggleFavorite"
            @randomize="randomizeTemplate"
          />
        </div>
      </aside>
    </main>

    <HistoryDrawer
      :open="drawerOpen"
      :entries="history.list.value"
      @close="drawerOpen = false"
      @restore="restoreEntry"
      @remove="history.remove"
      @clear="history.clear"
    />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--ui-bg);
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 54px;
  padding: 0 16px;
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-panel);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  min-width: 0;
}
.brand__text strong {
  font-size: 13px;
  letter-spacing: 0.01em;
}
.brand__text span {
  font-size: 11px;
  color: var(--ui-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 42vw;
}
.topbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.size-chip {
  font-size: 11px;
  color: var(--ui-muted);
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  font-variant-numeric: tabular-nums;
}
.ghost-btn {
  font-size: 12px;
  color: var(--ui-muted);
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--ui-border);
  background: transparent;
  cursor: pointer;
}
.ghost-btn:hover {
  color: var(--ui-text);
}
.workspace {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr) 320px;
}
.pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.pane--left,
.pane--right {
  background: var(--ui-panel);
}
.pane--left {
  border-right: 1px solid var(--ui-border);
}
.pane--right {
  border-left: 1px solid var(--ui-border);
}
.pane__head {
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--ui-border);
}
.pane__head h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.pane__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px 24px;
}
.mobile-tabs {
  display: none;
}

@media (max-width: 900px) {
  .workspace {
    grid-template-columns: minmax(0, 1fr);
  }
  .pane[data-mobile-hidden='true'] {
    display: none;
  }
  .mobile-tabs {
    display: flex;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--ui-border);
    background: var(--ui-panel);
  }
  .mobile-tabs button {
    flex: 1;
    padding: 7px 0;
    font-size: 12px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ui-muted);
    cursor: pointer;
  }
  .mobile-tabs button[data-active='true'] {
    background: rgba(99, 102, 241, 0.1);
    color: #6366F1;
    border-color: rgba(99, 102, 241, 0.3);
  }
  .size-chip {
    display: none;
  }
}
</style>
