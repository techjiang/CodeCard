<script setup lang="ts">
/**
 * 卡片渲染器：根据 card.type 选择内容渲染方式，模板只负责外框与排版。
 * 所有尺寸用 px 计算，确保导出时与屏幕 1:1 一致。
 */
import { computed } from 'vue'
import type { CardData } from '@/types/card'
import { FONT_SIZE_MAP, FONT_STACK } from '@/types/card'
import type { CardStyle } from '@/types/card'
import MarkdownContent from './parts/MarkdownContent.vue'
import CodeBlock from '@/components/code/CodeBlock.vue'
import TerminalContent from './parts/TerminalContent.vue'
import MathContent from './parts/MathContent.vue'
import QuoteContent from './parts/QuoteContent.vue'

const props = defineProps<{
  card: CardData
  style: CardStyle
  /** 视觉密度 */
  tone?: 'dark' | 'light' | 'accent'
  /** 是否在代码模板中显示窗体装饰 */
  showChrome?: boolean
  /** 内容过长时整体缩小字号（1 = 原尺寸） */
  fitScale?: number
}>()

const fit = computed(() => props.fitScale ?? 1)

const tone = computed(() => props.tone ?? 'light')
const baseFontSize = computed(() =>
  props.style.fontSize === 'custom' ? (props.style.customFontSize ?? 32) : FONT_SIZE_MAP[props.style.fontSize],
)
const fontSize = computed(() => Math.round(baseFontSize.value * fit.value))
const codeFontSize = computed(() => Math.round(fontSize.value * 0.5))
const textColor = computed(() => (tone.value === 'dark' ? '#F4F6FB' : '#1B1D24'))
const mutedColor = computed(() => (tone.value === 'dark' ? 'rgba(240, 243, 250, 0.66)' : 'rgba(27, 29, 36, 0.56)'))

const showTitle = computed(() => !!props.card.title?.trim())
const showSubtitle = computed(() => !!props.card.subtitle?.trim())
const showTags = computed(() => props.card.tags?.filter(Boolean).length > 0)
const footerItems = computed(() => {
  const f = props.card.footer
  if (!f) return []
  return [f.author, f.source, f.date].filter((v): v is string => !!v && !!v.trim())
})
</script>

<template>
  <div class="cc-content" :style="{ fontFamily: FONT_STACK[style.fontFamily], color: textColor }">
    <header v-if="showTitle" class="cc-header">
      <h1 class="cc-title" :style="{ fontSize: `${Math.round(fontSize * 1.62)}px` }">{{ card.title }}</h1>
      <p v-if="showSubtitle" class="cc-subtitle" :style="{ fontSize: `${Math.round(fontSize * 0.72)}px`, color: mutedColor }">
        {{ card.subtitle }}
      </p>
    </header>

    <div class="cc-body" :style="{ fontSize: `${fontSize}px` }">
      <slot name="body">
        <CodeBlock
          v-if="card.type === 'code'"
          :code="card.content"
          :language="card.language"
          :theme-id="card.highlightTheme"
          :show-line-numbers="card.showLineNumbers"
          :show-chrome="showChrome"
          :filename="card.filename"
          :font-size="codeFontSize"
        />
        <TerminalContent v-else-if="card.type === 'terminal'" :content="card.content" :font-size="codeFontSize" :tone="tone" />
        <MathContent v-else-if="card.type === 'math'" :content="card.content" :font-size="fontSize" :tone="tone" />
        <QuoteContent
          v-else-if="card.type === 'quote'"
          :content="card.content"
          :from="card.quoteFrom"
          :font-size="fontSize"
          :tone="tone"
        />
        <MarkdownContent
          v-else-if="card.type === 'knowledge'"
          :content="card.content"
          :tone="tone"
          :font-size="fontSize"
        />
        <pre v-else class="cc-raw" :style="{ fontSize: `${Math.round(fontSize * 0.92)}px` }">{{ card.content }}</pre>
      </slot>
    </div>

    <footer v-if="showTags || footerItems.length" class="cc-footer">
      <div v-if="showTags" class="cc-tags">
        <span
          v-for="tag in card.tags.slice(0, 5)"
          :key="tag"
          class="cc-tag"
          :style="{
            fontSize: `${Math.round(fontSize * 0.54)}px`,
            borderColor: tone === 'dark' ? 'rgba(255,255,255,0.26)' : 'rgba(27,29,36,0.16)',
            color: tone === 'dark' ? 'rgba(255,255,255,0.82)' : 'rgba(27,29,36,0.66)',
          }"
        >#{{ tag }}</span>
      </div>
      <div v-if="footerItems.length" class="cc-meta" :style="{ fontSize: `${Math.round(fontSize * 0.5)}px`, color: mutedColor }">
        <span v-for="(item, i) in footerItems" :key="i">{{ item }}</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.cc-content {
  display: flex;
  flex-direction: column;
  gap: 34px;
  width: 100%;
  height: 100%;
  line-height: 1.8;
}
.cc-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-title {
  margin: 0;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.01em;
}
.cc-subtitle {
  margin: 0;
  line-height: 1.5;
}
.cc-body {
  flex: 0 1 auto;
  min-height: 0;
}
.cc-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
}
.cc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.cc-tag {
  padding: 4px 12px;
  border: 1px solid;
  border-radius: 999px;
  line-height: 1.5;
}
.cc-raw {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'JetBrains Mono', 'PingFang SC', monospace;
  line-height: 1.8;
}
.cc-meta {
  display: flex;
  gap: 14px;
  margin-left: auto;
}
</style>
