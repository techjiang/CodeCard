<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, shallowRef, watch, type ComponentPublicInstance } from 'vue'
import type { CardData, CardStyle } from '@/types/card'
import { findTemplate } from '@/utils/templates'

const props = defineProps<{
  card: CardData
  style: CardStyle
  /** 自定义缩放；不传则自动适配容器 */
  scale?: number
}>()

const emit = defineEmits<{ ready: [el: HTMLElement | null] }>()

const container = ref<HTMLElement | null>(null)
const cardEl = ref<HTMLElement | null>(null)
const autoScale = ref(1)

/** 模板按需加载，缓存已加载组件避免闪烁 */
const cache = new Map<string, ReturnType<typeof defineAsyncComponent>>()
const templateComponent = shallowRef<ReturnType<typeof defineAsyncComponent> | null>(null)

function resolveTemplate(id: string) {
  const template = findTemplate(id)
  if (!cache.has(template.id)) {
    cache.set(template.id, defineAsyncComponent(template.loader as never))
  }
  templateComponent.value = cache.get(template.id)!
}

watch(() => props.style.templateId, resolveTemplate, { immediate: true })

const sizeStyle = computed(() => ({
  width: `${props.style.size.width}px`,
  height: `${props.style.size.height}px`,
  minWidth: `${props.style.size.width}px`,
  minHeight: `${props.style.size.height}px`,
}))

const currentScale = computed(() => props.scale ?? autoScale.value)
const wrapperStyle = computed(() => ({
  width: `${props.style.size.width * currentScale.value}px`,
  height: `${props.style.size.height * currentScale.value}px`,
}))

const transformStyle = computed(() => ({
  transform: `scale(${currentScale.value})`,
  transformOrigin: 'top left',
}))

/** 导出渲染器需要设计尺寸，直接从 DOM 上读，省得 E2E 再猜 */
const exportMeta = computed(() =>
  JSON.stringify({ width: props.style.size.width, height: props.style.size.height }),
)

/** 预览区留给卡片的边距：左右各 32、底部给尺寸标注留 90，和 .preview-host 对齐 */
const PREVIEW_PAD_X = 64
const PREVIEW_PAD_Y = 90

function measure() {
  const box = container.value
  if (!box) return
  const available = box.clientWidth - PREVIEW_PAD_X
  const availableH = box.clientHeight - PREVIEW_PAD_Y
  if (available <= 0 || availableH <= 0) return
  const design = props.style.size
  const fitted = Math.min(available / design.width, availableH / design.height)
  // 正好卡在 1 附近时保持原尺寸：1.0001 倍的缩放只会让文字被重采样变糊
  autoScale.value = fitted >= 1 ? 1 : Math.max(0.12, Number(fitted.toFixed(4)))
}

let observer: ResizeObserver | null = null

function setupObserver(el: Element | ComponentPublicInstance | null) {
  const host = el instanceof HTMLElement ? el : null
  container.value = host
  if (typeof ResizeObserver === 'undefined' || !host) return
  observer?.disconnect()
  observer = new ResizeObserver(measure)
  observer.observe(host)
  measure()
  // 布局稳定后再兜底测两次，避免首帧读到旧尺寸
  requestAnimationFrame(measure)
  setTimeout(measure, 120)
}

watch(
  () => [props.style.size.width, props.style.size.height],
  async () => {
    // 先让 DOM 换成新尺寸再量，否则量到的还是上一张卡片撑开的容器
    await nextTick()
    measure()
  },
)

watch(cardEl, (el) => emit('ready', el))

/**
 * 模板里的自适应还在逐档试缩时不导出，免得截到中间态。
 * 模板是异步组件，它自己挂在 window 上的调试钩子不算数，必须用组件实例的 ref。
 */
async function waitUntilSettled() {
  const instance = (templateComponent.value as unknown as ComponentPublicInstance | null)?.$
  const fn = (instance?.exposed as { waitForSettle?: () => Promise<void> } | undefined)?.waitForSettle
  await fn?.()
}

defineExpose({ measure, cardEl, waitUntilSettled })
</script>

<template>
  <div :ref="setupObserver" class="preview-host" :data-scale="currentScale">
    <div class="preview-stage" :style="wrapperStyle">
      <div
        ref="cardEl"
        class="preview-card"
        :style="[sizeStyle, transformStyle]"
        data-card-export
        :data-export-style="exportMeta"
      >
        <div class="preview-card__inner">
          <component :is="templateComponent" v-if="templateComponent" :card="card" :style="style" />
        </div>
      </div>
    </div>
    <div class="preview-meta">
      <span>{{ style.size.width }} × {{ style.size.height }}</span>
      <span class="preview-meta__dot">·</span>
      <span>{{ Math.round(currentScale * 100) }}%</span>
    </div>
  </div>
</template>

<style scoped>
.preview-card__inner {
  width: 100%;
  height: 100%;
}
.preview-card__inner > * {
  display: block;
  width: 100%;
  height: 100%;
}
/* 模板根节点必须吃满卡片高度，避免被 flex 收缩 */
.preview-card__inner :deep(.shell) {
  flex: none;
  height: 100%;
}
.preview-host {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 24px 32px 12px;
}
.preview-stage {
  position: relative;
  flex: none;
}
.preview-card {
  flex: none;
  overflow: hidden;
  box-shadow: 0 22px 60px -20px rgba(15, 23, 42, 0.4);
}
.preview-meta {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}
.preview-meta__dot {
  opacity: 0.5;
}
</style>
