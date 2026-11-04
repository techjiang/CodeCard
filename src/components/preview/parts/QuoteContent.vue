<script setup lang="ts">
import { computed } from 'vue'
import { parseInline, parseMarkdown } from '@/utils/markdown'

const props = defineProps<{ content: string; from?: string; fontSize: number; tone: 'dark' | 'light' | 'accent' }>()

/** 短名句按行内语法渲染；带结构（标题/列表/多段）时退回块级渲染 */
const structured = computed(() => /(^|\n)\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>)/.test(props.content ?? ''))
const blocks = computed(() => (structured.value ? parseMarkdown(props.content ?? '') : []))
const lines = computed(() => (props.content ?? '').split('\n').map((l) => parseInline(l, false)))
const strongColor = computed(() => (props.tone === 'dark' ? '#FFFFFF' : '#11131A'))
</script>

<template>
  <figure class="quote">
    <span class="quote__mark" :style="{ fontSize: `${Math.round(props.fontSize * 2.4)}px` }">“</span>

    <blockquote v-if="!structured" class="quote__text" :style="{ fontSize: `${Math.round(props.fontSize * 1.18)}px` }">
      <p v-for="(line, li) in lines" :key="li" class="quote__line">
        <template v-for="(node, ni) in line" :key="ni">
          <code v-if="node.type === 'code'" class="quote__code">{{ node.value }}</code>
          <strong v-else-if="node.type === 'strong'" :style="{ color: strongColor }">{{ node.value }}</strong>
          <em v-else-if="node.type === 'em'">{{ node.value }}</em>
          <template v-else>{{ node.value }}</template>
        </template>
      </p>
    </blockquote>

    <div v-else class="quote__md" :style="{ fontSize: `${Math.round(props.fontSize * 1.02)}px` }">
      <template v-for="(block, bi) in blocks" :key="bi">
        <h2 v-if="block.type === 'heading'" class="quote__h">
          <template v-for="(node, ni) in block.inlines" :key="ni">{{ node.value }}</template>
        </h2>
        <p v-else-if="block.type === 'paragraph'" class="quote__p">
          <template v-for="(node, ni) in block.inlines" :key="ni">
            <code v-if="node.type === 'code'" class="quote__code">{{ node.value }}</code>
            <strong v-else-if="node.type === 'strong'" :style="{ color: strongColor }">{{ node.value }}</strong>
            <em v-else-if="node.type === 'em'">{{ node.value }}</em>
            <template v-else>{{ node.value }}</template>
          </template>
        </p>
        <ul v-else-if="block.type === 'list'" class="quote__list">
          <li v-for="(item, ii) in block.items" :key="ii">
            <span class="quote__bullet">{{ block.ordered ? `${ii + 1}.` : '·' }}</span>
            <span>
              <template v-for="(node, ni) in item" :key="ni">
                <code v-if="node.type === 'code'" class="quote__code">{{ node.value }}</code>
                <strong v-else-if="node.type === 'strong'" :style="{ color: strongColor }">{{ node.value }}</strong>
                <template v-else>{{ node.value }}</template>
              </template>
            </span>
          </li>
        </ul>
        <blockquote v-else-if="block.type === 'quote'" class="quote__sub">
          <template v-for="(node, ni) in block.inlines" :key="ni">{{ node.value }}</template>
        </blockquote>
      </template>
    </div>

    <figcaption v-if="from" class="quote__from" :style="{ fontSize: `${Math.round(props.fontSize * 0.62)}px` }">
      —— {{ from }}
    </figcaption>
  </figure>
</template>

<style scoped>
.quote {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
  margin: 0;
}
.quote__mark {
  line-height: 0.8;
  opacity: 0.28;
  font-family: Georgia, 'Songti SC', serif;
}
.quote__text {
  margin: 0;
  font-weight: 500;
  line-height: 1.7;
  letter-spacing: 0.01em;
}
.quote__line {
  margin: 0;
  /* 行末标点贴到边界时，浏览器的 CJK 挤压会把它挤到行盒外，
     看起来就像下一行以标点开头。留出半个字，别让它贴边。 */
  padding-right: 0.5em;
}
.quote__md {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  line-height: 1.78;
}
.quote__h {
  margin: 0.1em 0 0;
  font-weight: 700;
  font-size: 1.14em;
}
.quote__p {
  margin: 0;
}
.quote__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.28em;
}
.quote__list li {
  display: flex;
  gap: 0.5em;
}
.quote__bullet {
  opacity: 0.5;
}
.quote__sub {
  margin: 0;
  padding-left: 0.7em;
  border-left: 2px solid currentColor;
  opacity: 0.82;
}
.quote__code {
  font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 0.86em;
  padding: 0.08em 0.34em;
  border-radius: 4px;
  background: currentColor;
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.quote__from {
  margin: 0;
  opacity: 0.66;
  text-align: right;
}
</style>
