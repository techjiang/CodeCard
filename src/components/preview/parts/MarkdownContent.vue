<script setup lang="ts">
import { computed } from 'vue'
import { parseMarkdown } from '@/utils/markdown'

const props = defineProps<{ content: string; tone: 'dark' | 'light' | 'accent'; fontSize: number }>()

const blocks = computed(() => parseMarkdown(props.content ?? ''))
const strongColor = computed(() => (props.tone === 'dark' ? '#FFFFFF' : '#11131A'))
</script>

<template>
  <div class="md" :style="{ fontSize: `${fontSize}px` }">
    <template v-for="(block, bi) in blocks" :key="bi">
      <h2
        v-if="block.type === 'heading'"
        class="md-h"
        :style="{ fontSize: `${Math.round(fontSize * (block.level <= 2 ? 1.12 : 1))}px` }"
      >
        <template v-for="(node, ni) in block.inlines" :key="ni">{{ node.value }}</template>
      </h2>
      <p v-else-if="block.type === 'paragraph'" class="md-p">
        <template v-for="(node, ni) in block.inlines" :key="ni">
          <code v-if="node.type === 'code'" class="md-code">{{ node.value }}</code>
          <strong v-else-if="node.type === 'strong'" :style="{ color: strongColor }">{{ node.value }}</strong>
          <em v-else-if="node.type === 'em'">{{ node.value }}</em>
          <span v-else-if="node.type === 'link'" class="md-link">{{ node.value }}</span>
          <template v-else>{{ node.value }}</template>
        </template>
      </p>
      <ul v-else-if="block.type === 'list'" class="md-list" :class="{ 'md-list--ordered': block.ordered }">
        <li v-for="(item, ii) in block.items" :key="ii">
          <span class="md-marker">{{ block.ordered ? `${ii + 1}.` : '•' }}</span>
          <span class="md-item">
            <template v-for="(node, ni) in item" :key="ni">
              <code v-if="node.type === 'code'" class="md-code">{{ node.value }}</code>
              <strong v-else-if="node.type === 'strong'" :style="{ color: strongColor }">{{ node.value }}</strong>
              <template v-else>{{ node.value }}</template>
            </template>
          </span>
        </li>
      </ul>
      <blockquote v-else-if="block.type === 'quote'" class="md-quote">
        <template v-for="(node, ni) in block.inlines" :key="ni">{{ node.value }}</template>
      </blockquote>
      <pre v-else-if="block.type === 'code'" class="md-pre"><code>{{ block.value }}</code></pre>
      <hr v-else-if="block.type === 'divider'" class="md-hr" />
    </template>
  </div>
</template>

<style scoped>
.md {
  display: flex;
  flex-direction: column;
  gap: 0.62em;
  line-height: 1.8;
}
.md-h {
  margin: 0.2em 0 0;
  font-weight: 700;
  line-height: 1.45;
}
.md-p {
  margin: 0;
}
.md-code {
  padding: 0.1em 0.36em;
  border-radius: 6px;
  background: rgba(127, 127, 127, 0.16);
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
  font-size: 0.88em;
}
.md-link {
  text-decoration: underline;
  text-underline-offset: 0.18em;
  opacity: 0.92;
}
.md-list {
  display: flex;
  flex-direction: column;
  gap: 0.28em;
  margin: 0;
  padding: 0;
  list-style: none;
}
.md-list li {
  display: flex;
  gap: 0.5em;
}
.md-marker {
  flex: 0 0 auto;
  min-width: 1.1em;
  opacity: 0.6;
}
.md-quote {
  margin: 0;
  padding: 0.5em 0 0.5em 0.9em;
  border-left: 3px solid currentColor;
  opacity: 0.78;
  font-style: italic;
}
.md-pre {
  margin: 0;
  padding: 0.7em 0.9em;
  border-radius: 10px;
  background: rgba(127, 127, 127, 0.14);
  overflow: hidden;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.84em;
  line-height: 1.6;
}
.md-hr {
  width: 100%;
  border: none;
  border-top: 1px solid currentColor;
  opacity: 0.18;
}
</style>
