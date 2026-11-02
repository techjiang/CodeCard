<script setup lang="ts">
import { computed } from 'vue'
import { highlight, getHighlightTheme } from '@/utils/highlight'

const props = withDefaults(
  defineProps<{
    code: string
    language?: string
    themeId?: string
    showLineNumbers?: boolean
    showChrome?: boolean
    filename?: string
    fontSize?: number
  }>(),
  {
    language: 'text',
    themeId: 'one-dark',
    showLineNumbers: true,
    showChrome: false,
    fontSize: 16,
  },
)

const theme = computed(() => getHighlightTheme(props.themeId))
const lines = computed(() => highlight(props.code ?? '', props.language))
</script>

<template>
  <div class="cc-code" :style="{ background: theme.background, color: theme.foreground }">
    <div v-if="showChrome" class="cc-code__chrome" :class="{ 'cc-code__chrome--light': theme.mode === 'light' }">
      <span class="dot" style="background: #ff5f57" />
      <span class="dot" style="background: #febc2e" />
      <span class="dot" style="background: #28c840" />
      <span v-if="filename" class="cc-code__file">{{ filename }}</span>
      <span v-if="language && language !== 'text'" class="cc-code__lang">{{ language }}</span>
    </div>
    <div class="cc-code__body" :style="{ fontSize: `${fontSize}px` }">
      <div
        v-for="(line, idx) in lines"
        :key="idx"
        class="cc-code__line"
        :class="{ 'cc-code__line--numbered': showLineNumbers }"
      >
        <span v-if="showLineNumbers" class="cc-code__ln" :style="{ color: theme.mode === 'light' ? '#b9bec7' : '#5c6069' }">{{ idx + 1 }}</span>
        <span class="cc-code__text">
          <span v-for="(token, ti) in line" :key="ti" :style="{ color: theme.colors[token.type] }">{{ token.value }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cc-code {
  border-radius: inherit;
  overflow: hidden;
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, 'PingFang SC', monospace;
  line-height: 1.6;
}
.cc-code__chrome {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
.cc-code__chrome--light {
  background: #f4f5f7;
  border-bottom-color: rgba(15, 23, 42, 0.08);
}
.dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}
.cc-code__file {
  margin-left: 10px;
  font-size: 13px;
  color: rgba(235, 238, 245, 0.75);
}
.cc-code__chrome--light .cc-code__file {
  color: #57606a;
}
.cc-code__lang {
  margin-left: auto;
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(235, 238, 245, 0.45);
}
.cc-code__body {
  padding: 14px 0;
}
.cc-code__line {
  display: flex;
  white-space: pre-wrap;
  word-break: break-all;
  padding-right: 20px;
}
.cc-code__ln {
  flex: 0 0 auto;
  width: 42px;
  padding-right: 14px;
  text-align: right;
  user-select: none;
  font-size: 0.86em;
}
.cc-code__line:not(.cc-code__line--numbered) .cc-code__text {
  padding-left: 20px;
}
</style>
