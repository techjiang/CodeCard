<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ content: string; fontSize: number; tone: 'dark' | 'light' | 'accent' }>()

interface Line {
  kind: 'command' | 'output'
  text: string
}

const lines = computed<Line[]>(() =>
  (props.content ?? '').split('\n').map((raw) => {
    const isCommand = /^\s*\$/.test(raw)
    return { kind: isCommand ? 'command' : 'output', text: isCommand ? raw.replace(/^\s*\$\s?/, '') : raw }
  }),
)
const isDark = computed(() => props.tone === 'dark')
</script>

<template>
  <div
    class="term"
    :style="{
      fontSize: `${fontSize}px`,
      background: isDark ? 'rgba(9, 11, 17, 0.72)' : 'rgba(17, 19, 26, 0.94)',
    }"
  >
    <div class="term__bar">
      <span class="dot" style="background: #ff5f57" />
      <span class="dot" style="background: #febc2e" />
      <span class="dot" style="background: #28c840" />
      <span class="term__title">bash</span>
    </div>
    <div class="term__body">
      <div v-for="(line, i) in lines" :key="i" class="term__line" :class="`term__line--${line.kind}`">
        <span v-if="line.kind === 'command'" class="term__prompt">$</span>
        <span>{{ line.text }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.term {
  border-radius: 14px;
  overflow: hidden;
  color: #E6EDF3;
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, 'PingFang SC', monospace;
  line-height: 1.6;
}
.term__bar {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.06);
}
.dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}
.term__title {
  margin-left: 8px;
  font-size: 12px;
  opacity: 0.55;
  letter-spacing: 0.04em;
}
.term__body {
  padding: 16px 20px 20px;
}
.term__line {
  display: flex;
  gap: 0.6em;
  white-space: pre-wrap;
  word-break: break-all;
}
.term__line--output {
  color: rgba(230, 237, 243, 0.62);
}
.term__prompt {
  color: #4ADE80;
  flex: 0 0 auto;
}
</style>
