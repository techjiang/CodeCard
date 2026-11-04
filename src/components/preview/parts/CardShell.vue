<script setup lang="ts">
/**
 * 模板外壳：统一处理尺寸、内边距、圆角、字体与背景透明度。
 * 模板组件只管填 slot 里的内容与装饰。
 */
import { computed } from 'vue'
import type { CardStyle } from '@/types/card'
import { FONT_STACK } from '@/types/card'

const props = withDefaults(
  defineProps<{
    style: CardStyle
    padding?: number
    background?: string
    textColor?: string
    /** 阴影强度 0 关闭 */
    shadow?: number
  }>(),
  { padding: 64, background: '#ffffff', textColor: '#1B1D24', shadow: 0.18 },
)

/** 背景透明度若作用在外壳上，文字和装饰会一起淡掉，那就不是「背景」透明度了 */
function fade(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const full = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

const vars = computed(() => {
  const alpha = Math.max(0, Math.min(1, props.style.backgroundOpacity / 100))
  return {
    width: `${props.style.size.width}px`,
    height: `${props.style.size.height}px`,
    padding: `${props.padding}px`,
    borderRadius: `${props.style.borderRadius}px`,
    background: alpha >= 1 ? props.background : fade(props.background, alpha),
    color: props.textColor,
    fontFamily: FONT_STACK[props.style.fontFamily],
    boxShadow: props.shadow > 0 ? `0 24px 60px -18px rgba(15, 23, 42, ${props.shadow})` : 'none',
  }
})
</script>

<template>
  <section class="shell" :style="vars" data-card-root>
    <slot name="decor" />
    <div class="shell__inner">
      <slot name="before" />
      <slot />
      <slot name="after" />
    </div>
    <slot name="overlay" />
  </section>
</template>

<style scoped>
.shell {
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  isolation: isolate;
}
.shell__inner {
  position: relative;
  z-index: 2;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
