<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type ComponentPublicInstance,
} from 'vue'
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
/** 当前模板的组件实例：自适应那些方法挂在它身上，只能从实例拿 */
const templateRef = ref<ComponentPublicInstance | null>(null)
const mounted = ref(false)
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

function bindContainer(el: Element | ComponentPublicInstance | null) {
  container.value = el instanceof HTMLElement ? el : null
}

/** 绑定容器并挂上尺寸监听。用函数 ref + onMounted 双保险：
 *  函数 ref 在 v-if 隐藏/显示时可能不触发，光靠它可能一辈子拿不到容器 */
function bindHost(el: Element | ComponentPublicInstance | null) {
  bindContainer(el)
  if (el instanceof HTMLElement) setupObserver(el)
}

function setupObserver(el: Element | ComponentPublicInstance | null) {
  const host = el instanceof HTMLElement ? el : null
  if (typeof ResizeObserver === 'undefined' || !host) return
  observer?.disconnect()
  observer = new ResizeObserver(measure)
  observer.observe(host)
  measure()
  // 布局稳定后再兜底测两次，避免首帧读到旧尺寸
  requestAnimationFrame(measure)
  setTimeout(measure, 120)
}

// 容器在挂载那一刻可能还没有尺寸（隐藏面板、懒加载、布局未稳），
// 之后又不会再有 resize 通知，所以要等挂载后补测几次
onMounted(() => {
  mounted.value = true
  // 移动端切 Tab 才显示预览，容器此时才第一次有尺寸
  if (container.value) setupObserver(container.value)
  measure()
  requestAnimationFrame(measure)
  setTimeout(measure, 120)
  setTimeout(measure, 400)
})

watch(
  () => [props.style.size.width, props.style.size.height],
  async () => {
    // 先让 DOM 换成新尺寸再量，否则量到的还是上一张卡片撑开的容器
    await nextTick()
    measure()
  },
)

// 卡片根节点在外层挂载时可能还没渲染出来，挂载后补发一次 ready，否则导出目标一直是空的
watch(
  [cardEl, mounted],
  ([el, isMounted]) => {
    if (isMounted) emit('ready', el)
  },
  { immediate: true },
)

onBeforeUnmount(() => observer?.disconnect())

/**
 * 导出前让自适应按当前真实盒子重算一遍并收敛。
 *
 * 光「等它自己收敛」不够：手机端停在别的 Tab 上时卡片是 `display: none`，
 * 自适应是在零尺寸下算的，那时候收敛的是错的。导出时卡片刚被支起来有了布局，
 * 必须重算，否则导出图沿用「什么都放得下」的旧结论，正文会溢出。
 */
async function waitUntilSettled() {
  const exposed = templateRef.value?.$?.exposed as
    | { refit?: () => Promise<void>; waitForSettle?: () => Promise<void> }
    | undefined
  if (exposed?.refit) await exposed.refit()
  else await exposed?.waitForSettle?.()
}

defineExpose({ measure, cardEl, waitUntilSettled })
</script>

<template>
  <div :ref="bindHost" class="preview-host" :data-scale="currentScale">
    <div class="preview-stage" :style="wrapperStyle">
      <div
        ref="cardEl"
        class="preview-card"
        :style="[sizeStyle, transformStyle]"
        data-card-export
        :data-export-style="exportMeta"
      >
        <div class="preview-card__inner">
          <component :is="templateComponent" v-if="templateComponent" ref="templateRef" :card="card" :style="style" />
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
  /* 移动端可用高度只有几百像素，别再往里塞大内边距 */
  min-height: 0;
  overflow: hidden;
  padding: 24px 32px 12px;
}

@media (max-width: 900px) {
  .preview-host {
    padding: 12px 16px 8px;
    gap: 8px;
  }
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
