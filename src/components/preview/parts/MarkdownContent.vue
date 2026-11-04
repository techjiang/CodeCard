<script setup lang="ts">
import { computed } from 'vue'
import { parseMarkdown } from '@/utils/markdown'
import { breakPoints, textParts } from '@/utils/typography'

const props = defineProps<{ content: string; tone: 'dark' | 'light' | 'accent'; fontSize: number }>()

const blocks = computed(() => parseMarkdown(props.content ?? ''))
/** 零宽空格：断点用字符而不是 <wbr>，片段超宽时不会被从中间硬拆 */
const ZWSP = '\u200B'

/** 行内代码里的长标识符同样要能在语义边界换行 */
function codeParts(value: string): string[] {
  return textParts(breakPoints(value))
}

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
        <template v-for="(node, ni) in block.inlines" :key="ni">
          <template v-if="node.type === 'text'">
            <template v-for="(part, pi) in textParts(node.value)" :key="pi">
              <wbr v-if="pi" />{{ part }}
            </template>
          </template>
          <template v-else>{{ node.value }}</template>
        </template>
      </h2>
      <p v-else-if="block.type === 'paragraph'" class="md-p">
        <template v-for="(node, ni) in block.inlines" :key="ni">
          <code v-if="node.type === 'code'" class="md-code">
            <template v-for="(part, pi) in codeParts(node.value)" :key="pi">{{ pi ? ZWSP : '' }}{{ part }}</template>
          </code>
          <strong v-else-if="node.type === 'strong'" :style="{ color: strongColor }">{{ node.value }}</strong>
          <em v-else-if="node.type === 'em'">{{ node.value }}</em>
          <span v-else-if="node.type === 'link'" class="md-link">{{ node.value }}</span>
          <template v-else-if="node.type === 'text'">
            <template v-for="(part, pi) in textParts(node.value)" :key="pi">
              <wbr v-if="pi" />{{ part }}
            </template>
          </template>
        </template>
      </p>
      <ul v-else-if="block.type === 'list'" class="md-list" :class="{ 'md-list--ordered': block.ordered }">
        <li v-for="(item, ii) in block.items" :key="ii">
          <span class="md-marker">{{ block.ordered ? `${ii + 1}.` : '•' }}</span>
          <span class="md-item">
            <template v-for="(node, ni) in item" :key="ni">
              <code v-if="node.type === 'code'" class="md-code">
                <template v-for="(part, pi) in codeParts(node.value)" :key="pi">{{ pi ? ZWSP : '' }}{{ part }}</template>
              </code>
              <strong v-else-if="node.type === 'strong'" :style="{ color: strongColor }">{{ node.value }}</strong>
              <template v-else-if="node.type === 'text'">
                <template v-for="(part, pi) in textParts(node.value)" :key="pi">
                  <wbr v-if="pi" />{{ part }}
                </template>
              </template>
              <template v-else>{{ node.value }}</template>
            </template>
          </span>
        </li>
      </ul>
      <blockquote v-else-if="block.type === 'quote'" class="md-quote">
        <template v-for="(node, ni) in block.inlines" :key="ni">
          <template v-if="node.type === 'text'">
            <template v-for="(part, pi) in textParts(node.value)" :key="pi">
              <wbr v-if="pi" />{{ part }}
            </template>
          </template>
          <template v-else>{{ node.value }}</template>
        </template>
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
  /* 正文按容器宽度排版：不写死会让长行把整条父链顶宽，自量的「可用宽度」跟着失真 */
  min-width: 0;
  max-width: 100%;
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
  /* 行内元素默认会吃掉模板里的换行，<wbr> 才拿得到断点 */
  white-space: pre-wrap;
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
  /* 圆点跟首行对齐，别在多行条目里飘到中间 */
  align-items: flex-start;
  gap: 0.5em;
}
.md-marker {
  flex: 0 0 auto;
  min-width: 1.1em;
  line-height: inherit;
  opacity: 0.6;
}
.md-item {
  flex: 1 1 auto;
  min-width: 0;
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
